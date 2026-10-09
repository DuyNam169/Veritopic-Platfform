import { api } from "@/shared/lib/axios";


/** API cho route quản lý riêng (/api/v1/management/topics/) — chỉ Admin/Trưởng bộ môn gọi được. */
export const approvalApi = {
  pending: () =>
    api.get<any>("/management/topics/pending/").then((r) => {
      const data = r.data;
      return Array.isArray(data) ? data : data.results || [];
    }),
  approve: (id: number, note = "") => api.post(`/management/topics/${id}/approve/`, { note }).then((r) => r.data),
  reject: (id: number, note = "") => api.post(`/management/topics/${id}/reject/`, { note }).then((r) => r.data),
  requestRename: (id: number, note = "") =>
    api.post(`/management/topics/${id}/request-rename/`, { note }).then((r) => r.data),
};
