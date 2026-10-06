import { useQuery } from "@tanstack/react-query";

import { statisticsApi, type StatisticsFilters } from "./api";

export function useStatisticsOverview(params: StatisticsFilters = {}) {
  return useQuery({ queryKey: ["statistics", "overview", params], queryFn: () => statisticsApi.overview(params) });
}
