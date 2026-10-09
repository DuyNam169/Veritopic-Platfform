import { api } from "@/shared/lib/axios";
import type { User } from "@/types";

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

export const authApi = {
  login: (payload: LoginPayload) => api.post<LoginResponse>("/auth/login/", payload).then((r) => r.data),
  me: () => api.get<User>("/auth/me/").then((r) => r.data),
  forgotPassword: (email: string) => 
    api.post("/auth/forgot-password/", { email }).then((r) => r.data),
  resetPassword: (payload: any) => 
    api.post("/auth/reset-password/", payload).then((r) => r.data),
};
