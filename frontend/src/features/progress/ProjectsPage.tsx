import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { teacherApi } from "@/features/teacher/api";
import { useAuthStore } from "@/features/auth/store";

export default function ProjectsPage({ overview = false }: { overview?: boolean }) {
  const user = useAuthStore(s => s.user);
  const projects = useQuery({ queryKey: ["projects", user?.id], queryFn: teacherApi.getProjectsProgress });
  const topics = useQuery({ queryKey: ["role-topics", user?.id], queryFn: () => teacherApi.getAllTopics({status: "pending", page: 1}), enabled: overview && user?.role === "department_head" });
  const items = projects.data ?? [];
  return <div className="mx-auto max-w-6xl space-y-6">
    <div><p className="text-sm font-semibold uppercase tracking-wider text-brand-700">{user?.role === "student" ? "Không gian sinh viên" : "Theo dõi đào tạo"}</p><h1 className="mt-2 text-3xl font-bold">{overview ? "Tổng quan đề tài" : "Tiến độ đồ án"}</h1><p className="mt-2 text-slate-500">{user?.role === "student" ? "Theo dõi đề tài được giao, gửi báo cáo và xem nhận xét của giảng viên." : "Theo dõi các nhóm thực hiện, báo cáo mới nhất và tình trạng tiến độ."}</p></div>
    {overview && user?.role === "department_head" && <Link to="/approval" className="inline-flex rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white">Duyệt đề tài · {topics.data?.count ?? 0} chờ duyệt</Link>}
    <div className="grid gap-4 sm:grid-cols-3">{[["Nhóm đề tài", items.length], ["Đang thực hiện", items.filter(p => p.status === "active").length], ["Cần theo dõi", items.filter(p => p.is_late).length]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-brand-800">{value}</p></div>)}</div>
    {projects.isPending && <p>Đang tải dữ liệu…</p>}
    {projects.isError && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">Không tải được tiến độ. <button onClick={() => projects.refetch()} className="underline">Thử lại</button></div>}
    {!projects.isPending && !projects.isError && !items.length && <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">Chưa có đề tài được giao trong phạm vi của bạn.</div>}
    <div className="grid gap-4 lg:grid-cols-2">{items.map(p => <Link key={p.assignment_id} to={`/projects/${p.assignment_id}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-400"><div className="flex items-start justify-between gap-4"><h2 className="font-semibold text-slate-900">{p.topic_title}</h2><span className={`shrink-0 rounded-full px-3 py-1 text-xs ${p.is_late ? "bg-amber-50 text-amber-800" : "bg-brand-50 text-brand-800"}`}>{p.is_late ? "Chậm cập nhật" : p.status_display}</span></div><p className="mt-3 text-sm text-slate-500">{p.students.map(s => s.full_name).join(", ")}</p><div className="mt-5 flex justify-between text-sm"><span>Tiến độ gần nhất</span><strong>{p.latest_percent}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{width: `${p.latest_percent}%`}} /></div><div className="mt-4 flex justify-between text-xs text-slate-500"><span>{p.total_reports} báo cáo</span><span>Hạn nộp: {p.due_date ? new Date(p.due_date).toLocaleDateString("vi-VN") : "Chưa đặt"}</span></div></Link>)}</div>
  </div>;
}
