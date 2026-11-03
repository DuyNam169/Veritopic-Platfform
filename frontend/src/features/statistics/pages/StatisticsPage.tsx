import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { catalogApi } from "@/features/academics/api";
import { usersApi } from "@/features/accounts/api";
import { studentApi } from "@/features/student/api";
import { useAuthStore } from "@/features/auth/store";
import {
  Filter,
  Search,
  BookOpen,
  GraduationCap,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
} from "@/shared/components/icons";
import { Button, ErrorState, PageHeader, PageSkeleton, Panel, fieldClass } from "@/shared/components/ui";
import { toast } from "@/shared/lib/toast";
import { statisticsApi, type StatisticsFilters, type SupervisedStudentItem } from "../api";
import { useStatisticsOverview } from "../hooks";
import { StatisticsSummary } from "../components/StatisticsSummary";

const statusLabels: Record<string, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
  rename_requested: "Yêu cầu sửa tên",
};
const statusColors: Record<string, string> = {
  pending: "#f59e0b",
  approved: "#10b981",
  rejected: "#f43f5e",
  rename_requested: "#3b82f6",
};

const studentStatusColors: Record<string, string> = {
  active: "#006A60",
  completed: "#2563eb",
  unassigned: "#f59e0b",
};

interface ChartRow { label: string; count: number; }

