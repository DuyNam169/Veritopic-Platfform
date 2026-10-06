import { api } from "@/shared/lib/axios";

import type { Topic } from "../topics/types";

interface PaginatedTopics {
  results?: Topic[];
  next?: string | null;
}

async function allPendingTopics(): Promise<Topic[]> {
  const topics: Topic[] = [];
  for (let page = 1; ; page++) {
    const { data } = await api.get<Topic[] | PaginatedTopics>("/management/topics/pending/", { params: { page } });
    if (Array.isArray(data)) return data;
    topics.push(...(Array.isArray(data.results) ? data.results : []));
    if (!data.next) return topics;
  }
}

/** API cho route quản lý riêng (/api/v1/management/topics/) — chỉ Admin/Trưởng bộ môn gọi được. */
export const approvalApi = {
  pending: allPendingTopics,
  approve: (id: number, note = "") => api.post(`/management/topics/${id}/approve/`, { note }).then((r) => r.data),
  reject: (id: number, note = "") => api.post(`/management/topics/${id}/reject/`, { note }).then((r) => r.data),
  requestRename: (id: number, note = "") =>
    api.post(`/management/topics/${id}/request-rename/`, { note }).then((r) => r.data),
};
