import React, { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  User as UserIcon,
  CheckSquare,
  BarChart3,
  Users,
  Layers,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ClipboardList,
  PlusCircle,
  GraduationCap,
  Search,
} from "./icons";

import { useAuthStore } from "@/features/auth/store";
import { toast } from "@/shared/lib/toast";

const roleLabels = {
  admin: "Quản trị viên",
  department_head: "Trưởng bộ môn",
  teacher: "Giảng viên",
  student: "Sinh viên",
};

const roleBadges = {
  admin: "bg-brand-50 text-brand-700 border-brand-200",
  department_head: "bg-amber-50 text-amber-800 border-amber-200",
  teacher: "bg-sky-50 text-sky-700 border-sky-200",
  student: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Đóng mobile menu khi chuyển trang
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    toast.info("Bạn đã đăng xuất khỏi hệ thống.");
    navigate("/login");
  };

  const initials =
    `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}` ||
    user?.username?.slice(0, 2).toUpperCase() ||
    "U";

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
      ? "bg-brand-100/70 text-brand-800 shadow-sm border border-brand-200"
      : "text-slate-600 hover:text-brand-800 hover:bg-brand-50"
    }`;

  const renderNavItems = () => (
    <>
      <div className="px-3 mb-2">
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-slate-500">
          Điều hướng
        </p>
      </div>
      <nav className="space-y-1">
        <NavLink to="/" end className={navLinkClass}>
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>Tổng quan đề tài</span>
        </NavLink>
        <NavLink to="/topics" className={navLinkClass}>
          <BookOpen className="w-4 h-4 shrink-0" />
          <span>Danh mục đề tài</span>
        </NavLink>
        {user?.role !== "student" && <NavLink to="/topics/similarity" className={navLinkClass}>
          <Search className="w-4 h-4 shrink-0" />
          <span>Kiểm tra tương đồng</span>
        </NavLink>}
        <NavLink to="/profile" className={navLinkClass}>
          <UserIcon className="w-4 h-4 shrink-0" />
          <span>Hồ sơ cá nhân</span>
        </NavLink>

        {user?.role === "teacher" && (
          <>
            <div className="pt-4 pb-2 px-3">
              <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-slate-500">
                Giảng viên
              </p>
            </div>
            <NavLink to="/teacher" end className={navLinkClass}>
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Tổng quan
              </span>
            </NavLink>
            <NavLink to="/teacher/topics" className={navLinkClass}>
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Đề tài của tôi</span>
            </NavLink>
            <NavLink to="/teacher/propose" className={navLinkClass}>
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Đề xuất đề tài</span>
            </NavLink>
            <NavLink to="/teacher/students" className={navLinkClass}>
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span>Sinh viên hướng dẫn</span>
            </NavLink>
            <NavLink to="/teacher/progress" className={navLinkClass}>
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span>Tiến độ đồ án</span>
            </NavLink>
          </>
        )}

        {(user?.role === "admin" || user?.role === "department_head") && (
          <>
            <NavLink to="/approval" className={navLinkClass}>
              <CheckSquare className="w-4 h-4 shrink-0" />
              <span>Duyệt đề tài</span>
            </NavLink>
            <NavLink to="/people" className={navLinkClass}>
              <Users className="w-4 h-4 shrink-0" />
              <span>Giảng viên & sinh viên</span>
            </NavLink>
          </>
        )}

        {user?.role === "admin" && (
          <>
            <div className="pt-6 pb-2 px-3">
              <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-slate-500">
                Quản trị hệ thống
              </p>
            </div>
            <NavLink to="/users" className={navLinkClass}>
              <Users className="w-4 h-4 shrink-0" />
              <span>Quản lý tài khoản</span>
            </NavLink>
            <NavLink to="/academics" className={navLinkClass}>
              <Layers className="w-4 h-4 shrink-0" />
              <span>Danh mục hệ thống</span>
            </NavLink>
            <NavLink to="/technologies" className={navLinkClass}>
              <Layers className="w-4 h-4 shrink-0" />
              <span>Danh mục công nghệ</span>
            </NavLink>
            <NavLink to="/statistics" className={navLinkClass}>
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>Thống kê & báo cáo</span>
            </NavLink>
          </>
        )}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen bg-brand-50/40 text-slate-900 flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-brand-100 bg-white px-4 sm:px-6 lg:px-8 text-slate-900 shadow-sm">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Nút Hamburger cho Mobile */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-brand-800 hover:bg-brand-50 transition"
            aria-label="Mở menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link to="/" className="flex items-center gap-3 group">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-tr from-brand-600 to-brand-700 border border-brand-600 font-bold text-sm text-white shadow-inner group-hover:border-brand-500 transition">
              V
            </div>
            <div>
              <strong className="block text-sm tracking-wider font-semibold text-brand-800 group-hover:text-brand-700 transition">
                VERITOPIC
              </strong>
              <span className="block text-[9px] tracking-[0.18em] text-slate-500 font-medium">
                ACADEMIC TOPICS
              </span>
            </div>
          </Link>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            to="/profile"
            className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-brand-50 transition group"
            title="Xem hồ sơ cá nhân"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={`Ảnh đại diện của ${user.first_name || user.username}`}
                className="h-8 w-8 rounded-full border border-brand-200 object-cover shadow-sm transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-50 to-brand-100 text-xs font-bold text-brand-800 border border-brand-200 shadow-sm group-hover:scale-105 transition-transform">
                {initials}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-xs font-medium text-slate-800 group-hover:text-brand-700 flex items-center gap-1">
                {user?.first_name} {user?.last_name}
                <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-brand-700 transition-transform group-hover:translate-x-0.5" />
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-medium border ${user ? roleBadges[user.role] : ""
                    }`}
                >
                  {user ? roleLabels[user.role] : ""}
                </span>
              </div>
            </div>
          </Link>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition-all duration-200 active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* BODY LAYOUT */}
      <div className="flex flex-1 relative">
        {/* SIDEBAR DESKTOP */}
        <aside className="hidden md:block w-64 shrink-0 bg-white border-r border-brand-100 p-4 py-6">
          {renderNavItems()}
        </aside>

        {/* SIDEBAR MOBILE DRAWER */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop overlay */}
            <div
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Drawer */}
            <aside className="relative w-64 max-w-[80vw] bg-white border-r border-brand-100 p-4 py-6 z-10 flex flex-col justify-between animate-slide-in-right">
              <div>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 px-2">
                  <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Menu chính
                  </span>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 rounded text-slate-500 hover:text-brand-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {renderNavItems()}
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                  Đăng xuất
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* MAIN CONTENT */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
