"use client";

import { ArrowDown, ArrowUp, Download, Inbox } from "lucide-react";
import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { downloadResultsCsv } from "@/lib/csv-export";
import { cn, formatUsd } from "@/lib/utils";
import type { TicketResult } from "@/types/events";

type SortKey = "ticket_id" | "status" | "amount_due" | "issue_date";

interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

interface Column {
  key: SortKey;
  label: string;
  align?: "right";
}

const COLUMNS: readonly Column[] = [
  { key: "ticket_id", label: "Ticket" },
  { key: "status", label: "Status" },
  { key: "issue_date", label: "Issue date" },
  { key: "amount_due", label: "Amount due", align: "right" },
];

export function ResultsTable({ results }: { results: TicketResult[] }) {
  const [sort, setSort] = useState<SortState>({ key: "amount_due", dir: "desc" });

  const sorted = useMemo(
    () =>
      results.toSorted((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av ?? "").localeCompare(String(bv ?? ""));
        return sort.dir === "asc" ? cmp : -cmp;
      }),
    [results, sort],
  );

  const onSort = (key: SortKey) =>
    setSort((s) => ({
      key,
      dir: s.key === key ? (s.dir === "asc" ? "desc" : "asc") : "asc",
    }));

  const ticketWord = results.length === 1 ? "ticket" : "tickets";
  const isEmpty = results.length === 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
        <div>
          <h3 className="font-semibold tracking-tight">Results</h3>
          <p className="text-xs text-ink-500">
            {results.length} {ticketWord} found
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              disabled={isEmpty}
              onClick={() => downloadResultsCsv(results)}
            >
              <Download className="h-4 w-4" aria-hidden />
              Export CSV
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download all results as a CSV file</TooltipContent>
        </Tooltip>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-400"
          >
            <Inbox className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-medium text-ink-900">
            No results yet
          </p>
          <p className="mt-1 max-w-xs text-pretty text-xs text-ink-500">
            Found tickets will appear here as the scraper processes your CSV.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => {
                const isSorted = sort.key === col.key;
                const ariaSort = isSorted
                  ? sort.dir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none";
                return (
                  <TableHead
                    key={col.key}
                    aria-sort={ariaSort}
                    className={cn(col.align === "right" ? "text-right" : "")}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onSort(col.key)}
                          aria-label={`Sort by ${col.label}`}
                          className={cn(
                            "inline-flex items-center gap-1 transition-colors hover:text-ink-900 motion-reduce:transition-none",
                            col.align === "right" ? "ml-auto" : "",
                          )}
                        >
                          {col.label}
                          {isSorted ? (
                            sort.dir === "asc" ? (
                              <ArrowUp className="h-3 w-3" aria-hidden />
                            ) : (
                              <ArrowDown className="h-3 w-3" aria-hidden />
                            )
                          ) : null}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Sort by {col.label.toLowerCase()}
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                );
              })}
              <TableHead>Violation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => (
              <TableRow key={r.ticket_id}>
                <TableCell>
                  <span
                    translate="no"
                    className="font-mono text-xs text-brand-700"
                  >
                    {r.ticket_id}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell className="text-ink-500 tabular">
                  {r.issue_date ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      "font-mono text-sm font-semibold tabular",
                      r.amount_due > 0 ? "text-danger-700" : "text-ink-500",
                    )}
                  >
                    {formatUsd(r.amount_due)}
                  </span>
                </TableCell>
                <TableCell className="text-ink-700">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm text-pretty">
                      {r.violation_description ?? "—"}
                    </span>
                    {r.violation_code ? (
                      <span className="text-xs text-ink-400">
                        Code {r.violation_code}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
