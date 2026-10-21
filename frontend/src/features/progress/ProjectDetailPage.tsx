import React, { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "@/shared/lib/axios";
import { teacherApi } from "@/features/teacher/api";
import { useAuthStore } from "@/features/auth/store";
import { toast } from "@/shared/lib/toast";

interface StudentDetail {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  student_code?: string;
  class_name?: string;
  email: string;
  phone_number?: string;
}

interface AssignmentData {
  id: number;
  topic: number;
  topic_title: string;
  status: string;
  due_date: string | null;
  note: string;
  proposed_by_detail?: {
    first_name: string;
    last_name: string;
    username: string;
    email: string;
  };
  students_detail?: StudentDetail[];
}

export default function ProjectDetailPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const id = Number(assignmentId);
  const user = useAuthStore((s) => s.user);
  const isTeacher = user?.role === "teacher" || user?.role === "department_head" || user?.role === "admin";
  const client = useQueryClient();

  const [busy, setBusy] = useState(false);
  const [activeFeedbackReportId, setActiveFeedbackReportId] = useState<number | null>(null);

  // Form states cho Giảng viên nhận xét
  const [fbComment, setFbComment] = useState("");
  const [fbScore, setFbScore] = useState<string>("");
  const [fbResult, setFbResult] = useState<"passed" | "need_revision" | "failed">("passed");

  // Fetch Assignment data
  const {
    data: project,
    isLoading: isProjectLoading,
    isError: isProjectError,
    refetch: refetchProject,
  } = useQuery({
    queryKey: ["assignment", user?.id, id],
    queryFn: () => api.get<AssignmentData>(`/progress/projects/${id}/`).then((r) => r.data),
  });

  // Fetch Reports data
  const {
    data: reports = [],
    isLoading: isReportsLoading,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ["reports", user?.id, id],
    queryFn: () => teacherApi.getAssignmentReports(id),
  });

  // Xử lý nộp báo cáo (Sinh viên)
  async function handleStudentSubmitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      if ((data.get("attachment") as File)?.size === 0) {
        data.delete("attachment");
      }
      await api.post(`/progress/projects/${id}/reports/`, data);
      toast.success("Đã gửi báo cáo tiến độ thành công!");
      form.reset();
      await Promise.all([
        client.invalidateQueries({ queryKey: ["reports"] }),
        client.invalidateQueries({ queryKey: ["projects"] }),
      ]);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gửi báo cáo thất bại. Vui lòng kiểm tra lại định dạng tệp.");
    } finally {
      setBusy(false);
    }
  }

  // Xử lý thêm nhận xét của Giảng viên
  async function handleTeacherAddFeedback(reportId: number) {
    if (!fbComment.trim()) {
      toast.error("Vui lòng nhập nội dung nhận xét.");
      return;
    }
    setBusy(true);
    try {
      await teacherApi.addProgressFeedback(reportId, {
        comment: fbComment.trim(),
        score: fbScore ? parseFloat(fbScore) : undefined,
        result: fbResult,
      });
      toast.success("Đã lưu nhận xét và đánh giá tiến độ!");
      setFbComment("");
      setFbScore("");
      setActiveFeedbackReportId(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["reports"] }),
        client.invalidateQueries({ queryKey: ["projects"] }),
      ]);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Không thể lưu nhận xét.");
    } finally {
      setBusy(false);
    }
  }

  // Tải file đính kèm
  async function downloadAttachment(reportId: number) {
    try {
      const response = await api.get(`/progress/reports/${reportId}/download-attachment/`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = decodeURIComponent(
        response.headers["content-disposition"]?.match(/filename\*=UTF-8''([^;]+)/)?.[1] ?? "bao-cao"
      );
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Không tải được tệp đính kèm.");
    }
  }

  // Cập nhật trạng thái đồ án (Hoàn thành / Hủy)
  async function handleUpdateStatus(newStatus: "completed" | "cancelled") {
    const actionLabel = newStatus === "completed" ? "hoàn thành" : "hủy";
    if (!confirm(`Bạn có chắc chắn muốn chuyển trạng thái đồ án này sang '${actionLabel}'?`)) return;
    try {
      setBusy(true);
      await teacherApi.updateAssignmentStatus(id, newStatus);
      toast.success(`Đã cập nhật trạng thái đồ án thành công.`);
      refetchProject();
    } catch {
      toast.error("Cập nhật trạng thái thất bại.");
    } finally {
      setBusy(false);
    }
  }

  if (isProjectLoading) {
    return (
      <div className="max-w-5xl mx-auto p-12 text-center text-slate-400 text-xs">
        Đang tải thông tin tiến độ đồ án...
      </div>
    );
  }

  if (isProjectError || !project) {
    return (
      <div className="max-w-5xl mx-auto p-8 text-center text-rose-600 bg-rose-50 rounded-2xl border border-rose-200">
        Không tìm thấy thông tin đồ án hoặc bạn không có quyền truy cập.
      </div>
    );
  }

  const latestReport = reports[0];
  const latestPercent = latestReport?.percent ?? 0;
  const isActive = project.status?.toLowerCase() === "active";
  const isCompleted = project.status?.toLowerCase() === "completed";

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link
              to={isTeacher ? "/teacher/students" : "/projects"}
              className="text-[#006A60] font-semibold hover:underline"
            >
              ← {isTeacher ? "Sinh viên hướng dẫn" : "Tiến độ đồ án"}
            </Link>
            <span>/</span>
            <span>Chi tiết tiến độ</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Theo Dõi Tiến Độ Đồ Án
          </h1>
        </div>

        {/* Nút nghiệm thu cho Giảng viên */}
        {isTeacher && isActive && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleUpdateStatus("completed")}
              disabled={busy}
              className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition disabled:opacity-50"
            >
              ✓ Nghiệm thu Hoàn thành
            </button>
            <button
              onClick={() => handleUpdateStatus("cancelled")}
              disabled={busy}
              className="rounded-full border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
            >
              Hủy đồ án
            </button>
          </div>
        )}
      </div>

      {/* Card Thông tin Đề tài & Tổng quan */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  isActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : isCompleted
                    ? "border-sky-200 bg-sky-50 text-sky-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {isActive ? "Đang thực hiện" : isCompleted ? "Đã hoàn thành" : "Đã hủy"}
              </span>
              <span className="text-xs text-slate-400">Mã phân công: #{project.id}</span>
            </div>
            <Link
              to={`/topics/${project.topic}`}
              className="text-lg font-bold text-slate-900 hover:text-[#006A60] transition-colors block leading-snug"
              title="Xem chi tiết đề tài gốc"
            >
              {project.topic_title}
            </Link>
            <p className="text-xs text-slate-500">
              GVHD:{" "}
              <strong className="text-slate-700">
                {project.proposed_by_detail?.first_name} {project.proposed_by_detail?.last_name}
              </strong>{" "}
              • Hạn nộp:{" "}
              <span className="font-semibold text-slate-700">
                {project.due_date ? new Date(project.due_date).toLocaleDateString("vi-VN") : "Chưa đặt"}
              </span>
            </p>
            {project.note && (
              <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic">
                Lời dặn của GV: &quot;{project.note}&quot;
              </p>
            )}
          </div>

          {/* Khối Tiến độ % */}
          <div className="w-full md:w-56 p-4 rounded-xl bg-teal-50/60 border border-teal-100 text-center shrink-0">
            <span className="text-[10px] uppercase font-bold text-[#006A60] tracking-wider block">
              Tiến độ hoàn thành
            </span>
            <div className="text-3xl font-black text-[#006A60] mt-1">{latestPercent}%</div>
            <div className="w-full h-2 bg-teal-200/60 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-[#006A60] rounded-full transition-all duration-500"
                style={{ width: `${latestPercent}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-500 mt-2 block font-medium">
              Đã gửi {reports.length} đợt báo cáo
            </span>
          </div>
        </div>

        {/* Danh sách Sinh viên thực hiện */}
        <div>
          <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2.5">
            Sinh viên thực hiện đồ án ({project.students_detail?.length || 0})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {project.students_detail?.map((sv) => {
              const initials = `${sv.first_name?.[0] || ""}${sv.last_name?.[0] || ""}`.toUpperCase() || "SV";
              return (
                <div
                  key={sv.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#006A60]/10 text-xs font-bold text-[#006A60]">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {sv.first_name} {sv.last_name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      MSSV: <span className="font-semibold text-slate-700">{sv.student_code || "N/A"}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Lớp: {sv.class_name || "N/A"} • {sv.email}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Form Nộp báo cáo cho Sinh viên */}
      {!isTeacher && isActive && (
        <form
          onSubmit={handleStudentSubmitReport}
          className="rounded-2xl border border-teal-200/80 bg-white p-6 shadow-xs space-y-4"
        >
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>📤</span> Gửi Báo Cáo Tiến Độ Mới
            </h3>
            <span className="text-[11px] text-slate-400">Cập nhật định kỳ cho GVHD</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Mốc báo cáo <span className="text-rose-500">*</span>
              </label>
              <input
                name="period_label"
                required
                maxLength={100}
                placeholder="VD: Tuần 4, Giai đoạn 2..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#006A60] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Giai đoạn công việc
              </label>
              <input
                name="stage"
                maxLength={100}
                placeholder="VD: Thiết kế cơ sở dữ liệu..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#006A60] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Ước tính hoàn thành (%) <span className="text-rose-500">*</span>
              </label>
              <input
                name="percent"
                type="number"
                required
                min={0}
                max={100}
                defaultValue={latestPercent}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#006A60] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Chi tiết công việc đã thực hiện <span className="text-rose-500">*</span>
            </label>
            <textarea
              name="content"
              required
              rows={3}
              placeholder="Mô tả các kết quả đạt được, khó khăn gặp phải, kế hoạch tuần tới..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-[#006A60] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Tài liệu đính kèm (PDF, Word, ZIP - Tối đa 20 MB)
            </label>
            <input
              name="attachment"
              type="file"
              accept=".pdf,.doc,.docx,.zip"
              className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-600 bg-slate-50/50"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-[#006A60] px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#00524a] disabled:opacity-50 transition"
            >
              {busy ? "Đang gửi..." : "Gửi Báo Cáo"}
            </button>
          </div>
        </form>
      )}

      {/* Timeline Tiến độ Báo cáo & Nhận xét */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Lịch Sử Báo Cáo & Nhận Xét ({reports.length})
          </h3>
          <span className="text-xs text-slate-400">Xếp theo mốc thời gian gần nhất</span>
        </div>

        {isReportsLoading ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            Đang tải danh sách báo cáo...
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 space-y-1">
            <p className="font-semibold text-slate-600">Chưa có báo cáo tiến độ nào được gửi.</p>
            <p className="text-xs">Sinh viên thực hiện đồ án cần nộp báo cáo định kỳ để GVHD theo dõi.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report, idx) => (
              <div
                key={report.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3 relative overflow-hidden"
              >
                {/* Dải tiến độ bên cạnh */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[#006A60] text-[10px] font-bold text-white">
                      #{reports.length - idx}
                    </span>
                    <div>
                      <span className="text-xs font-bold text-slate-800">{report.period_label}</span>
                      {report.stage && (
                        <span className="text-xs text-slate-500 font-medium ml-2">
                          • {report.stage}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-black text-[#006A60] text-sm">{report.percent}%</span>
                    {report.is_late && (
                      <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                        Nộp trễ hạn
                      </span>
                    )}
                    <span className="text-slate-400 text-[11px]">
                      {new Date(report.submitted_at).toLocaleString("vi-VN")}
                    </span>
                  </div>
                </div>

                {/* Nội dung kết quả */}
                <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {report.content}
                </div>

                {/* Tệp đính kèm */}
                {report.attachment && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => downloadAttachment(report.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <span>📎</span>
                      <span>Tải tài liệu đính kèm</span>
                    </button>
                  </div>
                )}

                {/* Danh sách nhận xét từ Giảng viên */}
                {report.feedbacks && report.feedbacks.length > 0 && (
                  <div className="mt-3 rounded-xl bg-teal-50/50 p-3.5 border border-teal-100/80 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#006A60]">
                      Nhận xét của Giảng viên ({report.feedbacks.length}):
                    </div>
                    {report.feedbacks.map((fb) => (
                      <div
                        key={fb.id}
                        className="p-3 rounded-lg bg-white border border-teal-100 shadow-2xs space-y-1.5 text-xs"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-800">
                            {fb.teacher_info?.first_name} {fb.teacher_info?.last_name}
                          </span>
                          <div className="flex items-center gap-2">
                            {fb.score != null && (
                              <span className="font-black text-[#006A60]">{fb.score}/10</span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                fb.result === "passed"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : fb.result === "need_revision"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {fb.result_display || fb.result}
                            </span>
                          </div>
                        </div>
                        <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{fb.comment}</p>
                        <span className="text-[10px] text-slate-400 block">
                          {new Date(fb.created_at).toLocaleString("vi-VN")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Nhận xét cho Giảng viên */}
                {isTeacher && (
                  <div className="pt-2 flex justify-end">
                    {activeFeedbackReportId === report.id ? (
                      <div className="w-full mt-2 p-4 rounded-xl border border-teal-200 bg-teal-50/40 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-[#006A60]">
                            Thêm nhận xét cho {report.period_label}
                          </span>
                          <button
                            onClick={() => setActiveFeedbackReportId(null)}
                            className="text-xs text-slate-400 hover:text-slate-700"
                          >
                            Đóng
                          </button>
                        </div>

                        <textarea
                          rows={3}
                          placeholder="Nhập nội dung góp ý, đánh giá tiến độ cho sinh viên..."
                          value={fbComment}
                          onChange={(e) => setFbComment(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-white focus:border-[#006A60] focus:outline-none"
                        />

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div>
                              <label className="text-[11px] font-bold text-slate-600 mr-1.5">Kết quả:</label>
                              <select
                                value={fbResult}
                                onChange={(e: any) => setFbResult(e.target.value)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs bg-white"
                              >
                                <option value="passed">Đạt yêu cầu</option>
                                <option value="need_revision">Cần chỉnh sửa</option>
                                <option value="failed">Không đạt</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-slate-600 mr-1.5">Điểm (thang 10):</label>
                              <input
                                type="number"
                                min={0}
                                max={10}
                                step={0.1}
                                placeholder="Tùy chọn"
                                value={fbScore}
                                onChange={(e) => setFbScore(e.target.value)}
                                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs bg-white"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveFeedbackReportId(null)}
                              className="rounded-full border border-slate-200 px-3.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTeacherAddFeedback(report.id)}
                              disabled={busy}
                              className="rounded-full bg-[#006A60] px-4 py-1 text-xs font-bold text-white shadow-xs hover:bg-[#00524a] disabled:opacity-50"
                            >
                              {busy ? "Đang lưu..." : "Lưu nhận xét"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveFeedbackReportId(report.id);
                          setFbComment("");
                          setFbScore("");
                          setFbResult("passed");
                        }}
                        className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold text-[#006A60] hover:bg-teal-100 transition inline-flex items-center gap-1.5"
                      >
                        <span>💬</span>
                        <span>Nhận xét / Đánh giá</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
