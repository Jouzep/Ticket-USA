import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  type LucideIcon,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn, formatUsd } from "@/lib/utils";

interface SummaryProps {
  found: number;
  notFound: number;
  errors: number;
  captcha: number;
  totalAmountDue: number;
}

const TONE = {
  success: "bg-success-100 text-success-700",
  ink: "bg-ink-100 text-ink-500",
  danger: "bg-danger-100 text-danger-700",
  warning: "bg-warning-100 text-warning-700",
  brand: "bg-brand-100 text-brand-700",
} as const;

type Tone = keyof typeof TONE;

interface StatProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: Tone;
}

function Stat({ icon: Icon, label, value, tone }: StatProps) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <span
        aria-hidden
        className={cn("flex h-11 w-11 items-center justify-center rounded-xl", TONE[tone])}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-ink-500">
          {label}
        </p>
        <p className="mt-0.5 text-xl font-semibold tabular text-ink-900">
          {value}
        </p>
      </div>
    </Card>
  );
}

export function StatsSummary({
  found,
  notFound,
  errors,
  captcha,
  totalAmountDue,
}: SummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-5">
      <Stat icon={CheckCircle2} label="Found" value={found} tone="success" />
      <Stat icon={AlertTriangle} label="Not Found" value={notFound} tone="ink" />
      <Stat icon={XCircle} label="Errors" value={errors} tone="danger" />
      <Stat icon={ShieldAlert} label="CAPTCHA" value={captcha} tone="warning" />
      <Stat
        icon={DollarSign}
        label="Total Due"
        value={formatUsd(totalAmountDue)}
        tone="brand"
      />
    </div>
  );
}
