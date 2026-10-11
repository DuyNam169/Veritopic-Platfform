import { Link } from "react-router-dom";
import { SupplementaryAssessment } from "./SupplementaryAssessment";

import type { StoredSimilarityResult, WarningLevel } from "../types";

const levelStyles: Record<WarningLevel, { label: string; badge: string }> = {
  normal: { label: "Bình thường", badge: "border-slate-200 bg-slate-100 text-slate-600" },
  review: { label: "Cần đối chiếu", badge: "border-sky-200 bg-sky-50 text-sky-700" },
  high: { label: "Tương đồng cao", badge: "border-orange-200 bg-orange-50 text-orange-700" },
  duplicate: { label: "Trùng tên đề tài", badge: "border-rose-200 bg-rose-50 text-rose-700" },
};

export function StoredSimilarityList({ results }: { results: StoredSimilarityResult[] }) {
  if (!results.length) {
    return <p className="mt-3 text-sm text-slate-500">Không có kết quả nào vượt ngưỡng hiển thị.</p>;
  }

  const exactMatch = results.some((result) => result.assessment_status === "exact_match");
  const summary = exactMatch ? {
    title: "Có đề tài trùng tên",
    description: "Tên khớp sau khi chuẩn hóa. Đọc mô tả và phạm vi để xác định có trùng nội dung hay không.",
    className: "border-rose-200 bg-rose-50 text-rose-800",
  } : {
    title: "Các đề tài gợi ý để đối chiếu",
    description: "Danh sách được xếp theo mức gần nghĩa của tên và mô tả. Điểm cao chưa đủ để kết luận trùng đề tài.",
    className: "border-sky-200 bg-sky-50 text-sky-800",
  };

  return <>
    <div className={`mt-4 rounded-xl border p-4 ${summary.className}`}>
      <p className="text-sm font-bold">{summary.title}</p>
      <p className="mt-1 text-xs leading-5 opacity-90">{summary.description}</p>
    </div>
    <div className="mt-3 space-y-2">
      {results.map((result) => {
        const level = levelStyles[result.assessment_status === "exact_match" ? "duplicate" : "review"];
        return <div key={result.id} className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1"><Link to={`/topics/${result.similar_topic}`} className="font-medium text-blue-700 hover:underline">
            {result.similar_topic_title}
          </Link><p className="mt-1 text-xs leading-5 text-slate-500">{result.similar_topic_description || "Chưa có mô tả; cần bổ sung để đối chiếu nội dung."}</p><SupplementaryAssessment result={result} /></div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${level.badge}`}>{level.label}</span>
            <span title="Điểm gần nghĩa, không phải tỷ lệ trùng" className="whitespace-nowrap text-right font-bold tabular-nums text-slate-800">{result.similarity_percent.toFixed(1)} / 100</span>
          </div>
        </div>;
      })}
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-400">
      Điểm gần nghĩa được tính từ tên và mô tả, không phải phần trăm trùng hoặc xác suất trùng đề tài. Cần đối chiếu mục tiêu, phạm vi, phương pháp và sản phẩm đầu ra; nếu thiếu mô tả, kết quả chỉ dựa trên tên. Điểm đánh giá nội dung bổ sung được hiển thị riêng khi có.
    </p>
  </>;
}
