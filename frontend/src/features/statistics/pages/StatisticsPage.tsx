import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { catalogApi } from "@/features/academics/api";
import { usersApi } from "@/features/accounts/api";
import { BarChart3, Filter } from "@/shared/components/icons";
import { Button, ErrorState, PageHeader, PageSkeleton, Panel, fieldClass } from "@/shared/components/ui";
import { toast } from "@/shared/lib/toast";
import { statisticsApi, type StatisticsFilters } from "../api";
import { useStatisticsOverview } from "../hooks";

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
    label: `${row.proposed_by__first_name} ${row.proposed_by__last_name}`.trim() || row.proposed_by__username,
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
      <PageHeader eyebrow="Quản trị hệ thống" title="Thống kê đề tài" description="Theo dõi quy mô và phân bố đề tài trong toàn hệ thống." actions={<><Button busy={exporting === "excel"} disabled={!!exporting} onClick={() => void download("excel")}>Xuất Excel</Button><Button variant="primary" busy={exporting === "pdf"} disabled={!!exporting} onClick={() => void download("pdf")}>Xuất PDF</Button></>} />

      <Panel>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-brand-700" /><h2 className="font-semibold text-slate-900">Bộ lọc thống kê</h2></div>{Object.keys(filters).length > 0 && <button onClick={() => setFilters({})} className="text-sm font-semibold text-brand-700 hover:underline">Xóa bộ lọc</button>}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FilterSelect label="Năm học" value={filters.academic_year} onChange={(value) => setNumericFilter("academic_year", value)} options={(years.data ?? []).map((item) => ({ value: item.id, label: item.name }))} />
          <FilterSelect label="Khóa học" value={filters.cohort} onChange={(value) => setNumericFilter("cohort", value)} options={(cohorts.data ?? []).map((item) => ({ value: item.id, label: item.name }))} />
          <FilterSelect label="Bộ môn" value={filters.department} onChange={(value) => setNumericFilter("department", value)} options={(departments.data ?? []).map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }))} />
          <FilterSelect label="Giảng viên" value={filters.proposed_by} onChange={(value) => setNumericFilter("proposed_by", value)} options={teachers.map((user) => ({ value: user.id, label: `${user.first_name} ${user.last_name}`.trim() || user.username }))} />
          <FilterSelect label="Lĩnh vực" value={filters.field} onChange={(value) => setNumericFilter("field", value)} options={(fields.data ?? []).map((item) => ({ value: item.id, label: item.name }))} />
          <label className="text-sm font-medium text-slate-700">Trạng thái<select value={filters.status ?? ""} onChange={(event) => setFilters((current) => { const next = { ...current }; if (event.target.value) next.status = event.target.value; else delete next.status; return next; })} className={fieldClass}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
      </Panel>

      {overview.isLoading ? <PageSkeleton cards={2} /> : overview.isError ? <ErrorState message="Không tải được số liệu thống kê." retry={() => void overview.refetch()} /> : <>
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-brand-950 p-6 text-white shadow-lg"><BarChart3 className="absolute -bottom-6 -right-4 h-32 w-32 text-white/10" /><p className="text-sm font-medium text-white/70">Tổng số đề tài phù hợp</p><p className="mt-2 text-5xl font-bold">{data?.total ?? 0}</p>{data?.total === 0 && <p className="mt-3 text-sm text-white/70">Không có đề tài nào phù hợp với điều kiện lọc đã chọn.</p>}</section>
        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Theo năm học"><BarChart rows={academicYears} color="bg-blue-500" /></ChartCard>
          <ChartCard title="Theo khóa học"><BarChart rows={cohortRows} color="bg-violet-500" /></ChartCard>
          <ChartCard title="Theo giảng viên"><BarChart rows={teacherRows} color="bg-cyan-500" /></ChartCard>
          <ChartCard title="Theo lĩnh vực"><BarChart rows={fieldRows} color="bg-emerald-500" /></ChartCard>
          <ChartCard title="Theo trạng thái" wide><StatusChart rows={statusRows} total={data?.total ?? 0} /></ChartCard>
        </section>
      </>}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value?: number; onChange: (value: string) => void; options: Array<{ value: number; label: string }> }) {
  return <label className="text-sm font-medium text-slate-700">{label}<select value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={fieldClass}><option value="">Tất cả {label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function ChartCard({ title, wide = false, children }: { title: string; wide?: boolean; children: ReactNode }) {
  return <article className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${wide ? "lg:col-span-2" : ""}`}><h2 className="font-semibold text-slate-900">{title}</h2><div className="mt-4">{children}</div></article>;
}

function BarChart({ rows, color }: { rows: ChartRow[]; color: string }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  if (!rows.length) return <p className="py-12 text-center text-sm text-slate-400">Chưa có dữ liệu</p>;
  return <div className="space-y-3">{rows.map((row) => <div key={row.label}><div className="mb-1 flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-700" title={row.label}>{row.label}</span><strong className="text-slate-900">{row.count}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${row.count ? Math.max((row.count / max) * 100, 4) : 0}%` }} /></div></div>)}</div>;
}

function StatusChart({ rows, total }: { rows: Array<ChartRow & { status: string }>; total: number }) {
  let offset = 0;
  const segments = rows.map((row) => {
    const start = total ? (offset / total) * 100 : 0;
    offset += row.count;
    const end = total ? (offset / total) * 100 : 0;
    return `${statusColors[row.status]} ${start}% ${end}%`;
  });
  return <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center"><div className="relative h-40 w-40 shrink-0 rounded-full" style={{ background: total ? `conic-gradient(${segments.join(", ")})` : "#e2e8f0" }}><div className="absolute inset-7 grid place-items-center rounded-full bg-white text-center"><div><strong className="text-2xl text-slate-950">{total}</strong><span className="block text-[10px] uppercase tracking-wide text-slate-400">đề tài</span></div></div></div><div className="grid gap-3 sm:grid-cols-2">{rows.map((row) => <div key={row.status} className="flex min-w-40 items-center gap-2 text-sm"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: statusColors[row.status] }} /><span className="flex-1 text-slate-600">{row.label}</span><strong>{row.count}</strong></div>)}</div></div>;
}
