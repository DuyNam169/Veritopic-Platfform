import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

import { Clock } from "@/shared/components/icons";
import { Button, EmptyState, ErrorState, PageHeader, PageSkeleton, fieldClass } from "@/shared/components/ui";
import { toast } from "@/shared/lib/toast";
import { useStoredSimilarityResults } from "@/features/topics/hooks";
import type { Topic } from "@/features/topics/types";
import { useApproveTopic, usePendingTopics, useRejectTopic, useRequestRenameTopic } from "../hooks";

const warningLabels: Record<string, string> = {
  normal: "Bình thường", review: "Cần xem xét", high: "Tương đồng cao", duplicate: "Có khả năng trùng",
};

function errorMessage(error: unknown) {
  if (axios.isAxiosError<Record<string, string | string[]>>(error)) {
    const data = error.response?.data;
    if (data) {
      const value = data.detail ?? Object.values(data)[0];
      if (Array.isArray(value)) return value.join(" ");
      if (value) return value;
    }
  }
  return "Không thể xử lý đề tài. Vui lòng thử lại.";
}

export default function ApprovalPage() {
  const pending = usePendingTopics();
  const approve = useApproveTopic();
  const reject = useRejectTopic();
  const requestRename = useRequestRenameTopic();
  const [selected, setSelected] = useState<Topic | null>(null);
  const [note, setNote] = useState("");
  const similarities = useStoredSimilarityResults(selected?.id ?? 0);
  const isProcessing = approve.isPending || reject.isPending || requestRename.isPending;

  function openReview(topic: Topic) { setSelected(topic); setNote(""); }
  function finish(message: string) { toast.success(message); setSelected(null); setNote(""); }
  function failed(error: unknown) { toast.error(errorMessage(error)); void pending.refetch(); }

  function decide(action: "approve" | "reject" | "rename") {
    if (!selected) return;
    const payload = { id: selected.id, note };
    if (action === "approve") approve.mutate(payload, { onSuccess: () => finish(`Đã phê duyệt đề tài "${selected.title}".`), onError: failed });
    else if (action === "reject") reject.mutate(payload, { onSuccess: () => finish(`Đã từ chối đề tài "${selected.title}".`), onError: failed });
    else requestRename.mutate(payload, { onSuccess: () => finish(`Đã yêu cầu sửa tên đề tài "${selected.title}".`), onError: failed });
  }

  return <div className="mx-auto max-w-5xl space-y-6">
    <PageHeader eyebrow="Kiểm duyệt đề tài" title="Danh sách đề tài chờ duyệt" description="Xem thông tin và kết quả tương đồng trước khi đưa ra quyết định." />

    {pending.isLoading ? <PageSkeleton cards={3} />
      : pending.isError ? <ErrorState message="Không tải được danh sách chờ duyệt." retry={() => void pending.refetch()} />
      : (pending.data ?? []).length === 0 ? <EmptyState title="Không có đề tài nào đang chờ duyệt" description="Tất cả đề tài đã được xử lý hoặc phản hồi." icon={<Clock className="h-6 w-6" />} />
      : <div className="space-y-3">{(pending.data ?? []).map((topic) => <article key={topic.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Chờ duyệt</span><h2 className="font-bold text-slate-900">{topic.title}</h2></div><p className="mt-2 line-clamp-2 text-sm text-slate-500">{topic.description || "Chưa có mô tả chi tiết."}</p><p className="mt-2 text-xs text-slate-400">{topic.department_name} · {topic.proposed_by_detail ? (`${topic.proposed_by_detail.first_name} ${topic.proposed_by_detail.last_name}`.trim() || topic.proposed_by_detail.username) : `#${topic.proposed_by}`}</p></div><Button variant="primary" onClick={() => openReview(topic)}>Xem và xử lý</Button></article>)}</div>}

    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="review-topic-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-in">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Đề tài chờ duyệt</p><h2 id="review-topic-title" className="mt-1 text-xl font-bold text-slate-950">{selected.title}</h2></div><button disabled={isProcessing} onClick={() => setSelected(null)} className="text-sm font-semibold text-slate-500">Đóng</button></div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{selected.description || "Chưa có mô tả."}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600"><span className="rounded bg-slate-100 px-2 py-1">{selected.department_name}</span><span className="rounded bg-slate-100 px-2 py-1">{selected.field_name || "Chưa phân loại"}</span><span className="rounded bg-slate-100 px-2 py-1">{selected.academic_year_name} · {selected.semester_name}</span></div>
      <Link to={`/topics/${selected.id}`} className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline">Mở trang chi tiết đầy đủ →</Link>
      <section className="mt-6 rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-900">Kết quả tương đồng đã lưu</h3>{similarities.isLoading ? <p className="mt-3 text-sm text-slate-500">Đang tải kết quả...</p> : similarities.isError ? <p className="mt-3 text-sm text-rose-700">Không tải được kết quả tương đồng.</p> : similarities.data?.length ? <div className="mt-3 space-y-2">{similarities.data.map((result) => <div key={result.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm"><Link to={`/topics/${result.similar_topic}`} className="font-medium text-blue-700 hover:underline">{result.similar_topic_title}</Link><span className="font-semibold text-slate-700">{result.similarity_percent.toFixed(1)}% · {warningLabels[result.warning_level] || result.warning_level}</span></div>)}</div> : <p className="mt-3 text-sm text-slate-500">Chưa phát hiện đề tài tương đồng.</p>}</section>
      <label className="mt-5 block text-sm font-medium text-slate-800">Ghi chú xử lý (không bắt buộc)<textarea disabled={isProcessing} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nhập lý do hoặc hướng dẫn cho giảng viên..." className={fieldClass} /></label>
      <div className="mt-6 grid gap-2 sm:grid-cols-3"><Button variant="primary" busy={approve.isPending} disabled={isProcessing} onClick={() => decide("approve")}>Duyệt đề tài</Button><Button variant="warning" busy={requestRename.isPending} disabled={isProcessing} onClick={() => decide("rename")}>Yêu cầu sửa tên</Button><Button variant="danger" busy={reject.isPending} disabled={isProcessing} onClick={() => decide("reject")}>Từ chối</Button></div>
    </div></div>}
  </div>;
}
