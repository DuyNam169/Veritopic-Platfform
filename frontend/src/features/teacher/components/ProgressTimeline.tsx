import React, { useState } from "react";
import { teacherApi } from "../api";
import type { ProgressReport } from "../types";

interface Props {
  reports: ProgressReport[];
  onFeedbackAdded: () => void;
}

export const ProgressTimeline: React.FC<Props> = ({ reports, onFeedbackAdded }) => {
  const [activeReportId, setActiveReportId] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [score, setScore] = useState<string>("");
  const [result, setResult] = useState<"passed" | "need_revision" | "failed">("passed");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSendFeedback = async (reportId: number) => {
    if (!comment.trim()) {
      setErrorMsg("Nội dung nhận xét không được để trống.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");
      await teacherApi.addProgressFeedback(reportId, {
        comment,
        score: score ? parseFloat(score) : undefined,
        result,
      });
      alert("Đã lưu nhận xét tiến độ thành công!");
      setComment("");
      setScore("");
      setActiveReportId(null);
      onFeedbackAdded();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.comment?.[0] || err.response?.data?.detail || "Gửi nhận xét thất bại. Vui lòng kiểm tra lại kết nối và thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">Chưa có báo cáo tiến độ nào được nộp cho đợt này.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reports.map((report) => (
        <div key={report.id} className="relative pl-6 border-l-2 border-indigo-200 space-y-3">
          <div className="absolute -left-2 top-0.5 h-3.5 w-3.5 rounded-full bg-indigo-600 border-2 border-white shadow-xs" />

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div>
                <span className="inline-block rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                  {report.period_label}
                </span>
                {report.stage && (
                  <span className="ml-2 text-xs font-medium text-slate-600">
                    • Giai đoạn: {report.stage}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="font-bold text-slate-700">{report.percent}% Hoàn thành</span>
                {report.is_late && (
                  <span className="rounded-md bg-rose-50 px-2 py-0.5 font-bold text-rose-700 border border-rose-200">
                    Trễ hạn
                  </span>
                )}
                <span className="text-slate-400">
                  {new Date(report.submitted_at).toLocaleString("vi-VN")}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
              {report.content}
            </div>

            {report.attachment && (
              <div className="pt-2">
                <a
                  href={teacherApi.getDownloadAttachmentUrl(report.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <span>📎 Tải file đính kèm</span>
                </a>
              </div>
            )}

            {/* Feedbacks list */}
            {report.feedbacks && report.feedbacks.length > 0 && (
              <div className="mt-4 border-t pt-3 space-y-2">
                <span className="text-xs font-bold text-slate-900">Nhận xét của Giảng viên ({report.feedbacks.length}):</span>
                {report.feedbacks.map((fb) => (
                  <div key={fb.id} className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-indigo-900">
                        {fb.teacher_info?.first_name} {fb.teacher_info?.last_name}
                      </span>
                      <div className="flex items-center gap-2">
                        {fb.score !== null && (
                          <span className="font-bold text-emerald-700">Điểm: {fb.score}/10</span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                          fb.result === "passed" ? "bg-emerald-100 text-emerald-800" :
                          fb.result === "need_revision" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                        }`}>
                          {fb.result_display}
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{fb.comment}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Form thêm nhận xét */}
            {activeReportId === report.id ? (
              <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                <h5 className="text-xs font-bold text-indigo-900">Thêm nhận xét cho {report.period_label}</h5>
                {errorMsg && <p className="text-xs text-rose-600">{errorMsg}</p>}

                <textarea
                  rows={3}
                  placeholder="Nhập nội dung nhận xét, góp ý cho sinh viên..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />

                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="text-xs text-slate-700 font-medium mr-2">Kết quả:</label>
                    <select
                      value={result}
                      onChange={(e: any) => setResult(e.target.value)}
                      className="rounded-lg border border-slate-300 p-1.5 text-xs"
                    >
                      <option value="passed">Đạt</option>
                      <option value="need_revision">Cần chỉnh sửa</option>
                      <option value="failed">Không đạt</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-700 font-medium mr-2">Điểm (Tùy chọn):</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      placeholder="0-10"
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                      className="w-20 rounded-lg border border-slate-300 p-1.5 text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveReportId(null)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSendFeedback(report.id)}
                    className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSubmitting ? "Đang gửi..." : "Gửi Nhận Xét"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveReportId(report.id);
                    setComment("");
                    setErrorMsg("");
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  + Thêm nhận xét của Giảng viên
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
