import type { SimilarTopicResult, WarningLevel } from "../types";

const LABEL: Record<WarningLevel, string> = {
  normal: "Bình thường",
  review: "Cần xem xét",
  high: "Tương đồng cao",
  duplicate: "Có khả năng trùng đề tài",
};

const COLOR_CLASS: Record<WarningLevel, string> = {
  normal: "bg-warning-normal/10 text-warning-normal",
  review: "bg-warning-review/10 text-warning-review",
  high: "bg-warning-high/10 text-warning-high",
  duplicate: "bg-warning-duplicate/10 text-warning-duplicate",
};

/** Hiển thị danh sách Top đề tài tương đồng kèm % và nhãn màu theo mức cảnh báo (Chương 2, mục 2.1.5). */
export default function SimilarityWarning({ results }: { results: SimilarTopicResult[] }) {
  if (results.length === 0) {
    return <p className="text-sm text-slate-500">Không tìm thấy đề tài tương đồng.</p>;
  }

  return (
    <ul className="space-y-2">
      {results.map((r) => (
        <li key={r.topic.id} className="flex items-center justify-between rounded-md border p-3">
          <span className="text-sm">{r.topic.title}</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${COLOR_CLASS[r.warning_level]}`}>
            {r.similarity_percent}% — {LABEL[r.warning_level]}
          </span>
        </li>
      ))}
    </ul>
  );
}
