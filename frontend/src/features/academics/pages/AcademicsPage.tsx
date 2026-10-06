import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { catalogApi, type CatalogItem, type CatalogKind } from "../api";
import { Layers, Search } from "@/shared/components/icons";
import { Button, ErrorState, PageHeader, PageSkeleton, Panel, fieldClass } from "@/shared/components/ui";
import { toast } from "@/shared/lib/toast";

const tabs: { key: CatalogKind; label: string }[] = [
  { key: "cohorts", label: "Khóa học" }, { key: "academic-years", label: "Năm học" },
  { key: "semesters", label: "Học kỳ" }, { key: "departments", label: "Bộ môn" },
  { key: "fields", label: "Lĩnh vực đề tài" },
];
const inputClass = fieldClass;
function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.data) {
    return Object.entries(error.response.data).filter(([key]) => key !== "status_code")
      .map(([, value]) => Array.isArray(value) ? value.join(" ") : String(value)).join(" ");
  }
  return "Không thể kết nối máy chủ. Vui lòng thử lại.";
}
export default function AcademicsPage() {
  const [kind, setKind] = useState<CatalogKind>("cohorts");
  return <div className="mx-auto max-w-7xl space-y-6">
    <PageHeader eyebrow="Quản trị hệ thống" title="Danh mục hệ thống" description="Quản lý dữ liệu đào tạo và các danh mục dùng chung trong toàn hệ thống." />
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Chọn danh mục">
      {tabs.map((tab) => <button key={tab.key} onClick={() => setKind(tab.key)} aria-pressed={kind === tab.key}
        className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${kind === tab.key ? "bg-brand-700 text-white shadow-sm" : "text-slate-600 hover:bg-brand-50 hover:text-brand-800"}`}>{tab.label}</button>)}
    </div><CatalogPanel key={kind} kind={kind} />
  </div>;
}
function CatalogPanel({ kind }: { kind: CatalogKind }) {
  const client = useQueryClient();
  const [year, setYear] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<CatalogItem> | null>(null);
  const [deleting, setDeleting] = useState<CatalogItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const years = useQuery({ queryKey: ["catalog", "academic-years"], queryFn: () => catalogApi.list("academic-years"), enabled: kind === "semesters" });
  const selectedYear = year || String(years.data?.find((item) => item.is_current)?.id ?? years.data?.[0]?.id ?? "");
  const list = useQuery({ queryKey: ["catalog", kind, kind === "semesters" ? selectedYear : ""], queryFn: () => catalogApi.list(kind, kind === "semesters" ? selectedYear : undefined), enabled: kind !== "semesters" || !!selectedYear });
  const heads = useQuery({ queryKey: ["catalog-heads"], queryFn: catalogApi.heads, enabled: kind === "departments" });
  const label = tabs.find((tab) => tab.key === kind)!.label;
  const rows = (list.data ?? []).filter((item) => `${item.name} ${item.code ?? ""}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")));
  const loading = list.isLoading || (kind === "semesters" && years.isLoading);
  const loadError = list.isError || (kind === "semesters" && years.isError);
  async function refresh() { await client.invalidateQueries({ queryKey: ["catalog"] }); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: Partial<CatalogItem> = { name: String(form.get("name")).trim() };
    if (kind === "cohorts") Object.assign(payload, { start_year: Number(form.get("start_year")), end_year: Number(form.get("end_year")) });
    if (kind === "academic-years") payload.is_current = form.get("is_current") === "on";
    if (kind === "semesters") Object.assign(payload, { academic_year: Number(selectedYear), start_date: form.get("start_date"), end_date: form.get("end_date") });
    if (kind === "departments") Object.assign(payload, { code: String(form.get("code")).trim(), head: form.get("head") ? Number(form.get("head")) : null });
    setBusy(true); setError("");
    try { await catalogApi.save(kind, payload, editing?.id); setEditing(null); toast.success("Đã lưu danh mục."); await refresh(); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true); setError("");
    try { await catalogApi.remove(kind, deleting.id); setDeleting(null); toast.success("Đã xóa danh mục."); await refresh(); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <Panel>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><div className="flex items-center gap-2"><Layers className="h-5 w-5 text-brand-700" /><h2 className="text-lg font-semibold text-slate-900">{label}</h2></div><p className="mt-1 text-sm text-slate-500">{rows.length} bản ghi</p></div>
      <Button variant="primary" disabled={kind === "semesters" && (!selectedYear || years.isError)} onClick={() => { setEditing({}); setError(""); }}>+ Thêm mới</Button>
    </div>
    <div className="my-5 flex flex-wrap items-end gap-4">
      {kind === "semesters" && <label className="text-sm">Năm học<select className={inputClass} value={selectedYear} onChange={(event) => setYear(event.target.value)}>
        <option value="" disabled>Chọn năm học</option>{years.data?.map((item) => <option key={item.id} value={item.id}>{item.name}{item.is_current ? " (hiện hành)" : ""}</option>)}
      </select></label>}
      <label className="text-sm">Tìm kiếm<div className="relative"><Search className="pointer-events-none absolute left-3.5 top-4 h-4 w-4 text-slate-400" /><input className={`${inputClass} min-w-64 pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập tên hoặc mã..." /></div></label>
    </div>
    {loading ? <PageSkeleton cards={2} /> : loadError ? <ErrorState message="Không tải được danh mục." retry={() => { void list.refetch(); void years.refetch(); }} /> : kind === "semesters" && !selectedYear ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Hãy tạo năm học trước khi thêm học kỳ.</p> : <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3.5">Tên</th><th className="px-4 py-3.5">Thông tin</th><th className="px-4 py-3.5 text-right">Thao tác</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map((item) => <tr key={item.id} className="transition hover:bg-brand-50/40"><td className="px-4 py-3.5 font-semibold text-slate-900">{item.name}</td>
          <td className="p-3 text-slate-600">{kind === "cohorts" ? `${item.start_year} – ${item.end_year}` : kind === "academic-years" ? item.is_current ? <span className="rounded-full bg-green-100 px-2 py-1 text-green-700">Hiện hành</span> : "—" : kind === "semesters" ? `${item.start_date} → ${item.end_date}` : kind === "departments" ? `${item.code} · ${item.head_name || "Chưa phân công trưởng bộ môn"}` : "—"}</td>
          <td className="whitespace-nowrap px-4 py-3.5 text-right"><button aria-label={`Sửa ${item.name}`} className="mr-4 font-semibold text-brand-700 hover:underline" onClick={() => { setEditing(item); setError(""); }}>Sửa</button><button aria-label={`Xóa ${item.name}`} className="font-semibold text-rose-600 hover:underline" onClick={() => { setDeleting(item); setError(""); }}>Xóa</button></td>
        </tr>)}</tbody></table></div>{!rows.length && <p className="py-10 text-center text-sm text-slate-500">Không có bản ghi phù hợp.</p>}
    </div>}
    {(editing || deleting) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="catalog-dialog-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-in">
        <h3 id="catalog-dialog-title" className="mb-4 text-lg font-semibold">{deleting ? "Xác nhận xóa" : editing?.id ? `Chỉnh sửa ${label.toLowerCase()}` : `Thêm ${label.toLowerCase()}`}</h3>
        {error && <div className="mb-4"><ErrorState message={error} /></div>}
        {deleting ? <><p>Bạn có chắc muốn xóa <strong>{deleting.name}</strong>?</p>{kind === "cohorts" && <p className="mt-2 text-sm text-slate-500">Không thể xóa khóa học đang có đề tài hoặc tài khoản sinh viên trực thuộc.</p>}{kind === "academic-years" && <p className="mt-2 text-sm text-slate-500">Không thể xóa năm học đang có học kỳ hoặc đề tài trực thuộc.</p>}{kind === "semesters" && <p className="mt-2 text-sm text-slate-500">Không thể xóa học kỳ đang có đề tài trực thuộc.</p>}{kind === "departments" && <p className="mt-2 text-sm text-slate-500">Không thể xóa bộ môn đang có đề tài hoặc tài khoản người dùng trực thuộc.</p>}{kind === "fields" && <p className="mt-2 text-sm text-slate-500">Đề tài sử dụng lĩnh vực này sẽ được giữ lại và chuyển về chưa gán lĩnh vực.</p>}<div className="mt-6 flex justify-end gap-3"><Button disabled={busy} onClick={() => setDeleting(null)}>Hủy</Button><Button variant="danger" busy={busy} onClick={() => void remove()}>Xóa</Button></div></> :
          <form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
            <label className="block text-sm">Tên {label.toLowerCase()}<input autoFocus required name="name" maxLength={kind === "academic-years" ? 20 : kind === "departments" ? 150 : kind === "fields" ? 100 : 50} defaultValue={editing?.name ?? ""} className={inputClass} /></label>
            {kind === "cohorts" && <div className="grid grid-cols-2 gap-4">{(["start_year", "end_year"] as const).map((field, index) => <label key={field} className="text-sm">{index ? "Năm kết thúc" : "Năm bắt đầu"}<input required type="number" min="1" max="9999" name={field} defaultValue={editing?.[field] ?? ""} className={inputClass} /></label>)}</div>}
            {kind === "academic-years" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_current" defaultChecked={editing?.is_current} />Năm học hiện hành (tự bỏ chọn năm học khác)</label>}
            {kind === "semesters" && <><p className="text-sm text-slate-500">Năm học: {years.data?.find((item) => String(item.id) === selectedYear)?.name}</p><div className="grid grid-cols-2 gap-4">{(["start_date", "end_date"] as const).map((field, index) => <label key={field} className="text-sm">{index ? "Ngày kết thúc" : "Ngày bắt đầu"}<input required type="date" name={field} defaultValue={editing?.[field] ?? ""} className={inputClass} /></label>)}</div></>}
            {kind === "departments" && <><label className="block text-sm">Mã bộ môn<input required name="code" maxLength={20} defaultValue={editing?.code ?? ""} className={inputClass} /></label><label className="block text-sm">Trưởng bộ môn<select name="head" defaultValue={editing?.head ?? ""} className={inputClass}><option value="">Chưa phân công</option>{heads.data?.map((head) => <option key={head.id} value={head.id}>{`${head.first_name} ${head.last_name}`.trim() || head.username} ({head.username})</option>)}</select></label>{heads.isLoading && <p role="status">Đang tải trưởng bộ môn...</p>}{heads.isError && <p role="alert" className="text-sm text-red-600">Không tải được trưởng bộ môn. <button type="button" onClick={() => void heads.refetch()} className="underline">Thử lại</button></p>}</>}
            <div className="flex justify-end gap-3 pt-2"><Button type="button" onClick={() => setEditing(null)}>Hủy</Button><Button type="submit" variant="primary" busy={busy} disabled={kind === "departments" && !heads.isSuccess}>Lưu thay đổi</Button></div>
          </fieldset></form>}
      </div>
    </div>}
  </Panel>;
}
