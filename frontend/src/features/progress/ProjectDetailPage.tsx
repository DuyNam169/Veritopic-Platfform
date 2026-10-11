import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "@/shared/lib/axios";
import { teacherApi } from "@/features/teacher/api";
import { useAuthStore } from "@/features/auth/store";

type Assignment = {topic: number; topic_title: string; status: string; due_date: string | null; note: string; proposed_by_detail?: {first_name: string; last_name: string; username: string}};
export default function ProjectDetailPage() {
  const {assignmentId} = useParams();
  const id = Number(assignmentId);
  const user = useAuthStore(s => s.user);
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const assignment = useQuery({queryKey: ["assignment", user?.id, id], queryFn: () => api.get<Assignment>(`/progress/projects/${id}/`).then(r => r.data)});
  const reports = useQuery({queryKey: ["reports", user?.id, id], queryFn: () => teacherApi.getAssignmentReports(id)});
  async function submit(event: FormEvent<HTMLFormElement>, reportId?: number) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setError("");
    try {
      if (reportId) await teacherApi.addProgressFeedback(reportId, {comment: String(data.get("comment")), result: data.get("result") as "passed" | "need_revision" | "failed", ...(data.get("score") ? {score: Number(data.get("score"))} : {})});
      else { if ((data.get("attachment") as File)?.size === 0) data.delete("attachment"); await api.post(`/progress/projects/${id}/reports/`, data); }
      form.reset();
      await Promise.all([client.invalidateQueries({queryKey: ["reports"]}), client.invalidateQueries({queryKey: ["projects"]})]);
    } catch { setError("Không lưu được. Kiểm tra nội dung, định dạng tệp, trạng thái đề tài và quyền của bạn."); }
    finally {setBusy(false);}
  }
  async function download(reportId: number) {
    try {const response = await api.get(`/progress/reports/${reportId}/download-attachment/`, {responseType: "blob"}); const url = URL.createObjectURL(response.data); const link = document.createElement("a"); link.href = url; link.download = decodeURIComponent(response.headers["content-disposition"]?.match(/filename\*=UTF-8''([^;]+)/)?.[1] ?? "bao-cao"); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);} catch {setError("Không tải được tệp đính kèm.");}
  }
  if (assignment.isPending) return <p>Đang tải đồ án…</p>;
  if (assignment.isError || !assignment.data) return <p role="alert">Không tìm thấy đồ án hoặc bạn không có quyền truy cập.</p>;
  const project = assignment.data;
  const input = "w-full rounded-lg border border-slate-200 bg-white p-3 text-sm";
  return <div className="mx-auto max-w-4xl space-y-6"><Link to="/projects" className="text-sm text-brand-700">← Tiến độ đồ án</Link><div className="rounded-2xl border bg-white p-6"><Link to={`/topics/${project.topic}`} className="text-2xl font-bold text-brand-800">{project.topic_title}</Link><p className="mt-3 text-slate-500">Giảng viên: {project.proposed_by_detail?.first_name} {project.proposed_by_detail?.last_name} · Hạn nộp: {project.due_date ?? "Chưa đặt"}</p>{project.note && <p className="mt-3">{project.note}</p>}</div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {user?.role === "student" && project.status === "active" && <form onSubmit={e => submit(e)} className="space-y-4 rounded-2xl border bg-white p-6"><h2 className="text-xl font-semibold">Gửi báo cáo tiến độ</h2><div className="grid gap-4 sm:grid-cols-2"><label>Mốc báo cáo<input name="period_label" required maxLength={100} placeholder="Ví dụ: Tuần 3" className={input}/></label><label>Giai đoạn<input name="stage" maxLength={100} placeholder="Ví dụ: Thiết kế hệ thống" className={input}/></label></div><label className="block">Hoàn thành (%)<input name="percent" type="number" required min={0} max={100} defaultValue={0} className={input}/></label><label className="block">Kết quả đã thực hiện<textarea name="content" required rows={4} className={input}/></label><label className="block text-sm">Tài liệu đính kèm · PDF, Word, ZIP, tối đa 20 MB<input name="attachment" type="file" accept=".pdf,.doc,.docx,.zip" className={input}/></label><button disabled={busy} className="rounded-lg bg-brand-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Đang lưu…" : "Gửi báo cáo"}</button></form>}
    <h2 className="text-xl font-semibold">Báo cáo & nhận xét</h2>{reports.isError && <p role="alert">Không tải được báo cáo.</p>}{reports.data?.length === 0 && <p className="text-slate-500">Chưa có báo cáo.</p>}
    {reports.data?.map(r => <article key={r.id} className="space-y-4 rounded-2xl border bg-white p-6"><div className="flex justify-between"><h3 className="font-semibold">{r.period_label} · {r.stage}</h3><strong className="text-brand-700">{r.percent}%</strong></div><p className="text-xs text-slate-500">{r.submitted_by_info?.first_name} {r.submitted_by_info?.last_name} · {new Date(r.submitted_at).toLocaleString("vi-VN")}{r.is_late && " · Nộp trễ"}</p><p className="whitespace-pre-wrap">{r.content}</p>{r.attachment && <button onClick={() => download(r.id)} className="text-sm font-semibold text-brand-700 underline">Tải tài liệu đính kèm</button>}{r.feedbacks.map(f => <div key={f.id} className="rounded-xl bg-brand-50 p-4"><p className="font-semibold">{f.result_display}{f.score != null && ` · ${f.score}/10`}</p><p className="mt-2 whitespace-pre-wrap">{f.comment}</p><p className="mt-2 text-xs text-slate-500">{f.teacher_info?.first_name} {f.teacher_info?.last_name} · {new Date(f.created_at).toLocaleString("vi-VN")}</p></div>)}{user?.role === "teacher" && <form onSubmit={e => submit(e, r.id)} className="space-y-3 border-t pt-4"><label className="block text-sm">Nhận xét mới<textarea name="comment" required rows={3} className={input}/></label><div className="flex gap-3"><select aria-label="Kết quả" name="result" className={input}><option value="passed">Đạt</option><option value="need_revision">Cần chỉnh sửa</option><option value="failed">Không đạt</option></select><input aria-label="Điểm" name="score" type="number" min={0} max={10} step={0.1} placeholder="Điểm /10 (tùy chọn)" className={input}/></div><button disabled={busy} className="rounded-lg bg-brand-700 px-4 py-2 text-white disabled:opacity-50">Lưu nhận xét</button></form>}</article>)}
  </div>;
}
