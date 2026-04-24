"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Theme-aware Sonner wrapper. We're light-mode only, so we hardcode "light"
 * and let global CSS pick up the brand-aligned styles.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-2xl border border-border bg-white text-ink-900 shadow-card font-sans",
          description: "text-ink-500",
          actionButton: "bg-brand-700 text-white",
          cancelButton: "bg-ink-100 text-ink-700",
        },
      }}
      {...props}
    />
  );
}
