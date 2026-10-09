import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";

import { catalogApi } from "@/features/academics/api";
import { useAuthStore } from "@/features/auth/store";
import { Button, ErrorState, PageSkeleton, Panel, fieldClass } from "@/shared/components/ui";
import { toast } from "@/shared/lib/toast";
import { topicsApi } from "../api";
import TopicResourcesPanel from "../components/TopicResourcesPanel";
import { useStoredSimilarityResults, useTopicDetail, useTopicHistory } from "../hooks";
import type { Topic, TopicUpdatePayload } from "../types";

const statuses = {
  pending: { label: "Chờ duyệt", className: "border-amber-200 bg-amber-50 text-amber-700" },
  approved: { label: "Đã duyệt", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  rejected: { label: "Từ chối", className: "border-rose-200 bg-rose-50 text-rose-700" },
  rename_requested: { label: "Yêu cầu sửa tên", className: "border-sky-200 bg-sky-50 text-sky-700" },
};

const actionLabels: Record<string, string> = {
  created: "Tạo mới",
  updated: "Cập nhật",
  approved: "Duyệt",
  rejected: "Từ chối",
  rename_requested: "Yêu cầu sửa tên",
  assigned: "Giao đề tài",
  similarity_refreshed: "Chạy lại kiểm tra tương đồng",
};

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<Record<string, string | string[]>>(error)) {
    const data = error.response?.data;
    if (data) {
      const value = Object.entries(data).find(([key]) => key !== "status_code")?.[1];
      if (Array.isArray(value)) return value.join(" ");
      if (value) return value;
    }
  }
  return "Không thể thực hiện thao tác. Vui lòng thử lại.";
}

