"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Search, ShieldAlert, XCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { formatTime, formatUsd } from "@/lib/utils";
import type { FeedEntry } from "@/types/events";

export function LiveFeed({ events }: { events: FeedEntry[] }) {
  const hasEvents = events.length > 0;
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
        <div>
          <h3 className="font-semibold tracking-tight">Live Feed</h3>
          <p className="text-xs text-ink-500">
            Most recent activity from the scraper
          </p>
        </div>
        {hasEvents ? (
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700 tabular">
            {events.length}
          </span>
        ) : null}
      </div>
      <div
        className="flex-1 overflow-y-auto scrollbar-slim px-2 py-3"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Scraping events feed"
      >
        {hasEvents ? (
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {events.map((entry, i) => (
                <motion.li
                  key={`${entry.ticketId}-${entry.at}-${i}`}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-ink-50"
                >
                  <Glyph kind={entry.kind} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-tight text-ink-900 break-words">
                      {messageFor(entry)}
                    </p>
                    <p
                      translate="no"
                      className="mt-0.5 font-mono text-[11px] text-ink-400 tabular"
                    >
                      {entry.ticketId} · {formatTime(entry.at)}
                    </p>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <div className="flex h-full min-h-[12rem] items-center justify-center text-center">
            <div>
              <p className="text-sm text-ink-500">Waiting for events…</p>
              <p className="mt-1 text-xs text-ink-400">
                Activity will appear here as tickets are processed.
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function Glyph({ kind }: { kind: FeedEntry["kind"] }) {
  const base =
    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full";
  switch (kind) {
    case "searching":
      return (
        <span aria-hidden className={`${base} bg-brand-100 text-brand-700`}>
          <Search className="h-3.5 w-3.5 animate-pulse-soft motion-reduce:animate-none" />
        </span>
      );
    case "found":
      return (
        <span aria-hidden className={`${base} bg-success-100 text-success-700`}>
          <CheckCircle2 className="h-3.5 w-3.5" />
        </span>
      );
    case "not_found":
      return (
        <span aria-hidden className={`${base} bg-ink-100 text-ink-500`}>
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
      );
    case "captcha":
      return (
        <span aria-hidden className={`${base} bg-warning-100 text-warning-700`}>
          <ShieldAlert className="h-3.5 w-3.5" />
        </span>
      );
    case "error":
      return (
        <span aria-hidden className={`${base} bg-danger-100 text-danger-700`}>
          <XCircle className="h-3.5 w-3.5" />
        </span>
      );
  }
}

function messageFor(entry: FeedEntry): string {
  switch (entry.kind) {
    case "searching":
      return `Searching ticket #${entry.ticketId}…`;
    case "found":
      return `Found — ${formatUsd(entry.amount)} due`;
    case "not_found":
      return "No record found";
    case "captcha":
      return "Blocked by CAPTCHA — skipped";
    case "error":
      return `Error: ${entry.error}`;
  }
}
