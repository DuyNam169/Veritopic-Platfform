import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { topicsApi, type TopicListParams } from "./api";
import type { Topic } from "./types";

export function useTopics(params: TopicListParams) {
  return useQuery({
    queryKey: ["topics", params],
    queryFn: () => topicsApi.list(params),
  });
}

export function useTopicDetail(id: number) {
  return useQuery({
    queryKey: ["topics", id],
    queryFn: () => topicsApi.detail(id),
    enabled: !!id,
  });
}

export function useSimilarityCheck(id: number) {
  return useQuery({
    queryKey: ["topics", id, "similarity"],
    queryFn: () => topicsApi.similarityCheck(id),
    enabled: !!id,
  });
}

export function useTopicHistory(id: number) {
  return useQuery({
    queryKey: ["topics", id, "history"],
    queryFn: () => topicsApi.history(id),
    enabled: !!id,
  });
}

export function useStoredSimilarityResults(id: number) {
  return useQuery({
    queryKey: ["topics", id, "stored-similarity"],
    queryFn: () => topicsApi.storedSimilarityResults(id),
    enabled: !!id,
  });
}

export function useCreateTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Topic>) => topicsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["topics"] }),
  });
}
