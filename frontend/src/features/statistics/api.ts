import { api } from "@/shared/lib/axios";

export interface StatisticsFilters {
  search?: string;
  academic_year?: number;
  cohort?: number;
  department?: number;
  field?: number;
  semester?: number;
  proposed_by?: number;
  status?: string;
}

interface CountRow { count: number; }
export interface StatisticsOverview {
  total: number;
  by_academic_year: Array<CountRow & { academic_year__name: string }>;
  by_cohort: Array<CountRow & { cohort__name: string }>;
  by_teacher: Array<CountRow & {
    proposed_by__id: number;
    proposed_by__username: string;
    proposed_by__first_name: string;
    proposed_by__last_name: string;
  }>;
  by_field: Array<CountRow & { field__name: string | null }>;
  by_status: Array<CountRow & { status: string }>;
}

export const statisticsApi = {
  overview: (params: StatisticsFilters = {}) =>
    api.get<StatisticsOverview>("/statistics/overview/", { params }).then((r) => r.data),
  download: async (format: "excel" | "pdf", params: StatisticsFilters = {}) => {
    const response = await api.get<Blob>("/statistics/export/", {
      params: { export_format: format, ...params },
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = format === "pdf" ? "danh_sach_de_tai.pdf" : "danh_sach_de_tai.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  },
};
