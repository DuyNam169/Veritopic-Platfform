import { statisticsApi } from "../api";
import { useStatisticsOverview } from "../hooks";

export default function StatisticsPage() {
  const { data, isLoading } = useStatisticsOverview();

  if (isLoading) return <p>Đang tải...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Thống kê đề tài</h2>
        <div className="flex gap-2">
          <a href={statisticsApi.exportUrl("excel")} className="rounded-md border px-3 py-1.5 text-sm">
            Xuất Excel
          </a>
          <a href={statisticsApi.exportUrl("pdf")} className="rounded-md border px-3 py-1.5 text-sm">
            Xuất PDF
          </a>
        </div>
      </div>
      <p>Tổng số đề tài: <strong>{data?.total}</strong></p>
      {/* TODO: dựng biểu đồ (recharts/chart.js) từ data.by_academic_year, by_cohort, by_teacher, by_field, by_status */}
    </div>
  );
}
