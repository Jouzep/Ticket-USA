"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";

import { Skeleton } from "@/components/atoms/skeleton";
import { CancelControl } from "@/components/molecules/cancel-control";
import { JobMetaFooter } from "@/components/molecules/job-meta-footer";
import { ProgressBar } from "@/components/molecules/progress-bar";
import { ResultsTable } from "@/components/organisms/results-table";
import { StatsSummary } from "@/components/organisms/stats-summary";
import { UploadZone } from "@/components/organisms/upload-zone";
import { useCancelJob } from "@/hooks/use-cancel-job";
import { ApiError } from "@/hooks/use-client-query";
import { useScrapingStream } from "@/hooks/use-scraping-stream";
import type { StreamStatus } from "@/types/events";

// Defer framer-motion until a job is created (it's only inside <LiveFeed/>)
const LiveFeed = dynamic(
  () => import("@/components/organisms/live-feed").then((m) => m.LiveFeed),
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
  const cancelJob = useCancelJob();

  const onCancel = () => {
    cancelJob.mutate(jobId, {
      onSuccess: () => toast.info("Cancellation requested"),
      onError: (err) => {
        const msg = err instanceof ApiError ? err.message : String(err);
        toast.error("Cancel failed", { description: msg });
      },
    });
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

      {isRunning ? (
        <CancelControl
          onCancel={onCancel}
          disabled={cancelJob.isPending}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr,1.4fr]">
        <LiveFeed events={stream.events} />
        <ResultsTable results={stream.results} />
      </div>

      <JobMetaFooter jobId={jobId} disabled={isRunning} onReset={onReset} />
    </>
  );
}
