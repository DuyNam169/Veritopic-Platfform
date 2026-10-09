import React, { useState } from "react";
import type { SimilarTopicResult, Topic } from "../types";
import { SimilarityBadge } from "./SimilarityBadge";

interface Props {
  results: SimilarTopicResult[];
  exactDuplicate?: boolean;
  isLoading?: boolean;
  currentDraft?: { title: string; description: string };
}

export const SimilarityPanel: React.FC<Props> = ({
  results,
  exactDuplicate,
  isLoading,
  currentDraft,
}) => {
  const [comparingTopic, setComparingTopic] = useState<Topic | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs text-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <p className="mt-2 text-sm text-slate-500 font-medium">Đang phân tích tương đồng ngữ nghĩa bằng AI...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {exactDuplicate && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-800 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-sm">
            <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Phát hiện trùng tên chính xác!
          </div>
          <p className="mt-1 text-xs text-rose-700">
            Tên đề tài bạn nhập đã trùng 100% với một đề tài đã có trong hệ thống. Vui lòng kiểm tra lại.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
            <span>Kết quả so sánh trùng lặp / tương đồng</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
              {results.length} kết quả
            </span>
          </h3>
        </div>

        {results.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">
            Không tìm thấy đề tài nào tương đồng đáng kể. Đề tài của bạn có vẻ rất mới lạ!
          </p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100">
            {results.map((r, idx) => (
              <div key={r.topic.id || idx} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <h4 className="text-sm font-medium text-slate-900 line-clamp-2">
                    {r.topic.title}
                  </h4>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {r.topic.description || "Không có mô tả."}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <SimilarityBadge percent={r.similarity_percent} level={r.warning_level} />
                  <button
                    type="button"
                    onClick={() => setComparingTopic(r.topic)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    So sánh song song
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal So Sánh Song Song */}
      {comparingTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">So sánh đối chiếu song song</h3>
              <button
                onClick={() => setComparingTopic(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                  Đề tài đang soạn thảo (Bản của bạn)
                </span>
                <h4 className="font-semibold text-slate-900 text-sm">{currentDraft?.title || "Chưa có tên"}</h4>
                <p className="text-xs text-slate-600 whitespace-pre-wrap">{currentDraft?.description || "Chưa có mô tả"}</p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                  Đề tài đối chiếu trong ngân hàng
                </span>
                <h4 className="font-semibold text-slate-900 text-sm">{comparingTopic.title}</h4>
                <p className="text-xs text-slate-600 whitespace-pre-wrap">{comparingTopic.description || "Chưa có mô tả"}</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setComparingTopic(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                Đóng đối chiếu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
