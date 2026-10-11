import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { teacherApi } from "../api";
import type { ProjectProgressItem } from "../types";

export const ProgressListPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectProgressItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    teacherApi
      .getProjectsProgress()
      .then(setProjects)
      .finally(() => setIsLoading(false));
  }, []);

  const lateCount = projects.filter((p) => p.is_late).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-black tracking-widest text-[#006A60] uppercase mb-1">
            GIÁM SÁT TIẾN ĐỘ
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Theo dõi Tiến độ Đồ án</h1>
          <p className="text-xs text-slate-400 mt-0.5">Danh sách các đồ án đang thực hiện và tiến độ nộp báo cáo của sinh viên.</p>
        </div>
        {lateCount > 0 && (
          <div className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700">
            ⚠️ {lateCount} đồ án đang trễ tiến độ
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Đang tải dữ liệu tiến độ...</div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-sm font-semibold">Chưa có đồ án nào đang thực hiện.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/70 text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">ĐỀ TÀI</th>
                  <th className="px-6 py-4">SINH VIÊN</th>
                  <th className="px-6 py-4">TRẠNG THÁI</th>
                  <th className="px-6 py-4">TIẾN ĐỘ MỚI NHẤT</th>
                  <th className="px-6 py-4">TỔNG BÁO CÁO</th>
                  <th className="px-6 py-4">THỜI HẠN</th>
                  <th className="px-6 py-4 text-right">CHI TIẾT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((p) => (
                  <tr key={p.assignment_id} className={`hover:bg-slate-50/60 transition-colors ${p.is_late ? "bg-rose-50/20" : ""}`}>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="font-bold text-slate-800 line-clamp-2 leading-snug">{p.topic_title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        {p.students.map((s) => (
                          <span key={s.id} className="text-slate-700 font-medium">
                            {s.full_name} <span className="text-slate-400">({s.student_code})</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full font-semibold text-xs ${
                        p.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" :
                        p.status === "completed" ? "bg-sky-50 text-sky-700 border border-sky-200/60" : "bg-rose-50 text-rose-700 border border-rose-200/60"
                      }`}>
                        {p.status_display}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#006A60]"
                            style={{ width: `${p.latest_percent}%` }}
                          />
                        </div>
                        <span className="font-black text-[#006A60]">{p.latest_percent}%</span>
                        {p.is_late && (
                          <span className="ml-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                            Trễ hạn
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">{p.total_reports}</td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {p.due_date ? new Date(p.due_date).toLocaleDateString("vi-VN") : "Chưa đặt"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/teacher/progress/${p.assignment_id}`}
                        className="text-xs font-bold text-[#006A60] hover:underline inline-flex items-center gap-1"
                      >
                        <span>Chi tiết</span>
                        <span>&rarr;</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

