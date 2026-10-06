import { api } from "@/shared/lib/axios";

import type { SimilarTopicResult, StoredSimilarityResult, Topic, TopicHistoryEntry, TopicUpdatePayload } from "./types";

export interface PaginatedTopics {
  count: number;
  next: string | null;
  previous: string | null;
  results: Topic[];
}

export interface TopicListParams {
  search?: string;
  department?: number;
  field?: number;
  cohort?: number;
  academic_year?: number;
  semester?: number;
  proposed_by?: number;
  status?: string;
  page?: number;
}

export const topicsApi = {
  list: (params: TopicListParams) => api.get<PaginatedTopics>("/topics/topics/", { params }).then((r) => r.data),
  detail: (id: number) => api.get<Topic>(`/topics/topics/${id}/`).then((r) => r.data),
  update: (id: number, payload: TopicUpdatePayload) =>
    api.patch<Topic>(`/topics/topics/${id}/`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/topics/topics/${id}/`),
  create: (payload: Partial<Topic>) => api.post<Topic>("/topics/topics/", payload).then((r) => r.data),
  similarityCheck: (id: number) =>
    api.get<SimilarTopicResult[]>(`/topics/topics/${id}/similarity-check/`).then((r) => r.data),
  assign: (id: number, studentIds: number[], note = "") =>
    api.post(`/topics/topics/${id}/assign/`, { student_ids: studentIds, note }).then((r) => r.data),
  history: (id: number) => api.get<TopicHistoryEntry[]>(`/topics/topics/${id}/history/`).then((r) => r.data),
  storedSimilarityResults: (id: number) =>
    api.get<StoredSimilarityResult[]>(`/topics/topics/${id}/similarity-results/`).then((r) => r.data),
  refreshSimilarity: (id: number) =>
    api.post<StoredSimilarityResult[]>(`/topics/topics/${id}/refresh-similarity/`).then((r) => r.data),
};
