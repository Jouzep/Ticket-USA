"use client";

import { Button } from "@/components/atoms/button";

interface Props {
  jobId: string;
  disabled?: boolean;
  onReset: () => void;
}

export function JobMetaFooter({ jobId, disabled = false, onReset }: Props) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-200 bg-white px-4 py-3">
      <p className="text-xs text-ink-500">
        Job ID:{" "}
        <span translate="no" className="font-mono text-ink-700">
          {jobId}
        </span>
      </p>
      <Button variant="ghost" size="sm" onClick={onReset} disabled={disabled}>
        Start another job
      </Button>
    </div>
  );
}
