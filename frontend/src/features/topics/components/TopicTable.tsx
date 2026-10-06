import { Link } from "react-router-dom";

import { ArrowRight, BookOpen } from "@/shared/components/icons";
import type { Topic, TopicStatus } from "../types";

const statuses: Record<TopicStatus, { label: string; className: string }> = {
  pending: { label: "Chờ duyệt", className: "border-amber-200 bg-amber-50 text-amber-700" },
  approved: { label: "Đã duyệt", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  rejected: { label: "Từ chối", className: "border-rose-200 bg-rose-50 text-rose-700" },
  rename_requested: { label: "Yêu cầu sửa tên", className: "border-sky-200 bg-sky-50 text-sky-700" },
};

export default function TopicTable({ topics }: { topics: Topic[] }) {
  return <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr><th className="px-5 py-3.5">Đề tài</th><th className="px-4 py-3.5">Bộ môn</th><th className="px-4 py-3.5">Thời gian</th><th className="px-4 py-3.5">Trạng thái</th><th className="px-5 py-3.5 text-right">Chi tiết</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {topics.length === 0 && <tr><td colSpan={5} className="px-6 py-14 text-center"><BookOpen className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-medium text-slate-700">Không tìm thấy đề tài</p><p className="mt-1 text-sm text-slate-500">Hãy thay đổi từ khóa hoặc điều kiện lọc.</p></td></tr>}
          {topics.map((topic) => {
            const status = statuses[topic.status];
            const teacher = topic.proposed_by_detail ? (`${topic.proposed_by_detail.first_name} ${topic.proposed_by_detail.last_name}`.trim() || topic.proposed_by_detail.username) : `Tài khoản #${topic.proposed_by}`;
            return <tr key={topic.id} className="group transition hover:bg-brand-50/40">
              <td className="px-5 py-4"><Link to={`/topics/${topic.id}`} className="font-semibold text-slate-900 transition group-hover:text-brand-800 hover:underline">{topic.title}</Link><p className="mt-1 max-w-md truncate text-xs text-slate-500">Đề xuất bởi {teacher}</p></td>
              <td className="px-4 py-4 text-slate-600"><span className="font-medium text-slate-700">{topic.department_name}</span><span className="mt-0.5 block text-xs">{topic.field_name || "Chưa phân loại"}</span></td>
              <td className="px-4 py-4 text-slate-600"><span>{topic.academic_year_name}</span><span className="mt-0.5 block text-xs">{topic.semester_name} · {topic.cohort_name}</span></td>
              <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span></td>
              <td className="px-5 py-4 text-right"><Link aria-label={`Xem chi tiết ${topic.title}`} to={`/topics/${topic.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900">Xem <ArrowRight className="h-3.5 w-3.5" /></Link></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </div>;
}
