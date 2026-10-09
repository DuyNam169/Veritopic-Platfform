import React, { useEffect, useState } from "react";
import { teacherApi } from "../api";
import type { Topic, UserDetail } from "../types";

interface Props {
  topic: Topic;
  onClose: () => void;
  onSuccess: () => void;
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

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length >= topic.max_students) {
        alert(`Đề tài này chỉ cho phép chọn tối đa ${topic.max_students} sinh viên.`);
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Giao đề tài cho Sinh viên</h3>
            <p className="text-xs text-slate-500 line-clamp-1">{topic.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Chọn Sinh viên (Tối đa {topic.max_students} SV)
              </label>
              <span className="text-xs text-indigo-600 font-bold">
                Đã chọn: {selectedIds.length}/{topic.max_students}
              </span>
            </div>

            <input
              type="text"
              placeholder="Tìm theo tên, MSSV, lớp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs mb-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />

            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 p-1">
              {isLoading ? (
                <div className="p-4 text-center text-xs text-slate-400">Đang tải danh sách SV...</div>
              ) : students.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">Không tìm thấy SV nào có thể giao.</div>
              ) : (
                students.map((sv) => {
                  const isChecked = selectedIds.includes(sv.id);
                  return (
                    <div
                      key={sv.id}
                      onClick={() => toggleSelect(sv.id)}
                      className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-xs transition-colors ${
                        isChecked ? "bg-indigo-50 text-indigo-900 font-medium" : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{sv.first_name} {sv.last_name} ({sv.username})</div>
                        <div className="text-[11px] text-slate-500">MSSV: {sv.student_code || "N/A"} • Lớp: {sv.class_name || "N/A"}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="h-4 w-4 rounded-sm text-indigo-600 border-slate-300"
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Thời hạn hoàn thành (Due Date)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú giao việc</label>
              <input
                type="text"
                placeholder="Ví dụ: Nộp đề cương tuần tới"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? "Đang xử lý..." : "Xác nhận Giao Đề Tài"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
