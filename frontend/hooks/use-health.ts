import { PUBLIC_API_URL } from "@/lib/env";
import type { HealthResponse } from "@/types/events";

import { useClientQuery } from "./use-client-query";

export const useHealth = () =>
  useClientQuery<HealthResponse>({
    keys: ["health"],
    url: `${PUBLIC_API_URL}/health`,
    options: { staleTime: 60_000 },
  });
