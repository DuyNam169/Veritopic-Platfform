import { useMutation, useQuery } from "@tanstack/react-query";

import { authApi, type LoginPayload } from "./api";
import { useAuthStore } from "./store";

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: async (data) => {
      setAuth(data.access, data.refresh);
      try {
        const user = await authApi.me();
        setUser(user);
        return user;
      } catch (e) {
        console.error("Failed to fetch user after login", e);
        return null;
      }
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
      setUser(user);
      return user;
    },
    enabled: !!accessToken,
  });
}
