import type * as React from "react";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  shimmer?: React.ReactNode;
  label?: string;
}

/**
 * Animates `transform: scaleX(...)` (compositor-only) instead of `width`
 * (layout) for smoother performance and to satisfy the
 * "animate transform/opacity only" rule.
 *
 * Optional `shimmer` slot lets callers compose an effect element (instead of
 * receiving a boolean prop that switches behavior).
 */
export function Progress({
  value,
  max = 100,
  shimmer,
  className,
  label,
  ...props
}: ProgressProps) {
  const ratio = max === 0 ? 0 : Math.min(1, Math.max(0, value / max));
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn(
        "relative h-2.5 w-full overflow-hidden rounded-full bg-ink-100",
        className,
      )}
      {...props}
    >
      <div
        className="h-full origin-left rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `scaleX(${ratio})` }}
      />
      {shimmer}
    </div>
  );
}

export function ProgressShimmer() {
  return (
    <div
      aria-hidden
      className="progress-shimmer pointer-events-none absolute inset-0 animate-shimmer rounded-full motion-reduce:hidden"
    />
  );
}
