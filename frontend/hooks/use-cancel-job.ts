import { useMutation } from "@tanstack/react-query";

import { PUBLIC_API_URL } from "@/lib/env";

import { mutationFetcher } from "./use-client-query";

export const useCancelJob = () =>
  useMutation<void, Error, string>({
    mutationFn: (jobId) =>
      mutationFetcher<void>({
        url: `${PUBLIC_API_URL}/jobs/${jobId}`,
        method: "DELETE",
        defaultErrorMessage: "Failed to cancel job",
      }),
  });
