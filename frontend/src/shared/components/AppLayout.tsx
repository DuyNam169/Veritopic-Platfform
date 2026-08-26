import { NavLink, Outlet } from "react-router-dom";

import { useAuthStore } from "@/features/auth/store";

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
  }`;

export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <h1 className="text-lg font-semibold">Veritopic</h1>
        <div className="flex items-center gap-3 text-sm">
          <span>{user?.first_name} {user?.last_name} — {user?.role}</span>
          <button onClick={logout} className="text-red-600 hover:underline">Đăng xuất</button>
        </div>
      </header>
      <div className="flex">
        <nav className="w-56 border-r bg-white p-4 space-y-1">
          <NavLink to="/" end className={navItemClass}>Trang chủ</NavLink>
          <NavLink to="/topics" className={navItemClass}>Đề tài</NavLink>
          <NavLink to="/statistics" className={navItemClass}>Thống kê</NavLink>
          {(user?.role === "admin" || user?.role === "department_head") && (
            <NavLink to="/approval" className={navItemClass}>Duyệt đề tài</NavLink>
          )}
          {user?.role === "admin" && (
            <NavLink to="/academics" className={navItemClass}>Danh mục hệ thống</NavLink>
          )}
        </nav>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
