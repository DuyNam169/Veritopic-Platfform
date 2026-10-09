import { Navigate, Outlet } from "react-router-dom";

import type { Role } from "@/types";
import { useAuthStore } from "@/features/auth/store";

interface Props {
  allow: Role[];
}

/**
 * Chặn truy cập theo vai trò — dùng bọc quanh nhóm route quản lý riêng
 * (ví dụ chỉ admin/department_head mới vào được trang duyệt đề tài).
 */
export default function RoleGuard({ allow }: Props) {
  const role = useAuthStore((s) => s.user?.role);
  if (!role || !allow.includes(role)) {
    const fallbackPath = role === "teacher" ? "/teacher" : role === "department_head" || role === "admin" ? "/approval" : "/topics";
    return <Navigate to={fallbackPath} replace />;
  }
  return <Outlet />;
}
