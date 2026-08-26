import { api } from "@/shared/lib/axios";

/** CRUD danh mục hệ thống — chỉ Admin (chặn bằng RoleGuard ở router.tsx, và ReadOnlyOrAdmin ở Backend). */
export const academicsApi = {
  cohorts: () => api.get("/academics/cohorts/").then((r) => r.data),
  academicYears: () => api.get("/academics/academic-years/").then((r) => r.data),
  departments: () => api.get("/academics/departments/").then((r) => r.data),
  fields: () => api.get("/academics/fields/").then((r) => r.data),
};
