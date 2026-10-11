import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { catalogApi } from "@/features/academics/api";
import { usersApi } from "@/features/accounts/api";
import { Filter } from "@/shared/components/icons";
import { Button, ErrorState, PageHeader, PageSkeleton, Panel, fieldClass } from "@/shared/components/ui";
import { toast } from "@/shared/lib/toast";
import { statisticsApi, type StatisticsFilters } from "../api";
import { useStatisticsOverview } from "../hooks";
import { StatisticsSummary } from "../components/StatisticsSummary";

const statusLabels: Record<string, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
  rename_requested: "Yêu cầu sửa tên",
};
const statusColors: Record<string, string> = {
  pending: "#f59e0b",
  approved: "#10b981",
  rejected: "#f43f5e",
  rename_requested: "#3b82f6",
};

interface ChartRow { label: string; count: number; }

export default function StatisticsPage() {
  const [filters, setFilters] = useState<StatisticsFilters>({});
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const overview = useStatisticsOverview(filters);
  const years = useQuery({ queryKey: ["catalog", "academic-years"], queryFn: () => catalogApi.list("academic-years") });
  const cohorts = useQuery({ queryKey: ["catalog", "cohorts"], queryFn: () => catalogApi.list("cohorts") });
  const departments = useQuery({ queryKey: ["catalog", "departments"], queryFn: () => catalogApi.list("departments") });
  const fields = useQuery({ queryKey: ["catalog", "fields"], queryFn: () => catalogApi.list("fields") });
  const users = useQuery({ queryKey: ["managed-users"], queryFn: usersApi.list });
  const teachers = useMemo(
    () => (users.data ?? []).filter((user) => user.role === "teacher" || user.role === "department_head"),
    [users.data],
  );

  const data = overview.data;
  const academicYears = data?.by_academic_year.map((row) => ({ label: row.academic_year__name, count: row.count })) ?? [];
  const cohortRows = data?.by_cohort.map((row) => ({ label: row.cohort__name, count: row.count })) ?? [];
  const teacherRows = data?.by_teacher.map((row) => ({
    label: `${`${row.proposed_by__first_name} ${row.proposed_by__last_name}`.trim() || row.proposed_by__username} (${row.proposed_by__username})`,
    count: row.count,
  })) ?? [];
  const fieldRows = data?.by_field.map((row) => ({ label: row.field__name || "Chưa phân loại", count: row.count })) ?? [];
  const statusRows = Object.keys(statusLabels).map((status) => ({
    status,
    label: statusLabels[status],
    count: data?.by_status.find((row) => row.status === status)?.count ?? 0,
  }));

  function setNumericFilter(key: keyof StatisticsFilters, value: string) {
    setFilters((current) => {
      const next = { ...current };
      if (value) next[key] = Number(value) as never;
      else delete next[key];
      return next;
    });
  }

  async function download(format: "excel" | "pdf") {
    setExporting(format);
    try {
      await statisticsApi.download(format, filters);
      toast.success(`Đã xuất báo cáo ${format.toUpperCase()}.`);
    } catch {
      toast.error("Không thể xuất báo cáo. Vui lòng thử lại.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader eyebrow="Phân tích ngân hàng đề tài" title="Thống kê & báo cáo" description="Theo dõi tình hình phê duyệt, phân bố lĩnh vực và hoạt động đề xuất trong cùng một phạm vi dữ liệu." actions={<><Button busy={overview.isFetching} onClick={() => void overview.refetch()}>Cập nhật</Button><Button busy={exporting === "excel"} disabled={!!exporting || overview.isLoading || overview.isError} onClick={() => void download("excel")}>Xuất Excel</Button><Button variant="primary" busy={exporting === "pdf"} disabled={!!exporting || overview.isLoading || overview.isError} onClick={() => void download("pdf")}>Xuất PDF</Button></>} />

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50"><Filter className="h-4 w-4 text-brand-700" /></span><h2 className="font-semibold text-slate-900">Phạm vi báo cáo</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{Object.keys(filters).length ? `${Object.keys(filters).length} bộ lọc` : "Toàn hệ thống"}</span></div>{Object.keys(filters).length > 0 && <button onClick={() => setFilters({})} className="text-sm font-semibold text-brand-700 hover:underline">Đặt lại bộ lọc</button>}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <FilterSelect label="Năm học" value={filters.academic_year} onChange={(value) => setNumericFilter("academic_year", value)} options={(years.data ?? []).map((item) => ({ value: item.id, label: item.name }))} />
          <FilterSelect label="Khóa học" value={filters.cohort} onChange={(value) => setNumericFilter("cohort", value)} options={(cohorts.data ?? []).map((item) => ({ value: item.id, label: item.name }))} />
          <FilterSelect label="Bộ môn" value={filters.department} onChange={(value) => setNumericFilter("department", value)} options={(departments.data ?? []).map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }))} />
          <FilterSelect label="Giảng viên" value={filters.proposed_by} onChange={(value) => setNumericFilter("proposed_by", value)} options={teachers.map((user) => ({ value: user.id, label: `${user.first_name} ${user.last_name}`.trim() || user.username }))} />
          <FilterSelect label="Lĩnh vực" value={filters.field} onChange={(value) => setNumericFilter("field", value)} options={(fields.data ?? []).map((item) => ({ value: item.id, label: item.name }))} />
          <label className="text-sm font-medium text-slate-700">Trạng thái<select value={filters.status ?? ""} onChange={(event) => setFilters((current) => { const next = { ...current }; if (event.target.value) next.status = event.target.value; else delete next.status; return next; })} className={fieldClass}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">Các chỉ số, biểu đồ và tệp báo cáo đều áp dụng bộ lọc đang chọn.</p>
      </Panel>

      {overview.isLoading ? <PageSkeleton cards={2} /> : overview.isError ? <ErrorState message="Không tải được số liệu thống kê." retry={() => void overview.refetch()} /> : <>
        {data && <StatisticsSummary data={data} />}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{data?.total === 0 ? "Không có đề tài phù hợp. Hãy thử điều chỉnh bộ lọc." : "Phân bố đề tài trong phạm vi đã chọn"}</span><span>Cập nhật lúc {new Date(overview.dataUpdatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span></div>
        <section className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Tình hình phê duyệt" description="Tỷ trọng đề tài theo trạng thái xử lý"><StatusChart rows={statusRows} total={data?.total ?? 0} /></ChartCard>
          <ChartCard title="Phân bố lĩnh vực" description="Số đề tài theo lĩnh vực nghiên cứu"><BarChart rows={fieldRows} total={data?.total ?? 0} /></ChartCard>
          <ChartCard title="Theo năm học" description="Quy mô ngân hàng đề tài qua các năm"><BarChart rows={academicYears} total={data?.total ?? 0} preserveOrder /></ChartCard>
          <ChartCard title="Theo khóa học" description="Số đề tài của từng khóa đào tạo"><BarChart rows={cohortRows} total={data?.total ?? 0} preserveOrder /></ChartCard>
          <ChartCard title="Hoạt động đề xuất của giảng viên" description="Số đề tài đã đề xuất, bao gồm tất cả trạng thái trong phạm vi đang xem" wide>
            <div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs text-slate-500"><tr><th className="rounded-l-lg p-3 font-medium">Giảng viên</th><th className="p-3 text-right font-medium">Số đề tài</th><th className="rounded-r-lg p-3 text-right font-medium">Tỷ trọng</th></tr></thead><tbody className="divide-y divide-slate-100">{[...teacherRows].sort((a, b) => b.count - a.count).map((row) => <tr key={row.label} className="hover:bg-brand-50/40"><td className="p-3 font-medium text-slate-700">{row.label}</td><td className="p-3 text-right font-semibold tabular-nums text-slate-950">{row.count}</td><td className="p-3 text-right tabular-nums text-slate-500">{data?.total ? (row.count / data.total * 100).toFixed(1) : "0.0"}%</td></tr>)}</tbody></table>{!teacherRows.length && <p className="py-10 text-center text-sm text-slate-400">Chưa có dữ liệu trong phạm vi đã chọn.</p>}</div>
          </ChartCard>
        </section>
      </>}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value?: number; onChange: (value: string) => void; options: Array<{ value: number; label: string }> }) {
  return <label className="text-sm font-medium text-slate-700">{label}<select value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={fieldClass}><option value="">Tất cả {label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function ChartCard({ title, description, wide = false, children }: { title: string; description: string; wide?: boolean; children: ReactNode }) {
  return <article className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ${wide ? "lg:col-span-2" : ""}`}><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p><div className="mt-6">{children}</div></article>;
}

function BarChart({ rows, total, preserveOrder = false }: { rows: ChartRow[]; total: number; preserveOrder?: boolean }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  if (!rows.length) return <p className="py-12 text-center text-sm text-slate-400">Chưa có dữ liệu</p>;
  const ordered = preserveOrder ? rows : [...rows].sort((a, b) => b.count - a.count);
  return <div className="max-h-80 space-y-4 overflow-auto pr-1">{ordered.map((row) => <div key={row.label}><div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="font-medium leading-5 text-slate-700">{row.label}</span><span className="shrink-0 tabular-nums"><strong className="text-slate-950">{row.count}</strong><span className="ml-2 text-slate-400">{total ? (row.count / total * 100).toFixed(1) : "0.0"}%</span></span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${(row.count / max) * 100}%` }} /></div></div>)}</div>;
}

