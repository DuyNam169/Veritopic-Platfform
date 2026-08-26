import { api } from "@/shared/lib/axios";

export const statisticsApi = {
  overview: (params: Record<string, string | number> = {}) =>
    api.get("/statistics/overview/", { params }).then((r) => r.data),
  exportUrl: (format: "excel" | "pdf", params: Record<string, string | number> = {}) => {
    // Tên param BẮT BUỘC là "export_format", không phải "format" — "format" bị DRF dùng
    // nội bộ để chọn renderer (json/api), dùng trùng tên sẽ khiến Backend trả 404 khó hiểu.
    const query = new URLSearchParams({ export_format: format, ...params } as Record<string, string>).toString();
    return `${import.meta.env.VITE_API_BASE_URL}/statistics/export/?${query}`;
  },
};
