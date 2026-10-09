import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { topicResourcesApi, type Technology } from "@/features/topics/resourcesApi";
import { Button, ErrorState, PageHeader, Panel, fieldClass } from "@/shared/components/ui";
import { toast } from "@/shared/lib/toast";

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<Record<string, unknown>>(error) && error.response?.data) {
    return Object.values(error.response.data)
      .map((value) => Array.isArray(value) ? value.join(" ") : String(value))
      .join(" ");
  }
  return "Không thể kết nối máy chủ. Vui lòng thử lại.";
}

export default function TechnologiesPage() {
  const client = useQueryClient();
  const [editing, setEditing] = useState<Partial<Technology> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const technologies = useQuery({ queryKey: ["topic-technology-catalog"], queryFn: topicResourcesApi.technologies });

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await topicResourcesApi.saveTechnology({
        name: String(form.get("name")).trim(),
        category: String(form.get("category")).trim() || "Khác",
        description: String(form.get("description")).trim(),
      }, editing?.id);
      setEditing(null);
      toast.success("Đã lưu công nghệ.");
      await client.invalidateQueries({ queryKey: ["topic-technology-catalog"] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Technology) {
    if (!window.confirm(`Xóa công nghệ "${item.name}" khỏi danh mục?`)) return;
    setBusy(true);
    setError("");
    try {
      await topicResourcesApi.deleteTechnology(item.id);
      toast.success("Đã xóa công nghệ.");
      await client.invalidateQueries({ queryKey: ["topic-technology-catalog"] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return <div className="mx-auto max-w-6xl space-y-6">
    <PageHeader eyebrow="Quản trị hệ thống" title="Danh mục công nghệ" description="Quản lý các công nghệ có thể gắn vào đề tài như ngôn ngữ, framework, cơ sở dữ liệu và công cụ." actions={<Button variant="primary" onClick={() => { setEditing({}); setError(""); }}>+ Thêm công nghệ</Button>} />
    {error && <ErrorState message={error} />}
    <Panel>
      {technologies.isLoading ? <p className="text-sm text-slate-500">Đang tải danh mục...</p>
        : technologies.isError ? <ErrorState message="Không tải được danh mục công nghệ." retry={() => { void technologies.refetch(); }} />
          : technologies.data?.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-3 pr-4">Tên công nghệ</th><th className="py-3 pr-4">Nhóm</th><th className="py-3 pr-4">Mô tả</th><th className="py-3 text-right">Thao tác</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{technologies.data.map((item) => <tr key={item.id}>
              <td className="py-3 pr-4 font-semibold text-slate-900">{item.name}</td><td className="py-3 pr-4">{item.category}</td><td className="py-3 pr-4 text-slate-600">{item.description || "—"}</td>
              <td className="py-3 text-right"><button disabled={busy} className="mr-3 font-semibold text-brand-700 hover:underline" onClick={() => { setEditing(item); setError(""); }}>Sửa</button><button disabled={busy} className="font-semibold text-rose-600 hover:underline" onClick={() => void remove(item)}>Xóa</button></td>
            </tr>)}</tbody>
          </table></div> : <p className="text-sm text-slate-500">Chưa có công nghệ nào trong danh mục.</p>}
    </Panel>

    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <form key={editing.id ?? "new"} onSubmit={save} className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-slate-900">{editing.id ? "Chỉnh sửa công nghệ" : "Thêm công nghệ"}</h2>
        {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <fieldset disabled={busy} className="mt-4 space-y-4">
          <label className="block text-sm font-medium">Tên<input required maxLength={100} name="name" defaultValue={editing.name ?? ""} className={fieldClass} /></label>
          <label className="block text-sm font-medium">Nhóm<input maxLength={50} name="category" defaultValue={editing.category ?? "Khác"} className={fieldClass} placeholder="Ngôn ngữ, Framework, Cơ sở dữ liệu..." /></label>
          <label className="block text-sm font-medium">Mô tả<textarea rows={3} name="description" defaultValue={editing.description ?? ""} className={fieldClass} /></label>
        </fieldset>
        <div className="mt-6 flex justify-end gap-3"><Button type="button" disabled={busy} onClick={() => setEditing(null)}>Hủy</Button><Button type="submit" variant="primary" busy={busy}>Lưu</Button></div>
      </form>
    </div>}
  </div>;
}
