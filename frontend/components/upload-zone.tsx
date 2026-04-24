"use client";

import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCsvUpload } from "@/hooks/use-csv-upload";
import { useHealth } from "@/hooks/use-health";
import { ApiError, createJob } from "@/lib/api-client";
import { downloadSampleCsv } from "@/lib/sample-csv";
import { cn } from "@/lib/utils";
import type { ScraperMode } from "@/types/events";

interface Props {
  onJobCreated: (jobId: string, totalTickets: number) => void;
}

export function UploadZone({ onJobCreated }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const helpId = useId();
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scraperMode, setScraperMode] = useState<ScraperMode>("mock");
  const { file, preview, error, parsing, parseFile, reset } = useCsvUpload();
  const { health } = useHealth();

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      void parseFile(files[0]);
    },
    [parseFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const onSubmit = useCallback(async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      const res = await createJob(file, scraperMode);
      toast.success(
        `Job started — ${res.total_tickets} tickets queued (${scraperMode})`,
      );
      onJobCreated(res.job_id, res.total_tickets);
      reset();
    } catch (err) {
      if (err instanceof ApiError) {
        const validations = err.validationErrors;
        if (validations.length > 0) {
          toast.error(
            `CSV validation failed (${validations.length} error${validations.length > 1 ? "s" : ""})`,
            {
              description: validations
                .slice(0, 3)
                .map((v) => `Row ${v.row}: ${v.message}`)
                .join("\n"),
            },
          );
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error("Upload failed", { description: String(err) });
      }
    } finally {
      setSubmitting(false);
    }
  }, [file, onJobCreated, reset, scraperMode]);

  const hasMissing = preview ? preview.missingColumns.length > 0 : false;
  const canSubmit = Boolean(file && preview && !hasMissing && !submitting);
  const realAvailable = health?.available_modes.includes("real") ?? false;

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Upload Tickets CSV
          </h2>
          <p id={helpId} className="mt-1 text-sm text-ink-500">
            Required columns:{" "}
            <span translate="no" className="font-mono text-xs">
              ticket_id, first_name, last_name, dob
            </span>
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadSampleCsv}
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Sample CSV
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download a 10-row example</TooltipContent>
        </Tooltip>
      </div>

      <ScraperToggle
        value={scraperMode}
        onChange={setScraperMode}
        realAvailable={realAvailable}
      />

      <div
        role="button"
        tabIndex={parsing ? -1 : 0}
        aria-describedby={helpId}
        aria-busy={parsing}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "mt-4 flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors motion-reduce:transition-none",
          dragOver
            ? "border-brand-500 bg-brand-50"
            : "border-ink-300 bg-ink-50/50 hover:border-brand-400 hover:bg-brand-50/40",
          parsing ? "pointer-events-none opacity-70" : "",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          aria-label="Choose a CSV file to upload"
        />
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700"
        >
          {parsing ? (
            <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" />
          ) : (
            <Upload className="h-6 w-6" />
          )}
        </span>
        <span>
          <span className="block font-medium text-ink-900">
            {dragOver ? "Drop your file" : "Drag a CSV here, or click to browse"}
          </span>
          <span className="mt-1 block text-xs text-ink-500">
            Max 5&nbsp;MB · UTF-8 recommended
          </span>
        </span>
      </div>

      {error ? (
        <Alert variant="destructive" aria-live="polite" className="mt-4">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {preview ? (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-ink-200 bg-ink-50/60 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <FileSpreadsheet
                className="h-5 w-5 shrink-0 text-brand-600"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">
                  {preview.fileName}
                </p>
                <p className="text-xs text-ink-500">
                  {preview.rowCount}+ rows previewed
                </p>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove file"
                  onClick={(e) => {
                    e.stopPropagation();
                    reset();
                  }}
                  className="h-9 w-9 rounded-full text-ink-400 hover:text-ink-700"
                >
                  <X aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove file</TooltipContent>
            </Tooltip>
          </div>

          {hasMissing ? (
            <Alert variant="warning" aria-live="polite">
              <AlertCircle />
              <AlertDescription>
                Missing columns:{" "}
                <span translate="no" className="font-mono">
                  {preview.missingColumns.join(", ")}
                </span>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="success" role="status" aria-live="polite">
              <CheckCircle2 />
              <AlertDescription>CSV looks good — ready to import</AlertDescription>
            </Alert>
          )}

          {preview.preview.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-ink-200">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-9 px-3 normal-case">ticket_id</TableHead>
                    <TableHead className="h-9 px-3 normal-case">first_name</TableHead>
                    <TableHead className="h-9 px-3 normal-case">last_name</TableHead>
                    <TableHead className="h-9 px-3 normal-case">dob</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.preview.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell
                        translate="no"
                        className="px-3 py-2 font-mono text-brand-700"
                      >
                        {row.ticket_id ?? "—"}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        {row.first_name ?? "—"}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        {row.last_name ?? "—"}
                      </TableCell>
                      <TableCell className="px-3 py-2">{row.dob ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <Badge variant="neutral">
              {scraperMode === "mock"
                ? "Mock scraper · ~1.2s/ticket"
                : "Real DMV · Playwright"}
            </Badge>
            <Button
              variant="primary"
              size="lg"
              disabled={!canSubmit}
              onClick={onSubmit}
            >
              {submitting ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden
                  />
                  Starting…
                </>
              ) : (
                <>Start Scraping</>
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

interface ScraperToggleProps {
  value: ScraperMode;
  onChange: (mode: ScraperMode) => void;
  realAvailable: boolean;
}

function ScraperToggle({ value, onChange, realAvailable }: ScraperToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Scraper mode"
      className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-ink-200 bg-ink-50/40 p-2"
    >
      <span className="ml-2 text-xs font-medium uppercase tracking-wide text-ink-500">
        Scraper mode
      </span>
      <ModeButton
        checked={value === "mock"}
        onClick={() => onChange("mock")}
        label="Mock"
        hint="Fast, deterministic, always returns results"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <ModeButton
              checked={value === "real"}
              onClick={() => onChange("real")}
              label="Real DMV"
              hint={
                realAvailable
                  ? "Playwright against process.dmv.ny.gov (F5 will block most requests)"
                  : "Disabled on this backend — set SCRAPER_MODE=real"
              }
              disabled={!realAvailable}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {realAvailable
            ? "DMV site is behind F5 anti-bot — expect CAPTCHA_BLOCKED"
            : "Start the backend with SCRAPER_MODE=real to enable"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

interface ModeButtonProps {
  checked: boolean;
  onClick: () => void;
  label: string;
  hint: string;
  disabled?: boolean;
}

function ModeButton({ checked, onClick, label, hint, disabled }: ModeButtonProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={`${label} — ${hint}`}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors motion-reduce:transition-none",
        checked
          ? "bg-brand-700 text-white shadow-sm"
          : "text-ink-700 hover:bg-white hover:text-ink-900",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
      )}
    >
      {label}
    </button>
  );
}
