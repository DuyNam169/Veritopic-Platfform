import { api } from "@/shared/lib/axios";

export interface Technology {
  id: number;
  name: string;
  category: string;
  description: string;
  created_at: string;
}

export interface TopicTechnology {
  id: number;
  topic: number;
  technology: number;
  technology_detail: Technology;
  is_primary: boolean;
  created_at: string;
}

export interface TopicFunction {
  id: number;
  topic: number;
  function_name: string;
  description: string;
  created_at: string;
}

export interface TopicDocument {
  id: number;
  topic: number;
  file_url: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_by: number | null;
  uploaded_at: string;
}

export interface SimilarityCheckResult {
  topic_id: number;
  title: string;
  percent: number;
  warning_level: "normal" | "review" | "high" | "duplicate";
}

export interface ExtractedTitle {
  title: string;
  confidence: number;
}

interface Paginated<T> {
  results: T[];
  next: string | null;
}

async function allPages<T>(url: string, params: Record<string, string | number> = {}): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const { data } = await api.get<T[] | Paginated<T>>(url, { params: { ...params, page } });
    if (Array.isArray(data)) return data;
    items.push(...data.results);
    if (!data.next) return items;
  }
}

export const topicResourcesApi = {
  technologies: () => allPages<Technology>("/topics/technologies/"),
  saveTechnology: (payload: Pick<Technology, "name" | "category" | "description">, id?: number) =>
    id ? api.patch<Technology>(`/topics/technologies/${id}/`, payload).then((response) => response.data)
      : api.post<Technology>("/topics/technologies/", payload).then((response) => response.data),
  deleteTechnology: (id: number) => api.delete(`/topics/technologies/${id}/`),
  topicTechnologies: (topicId: number) =>
    allPages<TopicTechnology>("/topics/topic-technologies/", { topic: topicId }),
  addTopicTechnology: (topic: number, technology: number, is_primary = false) =>
    api.post<TopicTechnology>("/topics/topic-technologies/", { topic, technology, is_primary }).then((response) => response.data),
  updateTopicTechnology: (id: number, payload: Partial<Pick<TopicTechnology, "is_primary">>) =>
    api.patch<TopicTechnology>(`/topics/topic-technologies/${id}/`, payload).then((response) => response.data),
  removeTopicTechnology: (id: number) => api.delete(`/topics/topic-technologies/${id}/`),
  topicFunctions: (topicId: number) =>
    allPages<TopicFunction>("/topics/topic-functions/", { topic: topicId }),
  saveFunction: (payload: Pick<TopicFunction, "topic" | "function_name" | "description">, id?: number) =>
    id ? api.patch<TopicFunction>(`/topics/topic-functions/${id}/`, payload).then((response) => response.data)
      : api.post<TopicFunction>("/topics/topic-functions/", payload).then((response) => response.data),
  deleteFunction: (id: number) => api.delete(`/topics/topic-functions/${id}/`),
  topicDocuments: (topicId: number) =>
    allPages<TopicDocument>("/topics/topic-documents/", { topic: topicId }),
  uploadDocument: (topic: number, file: File) => {
    const payload = new FormData();
    payload.append("topic", String(topic));
    payload.append("file", file);
    return api.post<TopicDocument>("/topics/topic-documents/", payload).then((response) => response.data);
  },
  deleteDocument: (id: number) => api.delete(`/topics/topic-documents/${id}/`),
  downloadDocument: async (id: number, fileName: string) => {
    const { data } = await api.get<Blob>(`/topics/topic-documents/${id}/download/`, { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  },
  checkSimilarity: (payload: { title?: string; source_topic_id?: number; top_k?: number }) =>
    api.post<{ query: string; count: number; results: SimilarityCheckResult[] }>(
      "/topics/similarity/checks/check/",
      payload,
    ).then((response) => response.data),
  extractFile: (file: File) => {
    const payload = new FormData();
    payload.append("file", file);
    return api.post<{ title_candidates: ExtractedTitle[]; suggested_title: string; preview_text: string }>(
      "/topics/similarity/checks/extract-file/",
      payload,
    ).then((response) => response.data);
  },
};
