import { statisticsApi } from "../api";
import { useStatisticsOverview } from "../hooks";

export default function StatisticsPage() {
  const { data, isLoading } = useStatisticsOverview();

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-slate-400">Đang tải dữ liệu thống kê...</div>;
  }

  const hasData = data && data.total > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Thống kê Đề tài Đồ án</h1>
          <p className="text-sm text-slate-500">Tổng hợp số liệu đề tài theo năm học, khóa sinh viên, lĩnh vực và trạng thái.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={statisticsApi.exportUrl("excel")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <span>📥 Xuất Báo Cáo Excel</span>
          </a>
          <a
            href={statisticsApi.exportUrl("pdf")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 shadow-xs"
          >
            <span>📄 Xuất File PDF</span>
          </a>
        </div>
      </div>

      {/* Overview Stat Card */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-6 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Tổng số đề tài trong phạm vi</span>
          <div className="text-3xl font-extrabold text-indigo-950 mt-1">{data?.total || 0} đề tài</div>
        </div>
        <div className="h-12 w-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-sm">
          📊
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-xs">
          <p className="text-sm font-semibold">Chưa có dữ liệu để thống kê.</p>
          <p className="text-xs text-slate-400 mt-1">Dữ liệu thống kê sẽ xuất hiện khi có đề tài được đề xuất trong hệ thống.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Thống kê theo Trạng thái */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm border-b pb-2">📌 Thống kê theo Trạng thái</h3>
            <div className="space-y-2">
              {data.by_status.map((item: any) => {
                const percent = Math.round((item.count / data.total) * 100);
                return (
                  <div key={item.status} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>Trạng thái: {item.status}</span>
                      <span>{item.count} đề tài ({percent}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-indigo-600" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Thống kê theo Khóa sinh viên */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm border-b pb-2">🎓 Thống kê theo Khóa học</h3>
            <div className="space-y-2">
              {data.by_cohort.map((item: any) => {
                const percent = Math.round((item.count / data.total) * 100);
                return (
                  <div key={item.cohort__name || "Khác"} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>Khóa: {item.cohort__name || "Chưa chọn"}</span>
                      <span>{item.count} đề tài ({percent}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Thống kê theo Năm học */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm border-b pb-2">📅 Thống kê theo Năm học</h3>
            <div className="space-y-2">
              {data.by_academic_year.map((item: any) => {
                const percent = Math.round((item.count / data.total) * 100);
                return (
                  <div key={item.academic_year__name || "Khác"} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>Năm học: {item.academic_year__name || "Chưa chọn"}</span>
                      <span>{item.count} đề tài ({percent}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Thống kê theo Lĩnh vực */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm border-b pb-2">💡 Thống kê theo Lĩnh vực Chuyên sâu</h3>
            <div className="space-y-2">
              {data.by_field.map((item: any) => {
                const percent = Math.round((item.count / data.total) * 100);
                return (
                  <div key={item.field__name || "Khác"} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>Lĩnh vực: {item.field__name || "Chung"}</span>
                      <span>{item.count} đề tài ({percent}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-cyan-600" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
