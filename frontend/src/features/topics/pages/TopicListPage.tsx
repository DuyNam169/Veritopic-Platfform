import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { usersApi } from "@/features/accounts/api";
import { catalogApi } from "@/features/academics/api";
import { useAuthStore } from "@/features/auth/store";
import { statisticsApi } from "@/features/statistics/api";
import { Filter, Search } from "@/shared/components/icons";
import { Button, ErrorState, PageHeader, PageSkeleton, Panel, fieldClass } from "@/shared/components/ui";
import { toast } from "@/shared/lib/toast";
import type { TopicListParams } from "../api";
import TopicTable from "../components/TopicTable";
import { useTopics } from "../hooks";

const statusOptions = [
  { value: "pending", label: "Chờ duyệt" }, { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Bị từ chối" }, { value: "rename_requested", label: "Yêu cầu sửa tên" },
];

export default function TopicListPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";
  const [filters, setFilters] = useState<TopicListParams>({});
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const topics = useTopics(filters);
  const years = useQuery({ queryKey: ["catalog", "academic-years"], queryFn: () => catalogApi.list("academic-years") });
  const cohorts = useQuery({ queryKey: ["catalog", "cohorts"], queryFn: () => catalogApi.list("cohorts") });
  const departments = useQuery({ queryKey: ["catalog", "departments"], queryFn: () => catalogApi.list("departments") });
  const fields = useQuery({ queryKey: ["catalog", "fields"], queryFn: () => catalogApi.list("fields") });
  const semesters = useQuery({ queryKey: ["catalog", "semesters"], queryFn: () => catalogApi.list("semesters") });
  const users = useQuery({ queryKey: ["managed-users"], queryFn: usersApi.list, enabled: isAdmin });
  const teachers = useMemo(() => (users.data ?? []).filter((item) => item.role === "teacher" || item.role === "department_head"), [users.data]);
  const currentPage = filters.page ?? 1;
  const totalPages = Math.max(1, Math.ceil((topics.data?.count ?? 0) / 20));
  const firstResult = topics.data?.count ? (currentPage - 1) * 20 + 1 : 0;
  const lastResult = topics.data?.count ? Math.min(currentPage * 20, topics.data.count) : 0;

  function setFilter(key: keyof TopicListParams, value: string, numeric = false) {
    setFilters((current) => {
      const next = { ...current };
      if (value) next[key] = (numeric ? Number(value) : value) as never;
      else delete next[key];
      delete next.page;
      return next;
    });
  }

  async function download(format: "excel" | "pdf") {
    setExporting(format);
    try {
      await statisticsApi.download(format, filters);
      toast.success(`Đã xuất báo cáo ${format.toUpperCase()} theo bộ lọc hiện tại.`);
    } catch {
      toast.error("Không thể xuất báo cáo. Vui lòng thử lại.");
    } finally {
      setExporting(null);
    }
  }

  return <div className="mx-auto max-w-7xl space-y-6">
    <PageHeader eyebrow="Kho dữ liệu học thuật" title="Danh mục đề tài" description="Tìm kiếm và tra cứu đề tài theo nhiều tiêu chí trong toàn hệ thống." actions={isAdmin && <><Button busy={exporting === "excel"} disabled={!!exporting} onClick={() => void download("excel")}>Xuất Excel</Button><Button variant="primary" busy={exporting === "pdf"} disabled={!!exporting} onClick={() => void download("pdf")}>Xuất PDF</Button></>} />

    <Panel>
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-brand-700" /><h2 className="font-semibold text-slate-900">Bộ lọc danh sách</h2></div>{Object.keys(filters).some((key) => key !== "page") && <button onClick={() => setFilters({})} className="text-sm font-semibold text-brand-700 hover:text-brand-900 hover:underline">Xóa bộ lọc</button>}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium text-slate-700">Từ khóa<div className="relative"><Search className="pointer-events-none absolute left-3.5 top-4 h-4 w-4 text-slate-400" /><input aria-label="Tìm kiếm theo tên hoặc mô tả đề tài" value={filters.search ?? ""} onChange={(event) => setFilter("search", event.target.value)} placeholder="Tên hoặc nội dung mô tả..." className={`${fieldClass} pl-10`} /></div></label>
        <FilterSelect label="Năm học" value={filters.academic_year} onChange={(value) => setFilter("academic_year", value, true)} options={(years.data ?? []).map((item) => ({ value: item.id, label: item.name }))} />
        <FilterSelect label="Khóa học" value={filters.cohort} onChange={(value) => setFilter("cohort", value, true)} options={(cohorts.data ?? []).map((item) => ({ value: item.id, label: item.name }))} />
        <FilterSelect label="Bộ môn" value={filters.department} onChange={(value) => setFilter("department", value, true)} options={(departments.data ?? []).map((item) => ({ value: item.id, label: item.name }))} />
        <FilterSelect label="Lĩnh vực" value={filters.field} onChange={(value) => setFilter("field", value, true)} options={(fields.data ?? []).map((item) => ({ value: item.id, label: item.name }))} />
        <FilterSelect label="Học kỳ" value={filters.semester} onChange={(value) => setFilter("semester", value, true)} options={(semesters.data ?? []).map((item) => ({ value: item.id, label: item.name }))} />
        <label className="text-sm font-medium text-slate-700">Trạng thái<select value={filters.status ?? ""} onChange={(event) => setFilter("status", event.target.value)} className={fieldClass}><option value="">Tất cả trạng thái</option>{statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        {isAdmin && <FilterSelect label="Giảng viên" value={filters.proposed_by} onChange={(value) => setFilter("proposed_by", value, true)} options={teachers.map((item) => ({ value: item.id, label: `${item.first_name} ${item.last_name}`.trim() || item.username }))} />}
      </div>
    </Panel>

    {topics.isLoading ? <PageSkeleton cards={2} /> : topics.isError ? <ErrorState message="Không tải được danh sách đề tài." retry={() => void topics.refetch()} /> : <>
      <TopicTable topics={topics.data?.results ?? []} />
      {(topics.data?.count ?? 0) > 0 && <nav aria-label="Phân trang danh sách đề tài" className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-slate-600">Hiển thị <strong>{firstResult}–{lastResult}</strong> trong <strong>{topics.data?.count ?? 0}</strong> đề tài</p><div className="flex items-center gap-2"><Button className="py-2" disabled={!topics.data?.previous} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, currentPage - 1) }))}>Trang trước</Button><span className="min-w-24 text-center text-slate-600">Trang {currentPage}/{totalPages}</span><Button className="py-2" disabled={!topics.data?.next} onClick={() => setFilters((current) => ({ ...current, page: currentPage + 1 }))}>Trang sau</Button></div></nav>}
    </>}
  </div>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value?: number; onChange: (value: string) => void; options: Array<{ value: number; label: string }> }) {
  return <label className="text-sm font-medium text-slate-700">{label}<select value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={fieldClass}><option value="">Tất cả {label.toLowerCase()}</option>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>;
}