function StatusChart({ rows, total }: { rows: Array<ChartRow & { status: string }>; total: number }) {
  let offset = 0;
  const segments = rows.map((row) => {
    const start = total ? (offset / total) * 100 : 0;
    offset += row.count;
    const end = total ? (offset / total) * 100 : 0;
    return `${statusColors[row.status]} ${start}% ${end}%`;
  });
  return <div className="flex flex-col items-center gap-8 sm:flex-row"><div role="img" aria-label={`Phân bố trạng thái của ${total} đề tài`} className="relative h-44 w-44 shrink-0 rounded-full" style={{ background: total ? `conic-gradient(${segments.join(", ")})` : "#e2e8f0" }}><div className="absolute inset-7 grid place-items-center rounded-full bg-white text-center"><div><strong className="text-3xl font-bold tabular-nums text-slate-950">{total}</strong><span className="mt-1 block text-xs text-slate-500">đề tài</span></div></div></div><div className="w-full flex-1 space-y-4">{rows.map((row) => <div key={row.status} className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: statusColors[row.status] }} /><span className="flex-1 text-slate-600">{row.label}</span><strong className="tabular-nums text-slate-950">{row.count}</strong><span className="w-12 text-right text-xs tabular-nums text-slate-400">{total ? (row.count / total * 100).toFixed(0) : 0}%</span></div>)}</div></div>;
}
