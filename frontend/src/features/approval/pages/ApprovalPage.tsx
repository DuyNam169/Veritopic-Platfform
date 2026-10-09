import { useState } from "react";
import { useApproveTopic, usePendingTopics, useRejectTopic, useRequestRenameTopic } from "../hooks";
import { parseKeywords } from "@/shared/lib/keywords";

/** Trang duyệt đề tài — dành cho Admin/Trưởng bộ môn. */
export default function ApprovalPage() {
  const rawPending = usePendingTopics();
  const pendingTopics = Array.isArray(rawPending.data) ? rawPending.data : [];
  const isLoading = rawPending.isLoading;
  const approveMutation = useApproveTopic();
  const rejectMutation = useRejectTopic();
  const requestRenameMutation = useRequestRenameTopic();

  const [activeTopicId, setActiveTopicId] = useState<number | null>(null);
  const [modalType, setModalType] = useState<"rename" | "reject" | null>(null);
  const [note, setNote] = useState("");

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-slate-400">Đang tải danh sách đề tài chờ duyệt...</div>;
  }

  const handleAction = () => {
    if (!activeTopicId || !modalType) return;

    if (modalType === "rename") {
      requestRenameMutation.mutate(
        { id: activeTopicId, note },
        {
          onSuccess: () => {
            alert("Đã gửi yêu cầu sửa tên/nội dung đề tài!");
            closeModal();
          },
        }
      );
    } else if (modalType === "reject") {
      rejectMutation.mutate(
        { id: activeTopicId, note },
        {
          onSuccess: () => {
            alert("Đã từ chối đề tài!");
            closeModal();
          },
        }
      );
    }
  };

  const closeModal = () => {
    setActiveTopicId(null);
    setModalType(null);
    setNote("");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Duyệt Đề tài Đồ án</h1>
        <p className="text-sm text-slate-500">Danh sách các đề tài do Giảng viên đề xuất đang chờ Trưởng bộ môn phê duyệt.</p>
      </div>

      {(!pendingTopics || pendingTopics.length === 0) ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 space-y-2 shadow-xs">
          <p className="text-sm font-semibold">Hiện tại không có đề tài nào đang chờ duyệt.</p>
          <p className="text-xs text-slate-400">Tất cả đề xuất đã được xử lý xong.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingTopics.map((topic) => (
            <div key={topic.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">#{topic.id}</span>
                  <h3 className="font-bold text-slate-900 text-base mt-1">{topic.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Người đề xuất: <span className="font-medium text-slate-700">{topic.proposed_by_detail?.first_name} {topic.proposed_by_detail?.last_name}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (confirm(`Bạn chắc chắn muốn duyệt đề tài "${topic.title}"?`)) {
                        approveMutation.mutate({ id: topic.id });
                      }
                    }}
                    disabled={approveMutation.isPending}
                    className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                  >
                    ✓ Duyệt
                  </button>
                  <button
                    onClick={() => {
                      setActiveTopicId(topic.id);
                      setModalType("rename");
                    }}
                    className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-600 shadow-xs"
                  >
                    ✏️ Yêu cầu sửa
                  </button>
                  <button
                    onClick={() => {
                      setActiveTopicId(topic.id);
                      setModalType("reject");
                    }}
                    className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 shadow-xs"
                  >
                    ✕ Từ chối
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-700">Mô tả đề tài:</p>
                <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">{topic.description || "Không có mô tả"}</p>
              </div>

              {parseKeywords(topic.keywords).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {parseKeywords(topic.keywords).map((k) => (
                    <span key={k} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">
                      #{k}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal nhập ghi chú yêu cầu sửa / lý do từ chối */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">
              {modalType === "rename" ? "✏️ Yêu cầu sửa tên / nội dung đề tài" : "✕ Lý do từ chối đề tài"}
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {modalType === "rename" ? "Nhập yêu cầu chi tiết để Giảng viên chỉnh sửa:" : "Nhập lý do từ chối:"}
              </label>
              <textarea
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={modalType === "rename" ? "Ví dụ: Cần làm rõ phạm vi và công nghệ áp dụng..." : "Ví dụ: Ý tưởng trùng lặp với đề tài đã nghiệm thu..."}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleAction}
                disabled={!note.trim()}
                className={`rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-50 ${
                  modalType === "rename" ? "bg-amber-600 hover:bg-amber-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                Gửi phản hồi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
