import React, { useEffect, useState } from "react";
import { teacherApi } from "../api";
import type { Topic, UserDetail } from "../types";

interface Props {
  topic: Topic;
  onClose: () => void;
  onSuccess: () => void;
}

/** Tạo avatar 2 ký tự từ tên */
function initials(sv: UserDetail) {
  const f = sv.first_name?.[0] ?? "";
  const l = sv.last_name?.[0] ?? "";
  return (f + l).toUpperCase() || sv.username.slice(0, 2).toUpperCase();
}

export const AssignTopicModal: React.FC<Props> = ({ topic, onClose, onSuccess }) => {
  const [students, setStudents] = useState<UserDetail[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setIsLoading(true);
    teacherApi
      .getAssignableStudents(topic.semester, search)
      .then(setStudents)
      .catch(() => setErrorMsg("Không thể tải danh sách sinh viên."))
      .finally(() => setIsLoading(false));
  }, [topic.semester, search]);

  const isSameCohort = (sv: UserDetail) =>
    !topic.cohort || !sv.cohort || sv.cohort === topic.cohort;

  const toggleSelect = (sv: UserDetail) => {
    if (!isSameCohort(sv)) return; // disabled — không cùng khóa
    if (selectedIds.includes(sv.id)) {
      setSelectedIds(selectedIds.filter((id) => id !== sv.id));
    } else {
      if (selectedIds.length >= topic.max_students) {
        setErrorMsg(`Đề tài này chỉ cho phép tối đa ${topic.max_students} sinh viên.`);
        return;
      }
      setErrorMsg("");
      setSelectedIds([...selectedIds, sv.id]);
    }
  };

  const removeSelected = (id: number) =>
    setSelectedIds(selectedIds.filter((s) => s !== id));

  const selectedStudents = students.filter((sv) => selectedIds.includes(sv.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất 1 sinh viên.");
      return;
    }
    try {
      setIsSubmitting(true);
      setErrorMsg("");
      await teacherApi.assignTopic(topic.id, selectedIds, dueDate, note);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Giao đề tài thất bại. Kiểm tra lại thông tin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[92vh]">

        {/* ── Header ── */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#006A60] mb-1">Giao đề tài cho Sinh viên</p>
            <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{topic.title}</h3>
          </div>
          <button onClick={onClose} className="shrink-0 text-slate-400 hover:text-slate-700 transition-colors text-lg leading-none">✕</button>
        </div>

        {/* ── Thông tin đề tài ── */}
        <div className="mx-6 mt-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-slate-400 text-[10px] uppercase font-bold mb-0.5">Bộ môn</p>
            <p className="font-semibold text-slate-800 truncate">{topic.department_name || "—"}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] uppercase font-bold mb-0.5">Khóa SV</p>
            <p className="font-semibold text-slate-800">{topic.cohort_name || "—"}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] uppercase font-bold mb-0.5">Tối đa</p>
            <p className="font-semibold text-slate-800">{topic.max_students} sinh viên</p>
          </div>
        </div>

        {/* ── Cảnh báo khóa ── */}
        {topic.cohort_name && (
          <div className="mx-6 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 flex items-center gap-2">
            <span>⚠️</span>
            <span>Chỉ có thể giao cho sinh viên thuộc <strong>Khóa {topic.cohort_name}</strong>. SV khóa khác sẽ bị vô hiệu hóa.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 px-6 pb-5 mt-4 space-y-4 overflow-y-auto">

          {/* ── Lỗi ── */}
          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 flex gap-2">
              <span>❌</span><span>{errorMsg}</span>
            </div>
          )}

          {/* ── Chọn sinh viên ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">
                Chọn Sinh viên <span className="text-slate-400 font-normal">(tối đa {topic.max_students} SV)</span>
              </label>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                selectedIds.length >= topic.max_students
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}>
                Đã chọn: {selectedIds.length}/{topic.max_students}
              </span>
            </div>

            {/* Tìm kiếm */}
            <div className="relative mb-2">
              <svg className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Tìm theo tên, MSSV, lớp..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 pl-8 pr-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
              />
            </div>

            {/* Danh sách SV */}
            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-5 text-center text-xs text-slate-400">Đang tải danh sách sinh viên...</div>
              ) : students.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-400">Không tìm thấy sinh viên nào có thể giao.</div>
              ) : (
                students.map((sv) => {
                  const isChecked = selectedIds.includes(sv.id);
                  const sameCohort = isSameCohort(sv);
                  const isDisabled = !sameCohort;

                  return (
                    <div
                      key={sv.id}
                      onClick={() => !isDisabled && toggleSelect(sv)}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        isDisabled
                          ? "cursor-not-allowed opacity-40 bg-slate-50/50"
                          : isChecked
                            ? "bg-[#E6F4F1] cursor-pointer"
                            : "cursor-pointer hover:bg-slate-50"
                      }`}
                      title={isDisabled ? "Sinh viên không thuộc khóa học của đề tài" : undefined}
                    >
                      {/* Avatar chữ */}
                      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        isChecked ? "bg-[#006A60] text-white" : "bg-slate-100 text-slate-600"
                      }`}>
                        {initials(sv)}
                      </div>

                      {/* Thông tin */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${isChecked ? "text-[#006A60]" : "text-slate-800"}`}>
                          {sv.first_name} {sv.last_name}
                          <span className="ml-1 text-slate-400 font-normal">({sv.username})</span>
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          MSSV: {sv.student_code || "N/A"}
                          {sv.class_name ? ` · Lớp: ${sv.class_name}` : ""}
                          {isDisabled && " · ⚠️ Khác khóa"}
                        </p>
                      </div>

                      {/* Checkbox custom */}
                      <div className={`shrink-0 h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                        isChecked ? "bg-[#006A60] border-[#006A60]" : "border-slate-300 bg-white"
                      }`}>
                        {isChecked && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Pill tag SV đã chọn ── */}
          {selectedStudents.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Sinh viên đã chọn</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedStudents.map((sv) => (
                  <span
                    key={sv.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#006A60] pl-2.5 pr-1.5 py-1 text-xs font-semibold text-white"
                  >
                    {sv.first_name} {sv.last_name}
                    <button
                      type="button"
                      onClick={() => removeSelected(sv.id)}
                      className="grid h-4 w-4 place-items-center rounded-full bg-white/20 hover:bg-white/40 transition-colors text-[10px] font-bold"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Due date & Ghi chú ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Thời hạn hoàn thành</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Ghi chú giao việc</label>
              <input
                type="text"
                placeholder="Ví dụ: Nộp đề cương tuần tới"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
              />
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedIds.length === 0}
              className="rounded-full bg-[#006A60] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#00524a] disabled:opacity-40 transition-colors"
            >
              {isSubmitting ? "Đang xử lý..." : `Xác nhận Giao Đề Tài${selectedIds.length > 0 ? ` (${selectedIds.length} SV)` : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