export default function StatisticsPage() {
  const [filters, setFilters] = useState<StatisticsFilters>({});
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const overview = useStatisticsOverview(filters);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";

  const [activeTab, setActiveTab] = useState<"students" | "topics">(isTeacher ? "students" : "topics");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentFilter, setStudentFilter] = useState<"all" | "active" | "completed" | "unassigned" | "late" | "pending_feedback">("all");

  const years = useQuery({ queryKey: ["catalog", "academic-years"], queryFn: () => catalogApi.list("academic-years") });
  const cohorts = useQuery({ queryKey: ["catalog", "cohorts"], queryFn: () => catalogApi.list("cohorts") });
  const departments = useQuery({ queryKey: ["catalog", "departments"], queryFn: () => catalogApi.list("departments") });
  const fields = useQuery({ queryKey: ["catalog", "fields"], queryFn: () => catalogApi.list("fields") });
  const users = useQuery({ queryKey: ["managed-users"], queryFn: usersApi.list, enabled: isAdmin });
  const availableTeachers = useQuery({ queryKey: ["available-teachers"], queryFn: () => studentApi.getAvailableTeachers(), enabled: !isTeacher });
  const teachers = useMemo(() => {
    if (isAdmin && users.data) {
      return users.data
        .filter((u) => u.role === "teacher" || u.role === "department_head")
        .map((u) => ({ id: u.id, label: `${u.first_name} ${u.last_name}`.trim() || u.username }));
    }
    return (availableTeachers.data ?? []).map((t) => ({ id: t.id, label: t.name || t.username }));
  }, [isAdmin, users.data, availableTeachers.data]);

  const data = overview.data;
  const so = data?.students_overview;

  const academicYears = data?.by_academic_year.map((row) => ({ label: row.academic_year__name, count: row.count })) ?? [];
  const cohortRows = data?.by_cohort.map((row) => ({ label: row.cohort__name, count: row.count })) ?? [];
  const teacherRows = data?.by_teacher.map((row) => ({
    label: `${`${row.proposed_by__first_name} ${row.proposed_by__last_name}`.trim() || row.proposed_by__username} (${row.proposed_by__username})`,
    count: row.count,
  })) ?? [];
  const fieldRows = data?.by_field.map((row) => ({ label: row.field__name || "Chưa phân loại", count: row.count })) ?? [];
  const statusRows = Object.keys(statusLabels).map((status) => ({
    status,
    label: statusLabels[status],
    count: data?.by_status.find((row) => row.status === status)?.count ?? 0,
  }));

  const studentStatusRows = (so?.by_status ?? []).map((row) => ({
    status: row.status,
    label: row.label,
    count: row.count,
  }));

  // Lọc danh sách sinh viên hướng dẫn
  const filteredStudents = useMemo(() => {
    if (!so?.students_list) return [];
    return so.students_list.filter((s) => {
      if (studentFilter === "active" && s.assignment_status !== "active") return false;
      if (studentFilter === "completed" && s.assignment_status !== "completed") return false;
      if (studentFilter === "unassigned" && s.has_topic) return false;
      if (studentFilter === "late" && !s.is_late) return false;
      if (studentFilter === "pending_feedback" && !s.has_pending_feedback) return false;

      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase();
        const matchName = s.student_name.toLowerCase().includes(q);
        const matchCode = s.student_code.toLowerCase().includes(q);
        const matchTopic = (s.topic_title || "").toLowerCase().includes(q);
        const matchClass = s.class_name.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchTopic && !matchClass) return false;
      }
      return true;
    });
  }, [so?.students_list, studentFilter, studentSearch]);

  function setNumericFilter(key: keyof StatisticsFilters, value: string) {
    setFilters((current) => {
      const next = { ...current };
      if (value) next[key] = Number(value) as never;
      else delete next[key];
      return next;
    });
  }

  async function download(format: "excel" | "pdf") {
    setExporting(format);
    try {
      await statisticsApi.download(format, filters);
      toast.success(`Đã xuất báo cáo ${format.toUpperCase()} thành công.`);
    } catch {
      toast.error("Không thể xuất báo cáo. Vui lòng thử lại.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow={isTeacher ? "Báo cáo & Thống kê Giảng viên" : "Phân tích ngân hàng đề tài"}
        title={isTeacher ? "Thống kê Đề tài & Sinh viên hướng dẫn" : "Thống kê & báo cáo"}
        description={
          isTeacher
            ? "Tổng hợp toàn diện dữ liệu về ngân hàng đề tài đề xuất, danh sách sinh viên hướng dẫn và theo dõi tiến độ đồ án."
            : "Theo dõi tình hình phê duyệt, phân bố lĩnh vực và hoạt động đề xuất trong cùng một phạm vi dữ liệu."
        }
        actions={
          <>
            <Button busy={overview.isFetching} onClick={() => void overview.refetch()}>
              Cập nhật
            </Button>
            <Button
              busy={exporting === "excel"}
              disabled={!!exporting || overview.isLoading || overview.isError}
              onClick={() => void download("excel")}
            >
              Xuất Excel
            </Button>
            <Button
              variant="primary"
              busy={exporting === "pdf"}
              disabled={!!exporting || overview.isLoading || overview.isError}
              onClick={() => void download("pdf")}
            >
              Xuất PDF
            </Button>
          </>
        }
      />

      {/* KPI Cards Summary */}
      {overview.isLoading ? (
        <PageSkeleton cards={2} />
      ) : overview.isError ? (
        <ErrorState message="Không tải được số liệu thống kê." retry={() => void overview.refetch()} />
      ) : (
        data && <StatisticsSummary data={data} />
      )}

      {/* Filter Panel */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50">
              <Filter className="h-4 w-4 text-brand-700" />
            </span>
            <h2 className="font-semibold text-slate-900">Phạm vi báo cáo</h2>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
              {Object.keys(filters).length
                ? `${Object.keys(filters).length} bộ lọc`
                : isTeacher
                ? "Đề tài & SV của tôi"
                : "Toàn hệ thống"}
            </span>
          </div>
          {Object.keys(filters).length > 0 && (
            <button onClick={() => setFilters({})} className="text-sm font-semibold text-brand-700 hover:underline">
              Đặt lại bộ lọc
            </button>
          )}
        </div>
        <div className={`mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${isTeacher ? "xl:grid-cols-5" : "xl:grid-cols-6"}`}>
          <FilterSelect label="Năm học" value={filters.academic_year} onChange={(value) => setNumericFilter("academic_year", value)} options={(years.data ?? []).map((item) => ({ value: item.id, label: item.name }))} />
          <FilterSelect label="Khóa học" value={filters.cohort} onChange={(value) => setNumericFilter("cohort", value)} options={(cohorts.data ?? []).map((item) => ({ value: item.id, label: item.name }))} />
          <FilterSelect label="Bộ môn" value={filters.department} onChange={(value) => setNumericFilter("department", value)} options={(departments.data ?? []).map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }))} />
          {!isTeacher && <FilterSelect label="Giảng viên" value={filters.proposed_by} onChange={(value) => setNumericFilter("proposed_by", value)} options={teachers.map((item) => ({ value: item.id, label: item.label }))} />}
          <FilterSelect label="Lĩnh vực" value={filters.field} onChange={(value) => setNumericFilter("field", value)} options={(fields.data ?? []).map((item) => ({ value: item.id, label: item.name }))} />
          <label className="text-sm font-medium text-slate-700">Trạng thái đề tài<select value={filters.status ?? ""} onChange={(event) => setFilters((current) => { const next = { ...current }; if (event.target.value) next.status = event.target.value; else delete next.status; return next; })} className={fieldClass}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          {isTeacher
            ? "Các chỉ số, biểu đồ, danh sách sinh viên và tệp báo cáo được tính toán trực tiếp trên phạm vi công tác của bạn."
            : "Các chỉ số, biểu đồ và tệp báo cáo đều áp dụng bộ lọc đang chọn."}
        </p>
      </Panel>

      {/* Tab Switcher if students overview exists */}
      {so && (
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab("students")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === "students"
                ? "border-[#006A60] text-[#006A60] bg-white rounded-t-xl shadow-xs"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            <span>Sinh viên hướng dẫn & Tiến độ</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${activeTab === "students" ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-600"}`}>
              {so.total_students}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("topics")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === "topics"
                ? "border-[#006A60] text-[#006A60] bg-white rounded-t-xl shadow-xs"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Ngân hàng đề tài khoa học</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${activeTab === "topics" ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-600"}`}>
              {data?.total ?? 0}
            </span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {overview.isLoading ? null : overview.isError ? null : (
        <>
          {/* TAB 1: SINH VIÊN HƯỚNG DẪN & TIẾN ĐỘ */}
          {activeTab === "students" && so && (
            <div className="space-y-6">
              {/* Charts for Students */}
              <section className="grid gap-6 lg:grid-cols-3">
                <ChartCard
                  title="Tình trạng nhận đề tài & đồ án"
                  description="Phân bổ sinh viên theo trạng thái giao đề tài và bảo vệ"
                >
                  <StatusChart rows={studentStatusRows} total={so.total_students} colors={studentStatusColors} unit="sinh viên" />
                </ChartCard>

                <ChartCard
                  title="Phân bố tiến độ đồ án"
                  description="Mức độ hoàn thành các mốc báo cáo định kỳ"
                >
                  <BarChart rows={so.by_progress} total={so.assigned_topic_count || 1} />
                </ChartCard>

                <ChartCard
                  title="Sinh viên theo khóa học"
                  description="Số lượng sinh viên hướng dẫn phân bổ theo khóa"
                >
                  <BarChart rows={so.by_cohort} total={so.total_students || 1} preserveOrder />
                </ChartCard>
              </section>

              {/* Supervised Students Interactive Table */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Users className="h-5 w-5 text-[#006A60]" />
                      <span>Danh sách sinh viên hướng dẫn & Chi tiết tiến độ</span>
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Theo dõi chi tiết tên đề tài, mức độ hoàn thành báo cáo và cảnh báo tiến độ từng sinh viên.
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {[
                      { key: "all", label: `Tất cả (${so.total_students})` },
                      { key: "active", label: `Đang làm (${so.active_students_count})` },
                      { key: "completed", label: `Đã xong (${so.completed_students_count})` },
                      { key: "unassigned", label: `Chờ đề tài (${so.unassigned_topic_count})` },
                      { key: "pending_feedback", label: `Chờ nhận xét (${so.pending_feedback_count})` },
                      { key: "late", label: `Trễ hạn (${so.late_students_count})` },
                    ].map((pill) => (
                      <button
                        key={pill.key}
                        onClick={() => setStudentFilter(pill.key as any)}
                        className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                          studentFilter === pill.key
                            ? "bg-[#006A60] text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Tìm kiếm sinh viên theo tên, MSSV, lớp, tên đề tài..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#006A60] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#006A60]"
                  />
                  {studentSearch && (
                    <button
                      onClick={() => setStudentSearch("")}
                      className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-medium"
                    >
                      Xóa
                    </button>
                  )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                      <tr>
                        <th className="p-3.5">Sinh viên</th>
                        <th className="p-3.5">Khóa & Bộ môn</th>
                        <th className="p-3.5">Đề tài đồ án</th>
                        <th className="p-3.5 text-center">Tiến độ (%)</th>
                        <th className="p-3.5 text-center">Tình trạng nộp bài</th>
                        <th className="p-3.5 text-center">Trạng thái</th>
                        <th className="p-3.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredStudents.map((s) => (
                        <tr key={s.student_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
                                {s.student_name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">{s.student_name}</p>
                                <p className="text-xs text-slate-500">
                                  {s.student_code || "Chưa có MSSV"} · {s.class_name || "Lớp N/A"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-xs text-slate-600">
                            <span className="font-semibold text-slate-800">{s.cohort_name}</span>
                            <span className="block text-slate-400">{s.department_name}</span>
                          </td>
                          <td className="p-3.5 max-w-xs">
                            {s.has_topic ? (
                              <p className="font-medium text-slate-800 line-clamp-2" title={s.topic_title || ""}>
                                {s.topic_title}
                              </p>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                                <Clock className="h-3 w-3" />
                                Chưa giao đề tài
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className="font-bold text-slate-900 text-xs tabular-nums">
                                {s.latest_percent}%
                              </span>
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    s.latest_percent >= 80
                                      ? "bg-emerald-500"
                                      : s.latest_percent >= 40
                                      ? "bg-[#006A60]"
                                      : "bg-amber-500"
                                  }`}
                                  style={{ width: `${s.latest_percent}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-center">
                            {s.is_late ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
                                <AlertTriangle className="h-3 w-3" />
                                Trễ hạn nộp
                              </span>
                            ) : s.has_pending_feedback ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                                <Clock className="h-3 w-3" />
                                Chờ GV nhận xét
                              </span>
                            ) : s.reports_count > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3" />
                                Đúng tiến độ
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Chưa nộp bài</span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`inline-block rounded-md px-2.5 py-1 text-xs font-medium ${
                                s.assignment_status === "completed"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : s.assignment_status === "active"
                                  ? "bg-teal-50 text-teal-800 border border-teal-200"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {s.assignment_status_display}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            {s.assignment_id ? (
                              <Link
                                to={`/projects/${s.assignment_id}`}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#006A60] hover:bg-[#006A60]/10 transition-colors"
                              >
                                <span>Tiến độ</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            ) : (
                              <Link
                                to="/teacher/students"
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
                              >
                                <span>Giao đề tài</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!filteredStudents.length && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                            {studentSearch
                              ? "Không tìm thấy sinh viên phù hợp với từ khóa."
                              : "Chưa có sinh viên nào trong danh mục đã chọn."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NGÂN HÀNG ĐỀ TÀI KHOA HỌC */}
          {(activeTab === "topics" || !so) && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  {data?.total === 0 ? "Không có đề tài phù hợp. Hãy thử điều chỉnh bộ lọc." : "Phân bố đề tài trong phạm vi đã chọn"}
                </span>
                <span>
                  Cập nhật lúc {new Date(overview.dataUpdatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <section className="grid gap-6 lg:grid-cols-2">
                <ChartCard title="Tình hình phê duyệt đề tài" description="Tỷ trọng đề tài theo trạng thái xử lý hội đồng">
                  <StatusChart rows={statusRows} total={data?.total ?? 0} colors={statusColors} unit="đề tài" />
                </ChartCard>
                <ChartCard title="Phân bố lĩnh vực nghiên cứu" description="Số đề tài theo từng chuyên ngành, lĩnh vực">
                  <BarChart rows={fieldRows} total={data?.total ?? 0} />
                </ChartCard>
                <ChartCard title="Quy mô theo năm học" description="Số lượng đề tài được đăng ký qua các năm học">
                  <BarChart rows={academicYears} total={data?.total ?? 0} preserveOrder />
                </ChartCard>
                <ChartCard title="Quy mô theo khóa học" description="Số đề tài phục vụ từng khóa đào tạo">
                  <BarChart rows={cohortRows} total={data?.total ?? 0} preserveOrder />
                </ChartCard>
                {!isTeacher && (
                  <ChartCard
                    title="Hoạt động đề xuất của giảng viên"
                    description="Số đề tài đã đề xuất, bao gồm tất cả trạng thái trong phạm vi đang xem"
                    wide
                  >
                    <div className="max-h-96 overflow-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                          <tr>
                            <th className="rounded-l-lg p-3 font-medium">Giảng viên</th>
                            <th className="p-3 text-right font-medium">Số đề tài</th>
                            <th className="rounded-r-lg p-3 text-right font-medium">Tỷ trọng</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {[...teacherRows]
                            .sort((a, b) => b.count - a.count)
                            .map((row) => (
                              <tr key={row.label} className="hover:bg-brand-50/40">
                                <td className="p-3 font-medium text-slate-700">{row.label}</td>
                                <td className="p-3 text-right font-semibold tabular-nums text-slate-950">{row.count}</td>
                                <td className="p-3 text-right tabular-nums text-slate-500">
                                  {data?.total ? ((row.count / data.total) * 100).toFixed(1) : "0.0"}%
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {!teacherRows.length && (
                        <p className="py-10 text-center text-sm text-slate-400">Chưa có dữ liệu trong phạm vi đã chọn.</p>
                      )}
                    </div>
                  </ChartCard>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value?: number;
  onChange: (value: string) => void;
  options: Array<{ value: number; label: string }>;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={fieldClass}>
        <option value="">Tất cả {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChartCard({
  title,
  description,
  wide = false,
  children,
}: {
  title: string;
  description: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <article className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ${wide ? "lg:col-span-2" : ""}`}>
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      <div className="mt-6">{children}</div>
    </article>
  );
}

function BarChart({
  rows,
  total,
  preserveOrder = false,
}: {
  rows: ChartRow[];
  total: number;
  preserveOrder?: boolean;
}) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  if (!rows.length) return <p className="py-12 text-center text-sm text-slate-400">Chưa có dữ liệu</p>;
  const ordered = preserveOrder ? rows : [...rows].sort((a, b) => b.count - a.count);
  return (
    <div className="max-h-80 space-y-4 overflow-auto pr-1">
      {ordered.map((row) => (
        <div key={row.label}>
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <span className="font-medium leading-5 text-slate-700">{row.label}</span>
            <span className="shrink-0 tabular-nums">
              <strong className="text-slate-950">{row.count}</strong>
              <span className="ml-2 text-slate-400">{total ? ((row.count / total) * 100).toFixed(1) : "0.0"}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#006A60] transition-all duration-500"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusChart({
  rows,
  total,
  colors = statusColors,
  unit = "đề tài",
}: {
  rows: Array<ChartRow & { status: string }>;
  total: number;
  colors?: Record<string, string>;
  unit?: string;
}) {
  let offset = 0;
  const segments = rows.map((row) => {
    const start = total ? (offset / total) * 100 : 0;
    offset += row.count;
    const end = total ? (offset / total) * 100 : 0;
    const color = colors[row.status] || "#94a3b8";
    return `${color} ${start}% ${end}%`;
  });
  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row">
      <div
        role="img"
        aria-label={`Phân bố trạng thái của ${total} ${unit}`}
        className="relative h-44 w-44 shrink-0 rounded-full"
        style={{ background: total ? `conic-gradient(${segments.join(", ")})` : "#e2e8f0" }}
      >
        <div className="absolute inset-7 grid place-items-center rounded-full bg-white text-center">
          <div>
            <strong className="text-3xl font-bold tabular-nums text-slate-950">{total}</strong>
            <span className="mt-1 block text-xs text-slate-500">{unit}</span>
          </div>
        </div>
      </div>
      <div className="w-full flex-1 space-y-4">
        {rows.map((row) => {
          const color = colors[row.status] || "#94a3b8";
          return (
            <div key={row.status} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="flex-1 text-slate-600">{row.label}</span>
              <strong className="tabular-nums text-slate-950">{row.count}</strong>
              <span className="w-12 text-right text-xs tabular-nums text-slate-400">
                {total ? ((row.count / total) * 100).toFixed(0) : 0}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
