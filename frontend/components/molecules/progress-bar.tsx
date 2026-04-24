import { Activity, CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Card } from "@/components/atoms/card";
import { Progress, ProgressShimmer } from "@/components/atoms/progress";
import type { StreamStatus } from "@/types/events";

interface Props {
  completed: number;
  total: number;
  status: StreamStatus;
}

const STATUS_LABEL: Record<StreamStatus, string> = {
  idle: "Idle",
  connecting: "Connecting…",
  streaming: "Scraping in progress",
  reconnecting: "Reconnecting…",
  done: "Scraping complete",
  cancelled: "Cancelled",
  failed: "Failed",
};

const ANIMATING_STATUSES = new Set<StreamStatus>(["streaming", "reconnecting"]);

export function ProgressBar({ completed, total, status }: Props) {
  const safeTotal = total === 0 ? 1 : total;
  const pct = (completed / safeTotal) * 100;
  const isAnimating = ANIMATING_STATUSES.has(status) && pct > 0 && pct < 100;
  const ticketLabel = total === 1 ? "ticket" : "tickets";

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <StatusIcon status={status} />
          <div>
            <p className="text-sm font-semibold text-ink-900">
              {STATUS_LABEL[status]}
            </p>
            <p className="text-xs text-ink-500 tabular">
              {completed} of {total} {ticketLabel} processed
            </p>
          </div>
        </div>
        <p className="font-mono text-sm font-semibold text-brand-700 tabular">
          {pct.toFixed(0)}%
        </p>
      </div>
      <div className="mt-4">
        <Progress
          value={completed}
          max={safeTotal}
          label={`Scraping progress: ${completed} of ${total}`}
          shimmer={isAnimating ? <ProgressShimmer /> : null}
        />
      </div>
    </Card>
  );
}

function StatusIcon({ status }: { status: StreamStatus }) {
  switch (status) {
    case "done":
      return (
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full bg-success-100 text-success-700"
        >
          <CheckCircle2 className="h-5 w-5" />
        </span>
      );
    case "failed":
    case "cancelled":
      return (
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full bg-danger-100 text-danger-700"
        >
          <XCircle className="h-5 w-5" />
        </span>
      );
    case "reconnecting":
      return (
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full bg-warning-100 text-warning-700"
        >
          <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        </span>
      );
    case "streaming":
    case "connecting":
      return (
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700"
        >
          <Activity className="h-5 w-5 animate-pulse-soft motion-reduce:animate-none" />
        </span>
      );
    default:
      return (
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-ink-500"
        >
          <Activity className="h-5 w-5" />
        </span>
      );
  }
}
