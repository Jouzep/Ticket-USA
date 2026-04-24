import { useMutation } from "@tanstack/react-query";

import { PUBLIC_API_URL } from "@/lib/env";
import type { JobCreateResponse, ScraperMode } from "@/types/events";

import { multipartFetcher } from "./use-client-query";

export type CreateJobArgs = {
  file: File;
  scraperMode?: ScraperMode;
};

export const useCreateJob = () =>
  useMutation<JobCreateResponse, Error, CreateJobArgs>({
    mutationFn: ({ file, scraperMode }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (scraperMode) formData.append("scraper_mode", scraperMode);
      return multipartFetcher<JobCreateResponse>({
        url: `${PUBLIC_API_URL}/jobs`,
        method: "POST",
        formData,
        defaultErrorMessage: "Failed to start scraping job",
      });
    },
  });
