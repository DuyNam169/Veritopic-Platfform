import { api } from "@/shared/lib/axios";

import type { SimilarTopicResult, Topic } from "./types";

export interface TopicListParams {
  search?: string;
  department?: number;
  cohort?: number;
  academic_year?: number;
  semester?: number;
  status?: string;
  page?: number;
}

export const topicsApi = {
  list: (params: TopicListParams) => api.get("/topics/topics/", { params }).then((r) => r.data),
  detail: (id: number) => api.get<Topic>(`/topics/topics/${id}/`).then((r) => r.data),
  create: (payload: Partial<Topic>) => api.post<Topic>("/topics/topics/", payload).then((r) => r.data),
  similarityCheck: (id: number) =>
    api.get<SimilarTopicResult[]>(`/topics/topics/${id}/similarity-check/`).then((r) => r.data),
  assign: (id: number, studentIds: number[], note = "") =>
    api.post(`/topics/topics/${id}/assign/`, { student_ids: studentIds, note }).then((r) => r.data),
  history: (id: number) => api.get(`/topics/topics/${id}/history/`).then((r) => r.data),
};
