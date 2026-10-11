import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { teacherApi } from "../api";
import type { ProjectProgressItem, Topic } from "../types";

export const TeacherDashboardPage: React.FC = () => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [projects, setProjects] = useState<ProjectProgressItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([teacherApi.getMyTopics(), teacherApi.getProjectsProgress()])
      .then(([topicsRes, projectsRes]) => {
        setTopics(topicsRes.results || topicsRes || []);
        setProjects(projectsRes || []);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const pendingCount = topics.filter((t) => t.status === "pending").length;
  const approvedCount = topics.filter((t) => t.status === "approved").length;
  const renameCount = topics.filter((t) => t.status === "rename_requested").length;
  const lateProjectsCount = projects.filter((p) => p.is_late).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-black tracking-widest text-[#006A60] uppercase mb-1">
            ĐIỀU HƯỚNG BẢNG ĐIỀU KHIỂN
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tổng quan đề tài & Hướng dẫn</h1>
          <p className="text-xs text-slate-400 mt-0.5">Tổng quan quản lý đề tài đồ án và theo dõi tiến độ sinh viên hướng dẫn.</p>
        </div>
        <Link
          to="/teacher/propose"
          className="inline-flex items-center gap-2 rounded-full bg-[#006A60] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#00524a] transition-colors"
        >
          <span>+ Đề xuất Đề tài Mới</span>
        </Link>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Đề tài Chờ Duyệt</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-amber-600">{pendingCount}</span>
            <span className="text-xs text-slate-400 font-medium">Chờ Bộ môn</span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5 shadow-xs">
          <div className="text-[11px] font-bold text-[#006A60] uppercase tracking-wider">Đề tài Đã Phê Duyệt</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-[#006A60]">{approvedCount}</span>
            <span className="text-xs text-[#006A60] font-medium">Sẵn sàng giao SV</span>
          </div>
        </div>

        <div className="rounded-2xl border border-sky-200/80 bg-sky-50/40 p-5 shadow-xs">
          <div className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">Yêu cầu Chỉnh sửa</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-sky-700">{renameCount}</span>
            <Link to="/teacher/topics" className="text-xs font-bold text-sky-700 hover:underline">
              Sửa ngay &rarr;
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-5 shadow-xs">
          <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Đồ án Cảnh báo Trễ</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-rose-700">{lateProjectsCount}</span>
            <Link to="/teacher/progress" className="text-xs font-bold text-rose-700 hover:underline">
              Xem tiến độ &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent topics */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-sm">Đề tài đề xuất gần đây</h3>
            <Link to="/teacher/topics" className="text-xs font-bold text-[#006A60] hover:underline">
              Tất cả đề tài &rarr;
            </Link>
          </div>

          {isLoading ? (
            <p className="text-xs text-slate-400">Đang tải dữ liệu...</p>
          ) : topics.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Bạn chưa đề xuất đề tài nào.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {topics.slice(0, 5).map((topic) => (
                <div key={topic.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{topic.title}</h4>
                    <span className="text-[11px] text-slate-400">
                      Tối đa {topic.max_students} SV • {new Date(topic.created_at).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    topic.status === "approved" ? "bg-emerald-50 text-emerald-700" :
                    topic.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {topic.status === "approved" ? "Đã duyệt" : topic.status === "pending" ? "Chờ duyệt" : topic.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action required / Late projects */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-sm">Tiến độ Đồ án cần chú ý</h3>
            <Link to="/teacher/progress" className="text-xs font-bold text-[#006A60] hover:underline">
              Chi tiết tiến độ &rarr;
            </Link>
          </div>

          {isLoading ? (
            <p className="text-xs text-slate-400">Đang tải dữ liệu...</p>
          ) : projects.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Chưa có lượt giao đồ án nào.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {projects.slice(0, 5).map((p) => (
                <div key={p.assignment_id} className="py-3 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{p.topic_title}</h4>
                    <p className="text-[11px] text-slate-400">
                      SV: {p.students.map((s) => s.full_name).join(", ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-[#006A60]">{p.latest_percent}%</span>
                    {p.is_late && (
                      <span className="block text-[10px] font-bold text-rose-600">Trễ tiến độ</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

