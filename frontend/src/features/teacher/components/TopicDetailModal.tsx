import React, { useEffect, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import type { Topic } from "../types";
import { api } from "@/shared/lib/axios";

interface Props {
  topic: Topic;
  onClose: () => void;
}

export const TopicDetailModal: React.FC<Props> = ({ topic, onClose }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get(`/topics/topics/${topic.id}/history/`)
      .then((r) => setHistory(r.data))
      .catch(() => setHistory([]))
      .finally(() => setIsLoading(false));
  }, [topic.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-5">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">#{topic.id}</span>
            <h2 className="text-lg font-bold text-slate-900 mt-1">{topic.title}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-sm">
            ✕
          </button>
        </div>

        {/* General Info */}
        <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
          <div>
            <span className="text-slate-500">Trạng thái:</span>{" "}
            <StatusBadge status={topic.status} />
          </div>
          <div>
            <span className="text-slate-500">Số SV tối đa:</span>{" "}
            <span className="font-bold text-slate-800">{topic.max_students} sinh viên</span>
          </div>
          <div>
            <span className="text-slate-500">Ngày tạo:</span>{" "}
            <span className="font-medium text-slate-700">{new Date(topic.created_at).toLocaleString("vi-VN")}</span>
          </div>
          <div>
            <span className="text-slate-500">Yêu cầu:</span>{" "}
            <span className="font-medium text-slate-700">{topic.requirements || "Không có"}</span>
          </div>
        </div>

        {/* Description */}
        <div>
          <h4 className="text-xs font-bold text-slate-900 mb-1">Mô tả chi tiết</h4>
          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap leading-relaxed">
            {topic.description || "Chưa có mô tả chi tiết."}
          </p>
        </div>

        {/* Review note if any */}
        {topic.review_note && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
            <span className="font-bold">📌 Ghi chú từ Trưởng bộ môn:</span>
            <p>{topic.review_note}</p>
          </div>
        )}

        {/* Audit Log / History */}
        <div>
          <h4 className="text-xs font-bold text-slate-900 mb-2">Lịch sử tác động (Audit Log)</h4>
          {isLoading ? (
            <div className="text-xs text-slate-400">Đang tải lịch sử...</div>
          ) : history.length === 0 ? (
            <div className="text-xs text-slate-400">Chưa có lịch sử thay đổi.</div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-[11px] p-2 bg-slate-50 rounded border border-slate-100">
                  <div>
                    <span className="font-bold text-slate-800">{h.actor_name || "Hệ thống"}</span>:{" "}
                    <span className="text-slate-600">{h.note || h.action}</span>
                  </div>
                  <span className="text-slate-400 text-[10px]">{new Date(h.created_at).toLocaleString("vi-VN")}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
