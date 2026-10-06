import { api } from "@/shared/lib/axios";
import type { Role, User } from "@/types";

export interface ManagedUser extends User { is_active: boolean; }
export interface CreateUserPayload {
  username: string; email: string; password: string; first_name: string; last_name: string; role: Role;
  phone_number?: string; department?: number | null; cohort?: number | null; student_code?: string;
}
export interface CohortOption { id: number; name: string; start_year: number; end_year: number; }
export interface DepartmentOption { id: number; name: string; code: string; }
export type UpdateUserPayload = Partial<Pick<ManagedUser,
  "username" | "email" | "first_name" | "last_name" | "phone_number" |
  "role" | "department" | "cohort" | "student_code" | "is_active"
>>;

async function allPages<T>(url: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const { data } = await api.get<T[] | { results: T[]; next: string | null }>(url, { params: { page } });
    if (Array.isArray(data)) return data;
    items.push(...data.results);
    if (!data.next) return items;
  }
}

export const usersApi = {
  list: () => allPages<ManagedUser>("/management/users/"),
  cohorts: () => allPages<CohortOption>("/academics/cohorts/"),
  departments: () => allPages<DepartmentOption>("/academics/departments/"),
  create: (payload: CreateUserPayload) => api.post<ManagedUser>("/management/users/", payload).then((r) => r.data),
  update: (id: number, payload: UpdateUserPayload) => api.patch<ManagedUser>(`/management/users/${id}/`, payload).then((r) => r.data),
  resetPassword: (id: number, password: string) => api.post<{ detail: string }>(`/management/users/${id}/reset-password/`, { password }).then((r) => r.data),
};
