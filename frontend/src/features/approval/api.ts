import { api } from "@/shared/lib/axios";

import type { Topic } from "../topics/types";

/** API cho route quản lý riêng (/api/v1/management/topics/) — chỉ Admin/Trưởng bộ môn gọi được. */
export const approvalApi = {
  pending: () => api.get<Topic[]>("/management/topics/pending/").then((r) => r.data),
  approve: (id: number, note = "") => api.post(`/management/topics/${id}/approve/`, { note }).then((r) => r.data),
  reject: (id: number, note = "") => api.post(`/management/topics/${id}/reject/`, { note }).then((r) => r.data),
  requestRename: (id: number, note = "") =>
    api.post(`/management/topics/${id}/request-rename/`, { note }).then((r) => r.data),
};
