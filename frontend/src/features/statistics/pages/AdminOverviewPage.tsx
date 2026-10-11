import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { topicsApi } from "@/features/topics/api";
import { ArrowRight, BarChart3, CheckSquare, Layers, Search } from "@/shared/components/icons";
import { ErrorState, PageHeader, PageSkeleton, Panel } from "@/shared/components/ui";
import { useStatisticsOverview } from "../hooks";
import { StatisticsSummary } from "../components/StatisticsSummary";

export default function AdminOverviewPage() {
  const overview = useStatisticsOverview();
  const pending = useQuery({ queryKey: ["admin-overview", "pending"], queryFn: () => topicsApi.list({ status: "pending" }) });
  const shortcuts = [
    { to: "/approval", title: "Duyệt đề tài", description: "Xem xét các đề xuất đang chờ xử lý", icon: CheckSquare },
    { to: "/topics/similarity", title: "Kiểm tra tương đồng", description: "Đối chiếu tên và nội dung đề tài", icon: Search },
    { to: "/academics", title: "Danh mục hệ thống", description: "Quản lý lĩnh vực và dữ liệu đào tạo", icon: Layers },
    { to: "/statistics", title: "Thống kê & báo cáo", description: "Phân tích dữ liệu và xuất báo cáo", icon: BarChart3 },
  ];
  return <div className="mx-auto max-w-7xl space-y-6">
    <PageHeader eyebrow="Không gian quản trị" title="Tổng quan đề tài" description="Nắm bắt tình hình ngân hàng đề tài và những công việc cần xử lý." actions={<Link to="/topics" className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">Xem ngân hàng đề tài<ArrowRight className="h-4 w-4" /></Link>} />
    {overview.isLoading ? <PageSkeleton cards={4} /> : overview.isError ? <ErrorState message="Không tải được số liệu tổng quan." retry={() => void overview.refetch()} /> : overview.data && <StatisticsSummary data={overview.data} />}
    <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <Panel><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-950">Đề tài cần phê duyệt</h2><p className="mt-1 text-sm text-slate-500">Các đề xuất mới nhất đang chờ xem xét</p></div><Link to="/approval" className="text-sm font-semibold text-brand-700 hover:underline">Xem tất cả →</Link></div>
        {pending.isLoading ? <div className="mt-5"><PageSkeleton cards={1} /></div> : pending.isError ? <div className="mt-5"><ErrorState message="Không tải được đề tài chờ duyệt." retry={() => void pending.refetch()} /></div> : pending.data?.results.length ? <div className="mt-4 divide-y divide-slate-100">{pending.data.results.slice(0, 5).map((topic) => <Link key={topic.id} to={`/topics/${topic.id}`} className="group flex items-center gap-4 py-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><CheckSquare className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-6 text-slate-800 group-hover:text-brand-700">{topic.title}</p><p className="mt-1 text-xs text-slate-500">{topic.department_name} · {new Date(topic.created_at).toLocaleDateString("vi-VN")}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-brand-700" /></Link>)}</div> : <p className="mt-5 rounded-xl bg-emerald-50 p-5 text-sm text-emerald-800">Không có đề tài đang chờ duyệt.</p>}
      </Panel>
      <Panel><h2 className="font-semibold text-slate-950">Truy cập nhanh</h2><p className="mt-1 text-sm text-slate-500">Các tác vụ quản trị thường dùng</p><div className="mt-4 space-y-2">{shortcuts.map(({ to, title, description, icon: Icon }) => <Link key={to} to={to} className="group flex items-center gap-3 rounded-xl border border-slate-100 p-4 transition hover:border-brand-200 hover:bg-brand-50"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span><div className="flex-1"><p className="text-sm font-semibold text-slate-800">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div><ArrowRight className="h-4 w-4 text-slate-400" /></Link>)}</div></Panel>
    </div>
  </div>;
}
