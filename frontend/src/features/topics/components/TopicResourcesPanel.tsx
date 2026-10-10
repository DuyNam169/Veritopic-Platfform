import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { Button, Panel, fieldClass } from "@/shared/components/ui";
import { toast } from "@/shared/lib/toast";
import {
  topicResourcesApi,
  type TopicFunction,
} from "../resourcesApi";

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<Record<string, unknown>>(error) && error.response?.data) {
    return Object.values(error.response.data)
      .map((value) => Array.isArray(value) ? value.join(" ") : String(value))
      .join(" ");
  }
  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

export default function TopicResourcesPanel({ topicId, canEdit }: { topicId: number; canEdit: boolean }) {
  const client = useQueryClient();
  const [technologyId, setTechnologyId] = useState("");
  const [editingFunction, setEditingFunction] = useState<TopicFunction | null>(null);
  const [functionName, setFunctionName] = useState("");
  const [functionDescription, setFunctionDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const technologies = useQuery({ queryKey: ["topic-resources", topicId, "technologies"], queryFn: () => topicResourcesApi.topicTechnologies(topicId) });
  const functions = useQuery({ queryKey: ["topic-resources", topicId, "functions"], queryFn: () => topicResourcesApi.topicFunctions(topicId) });
  const documents = useQuery({ queryKey: ["topic-resources", topicId, "documents"], queryFn: () => topicResourcesApi.topicDocuments(topicId) });
  const catalog = useQuery({ queryKey: ["topic-technology-catalog"], queryFn: topicResourcesApi.technologies });
  const usedTechnologyIds = new Set((technologies.data ?? []).map((item) => item.technology));
  const availableTechnologies = (catalog.data ?? []).filter((item) => !usedTechnologyIds.has(item.id));

  async function refresh(key: string) {
    await client.invalidateQueries({ queryKey: ["topic-resources", topicId, key] });
  }
  async function run(action: () => Promise<unknown>, success: string, key: string): Promise<boolean> {
    try {
      await action();
      toast.success(success);
      await refresh(key);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  }
  async function saveFunction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = { topic: topicId, function_name: functionName.trim(), description: functionDescription.trim() };
    const saved = await run(
      () => topicResourcesApi.saveFunction(payload, editingFunction?.id),
      editingFunction ? "Đã cập nhật chức năng." : "Đã thêm chức năng.",
      "functions",
    );
    if (!saved) return;
    setEditingFunction(null);
    setFunctionName("");
    setFunctionDescription("");
  }
  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const form = event.currentTarget;
    try {
      await topicResourcesApi.uploadDocument(topicId, file);
      toast.success("Đã tải tài liệu lên.");
      setFile(null);
      form.reset();
      await refresh("documents");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return <div className="space-y-5">
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold text-slate-900">Công nghệ sử dụng</h2><p className="mt-1 text-sm text-slate-500">Các công nghệ được liên kết với đề tài.</p></div>
        {canEdit && <form className="flex flex-wrap gap-2" onSubmit={(event) => {
          event.preventDefault();
          if (!technologyId) return;
          void run(() => topicResourcesApi.addTopicTechnology(topicId, Number(technologyId)), "Đã thêm công nghệ.", "technologies");
          setTechnologyId("");
        }}>
          <select aria-label="Chọn công nghệ" className={`${fieldClass} mt-0 min-w-52`} value={technologyId} onChange={(event) => setTechnologyId(event.target.value)}>
            <option value="">Chọn công nghệ</option>
            {availableTechnologies.map((item) => <option key={item.id} value={item.id}>{item.category} · {item.name}</option>)}
          </select>
          <Button type="submit" variant="primary" disabled={!technologyId}>Thêm</Button>
        </form>}
      </div>
      {technologies.isError || catalog.isError ? <p role="alert" className="mt-4 text-sm text-rose-700">Không tải được danh sách công nghệ.</p>
        : technologies.isLoading ? <p className="mt-4 text-sm text-slate-500">Đang tải...</p>
          : technologies.data?.length ? <ul className="mt-4 flex flex-wrap gap-2">
            {technologies.data.map((item) => <li key={item.id} className="flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-sm">
              <span className="text-xs font-medium text-brand-700">{item.technology_detail.category}</span>
              <span className="font-semibold text-slate-800">{item.technology_detail.name}</span>
              {canEdit && <button type="button" className="font-bold text-slate-400 hover:text-rose-600" aria-label={`Xóa ${item.technology_detail.name}`} onClick={() => void run(() => topicResourcesApi.removeTopicTechnology(item.id), "Đã gỡ công nghệ.", "technologies")}>×</button>}
              {canEdit && <button type="button" className="text-xs text-brand-700 underline" onClick={() => void run(() => topicResourcesApi.updateTopicTechnology(item.id, { is_primary: !item.is_primary }), "Đã cập nhật công nghệ chính.", "technologies")}>{item.is_primary ? "Chính" : "Đặt chính"}</button>}
            </li>)}
          </ul> : <p className="mt-4 text-sm text-slate-500">Chưa có công nghệ nào được khai báo.</p>}
    </Panel>

    <Panel>
      <div><h2 className="font-semibold text-slate-900">Chức năng chính</h2><p className="mt-1 text-sm text-slate-500">Các chức năng con thuộc phạm vi đề tài.</p></div>
      {canEdit && <form onSubmit={saveFunction} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4">
        <label className="text-sm font-medium text-slate-700">Tên chức năng<input required maxLength={255} className={fieldClass} value={functionName} onChange={(event) => setFunctionName(event.target.value)} /></label>
        <label className="text-sm font-medium text-slate-700">Mô tả<textarea rows={2} className={fieldClass} value={functionDescription} onChange={(event) => setFunctionDescription(event.target.value)} /></label>
        <div className="flex gap-2">
          <Button type="submit" variant="primary">{editingFunction ? "Lưu chức năng" : "Thêm chức năng"}</Button>
          {editingFunction && <Button type="button" onClick={() => { setEditingFunction(null); setFunctionName(""); setFunctionDescription(""); }}>Hủy sửa</Button>}
        </div>
      </form>}
      {functions.isError ? <p role="alert" className="mt-4 text-sm text-rose-700">Không tải được chức năng đề tài.</p>
        : functions.isLoading ? <p className="mt-4 text-sm text-slate-500">Đang tải...</p>
          : functions.data?.length ? <div className="mt-4 divide-y divide-slate-100">
            {functions.data.map((item) => <article key={item.id} className="flex items-start justify-between gap-4 py-3">
              <div><h3 className="text-sm font-semibold text-slate-900">{item.function_name}</h3>{item.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.description}</p>}</div>
              {canEdit && <div className="flex shrink-0 gap-3 text-xs font-semibold"><button type="button" className="text-brand-700 hover:underline" onClick={() => { setEditingFunction(item); setFunctionName(item.function_name); setFunctionDescription(item.description); }}>Sửa</button><button type="button" className="text-rose-600 hover:underline" onClick={() => void run(() => topicResourcesApi.deleteFunction(item.id), "Đã xóa chức năng.", "functions")}>Xóa</button></div>}
            </article>)}
          </div> : <p className="mt-4 text-sm text-slate-500">Chưa có chức năng nào được khai báo.</p>}
    </Panel>

    <Panel>
      <div><h2 className="font-semibold text-slate-900">Tài liệu đính kèm</h2><p className="mt-1 text-sm text-slate-500">Hỗ trợ PDF/DOCX, tối đa 10 MB mỗi tệp.</p></div>
      {canEdit && <form onSubmit={uploadFile} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1 text-sm font-medium text-slate-700">Chọn tài liệu<input required type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className={fieldClass} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        <Button type="submit" variant="primary" disabled={!file}>Tải lên</Button>
      </form>}
      {documents.isError ? <p role="alert" className="mt-4 text-sm text-rose-700">Không tải được tài liệu đề tài.</p>
        : documents.isLoading ? <p className="mt-4 text-sm text-slate-500">Đang tải...</p>
          : documents.data?.length ? <ul className="mt-4 divide-y divide-slate-100">
            {documents.data.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div><a href={item.file_url ?? undefined} onClick={(event) => { event.preventDefault(); void topicResourcesApi.downloadDocument(item.id, item.file_name).catch((error: unknown) => toast.error(errorMessage(error))); }} className="font-medium text-brand-700 hover:underline">{item.file_name}</a><p className="mt-1 text-xs text-slate-500">{item.file_type} · {(item.file_size / 1024 / 1024).toFixed(2)} MB · {new Date(item.uploaded_at).toLocaleDateString("vi-VN")}</p></div>
              {canEdit && <button type="button" className="text-sm font-semibold text-rose-600 hover:underline" onClick={() => void run(() => topicResourcesApi.deleteDocument(item.id), "Đã xóa tài liệu.", "documents")}>Xóa</button>}
            </li>)}
          </ul> : <p className="mt-4 text-sm text-slate-500">Chưa có tài liệu đính kèm.</p>}
    </Panel>
  </div>;
}
