import { FileSpreadsheet } from "lucide-react";

import { Card } from "@/components/ui/card";

export function EmptyState() {
  return (
    <Card className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700"
      >
        <FileSpreadsheet className="h-7 w-7" />
      </span>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink-900">
        Ready when you are
      </h3>
      <p className="mt-2 max-w-md text-pretty text-sm text-ink-500">
        Upload a CSV of ticket IDs above. The dashboard will stream live progress
        as we look up each ticket on the NY DMV.
      </p>
    </Card>
  );
}
