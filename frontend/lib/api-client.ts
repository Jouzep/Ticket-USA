"use client";

import { PUBLIC_API_URL } from "@/lib/env";
import type {
  ApiErrorBody,
  HealthResponse,
  JobCreateResponse,
  JobSnapshot,
  ScraperMode,
} from "@/types/events";

export class ApiError extends Error {
  constructor(public status: number, public body: ApiErrorBody) {
    const detail =
      (typeof body.detail === "object" ? body.detail : null) ?? body;
    const message =
      (detail.message as string | undefined) ??
      (typeof body.detail === "string" ? body.detail : null) ??
      `Request failed with status ${status}`;
    super(message);
    this.name = "ApiError";
  }

  get validationErrors() {
    const detail = (typeof this.body.detail === "object" ? this.body.detail : null) ?? this.body;
    return detail.validation_errors ?? [];
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody = {};
  try {
    body = await res.json();
  } catch {
    body = { message: res.statusText };
  }
  return new ApiError(res.status, body);
}

export async function createJob(
  file: File,
  scraperMode?: ScraperMode,
): Promise<JobCreateResponse> {
  const fd = new FormData();
  fd.append("file", file);
  if (scraperMode) fd.append("scraper_mode", scraperMode);
  const res = await fetch(`${PUBLIC_API_URL}/jobs`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function getJob(jobId: string): Promise<JobSnapshot> {
  const res = await fetch(`${PUBLIC_API_URL}/jobs/${jobId}`);
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function cancelJob(jobId: string): Promise<void> {
  const res = await fetch(`${PUBLIC_API_URL}/jobs/${jobId}`, { method: "DELETE" });
  if (!res.ok) throw await parseError(res);
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${PUBLIC_API_URL}/health`);
  if (!res.ok) throw await parseError(res);
  return res.json();
}
