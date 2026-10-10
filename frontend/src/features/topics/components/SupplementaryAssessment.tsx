type Assessment = {
  groq_score?: number | null;
  groq_explanation?: string;
  assessment_status?: string;
};

export function SupplementaryAssessment({ result }: { result: Assessment }) {
  if (result.assessment_status === "exact_match") {
    return <p className="mt-2 text-xs text-rose-700">Trùng tên sau khi chuẩn hóa.</p>;
  }
  if (result.assessment_status === "unavailable") {
    return <p className="mt-2 text-xs text-amber-700">Đánh giá bổ sung tạm thời không khả dụng. Kết quả hiện tại dựa trên mức tương đồng tên đề tài.</p>;
  }
  if (result.groq_score == null) return null;
  return <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
    <p className="font-semibold">Điểm đánh giá nội dung bổ sung: {result.groq_score.toFixed(1)}/100</p>
    {result.groq_explanation && <p className="mt-1">{result.groq_explanation}</p>}
  </div>;
}
