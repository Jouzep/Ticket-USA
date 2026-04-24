import type * as React from "react";

import { cn } from "@/lib/utils";

type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  ref?: React.Ref<HTMLTableElement>;
};
type SectionProps = React.HTMLAttributes<HTMLTableSectionElement> & {
  ref?: React.Ref<HTMLTableSectionElement>;
};
type RowProps = React.HTMLAttributes<HTMLTableRowElement> & {
  ref?: React.Ref<HTMLTableRowElement>;
};
type ThProps = React.ThHTMLAttributes<HTMLTableCellElement> & {
  ref?: React.Ref<HTMLTableCellElement>;
};
type TdProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
  ref?: React.Ref<HTMLTableCellElement>;
};

export function Table({ className, ref, ...props }: TableProps) {
  return (
    <div className="relative w-full overflow-auto scrollbar-slim">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ref, ...props }: SectionProps) {
  return (
    <thead
      ref={ref}
      className={cn(
        "sticky top-0 z-10 bg-ink-50/80 backdrop-blur supports-[backdrop-filter]:bg-ink-50/70 [&_tr]:border-b",
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ref, ...props }: SectionProps) {
  return (
    <tbody
      ref={ref}
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

export function TableRow({ className, ref, ...props }: RowProps) {
  return (
    <tr
      ref={ref}
      className={cn(
        "border-b border-ink-200 transition-colors hover:bg-brand-50/40 data-[state=selected]:bg-brand-50 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ref, ...props }: ThProps) {
  return (
    <th
      ref={ref}
      className={cn(
        "h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-ink-500",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ref, ...props }: TdProps) {
  return (
    <td
      ref={ref}
      className={cn("px-4 py-3 align-middle text-sm text-ink-700", className)}
      {...props}
    />
  );
}
