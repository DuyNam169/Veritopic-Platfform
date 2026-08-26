import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { approvalApi } from "./api";

export function usePendingTopics() {
  return useQuery({ queryKey: ["management", "topics", "pending"], queryFn: approvalApi.pending });
}

export function useApproveTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) => approvalApi.approve(id, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["management", "topics", "pending"] }),
  });
}

export function useRejectTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) => approvalApi.reject(id, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["management", "topics", "pending"] }),
  });
}
