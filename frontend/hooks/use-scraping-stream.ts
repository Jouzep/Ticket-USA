"use client";

import { useEffect, useRef, useState } from "react";

import { PUBLIC_API_URL } from "@/lib/env";
import type { FeedEntry, StreamStatus, TicketResult } from "@/types/events";

interface ScrapingStreamState {
  status: StreamStatus;
  events: FeedEntry[];
  results: TicketResult[];
  progress: { completed: number; total: number };
  summary: {
    found: number;
    notFound: number;
    errors: number;
    captcha: number;
    totalAmountDue: number;
  };
  error: string | null;
}

const initialState: ScrapingStreamState = {
  status: "idle",
  events: [],
  results: [],
  progress: { completed: 0, total: 0 },
  summary: { found: 0, notFound: 0, errors: 0, captcha: 0, totalAmountDue: 0 },
  error: null,
};

const TERMINAL: StreamStatus[] = ["done", "cancelled", "failed"];

/**
 * Subscribes to the FastAPI SSE stream for a job. Direct connection from the
 * browser — bypasses Next.js route handler to avoid Vercel SSE timeouts.
 *
 * EventSource handles Last-Event-ID automatically on reconnection.
 */
export function useScrapingStream(jobId: string | null) {
  const [state, setState] = useState<ScrapingStreamState>(initialState);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) {
      setState(initialState);
      return;
    }

    setState({ ...initialState, status: "connecting" });

    const url = `${PUBLIC_API_URL}/jobs/${jobId}/stream`;
    const es = new EventSource(url);
    esRef.current = es;

    const safe =
      <T,>(handler: (data: T) => void) =>
      (e: MessageEvent) => {
        try {
          handler(JSON.parse(e.data) as T);
        } catch (err) {
          console.error("[SSE] invalid payload", err, e.data);
        }
      };

    es.addEventListener("open", () => {
      setState((s) => (TERMINAL.includes(s.status) ? s : { ...s, status: "streaming" }));
    });

    es.addEventListener(
      "job.started",
      safe<{ total: number }>((d) =>
        setState((s) => ({
          ...s,
          status: "streaming",
          progress: { ...s.progress, total: d.total },
        })),
      ),
    );

    es.addEventListener(
      "ticket.searching",
      safe<{ ticket_id: string }>((d) =>
        setState((s) => ({
          ...s,
          events: upsertByTicket(s.events, {
            kind: "searching",
            ticketId: d.ticket_id,
            at: Date.now(),
          }),
        })),
      ),
    );

    es.addEventListener(
      "ticket.found",
      safe<{ ticket_id: string; result: TicketResult }>((d) =>
        setState((s) => ({
          ...s,
          results: [...s.results, d.result],
          summary: {
            ...s.summary,
            found: s.summary.found + 1,
            totalAmountDue: s.summary.totalAmountDue + (d.result.amount_due ?? 0),
          },
          events: upsertByTicket(s.events, {
            kind: "found",
            ticketId: d.ticket_id,
            amount: d.result.amount_due ?? 0,
            at: Date.now(),
          }),
        })),
      ),
    );

    es.addEventListener(
      "ticket.not_found",
      safe<{ ticket_id: string }>((d) =>
        setState((s) => ({
          ...s,
          summary: { ...s.summary, notFound: s.summary.notFound + 1 },
          events: upsertByTicket(s.events, {
            kind: "not_found",
            ticketId: d.ticket_id,
            at: Date.now(),
          }),
        })),
      ),
    );

    es.addEventListener(
      "ticket.error",
      safe<{ ticket_id: string; error: string }>((d) =>
        setState((s) => ({
          ...s,
          summary: { ...s.summary, errors: s.summary.errors + 1 },
          events: upsertByTicket(s.events, {
            kind: "error",
            ticketId: d.ticket_id,
            error: d.error,
            at: Date.now(),
          }),
        })),
      ),
    );

    es.addEventListener(
      "ticket.captcha_blocked",
      safe<{ ticket_id: string }>((d) =>
        setState((s) => ({
          ...s,
          summary: { ...s.summary, captcha: s.summary.captcha + 1 },
          events: upsertByTicket(s.events, {
            kind: "captcha",
            ticketId: d.ticket_id,
            at: Date.now(),
          }),
        })),
      ),
    );

    es.addEventListener(
      "job.progress",
      safe<{ completed: number; total: number }>((d) =>
        setState((s) => ({ ...s, progress: { completed: d.completed, total: d.total } })),
      ),
    );

    es.addEventListener("job.complete", () => {
      setState((s) => ({ ...s, status: "done" }));
      es.close();
    });

    es.addEventListener("job.cancelled", () => {
      setState((s) => ({ ...s, status: "cancelled" }));
      es.close();
    });

    es.addEventListener(
      "job.failed",
      safe<{ error: string }>((d) => {
        setState((s) => ({ ...s, status: "failed", error: d.error }));
        es.close();
      }),
    );

    es.onerror = () => {
      setState((s) => {
        if (TERMINAL.includes(s.status)) return s;
        return { ...s, status: "reconnecting" };
      });
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [jobId]);

  return state;
}

const FEED_CAP = 200;

/**
 * One feed entry per ticket: when a terminal event arrives for a ticket
 * we already showed as "Searching…", replace the stale entry in place.
 * Most recent activity bubbles to the top.
 */
function upsertByTicket(events: FeedEntry[], next: FeedEntry): FeedEntry[] {
  const filtered = events.filter((e) => e.ticketId !== next.ticketId);
  const updated = [next, ...filtered];
  return updated.length > FEED_CAP ? updated.slice(0, FEED_CAP) : updated;
}
