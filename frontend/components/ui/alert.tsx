import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[1rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5",
  {
    variants: {
      variant: {
        default: "border-ink-200 bg-white text-ink-900 [&>svg]:text-ink-500",
        info: "border-info-100 bg-info-100/40 text-info-700 [&>svg]:text-info-500",
        success:
          "border-success-100 bg-success-100/40 text-success-700 [&>svg]:text-success-500",
        warning:
          "border-warning-100 bg-warning-100/40 text-warning-700 [&>svg]:text-warning-500",
        destructive:
          "border-danger-100 bg-danger-100/40 text-danger-700 [&>svg]:text-danger-500",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  );
}

export function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("col-start-2 grid justify-items-start gap-1 text-sm", className)}
      {...props}
    />
  );
}
