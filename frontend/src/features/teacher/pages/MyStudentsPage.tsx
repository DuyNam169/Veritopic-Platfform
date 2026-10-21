import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { teacherApi } from "../api";
import { AssignTopicToStudentModal } from "../components/AssignTopicToStudentModal";
import type { MyAdviseeItem, MyStudentItem, UnifiedAdviseeStudent } from "../types";

type FilterStatus = "all" | "unassigned" | "active" | "completed";

export const MyStudentsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<UnifiedAdviseeStudent[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");

  // State cho Modal Giao đề tài
  const [assignStudent, setAssignStudent] = useState<UnifiedAdviseeStudent | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Tải dữ liệu kết hợp từ cả 2 nguồn: Sinh viên có Assignment và Sinh viên đã chọn GVHD
  const fetchData = async () => {
    setLoading(true);
    try {
      const [assignmentRes, adviseesRes] = await Promise.all([
        teacherApi.getMyStudents(),
        teacherApi.getMyAdvisees(),
      ]);

      const assignmentList: MyStudentItem[] = Array.isArray(assignmentRes) ? assignmentRes : [];
      const adviseeList: MyAdviseeItem[] = Array.isArray(adviseesRes) ? adviseesRes : [];

      // Gom danh sách sinh viên theo student_id để tránh trùng lặp
      const studentMap = new Map<number, UnifiedAdviseeStudent>();

      // 1. Nạp sinh viên từ danh sách đã chọn GVHD
      for (const adv of adviseeList) {
        studentMap.set(adv.student_id, {
          student_id: adv.student_id,
          student_name: adv.student_name,
          student_code: adv.student_code,
          class_name: adv.class_name,
          email: adv.email,
          phone_number: adv.phone_number,
          cohort_id: adv.cohort_id,
          cohort_name: adv.cohort_name,
          department_id: adv.department_id,
          department_name: adv.department_name,
          has_topic: false,
          advisor_request_id: adv.advisor_request_id,
          accepted_at: adv.accepted_at,
          message: adv.message,
        });
      }

      // 2. Cập nhật hoặc bổ sung sinh viên đã được giao đề tài
      for (const sv of assignmentList) {
        const existing = studentMap.get(sv.student_id);
        if (existing) {
          existing.has_topic = true;
          existing.topic_id = sv.topic_id;
          existing.topic_title = sv.topic_title;
          existing.assignment_id = sv.assignment_id;
          existing.assignment_status = sv.assignment_status;
          existing.assignment_status_display = sv.assignment_status_display;
          existing.latest_percent = sv.latest_percent;
          existing.due_date = sv.due_date;
          if (sv.cohort_name && !existing.cohort_name) existing.cohort_name = sv.cohort_name;
          if (sv.department_name && !existing.department_name) existing.department_name = sv.department_name;
        } else {
          studentMap.set(sv.student_id, {
            student_id: sv.student_id,
            student_name: sv.student_name,
            student_code: sv.student_code,
            class_name: sv.class_name,
            email: sv.email,
            phone_number: sv.phone_number,
            cohort_id: sv.cohort_id ?? undefined,
            cohort_name: sv.cohort_name,
            department_id: sv.department_id ?? undefined,
            department_name: sv.department_name,
            has_topic: true,
            topic_id: sv.topic_id,
            topic_title: sv.topic_title,
            assignment_id: sv.assignment_id,
            assignment_status: sv.assignment_status,
            assignment_status_display: sv.assignment_status_display,
            latest_percent: sv.latest_percent,
            due_date: sv.due_date,
          });
        }
      }

      setStudents(Array.from(studentMap.values()));
    } catch {
      setFeedbackMessage({ type: "error", text: "Không thể tải danh sách sinh viên hướng dẫn." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStatusChange = async (assignmentId: number, status: "completed" | "cancelled") => {
    const actionName = status === "completed" ? "hoàn thành" : "hủy";
    if (!confirm(`Bạn có chắc chắn muốn đánh dấu lượt giao này là '${actionName}'?`)) return;
    try {
      await teacherApi.updateAssignmentStatus(assignmentId, status);
      setFeedbackMessage({ type: "success", text: `Đã cập nhật trạng thái đồ án thành công.` });
      fetchData();
    } catch {
      setFeedbackMessage({ type: "error", text: "Cập nhật trạng thái lượt giao thất bại." });
    }
  };

  // Thống kê số lượng
  const stats = useMemo(() => {
    const total = students.length;
    const unassigned = students.filter((s) => !s.has_topic).length;
    const active = students.filter((s) => s.has_topic && s.assignment_status?.toLowerCase() === "active").length;
    const completed = students.filter((s) => s.has_topic && s.assignment_status?.toLowerCase() === "completed").length;
    return { total, unassigned, active, completed };
  }, [students]);

  // Lọc dữ liệu theo Search và Filter
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Lọc theo trạng thái
      if (filter === "unassigned" && s.has_topic) return false;
      if (filter === "active" && (!s.has_topic || s.assignment_status?.toLowerCase() !== "active")) return false;
      if (filter === "completed" && (!s.has_topic || s.assignment_status?.toLowerCase() !== "completed")) return false;

      // Lọc theo search
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const name = s.student_name.toLowerCase();
      const code = (s.student_code || "").toLowerCase();
      const cls = (s.class_name || "").toLowerCase();
      const topic = (s.topic_title || "").toLowerCase();
      return name.includes(q) || code.includes(q) || cls.includes(q) || topic.includes(q);
    });
  }, [students, filter, search]);

  // Render Badge Trạng thái đồng bộ với phong cách toàn hệ thống
  const renderStatusBadge = (sv: UnifiedAdviseeStudent) => {
    if (!sv.has_topic) {
      return (
        <span className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap shadow-xs border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-400">
          Chờ giao việc
        </span>
      );
    }

    const status = sv.assignment_status?.toLowerCase();
    if (status === "active") {
      return (
        <span className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap shadow-xs border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-400">
          Đang thực hiện
        </span>
      );
    }

    if (status === "completed") {
      return (
        <span className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap shadow-xs border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/80 dark:bg-sky-950/40 dark:text-sky-400">
          Đã hoàn thành
        </span>
      );
    }

    return (
      <span className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap shadow-xs border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/80 dark:bg-rose-950/40 dark:text-rose-400">
        Đã hủy
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div>
        <div className="text-[11px] font-black tracking-widest text-[#006A60] uppercase mb-1">
          QUẢN LÝ HƯỚNG DẪN ĐỒ ÁN
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Danh sách Sinh viên Hướng dẫn
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Quản lý toàn diện sinh viên được phân công: theo dõi tiến độ đồ án và trực tiếp giao đề tài cho sinh viên mới tiếp nhận.
        </p>
      </div>

      {/* Thông báo Alert */}
      {feedbackMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-700 font-bold ml-2 text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setFilter("all")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filter === "all"
              ? "bg-[#006A60]/5 border-[#006A60] ring-1 ring-[#006A60]"
              : "bg-white border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng Sinh viên</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{stats.total}</div>
          <div className="text-[10px] text-slate-400 mt-1">Đang phụ trách</div>
        </button>

        <button
          onClick={() => setFilter("unassigned")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filter === "unassigned"
              ? "bg-amber-500/10 border-amber-500 ring-1 ring-amber-500"
              : "bg-white border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Chờ giao việc
          </div>
          <div className="text-2xl font-black text-amber-600 mt-1">{stats.unassigned}</div>
          <div className="text-[10px] text-amber-700/80 font-medium mt-1">Cần giao đề tài ngay</div>
        </button>

        <button
          onClick={() => setFilter("active")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filter === "active"
              ? "bg-[#006A60]/10 border-[#006A60] ring-1 ring-[#006A60]"
              : "bg-white border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className="text-[11px] font-bold text-[#006A60] uppercase tracking-wider">Đang thực hiện</div>
          <div className="text-2xl font-black text-[#006A60] mt-1">{stats.active}</div>
          <div className="text-[10px] text-slate-400 mt-1">Theo dõi tiến độ</div>
        </button>

        <button
          onClick={() => setFilter("completed")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filter === "completed"
              ? "bg-sky-50 border-sky-400 ring-1 ring-sky-400"
              : "bg-white border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">Đã hoàn thành</div>
          <div className="text-2xl font-black text-sky-800 mt-1">{stats.completed}</div>
          <div className="text-[10px] text-slate-400 mt-1">Đạt nghiệm thu</div>
        </button>
      </div>

      {/* Filter Pills & Search Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex flex-col md:flex-row items-center gap-3 justify-between">
        {/* Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setFilter("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
              filter === "all"
                ? "bg-[#006A60] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Tất cả ({stats.total})
          </button>
          <button
            onClick={() => setFilter("unassigned")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
              filter === "unassigned"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60"
            }`}
          >
            <span>Chờ giao việc ({stats.unassigned})</span>
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
              filter === "active"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
            }`}
          >
            Đang thực hiện ({stats.active})
          </button>
          <button
            onClick={() => setFilter("completed")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
              filter === "completed"
                ? "bg-sky-700 text-white shadow-xs"
                : "bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/60"
            }`}
          >
            Đã hoàn thành ({stats.completed})
          </button>
        </div>

        {/* Ô tìm kiếm */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Tìm theo tên SV, MSSV, lớp, đề tài..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border border-slate-200 bg-slate-50/50 pl-9 pr-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none transition-colors"
          />
          <svg
            className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-400">Đang tải danh sách sinh viên hướng dẫn...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-16 text-center text-slate-500 space-y-2">
            <p className="text-sm font-semibold">Không tìm thấy sinh viên nào phù hợp.</p>
            <p className="text-xs text-slate-400">
              {filter === "unassigned"
                ? "Hiện không có sinh viên nào đang chờ giao đề tài."
                : "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap min-w-[200px]">SINH VIÊN</th>
                  <th className="px-5 py-4 whitespace-nowrap min-w-[120px]">MSSV / LỚP</th>
                  <th className="px-5 py-4 whitespace-nowrap min-w-[170px]">KHÓA / BỘ MÔN</th>
                  <th className="px-6 py-4 min-w-[240px]">ĐỀ TÀI ĐỒ ÁN</th>
                  <th className="px-5 py-4 text-center whitespace-nowrap min-w-[100px]">TIẾN ĐỘ</th>
                  <th className="px-5 py-4 whitespace-nowrap min-w-[110px]">THỜI HẠN</th>
                  <th className="px-6 py-4 text-center whitespace-nowrap min-w-[140px]">TRẠNG THÁI</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap min-w-[180px]">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((sv) => {
                  const initials = sv.student_name
                    .split(" ")
                    .slice(-2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase();

                  return (
                    <tr
                      key={`${sv.student_id}-${sv.assignment_id || "none"}`}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Cột Sinh viên */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#006A60]/10 text-xs font-bold text-[#006A60]">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{sv.student_name}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{sv.email}</div>
                            {sv.message && !sv.has_topic && (
                              <div className="text-[10px] text-slate-400 italic mt-0.5 line-clamp-1 max-w-[180px]">
                                &quot;{sv.message}&quot;
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Cột MSSV / Lớp */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-700">{sv.student_code || "N/A"}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Lớp: {sv.class_name || "N/A"}</div>
                      </td>

                      {/* Cột Khóa / Bộ môn */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-700">
                          {sv.cohort_name ? `Khóa ${sv.cohort_name}` : "—"}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[160px]" title={sv.department_name}>
                          {sv.department_name || "—"}
                        </div>
                      </td>

                      {/* Cột Đề tài đồ án */}
                      <td className="px-6 py-4 max-w-xs">
                        {sv.has_topic && sv.topic_title ? (
                          <div className="font-bold text-slate-800 line-clamp-2 leading-snug">
                            {sv.topic_title}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-400 shadow-xs">
                            <span>⚠️</span>
                            <span>Chưa phân công đề tài</span>
                          </span>
                        )}
                      </td>

                      {/* Cột Tiến độ */}
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        {sv.has_topic ? (
                          <div>
                            <div className="font-black text-[#006A60] text-sm">
                              {sv.latest_percent ?? 0}%
                            </div>
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full mx-auto mt-1 overflow-hidden">
                              <div
                                className="h-full bg-[#006A60] rounded-full"
                                style={{ width: `${sv.latest_percent ?? 0}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-medium">—</span>
                        )}
                      </td>

                      {/* Cột Thời hạn */}
                      <td className="px-5 py-4 whitespace-nowrap text-slate-500 font-medium">
                        {sv.has_topic
                          ? sv.due_date
                            ? new Date(sv.due_date).toLocaleDateString("vi-VN")
                            : "Chưa đặt"
                          : "—"}
                      </td>

                      {/* Cột Trạng thái */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        {renderStatusBadge(sv)}
                      </td>

                      {/* Cột Thao tác */}
                      <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                        {!sv.has_topic ? (
                          <button
                            onClick={() => setAssignStudent(sv)}
                            className="rounded-full bg-[#006A60] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#00524a] transition-all inline-flex items-center gap-1.5"
                          >
                            <span>+</span>
                            <span>Giao Đề Tài</span>
                          </button>
                        ) : (
                          <>
                            <Link
                              to={`/teacher/progress/${sv.assignment_id}`}
                              className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 hover:bg-sky-100 inline-block"
                            >
                              Xem tiến độ
                            </Link>
                            {sv.assignment_status?.toLowerCase() === "active" && sv.assignment_id && (
                              <>
                                <button
                                  onClick={() => handleStatusChange(sv.assignment_id!, "completed")}
                                  className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                                >
                                  Hoàn thành
                                </button>
                                <button
                                  onClick={() => handleStatusChange(sv.assignment_id!, "cancelled")}
                                  className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                                >
                                  Hủy
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Giao Đề Tài Cho Sinh Viên */}
      {assignStudent && (
        <AssignTopicToStudentModal
          student={assignStudent}
          availablePeers={students.filter((s) => s.student_id !== assignStudent.student_id && !s.has_topic)}
          onClose={() => setAssignStudent(null)}
          onSuccess={() => {
            setAssignStudent(null);
            setFeedbackMessage({
              type: "success",
              text: `Đã giao đề tài thành công cho sinh viên ${assignStudent.student_name}!`,
            });
            fetchData();
          }}
        />
      )}
    </div>
  );
};
