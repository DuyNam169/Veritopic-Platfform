import React, { useEffect, useState } from "react";
import { teacherApi } from "../api";
import type { Topic, UnifiedAdviseeStudent } from "../types";

interface Props {
  student: UnifiedAdviseeStudent;
  availablePeers?: UnifiedAdviseeStudent[];
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignTopicToStudentModal: React.FC<Props> = ({
  student,
  availablePeers = [],
  onClose,
  onSuccess,
}) => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [selectedPeerIds, setSelectedPeerIds] = useState<number[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setIsLoading(true);
    teacherApi
      .getMyTopics({ status: "approved" })
      .then((res: any) => {
        const list: Topic[] = Array.isArray(res) ? res : res?.results || [];
        // Lọc các đề tài đã duyệt
        setTopics(list.filter((t) => t.status === "approved"));
      })
      .catch(() => setErrorMsg("Không thể tải danh sách đề tài của bạn."))
      .finally(() => setIsLoading(false));
  }, []);

  const selectedTopic = topics.find((t) => t.id === selectedTopicId);

  // Khi đổi đề tài, reset danh sách bạn cùng nhóm
  useEffect(() => {
    setSelectedPeerIds([]);
  }, [selectedTopicId]);

  // Kiểm tra tính tương thích về khóa
  const isCohortCompatible = (t: Topic) => {
    if (!t.cohort || !student.cohort_id) return true;
    return t.cohort === student.cohort_id;
  };

  // Kiểm tra xem đề tài đã đầy slot chưa
  const isTopicFull = (t: Topic) => {
    if (t.is_assigned && (t.assignment_count ?? 1) >= t.max_students) {
      return true;
    }
    return false;
  };

  // Lọc các bạn cùng khóa/bộ môn có thể ghép nhóm
  const eligiblePeers = availablePeers.filter((p) => {
    if (p.has_topic) return false;
    if (student.cohort_id && p.cohort_id && p.cohort_id !== student.cohort_id) return false;
    return true;
  });

  const togglePeer = (peerId: number) => {
    if (!selectedTopic) return;
    if (selectedPeerIds.includes(peerId)) {
      setSelectedPeerIds(selectedPeerIds.filter((id) => id !== peerId));
    } else {
      if (1 + selectedPeerIds.length >= selectedTopic.max_students) {
        setErrorMsg(`Đề tài này chỉ cho phép tối đa ${selectedTopic.max_students} sinh viên.`);
        return;
      }
      setErrorMsg("");
      setSelectedPeerIds([...selectedPeerIds, peerId]);
    }
  };

  // Lọc theo từ khóa tìm kiếm
  const filteredTopics = topics.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      (t.department_name && t.department_name.toLowerCase().includes(q)) ||
      (t.cohort_name && t.cohort_name.toLowerCase().includes(q))
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopicId) {
      setErrorMsg("Vui lòng chọn một đề tài để giao cho sinh viên.");
      return;
    }
    if (selectedTopic && !isCohortCompatible(selectedTopic)) {
      setErrorMsg(
        `Đề tài này chỉ dành cho Khóa ${selectedTopic.cohort_name || ""}, không thể giao cho sinh viên ${
          student.cohort_name ? `Khóa ${student.cohort_name}` : ""
        }.`
      );
      return;
    }

    const allStudentIds = [student.student_id, ...selectedPeerIds];

    try {
      setIsSubmitting(true);
      setErrorMsg("");
      await teacherApi.assignTopic(selectedTopicId, allStudentIds, dueDate, note);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Giao đề tài thất bại. Vui lòng kiểm tra lại điều kiện.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#006A60] block mb-1">
              Phân công đề tài cho Sinh viên
            </span>
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              Giao Đề Tài Đồ Án
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors text-lg leading-none p-1"
          >
            ✕
          </button>
        </div>

        {/* Thông tin sinh viên nhận đề tài */}
        <div className="mx-6 mt-4 p-4 rounded-xl border border-teal-100 bg-teal-50/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#006A60] text-xs font-bold text-white shadow-xs">
              {student.student_name.split(" ").slice(-2).map((w) => w[0]).join("").toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800">{student.student_name}</div>
              <div className="text-slate-500 font-medium">
                MSSV: <span className="font-semibold text-slate-700">{student.student_code || "N/A"}</span> • Lớp: {student.class_name || "N/A"}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-teal-800">
              {student.cohort_name ? `Khóa ${student.cohort_name}` : "Chưa rõ khóa"}
            </div>
            <div className="text-slate-500">{student.department_name || "—"}</div>
          </div>
        </div>

        {/* Form chính */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 px-6 pb-5 mt-3 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 flex gap-2 items-center">
              <span>❌</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Chọn đề tài */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">
                Chọn Đề tài đã duyệt của bạn <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-semibold text-slate-400">
                {filteredTopics.length} đề tài khả dụng
              </span>
            </div>

            {/* Tìm kiếm đề tài */}
            <div className="relative mb-2.5">
              <svg
                className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Tìm đề tài theo tên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-8 pr-3 py-1.5 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none transition-colors"
              />
            </div>

            {/* Danh sách đề tài */}
            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/30">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">Đang tải danh sách đề tài...</div>
              ) : filteredTopics.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Không tìm thấy đề tài nào đã được duyệt phù hợp.
                </div>
              ) : (
                filteredTopics.map((t) => {
                  const compatible = isCohortCompatible(t);
                  const full = isTopicFull(t);
                  const isSelected = selectedTopicId === t.id;
                  const disabled = !compatible || full;

                  return (
                    <div
                      key={t.id}
                      onClick={() => !disabled && setSelectedTopicId(t.id)}
                      className={`p-3 transition-colors flex items-start gap-3 cursor-pointer ${
                        disabled
                          ? "opacity-50 cursor-not-allowed bg-slate-100/60"
                          : isSelected
                          ? "bg-teal-50/80 border-l-4 border-[#006A60]"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="topic"
                        checked={isSelected}
                        disabled={disabled}
                        onChange={() => setSelectedTopicId(t.id)}
                        className="mt-1 accent-[#006A60]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-800 line-clamp-2">{t.title}</span>
                          {t.cohort_name && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600">
                              Khóa {t.cohort_name}
                            </span>
                          )}
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600">
                            Tối đa: {t.max_students} SV
                          </span>
                        </div>
                        {t.description && (
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{t.description}</p>
                        )}
                        {!compatible && (
                          <p className="text-[10px] text-rose-600 font-semibold mt-1">
                            ⚠️ Khác khóa học với sinh viên (Đề tài yêu cầu Khóa {t.cohort_name})
                          </p>
                        )}
                        {full && (
                          <p className="text-[10px] text-amber-600 font-semibold mt-1">
                            ⚠️ Đề tài này đã đủ số lượng sinh viên ({t.max_students}/{t.max_students})
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Ghép nhóm sinh viên nếu đề tài cho phép > 1 sinh viên */}
          {selectedTopic && selectedTopic.max_students > 1 && eligiblePeers.length > 0 && (
            <div className="p-3.5 rounded-xl border border-teal-200/80 bg-teal-50/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span>👥</span> Ghép nhóm sinh viên cùng thực hiện
                </span>
                <span className="text-[11px] font-semibold text-[#006A60]">
                  Đã chọn: {1 + selectedPeerIds.length} / {selectedTopic.max_students} SV
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Đề tài này cho phép tối đa {selectedTopic.max_students} SV. Bạn có thể chọn thêm các bạn khác vào làm chung:
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1">
                {eligiblePeers.map((p) => {
                  const isChecked = selectedPeerIds.includes(p.student_id);
                  return (
                    <label
                      key={p.student_id}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition ${
                        isChecked
                          ? "bg-teal-50 border-[#006A60] font-semibold text-[#006A60]"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePeer(p.student_id)}
                          className="accent-[#006A60] rounded"
                        />
                        <span>{p.student_name}</span>
                        <span className="text-slate-400 text-[11px]">({p.student_code || "N/A"} - {p.class_name || "N/A"})</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {p.cohort_name ? `Khóa ${p.cohort_name}` : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Thiết lập hạn nộp và ghi chú */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Thời hạn hoàn thành đồ án <span className="text-slate-400 font-normal">(tùy chọn)</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-[#006A60] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Ghi chú / Dặn dò cho SV <span className="text-slate-400 font-normal">(tùy chọn)</span>
              </label>
              <input
                type="text"
                placeholder="VD: Liên hệ thầy trước thứ Sáu..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-[#006A60] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedTopicId}
              className="rounded-full bg-[#006A60] px-6 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#00524a] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isSubmitting ? "Đang xử lý..." : `Xác nhận Giao đề tài (${1 + selectedPeerIds.length} SV)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
