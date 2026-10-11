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

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export const authApi = {
  login: (payload: LoginPayload) => api.post<LoginResponse>("/auth/login/", payload).then((r) => r.data),
  me: () => api.get<User>("/auth/me/").then((r) => r.data),
  updateProfile: (payload: UpdateProfilePayload) => api.patch<User>("/auth/me/", payload).then((r) => r.data),
  uploadAvatar: (avatar: File) => {
    const form = new FormData();
    form.append("avatar", avatar);
    return api.patch<User>("/auth/me/", form).then((r) => r.data);
  },
  deleteAvatar: () => api.delete<User>("/auth/me/avatar/").then((r) => r.data),
  changePassword: (payload: ChangePasswordPayload) => api.post<{ detail: string }>("/auth/change-password/", payload).then((r) => r.data),
  forgotPassword: (email: string) =>
    api.post<{ detail: string }>("/auth/forgot-password/", { email }).then((r) => r.data),
  resetPassword: (payload: { email: string; otp: string; new_password: string }) =>
    api.post<{ detail: string }>("/auth/reset-password/", payload).then((r) => r.data),
};
