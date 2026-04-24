"use client";

import { StopCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";

import { ProgressBar } from "@/components/progress-bar";
import { ResultsTable } from "@/components/results-table";
import { StatsSummary } from "@/components/stats-summary";
import { UploadZone } from "@/components/upload-zone";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useScrapingStream } from "@/hooks/use-scraping-stream";
import { ApiError, cancelJob } from "@/lib/api-client";
import type { StreamStatus } from "@/types/events";

// Defer framer-motion until a job is created (it's only inside <LiveFeed/>)
const LiveFeed = dynamic(
  () => import("@/components/live-feed").then((m) => m.LiveFeed),
  {
    ssr: false,
    loading: () => <Skeleton className="h-72 rounded-2xl" />,
  },
);

const RUNNING_STATUSES = new Set<StreamStatus>([
  "streaming",
  "connecting",
  "reconnecting",
]);

interface ActiveJob {
  id: string;
  totalTickets: number;
}

export function Dashboard() {
  const [job, setJob] = useState<ActiveJob | null>(null);
  const stream = useScrapingStream(job?.id ?? null);

  return (
    <div className="space-y-8">
      <UploadZone
        onJobCreated={(id, total) => setJob({ id, totalTickets: total })}
      />

      {job ? (
        <ActiveJobView
          jobId={job.id}
          totalTickets={job.totalTickets}
          stream={stream}
          onReset={() => setJob(null)}
        />
      ) : (
        <IdleView />
      )}
    </div>
  );
}

function IdleView() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <LiveFeed events={[]} />
      <ResultsTable results={[]} />
    </div>
  );
}

interface ActiveJobViewProps {
  jobId: string;
  totalTickets: number;
  stream: ReturnType<typeof useScrapingStream>;
  onReset: () => void;
}

function ActiveJobView({
  jobId,
  totalTickets,
  stream,
  onReset,
}: ActiveJobViewProps) {
  const isRunning = RUNNING_STATUSES.has(stream.status);

  const onCancel = async () => {
    try {
      await cancelJob(jobId);
      toast.info("Cancellation requested");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      toast.error("Cancel failed", { description: msg });
    }
  };

  return (
    <>
      <ProgressBar
        completed={stream.progress.completed}
        total={stream.progress.total || totalTickets}
        status={stream.status}
      />

      <StatsSummary
        found={stream.summary.found}
        notFound={stream.summary.notFound}
        errors={stream.summary.errors}
        captcha={stream.summary.captcha}
        totalAmountDue={stream.summary.totalAmountDue}
      />

      {isRunning ? <CancelControl onCancel={onCancel} /> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr,1.4fr]">
        <LiveFeed events={stream.events} />
        <ResultsTable results={stream.results} />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-ink-200 bg-white px-4 py-3">
        <p className="text-xs text-ink-500">
          Job ID:{" "}
          <span translate="no" className="font-mono text-ink-700">
            {jobId}
          </span>
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={isRunning}
        >
          Start another job
        </Button>
      </div>
    </>
  );
}

function CancelControl({ onCancel }: { onCancel: () => void | Promise<void> }) {
  return (
    <div className="flex justify-end">
      <Button variant="secondary" size="sm" onClick={onCancel}>
        <StopCircle className="h-4 w-4" aria-hidden />
        Cancel Job
      </Button>
    </div>
  );
}
