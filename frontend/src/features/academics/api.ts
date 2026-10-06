import { api } from "@/shared/lib/axios";

/** CRUD danh mục hệ thống — chỉ Admin (chặn bằng RoleGuard ở router.tsx, và ReadOnlyOrAdmin ở Backend). */
export const academicsApi = {
  cohorts: () => api.get("/academics/cohorts/").then((r) => r.data),
  academicYears: () => api.get("/academics/academic-years/").then((r) => r.data),
  departments: () => api.get("/academics/departments/").then((r) => r.data),
  fields: () => api.get("/academics/fields/").then((r) => r.data),
};

export type CatalogKind = "cohorts" | "academic-years" | "semesters" | "departments" | "fields";
export interface CatalogItem {
  id: number; name: string; start_year?: number; end_year?: number;
  is_current?: boolean; academic_year?: number; start_date?: string; end_date?: string;
  code?: string; head?: number | null; head_name?: string | null;
}
export interface HeadOption { id: number; username: string; first_name: string; last_name: string; }
async function allPages<T>(url: string, params: Record<string, string | number> = {}): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const { data } = await api.get<T[] | { results: T[]; next: string | null }>(url, { params: { ...params, page } });
    if (Array.isArray(data)) return data;
    items.push(...data.results);
    if (!data.next) return items;
  }
}
export const catalogApi = {
  list: (kind: CatalogKind, year?: string) => allPages<CatalogItem>(`/academics/${kind}/`, year ? { academic_year: year } : {}),
  heads: () => allPages<HeadOption>("/management/users/", { role: "department_head" }),
  save: (kind: CatalogKind, payload: Partial<CatalogItem>, id?: number) => id
    ? api.patch(`/academics/${kind}/${id}/`, payload)
    : api.post(`/academics/${kind}/`, payload),
  remove: (kind: CatalogKind, id: number) => api.delete(`/academics/${kind}/${id}/`),
};
