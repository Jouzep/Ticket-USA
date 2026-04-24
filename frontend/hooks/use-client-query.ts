import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import type { ApiErrorBody } from "@/types/events";

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
    const detail =
      (typeof this.body.detail === "object" ? this.body.detail : null) ??
      this.body;
    return detail.validation_errors ?? [];
  }
}

export const handleFetchResponse = async <T>(
  response: Response,
  defaultErrorMessage: string,
): Promise<T> => {
  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = await response.json();
    } catch {
      body = { message: response.statusText || defaultErrorMessage };
    }
    throw new ApiError(response.status, body);
  }

  if (
    response.status === 204 ||
    response.headers.get("content-length") === "0"
  ) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

export const fetcher = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  return handleFetchResponse<T>(response, "Failed to fetch data");
};

type MutationFetcherOptions<TBody = unknown> = {
  url: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: TBody;
  defaultErrorMessage?: string;
};

export const mutationFetcher = async <TResponse, TBody = unknown>({
  url,
  method = "POST",
  body,
  defaultErrorMessage = "An error occurred",
}: MutationFetcherOptions<TBody>): Promise<TResponse> => {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  return handleFetchResponse<TResponse>(response, defaultErrorMessage);
};

/**
 * Multipart variant for file uploads — browser sets the Content-Type
 * (including boundary) automatically when body is FormData.
 */
export const multipartFetcher = async <TResponse>({
  url,
  method = "POST",
  formData,
  defaultErrorMessage = "Upload failed",
}: {
  url: string;
  method?: "POST" | "PUT" | "PATCH";
  formData: FormData;
  defaultErrorMessage?: string;
}): Promise<TResponse> => {
  const response = await fetch(url, { method, body: formData });
  return handleFetchResponse<TResponse>(response, defaultErrorMessage);
};

type UseClientQueryProps<T> = {
  keys: readonly unknown[];
  url: string;
  /** Query string params — null/undefined entries are skipped. */
  params?: Record<string, unknown>;
  options?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">;
};

export const useClientQuery = <T>({
  keys,
  url,
  params,
  options,
}: UseClientQueryProps<T>) => {
  let fullUrl = url;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    if (qs) fullUrl = `${url}?${qs}`;
  }
  return useQuery({
    queryKey: keys,
    queryFn: () => fetcher<T>(fullUrl),
    ...options,
  });
};
