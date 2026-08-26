import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "@/features/auth/store";

/** Chặn truy cập nếu chưa đăng nhập. Dùng bọc quanh các route cần auth trong router.tsx. */
export default function PrivateRoute() {
  const token = useAuthStore((s) => s.accessToken);
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}
