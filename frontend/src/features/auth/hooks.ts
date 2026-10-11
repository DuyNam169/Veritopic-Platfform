import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authApi, type LoginPayload, type UpdateProfilePayload, type ChangePasswordPayload } from "./api";
import { useAuthStore } from "./store";

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const tokens = await authApi.login({...payload, username: payload.username.trim()});
      const user = await authApi.me(tokens.access);
      return {...tokens, user};
    },
    onSuccess: (data) => {
      // Keep the active mutation and its navigation callback mounted.
      queryClient.removeQueries();
      queryClient.setQueryData(["me"], data.user);
      setUser(data.user);
      setAuth(data.access, data.refresh);
    },
  });
}

export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const user = await authApi.me();
      if (useAuthStore.getState().accessToken === accessToken) setUser(user);
      return user;
    },
    enabled: !!accessToken,
  });
}

export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => authApi.updateProfile(payload),
    onSuccess: (user) => {
      setUser(user);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => authApi.changePassword(payload),
  });
}

export function useUploadAvatar() {
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (avatar: File) => authApi.uploadAvatar(avatar),
    onSuccess: (user) => {
      setUser(user);
      queryClient.setQueryData(["me"], user);
    },
  });
}

export function useDeleteAvatar() {
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.deleteAvatar,
    onSuccess: (user) => {
      setUser(user);
      queryClient.setQueryData(["me"], user);
    },
  });
}
