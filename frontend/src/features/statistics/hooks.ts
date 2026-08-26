import { useQuery } from "@tanstack/react-query";

import { statisticsApi } from "./api";

export function useStatisticsOverview(params: Record<string, string | number> = {}) {
  return useQuery({ queryKey: ["statistics", "overview", params], queryFn: () => statisticsApi.overview(params) });
}
