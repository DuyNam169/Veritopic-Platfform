import { BookOpen, Clock, CheckCircle2, Layers, GraduationCap, Users, AlertTriangle } from "@/shared/components/icons";
import type { StatisticsOverview } from "../api";

export function StatisticsSummary({ data }: { data: StatisticsOverview }) {
  const pending = data.by_status.find((row) => row.status === "pending")?.count ?? 0;
  const approved = data.by_status.find((row) => row.status === "approved")?.count ?? 0;
  const so = data.students_overview;

  if (so) {
    const cards = [
      {
        label: "Đề tài đề xuất",
        value: data.total,
        detail: `${approved} đã duyệt · ${pending} chờ duyệt`,
        icon: BookOpen,
        color: "bg-blue-50 text-blue-700",
      },
      {
        label: "Sinh viên hướng dẫn",
        value: so.total_students,
        detail: `${so.assigned_topic_count} có đề tài · ${so.unassigned_topic_count} chưa giao`,
        icon: GraduationCap,
        color: "bg-emerald-50 text-emerald-700",
      },
      {
        label: "Đang làm đồ án",
        value: so.active_students_count,
        detail: `${so.completed_students_count} sinh viên đã hoàn thành`,
        icon: Users,
        color: "bg-teal-50 text-teal-700",
      },
      {
        label: "Tiến độ trung bình",
        value: `${so.average_progress}%`,
        detail: "Mức độ hoàn thành chung",
        icon: CheckCircle2,
        color: "bg-brand-50 text-brand-700",
      },
      {
        label: "Chờ GV nhận xét",
        value: so.pending_feedback_count,
        detail: so.pending_feedback_count ? "Báo cáo cần chấm" : "Đã nhận xét hết",
        icon: Clock,
        color: so.pending_feedback_count ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500",
      },
      {
        label: "Cảnh báo trễ hạn",
        value: so.late_students_count,
        detail: so.late_students_count ? "Sinh viên có bài nộp muộn" : "Tất cả đúng tiến độ",
        icon: AlertTriangle,
        color: so.late_students_count ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500",
      },
    ];

    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map(({ label, value, detail, icon: Icon, color }) => (
          <article key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <span className={`grid h-8 w-8 place-items-center rounded-lg ${color}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-slate-950">
              {typeof value === "number" ? value.toLocaleString("vi-VN") : value}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</p>
          </article>
        ))}
      </div>
    );
  }

  const cards = [
    { label: "Tổng số đề tài", value: data.total, detail: "Trong phạm vi đang xem", icon: BookOpen, color: "bg-brand-50 text-brand-700" },
    { label: "Chờ phê duyệt", value: pending, detail: "Cần được hội đồng xem xét", icon: Clock, color: "bg-amber-50 text-amber-700" },
    { label: "Đã phê duyệt", value: approved, detail: `${data.total ? Math.round(approved / data.total * 100) : 0}% tổng số đề tài`, icon: CheckCircle2, color: "bg-emerald-50 text-emerald-700" },
    { label: "Lĩnh vực có đề tài", value: data.by_field.filter((row) => row.field__name !== null && row.count > 0).length, detail: "Theo phân loại hiện có", icon: Layers, color: "bg-sky-50 text-sky-700" },
  ];
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, detail, icon: Icon, color }) =>
    <article key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className={`grid h-10 w-10 place-items-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></span></div>
      <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-slate-950">{value.toLocaleString("vi-VN")}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </article>)}</div>;
}
