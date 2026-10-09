import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useCurrentUser } from "@/features/auth/hooks";
import { useAuthStore } from "@/features/auth/store";
import { api } from "@/shared/lib/axios";

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-full px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${
    isActive
      ? "bg-[#E6F4F1] text-[#006A60] shadow-xs"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
  }`;

export default function AppLayout() {
  useCurrentUser();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        await api.post("/auth/logout/", { refresh });
      }
    } catch {
      // Dù API lỗi vẫn logout ở client
    } finally {
      logout();
      navigate("/login");
    }
  };

  const isTeacher = user?.role === "teacher";

  return (
    <div className="min-h-screen bg-[#F4F9F8] text-slate-800 flex flex-col font-sans">
      {/* Header Veritopic Style */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-emerald-900/10 bg-white/90 backdrop-blur-md px-8 py-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#006A60] font-black text-white text-base shadow-sm">
            V
          </div>
          <div>
            <div className="text-xs font-black tracking-widest text-[#006A60] uppercase">VERITOPIC</div>
            <div className="text-[10px] tracking-wider text-slate-400 uppercase font-semibold">ACADEMIC TOPICS</div>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E6F4F1] text-[#006A60] font-bold text-xs ring-2 ring-[#006A60]/20">
              {user?.first_name?.charAt(0) || user?.username?.charAt(0) || "U"}
            </div>
            <div className="text-left leading-tight hidden sm:block">
              <div className="text-xs font-bold text-slate-800">
                {user?.first_name} {user?.last_name} || {user?.username}
              </div>
              <div className="text-[10px] text-slate-500 capitalize">
                {user?.role === "teacher" ? "Giảng viên" : user?.role === "admin" ? "Quản trị viên" : "Sinh viên"}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-rose-600 transition-colors"
          >
            <span>[→ Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex flex-1">
        {/* Sidebar Veritopic */}
        <aside className="w-64 border-r border-slate-200/80 bg-white p-5 flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            <div>
              <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                ĐIỀU HƯỚNG
              </div>
              <nav className="space-y-1">
                {isTeacher ? (
                  <>
                    <NavLink to="/teacher" end className={navItemClass}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      <span>Tổng quan đề tài</span>
                    </NavLink>

                    <NavLink to="/teacher/topics" className={navItemClass}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <span>Danh mục đề tài</span>
                    </NavLink>

                    <NavLink to="/teacher/propose" className={navItemClass}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Đề xuất đề tài</span>
                    </NavLink>

                    <NavLink to="/teacher/students" className={navItemClass}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>Sinh viên hướng dẫn</span>
                    </NavLink>

                    <NavLink to="/teacher/progress" className={navItemClass}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <span>Tiến độ đồ án</span>
                    </NavLink>
                  </>
                ) : (
                  <>
                    <NavLink to="/" end className={navItemClass}>
                      <span>Trang chủ</span>
                    </NavLink>
                    <NavLink to="/topics" className={navItemClass}>
                      <span>Danh mục đề tài</span>
                    </NavLink>
                    {(user?.role === "admin" || user?.role === "department_head") && (
                      <NavLink to="/approval" className={navItemClass}>
                        <span>Duyệt đề tài</span>
                      </NavLink>
                    )}
                    {user?.role === "admin" && (
                      <NavLink to="/academics" className={navItemClass}>
                        <span>Danh mục hệ thống</span>
                      </NavLink>
                    )}
                  </>
                )}
              </nav>
            </div>

            <div>
              <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                THỐNG KÊ & THÁO TÁC
              </div>
              <nav className="space-y-1">
                <NavLink to="/statistics" className={navItemClass}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>Thống kê & Báo cáo</span>
                </NavLink>
              </nav>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
            Veritopic &copy; 2026 Academic Topics
          </div>
        </aside>

        {/* Content Body */}
        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


