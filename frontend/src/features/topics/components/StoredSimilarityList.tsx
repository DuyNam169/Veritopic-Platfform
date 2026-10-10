import { Link } from "react-router-dom";

import type { StoredSimilarityResult, WarningLevel } from "../types";

const levelStyles: Record<WarningLevel, { label: string; badge: string }> = {
  normal: { label: "Bình thường", badge: "border-slate-200 bg-slate-100 text-slate-600" },
  review: { label: "Cần xem xét", badge: "border-amber-200 bg-amber-50 text-amber-700" },
  high: { label: "Tương đồng cao", badge: "border-orange-200 bg-orange-50 text-orange-700" },
  duplicate: { label: "Có khả năng trùng", badge: "border-rose-200 bg-rose-50 text-rose-700" },
};

const summaryStyles: Record<WarningLevel, { title: string; description: string; className: string }> = {
  normal: {
    title: "Không phát hiện tương đồng đáng kể",
    description: "Các kết quả bên dưới đều dưới ngưỡng cảnh báo 50% và chỉ dùng để đối chiếu tham khảo.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  review: {
    title: "Có nội dung cần xem xét",
    description: "Ít nhất một đề tài đạt trên 50%. Nên đọc mô tả hai đề tài trước khi quyết định.",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  high: {
    title: "Phát hiện mức tương đồng cao",
    description: "Ít nhất một đề tài đạt trên 70%. Cần kiểm tra kỹ phạm vi, phương pháp và sản phẩm đầu ra.",
    className: "border-orange-200 bg-orange-50 text-orange-800",
  },
  duplicate: {
    title: "Có khả năng trùng đề tài",
    description: "Ít nhất một kết quả vượt 85%. Không nên phê duyệt trước khi đối chiếu nội dung chi tiết.",
    className: "border-rose-200 bg-rose-50 text-rose-800",
  },
};

export function StoredSimilarityList({ results }: { results: StoredSimilarityResult[] }) {
  if (!results.length) {
    return <p className="mt-3 text-sm text-slate-500">Không có kết quả nào vượt ngưỡng hiển thị.</p>;
  }

  const highest = results.reduce((current, result) =>
    result.similarity_percent > current.similarity_percent ? result : current
  );
  const summary = summaryStyles[highest.warning_level];

  return <>
    <div className={`mt-4 rounded-xl border p-4 ${summary.className}`}>
      <p className="text-sm font-bold">{summary.title}</p>
      <p className="mt-1 text-xs leading-5 opacity-90">{summary.description}</p>
    </div>
    <div className="mt-3 space-y-2">
      {results.map((result) => {
        const level = levelStyles[result.warning_level];
        return <div key={result.id} className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <Link to={`/topics/${result.similar_topic}`} className="font-medium text-blue-700 hover:underline">
            {result.similar_topic_title}
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${level.badge}`}>{level.label}</span>
            <span className="w-14 text-right font-bold tabular-nums text-slate-800">{result.similarity_percent.toFixed(1)}%</span>
          </div>
        </div>;
      })}
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-400">
      Tỷ lệ là điểm hỗ trợ sàng lọc, không thay thế đánh giá chuyên môn của người duyệt.
    </p>
  </>;
}
