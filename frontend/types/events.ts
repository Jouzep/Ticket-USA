// Mirror of backend/app/core/events.py + schemas.py
// Keep in sync manually (small surface, low churn).

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export type StreamStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "reconnecting"
  | "done"
  | "cancelled"
  | "failed";

export type ScraperMode = "mock" | "real";

export type TicketStatusValue =
  | "OPEN"
  | "PAID IN FULL"
  | "PARTIAL"
  | "DISMISSED"
  | "UNKNOWN";

export interface TicketResult {
  ticket_id: string;
  summons_number: string | null;
  violation_code: string | null;
  violation_description: string | null;
  issue_date: string | null;
  plate: string | null;
  state: string | null;
  fine_amount: number;
  penalty: number;
  interest: number;
  reduction: number;
  paid: number;
  amount_due: number;
  status: TicketStatusValue;
}

export interface JobSummary {
  total: number;
  found: number;
  not_found: number;
  errors: number;
  captcha_blocked: number;
  total_amount_due: number;
}

export interface JobSnapshot {
  id: string;
  status: JobStatus;
  total_tickets: number;
  progress: number;
  created_at: string;
  completed_at: string | null;
  summary: JobSummary;
  results: TicketResult[];
}

export interface JobCreateResponse {
  job_id: string;
  total_tickets: number;
  status: JobStatus;
}

export interface HealthResponse {
  status: "ok";
  version: string;
  scraper_mode: ScraperMode;
  available_modes: ScraperMode[];
  claude_enabled: boolean;
}

// SSE event payloads
export type FeedEntry =
  | { kind: "searching"; ticketId: string; at: number }
  | { kind: "found"; ticketId: string; amount: number; at: number }
  | { kind: "not_found"; ticketId: string; at: number }
  | { kind: "error"; ticketId: string; error: string; at: number }
  | { kind: "captcha"; ticketId: string; at: number };

export interface ApiErrorBody {
  error?: string;
  message?: string;
  validation_errors?: Array<{
    row: number;
    field: string | null;
    message: string;
  }>;
  detail?: ApiErrorBody | string;
}
