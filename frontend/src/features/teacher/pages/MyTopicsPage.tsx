import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { teacherApi } from "../api";
import { academicsApi } from "@/features/academics/api";
import { api } from "@/shared/lib/axios";
import { AssignTopicModal } from "../components/AssignTopicModal";
import { TopicDetailModal } from "../components/TopicDetailModal";
import type { Topic } from "../types";

export const MyTopicsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"mine" | "bank">("mine");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [search, setSearch] = useState("");

  // Options state from master data
  const [departments, setDepartments] = useState<{ id: number; name: string; code: string }[]>([]);
  const [fields, setFields] = useState<{ id: number; name: string }[]>([]);
  const [cohorts, setCohorts] = useState<{ id: number; name: string }[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: number; name: string }[]>([]);
  const [semesters, setSemesters] = useState<{ id: number; name: string }[]>([]);

  // Selected Filter states
  const [yearFilter, setYearFilter] = useState("");
  const [cohortFilter, setCohortFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [fieldFilter, setFieldFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [selectedTopicForAssign, setSelectedTopicForAssign] = useState<Topic | null>(null);
  const [selectedTopicForDetail, setSelectedTopicForDetail] = useState<Topic | null>(null);

  useEffect(() => {
    const toArray = (res: unknown) => (Array.isArray(res) ? res : (res as { results?: unknown[] })?.results ?? []);
    academicsApi.departments().then((res) => setDepartments(toArray(res))).catch(() => {});
    academicsApi.fields().then((res) => setFields(toArray(res))).catch(() => {});
    academicsApi.cohorts().then((res) => setCohorts(toArray(res))).catch(() => {});
    academicsApi.academicYears().then((res) => setAcademicYears(toArray(res))).catch(() => {});
    api.get("/academics/semesters/").then((r) => setSemesters(toArray(r.data))).catch(() => {});
  }, []);

  const fetchTopics = () => {
    setIsLoading(true);
    const params = {
      search: search || undefined,
      academic_year: yearFilter ? Number(yearFilter) : undefined,
      cohort: cohortFilter ? Number(cohortFilter) : undefined,
      department: departmentFilter ? Number(departmentFilter) : undefined,
      field: fieldFilter ? Number(fieldFilter) : undefined,
      semester: semesterFilter ? Number(semesterFilter) : undefined,
      status: statusFilter || undefined,
    };

    const apiCall = activeTab === "mine" ? teacherApi.getMyTopics(params) : teacherApi.getAllTopics(params);

    apiCall
      .then((res) => {
        setTopics(res.results || res || []);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchTopics();
  }, [activeTab, yearFilter, cohortFilter, departmentFilter, fieldFilter, semesterFilter, statusFilter]);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200/60">
            Chờ duyệt
          </span>
        );
      case "approved":
        return (
          <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
            Đã duyệt
          </span>
        );
      case "rename_requested":
        return (
          <span className="inline-block rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 border border-sky-200/60">
            Yêu cầu sửa tên
          </span>
        );
      case "rejected":
        return (
          <span className="inline-block rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 border border-rose-200/60">
            Từ chối
          </span>
        );
      default:
        return (
          <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-black tracking-widest text-[#006A60] uppercase mb-1">
            KHO DỮ LIỆU HỌC THUẬT
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Danh mục đề tài</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Tìm kiếm và tra cứu đề tài theo nhiều tiêu chí trong toàn hệ thống.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50">
            Xuất Excel
          </button>
          <button className="rounded-full bg-[#006A60] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#00524a]">
            Xuất PDF
          </button>
          <Link
            to="/teacher/propose"
            className="rounded-full bg-[#006A60] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#00524a] inline-flex items-center gap-1"
          >
            <span>+ Đề xuất đề tài</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("mine")}
          className={`pb-3 text-xs font-bold transition-all relative ${
            activeTab === "mine" ? "text-[#006A60]" : "text-slate-400 hover:text-slate-700"
          }`}
        >
          Đề tài của tôi
          {activeTab === "mine" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#006A60] rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("bank")}
          className={`pb-3 text-xs font-bold transition-all relative ${
            activeTab === "bank" ? "text-[#006A60]" : "text-slate-400 hover:text-slate-700"
          }`}
        >
          Ngân hàng Đề tài (Chỉ đọc)
          {activeTab === "bank" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#006A60] rounded-full" />
          )}
        </button>
      </div>

      {/* Filter Box */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <svg className="w-4 h-4 text-[#006A60]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span>Bộ lọc danh sách</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Từ khóa</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Tên hoặc nội dung mô tả..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchTopics()}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none transition-colors"
              />
              <svg className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Năm học</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
            >
              <option value="">Tất cả năm học</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Khóa học</label>
            <select
              value={cohortFilter}
              onChange={(e) => setCohortFilter(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
            >
              <option value="">Tất cả khóa học</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>Khóa {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Bộ môn</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
            >
              <option value="">Tất cả bộ môn</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Lĩnh vực</label>
            <select
              value={fieldFilter}
              onChange={(e) => setFieldFilter(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
            >
              <option value="">Tất cả lĩnh vực</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Học kỳ</label>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
            >
              <option value="">Tất cả học kỳ</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Trạng thái</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rename_requested">Yêu cầu sửa tên</option>
              <option value="rejected">Từ chối</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchTopics}
              className="w-full rounded-full bg-[#006A60] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#00524a] transition-colors"
            >
              Lọc kết quả
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Đang tải danh sách đề tài...</div>
        ) : topics.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <p className="text-sm font-semibold">Không tìm thấy kết quả phù hợp.</p>
            <p className="text-xs text-slate-400">Thử thay đổi từ khóa hoặc bộ lọc của bạn.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/70 text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">ĐỀ TÀI</th>
                  <th className="px-6 py-4">BỘ MÔN</th>
                  <th className="px-6 py-4">THỜI GIAN</th>
                  <th className="px-6 py-4">TRẠNG THÁI</th>
                  <th className="px-6 py-4 text-right">CHI TIẾT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topics.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 max-w-md">
                      <div className="font-bold text-slate-800 text-xs leading-snug">{t.title}</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Đề xuất bởi: <span className="text-slate-500">{t.teacher_name || "Giảng viên"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-700">{t.department_name || "Bộ môn Cơ điện tử"}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{t.field_name || "Giao thông thông minh"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-700">{t.academic_year_name || "2026-2027"}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{t.semester_name || "Học kỳ 1"}</div>
                    </td>
                    <td className="px-6 py-4">
                      {renderStatusBadge(t.status)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedTopicForDetail(t)}
                        className="text-xs font-bold text-[#006A60] hover:underline inline-flex items-center gap-1"
                      >
                        <span>Xem</span>
                        <span>&rarr;</span>
                      </button>

                      {activeTab === "mine" && t.status === "approved" && (
                        <button
                          onClick={() => setSelectedTopicForAssign(t)}
                          className="ml-2 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                        >
                          Giao Đề Tài
                        </button>
                      )}

                      {activeTab === "mine" && t.status === "rename_requested" && (
                        <Link
                          to={`/teacher/topics/${t.id}/edit`}
                          className="ml-2 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                        >
                          Sửa tên
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTopicForAssign && (
        <AssignTopicModal
          topic={selectedTopicForAssign}
          onClose={() => setSelectedTopicForAssign(null)}
          onSuccess={() => {
            setSelectedTopicForAssign(null);
            fetchTopics();
            alert("Đã giao đề tài thành công!");
          }}
        />
      )}

      {selectedTopicForDetail && (
        <TopicDetailModal
          topic={selectedTopicForDetail}
          onClose={() => setSelectedTopicForDetail(null)}
        />
      )}
    </div>
  );
};