export default function TopicDetailPage() {
  const { id } = useParams();
  const topicId = Number(id);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");

  const detail = useTopicDetail(topicId);
  const history = useTopicHistory(topicId);
  const similarities = useStoredSimilarityResults(topicId);
  const topic = detail.data;
  const isAdmin = user?.role === "admin";
  const refreshSimilarity = useMutation({
    mutationFn: () => topicsApi.refreshSimilarity(topicId),
    onSuccess: () => {
      toast.success("Đã chạy lại và lưu kết quả kiểm tra tương đồng.");
      void client.invalidateQueries({ queryKey: ["topics", topicId, "stored-similarity"] });
      void client.invalidateQueries({ queryKey: ["topics", topicId, "history"] });
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => topicsApi.remove(topicId),
    onSuccess: () => {
      toast.success("Đã xóa đề tài và dữ liệu liên quan.");
      void client.invalidateQueries({ queryKey: ["topics"] });
      navigate("/topics");
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  if (detail.isLoading) return <PageSkeleton cards={2} />;
  if (detail.isError || !topic) {
    const notFound = axios.isAxiosError(detail.error) && detail.error.response?.status === 404;
    return <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
      <h2 className="font-semibold">{notFound ? "Không tìm thấy đề tài" : "Không tải được đề tài"}</h2>
      <p className="mt-1 text-sm">{notFound ? "Đề tài có thể đã bị xóa trước đó." : "Vui lòng tải lại trang và thử lại."}</p>
      <Link to="/topics" className="mt-4 inline-block text-sm font-medium underline">Quay lại danh sách</Link>
    </div>;
  }

  const highRiskDelete = topic.status === "approved" || topic.assignment_count > 0;
  const canConfirmDelete = !highRiskDelete || confirmTitle === topic.title;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/topics" className="text-sm text-slate-500 hover:text-slate-800">← Danh sách đề tài</Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Chi tiết đề tài</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{topic.title}</h1>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statuses[topic.status].className}`}>{statuses[topic.status].label}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{topic.description || "Chưa có mô tả."}</p>
        </div>
        {isAdmin && <div className="flex shrink-0 flex-wrap gap-2">
          <a href="#topic-history" className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800">Xem lịch sử</a>
          <Button onClick={() => setEditing(true)}>Chỉnh sửa</Button>
          <Button variant="danger" onClick={() => { setDeleting(true); setConfirmTitle(""); }}>Xóa đề tài</Button>
        </div>}
      </header>

      <Panel className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Bộ môn" value={topic.department_name} />
        <Info label="Lĩnh vực" value={topic.field_name || "Chưa phân loại"} />
        <Info label="Khóa học" value={topic.cohort_name} />
        <Info label="Năm học" value={topic.academic_year_name} />
        <Info label="Học kỳ" value={topic.semester_name} />
        <Info label="Người đề xuất" value={topic.proposed_by_detail ? (`${topic.proposed_by_detail.first_name} ${topic.proposed_by_detail.last_name}`.trim() || topic.proposed_by_detail.username) : `#${topic.proposed_by}`} />
        <Info label="Ngày tạo" value={new Date(topic.created_at).toLocaleString("vi-VN")} />
        <Info label="Cập nhật gần nhất" value={new Date(topic.updated_at).toLocaleString("vi-VN")} />
        <Info label="Số lượt giao" value={String(topic.assignment_count)} />
      </Panel>

      {topic.review_note && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold text-amber-900">Phản hồi duyệt</h2><p className="mt-1 text-sm text-amber-800">{topic.review_note}</p></section>}

      <TopicResourcesPanel
        topicId={topic.id}
        canEdit={isAdmin || (user?.role === "teacher" && user.id === topic.proposed_by)}
      />

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">Kết quả kiểm tra tương đồng đã lưu</h2>
          {isAdmin && <Button className="py-2 text-xs" busy={refreshSimilarity.isPending} onClick={() => refreshSimilarity.mutate()}>Chạy lại kiểm tra</Button>}
        </div>
        {similarities.isLoading ? <p className="mt-3 text-sm text-slate-500">Đang tải...</p> : similarities.data?.length ? <div className="mt-3 space-y-2">{similarities.data.map((result) => <div key={result.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-sm"><Link to={`/topics/${result.similar_topic}`} className="font-medium text-blue-700 hover:underline">{result.similar_topic_title}</Link><span className="font-semibold text-slate-700">{result.similarity_percent.toFixed(1)}%</span></div>)}</div> : <p className="mt-3 text-sm text-slate-500">Chưa có kết quả tương đồng được lưu.</p>}
      </Panel>

      <Panel id="topic-history" className="scroll-mt-24">
        <h2 className="font-semibold text-slate-900">Lịch sử xử lý</h2>
        {history.isLoading ? <p className="mt-3 text-sm text-slate-500">Đang tải...</p> : history.isError ? <div className="mt-3"><ErrorState message="Không tải được lịch sử đề tài." retry={() => void history.refetch()} /></div> : history.data?.length ? <ol className="mt-4 space-y-4">{history.data.map((entry) => <li key={entry.id} className="relative border-l-2 border-brand-200 pb-1 pl-5 text-sm before:absolute before:-left-[7px] before:top-1 before:h-3 before:w-3 before:rounded-full before:bg-brand-600"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><strong className="text-slate-900">{actionLabels[entry.action] || entry.action}</strong><span className="text-slate-500">bởi {entry.actor_name || "Tài khoản đã xóa"}</span><time dateTime={entry.created_at} className="text-xs text-slate-400">{new Date(entry.created_at).toLocaleString("vi-VN")}</time></div>{entry.note && <p className="mt-1.5 whitespace-pre-wrap text-slate-600">{entry.note}</p>}</li>)}</ol> : <p className="mt-3 text-sm text-slate-500">Chưa có lịch sử xử lý.</p>}
      </Panel>

      {editing && <EditTopicDialog topic={topic} close={() => setEditing(false)} />}
      {deleting && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="delete-topic-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-in">
        <h2 id="delete-topic-title" className="text-xl font-bold text-slate-950">Xác nhận xóa đề tài</h2>
        <p className="mt-3 text-sm text-slate-700">Thao tác sẽ xóa đề tài cùng lịch sử xử lý, kết quả tương đồng và thông tin giao đề tài.</p>
        {topic.assignment_count > 0 && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-800">Đề tài đã được giao cho sinh viên ({topic.assignment_count} lượt giao). Việc xóa sẽ ảnh hưởng trực tiếp đến sinh viên đang thực hiện.</p>}
        {topic.status === "approved" && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-800">Đây là đề tài đã được duyệt.</p>}
        {highRiskDelete && <label className="mt-4 block text-sm font-medium text-slate-800">Nhập chính xác tên đề tài để xác nhận<input value={confirmTitle} onChange={(event) => setConfirmTitle(event.target.value)} className={fieldClass} /></label>}
        <div className="mt-6 flex justify-end gap-3"><Button disabled={remove.isPending} onClick={() => setDeleting(false)}>Hủy</Button><Button variant="danger" busy={remove.isPending} disabled={!canConfirmDelete} onClick={() => remove.mutate()}>Xóa vĩnh viễn</Button></div>
      </div></div>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd></div>;
}

function EditTopicDialog({ topic, close }: { topic: Topic; close: () => void }) {
  const client = useQueryClient();
  const [payload, setPayload] = useState<TopicUpdatePayload>({ title: topic.title, description: topic.description, department: topic.department, field: topic.field, cohort: topic.cohort, academic_year: topic.academic_year, semester: topic.semester });
  const departments = useQuery({ queryKey: ["catalog", "departments"], queryFn: () => catalogApi.list("departments") });
  const fields = useQuery({ queryKey: ["catalog", "fields"], queryFn: () => catalogApi.list("fields") });
  const cohorts = useQuery({ queryKey: ["catalog", "cohorts"], queryFn: () => catalogApi.list("cohorts") });
  const years = useQuery({ queryKey: ["catalog", "academic-years"], queryFn: () => catalogApi.list("academic-years") });
  const semesters = useQuery({ queryKey: ["catalog", "semesters", payload.academic_year], queryFn: () => catalogApi.list("semesters", String(payload.academic_year)), enabled: !!payload.academic_year });
  const update = useMutation({ mutationFn: () => topicsApi.update(topic.id, payload), onSuccess: () => { toast.success("Đã cập nhật đề tài."); void client.invalidateQueries({ queryKey: ["topics"] }); close(); } });
  const inputClass = fieldClass;
  function submit(event: FormEvent) { event.preventDefault(); update.mutate(); }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><form onSubmit={submit} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-in">
    <h2 className="text-xl font-bold">Chỉnh sửa đề tài</h2>
    {update.isError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{errorMessage(update.error)}</p>}
    <fieldset disabled={update.isPending} className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2 text-sm">Tên đề tài<input required maxLength={500} value={payload.title} onChange={(e) => setPayload({ ...payload, title: e.target.value })} className={inputClass} /></label>
      <label className="sm:col-span-2 text-sm">Mô tả<textarea rows={4} value={payload.description} onChange={(e) => setPayload({ ...payload, description: e.target.value })} className={inputClass} /></label>
      <Select label="Bộ môn" value={payload.department} items={departments.data ?? []} onChange={(value) => setPayload({ ...payload, department: value })} />
      <label className="text-sm">Lĩnh vực<select value={payload.field ?? ""} onChange={(e) => setPayload({ ...payload, field: e.target.value ? Number(e.target.value) : null })} className={inputClass}><option value="">Chưa phân loại</option>{fields.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <Select label="Khóa học" value={payload.cohort} items={cohorts.data ?? []} onChange={(value) => setPayload({ ...payload, cohort: value })} />
      <Select label="Năm học" value={payload.academic_year} items={years.data ?? []} onChange={(value) => setPayload({ ...payload, academic_year: value, semester: 0 })} />
      <Select label="Học kỳ" value={payload.semester} items={semesters.data ?? []} onChange={(value) => setPayload({ ...payload, semester: value })} />
    </fieldset>
    <div className="mt-6 flex justify-end gap-3"><Button type="button" onClick={close}>Hủy</Button><Button type="submit" variant="primary" busy={update.isPending} disabled={!payload.semester}>Lưu thay đổi</Button></div>
  </form></div>;
}

function Select({ label, value, items, onChange }: { label: string; value: number; items: Array<{ id: number; name: string }>; onChange: (value: number) => void }) {
  return <label className="text-sm">{label}<select required value={value || ""} onChange={(event) => onChange(Number(event.target.value))} className={fieldClass}><option value="" disabled>Chọn {label.toLowerCase()}</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}
