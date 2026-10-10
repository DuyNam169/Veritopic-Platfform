import React, { useEffect, useState } from "react";
import { teacherApi } from "../api";
import type { MyStudentItem } from "../types";

export const MyStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<MyStudentItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchStudents = () => {
    setIsLoading(true);
    teacherApi
      .getMyStudents(search)
      .then(setStudents)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleStatusChange = async (assignmentId: number, status: "completed" | "cancelled") => {
    const actionName = status === "completed" ? "hoàn thành" : "hủy";
    if (!confirm(`Bạn có chắc chắn muốn đánh dấu lượt giao này là '${actionName}'?`)) return;

    try {
      await teacherApi.updateAssignmentStatus(assignmentId, status);
      fetchStudents();
    } catch {
      alert("Cập nhật trạng thái lượt giao thất bại.");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="text-[11px] font-black tracking-widest text-[#006A60] uppercase mb-1">
          QUẢN LÝ HƯỚNG DẪN
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Danh sách Sinh viên Hướng dẫn</h1>
        <p className="text-xs text-slate-400 mt-0.5">Quản lý các sinh viên được phân công làm đồ án dưới sự hướng dẫn của bạn.</p>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Tìm theo tên SV, MSSV, lớp, tiêu đề đề tài..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchStudents()}
            className="w-full rounded-full border border-slate-200 bg-slate-50/50 pl-9 pr-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none transition-colors"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <button
          onClick={fetchStudents}
          className="rounded-full bg-[#006A60] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#00524a] transition-colors"
        >
          Tìm kiếm
        </button>
      </div>

      {/* Students Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Đang tải danh sách sinh viên...</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <p className="text-sm font-semibold">Không tìm thấy kết quả phù hợp.</p>
            <p className="text-xs text-slate-400">Thử thay đổi từ khóa tìm kiếm MSSV, tên sinh viên hoặc lớp học.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/70 text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">SINH VIÊN</th>
                  <th className="px-6 py-4">MSSV / LỚP</th>
                  <th className="px-6 py-4">ĐỀ TÀI HƯỚNG DẪN</th>
                  <th className="px-6 py-4">TIẾN ĐỘ</th>
                  <th className="px-6 py-4">THỜI HẠN</th>
                  <th className="px-6 py-4">TRẠNG THÁI</th>
                  <th className="px-6 py-4 text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((sv, idx) => (
                  <tr key={`${sv.assignment_id}-${sv.student_id}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{sv.student_name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{sv.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-700">{sv.student_code || "N/A"}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Lớp: {sv.class_name || "N/A"}</div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="font-bold text-slate-800 line-clamp-2 leading-snug">{sv.topic_title}</div>
                    </td>
                    <td className="px-6 py-4 font-black text-[#006A60] text-sm">
                      {sv.latest_percent}%
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {sv.due_date ? new Date(sv.due_date).toLocaleDateString("vi-VN") : "Chưa đặt"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        sv.assignment_status?.toLowerCase() === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" :
                        sv.assignment_status?.toLowerCase() === "completed" ? "bg-sky-50 text-sky-700 border border-sky-200/60" : "bg-rose-50 text-rose-700 border border-rose-200/60"
                      }`}>
                        {sv.assignment_status_display}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {sv.assignment_status?.toLowerCase() === "active" && (
                        <>
                          <button
                            onClick={() => handleStatusChange(sv.assignment_id, "completed")}
                            className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                          >
                            Hoàn thành
                          </button>
                          <button
                            onClick={() => handleStatusChange(sv.assignment_id, "cancelled")}
                            className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                          >
                            Hủy
                          </button>
                        </>
                      )}
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

