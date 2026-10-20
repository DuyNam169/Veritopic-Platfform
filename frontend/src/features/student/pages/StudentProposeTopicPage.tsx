import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store";
import { catalogApi } from "@/features/academics/api";
import { studentApi } from "../api";
import { toast } from "@/shared/lib/toast";
import {
  CheckCircle,
  Clock,
  PlusCircle,
  XCircle,
  AlertTriangle,
  BookOpen,
} from "@/shared/components/icons";

export const StudentProposeTopicPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expectedTech, setExpectedTech] = useState("");
  const [teacherId, setTeacherId] = useState<number | "">("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [fieldId, setFieldId] = useState<number | "">("");
  const [cohortId, setCohortId] = useState<number | "">("");
  const [academicYearId, setAcademicYearId] = useState<number | "">("");
  const [semesterId, setSemesterId] = useState<number | "">("");

  // Catalogs
  const departmentsQuery = useQuery({ queryKey: ["catalog", "departments"], queryFn: () => catalogApi.list("departments") });
  const fieldsQuery = useQuery({ queryKey: ["catalog", "fields"], queryFn: () => catalogApi.list("fields") });
  const cohortsQuery = useQuery({ queryKey: ["catalog", "cohorts"], queryFn: () => catalogApi.list("cohorts") });
  const yearsQuery = useQuery({ queryKey: ["catalog", "academic-years"], queryFn: () => catalogApi.list("academic-years") });
  const semestersQuery = useQuery({
    queryKey: ["catalog", "semesters", academicYearId],
    queryFn: () => catalogApi.list("semesters", academicYearId ? String(academicYearId) : undefined),
    enabled: !!academicYearId,
  });

  const myAdvisorQuery = useQuery({
    queryKey: ["my-advisor", user?.id],
    queryFn: studentApi.getMyAdvisor,
  });

  const teachersQuery = useQuery({
    queryKey: ["teachers-propose"],
    queryFn: () => studentApi.getAvailableTeachers(),
  });

  const proposalsQuery = useQuery({
    queryKey: ["student-proposals", user?.id],
    queryFn: studentApi.getStudentProposals,
  });

  const topicStatusQuery = useQuery({
    queryKey: ["my-topic-status", user?.id],
    queryFn: studentApi.getMyTopicStatus,
  });

  // Pre-fill user cohort / advisor if available
  React.useEffect(() => {
    if (myAdvisorQuery.data?.advisor?.id && !teacherId) {
      setTeacherId(myAdvisorQuery.data.advisor.id);
    }
  }, [myAdvisorQuery.data, teacherId]);

  React.useEffect(() => {
    if (user?.cohort && !cohortId) {
      setCohortId(user.cohort);
    }
    if (user?.department && !departmentId) {
      setDepartmentId(user.department);
    }
  }, [user, cohortId, departmentId]);

  const proposeMutation = useMutation({
    mutationFn: studentApi.createStudentProposal,
    onSuccess: () => {
      toast.success("Đã gửi đề xuất đề tài lên Giảng viên hướng dẫn thành công!");
      setTitle("");
      setDescription("");
      setExpectedTech("");
      void queryClient.invalidateQueries({ queryKey: ["student-proposals"] });
      void queryClient.invalidateQueries({ queryKey: ["my-topic-status"] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Gửi đề xuất thất bại. Vui lòng kiểm tra lại.";
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !departmentId || !cohortId || !academicYearId || !semesterId) {
      toast.error("Vui lòng điền đầy đủ các thông tin bắt buộc (GVHD, Bộ môn, Khóa, Năm học, Học kỳ).");
      return;
    }
    if (!title.trim()) {
      toast.error("Vui lòng nhập tên đề tài.");
      return;
    }

    proposeMutation.mutate({
      teacher: Number(teacherId),
      title: title.trim(),
      description,
      expected_technologies: expectedTech,
      department: Number(departmentId),
      field: fieldId ? Number(fieldId) : null,
      cohort: Number(cohortId),
      academic_year: Number(academicYearId),
      semester: Number(semesterId),
    });
  };

  const hasActiveTopic = topicStatusQuery.data?.has_topic;
  const pendingProposal = proposalsQuery.data?.find((p) => p.status === "pending");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Title */}
      <div>
        <span className="text-[11px] font-black tracking-widest text-[#006A60] uppercase mb-1 block">
          ĐỀ TÀI ĐỒ ÁN
        </span>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Đề xuất Đề tài cho Giảng viên Hướng dẫn
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Nếu bạn có ý tưởng nghiên cứu riêng, hãy đề xuất đề tài lên Giảng viên hướng dẫn để được phê duyệt và đưa vào ngân hàng đề tài.
        </p>
      </div>

      {/* Constraints Warning */}
      {hasActiveTopic ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-950 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-xs sm:text-sm">
            <p className="font-bold">Bạn đã có đề tài đồ án tốt nghiệp chính thức</p>
            <p className="text-emerald-800">
              Mỗi sinh viên chỉ được làm 1 đề tài đồ án. Bạn không cần phải đề xuất thêm đề tài mới.
            </p>
          </div>
        </div>
      ) : pendingProposal ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-950 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs sm:text-sm">
            <p className="font-bold">Bạn đang có một đề xuất đề tài chờ xử lý: &ldquo;{pendingProposal.title}&rdquo;</p>
            <p className="text-amber-800">
              Đề tài đã được gửi tới GV <strong>{pendingProposal.teacher_name}</strong>. Vui lòng chờ phản hồi trước khi gửi đề tài khác.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Form Column */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-[#006A60]" /> Form Đề xuất Đề tài Mới
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên đề tài đồ án tốt nghiệp <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Xây dựng hệ thống quản lý học tập tích hợp AI..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={hasActiveTopic || !!pendingProposal}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-[#006A60] focus:outline-none disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Giảng viên nhận đề xuất <span className="text-rose-600">*</span>
                </label>
                <select
                  required
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value ? Number(e.target.value) : "")}
                  disabled={hasActiveTopic || !!pendingProposal}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-[#006A60] focus:outline-none disabled:bg-slate-100"
                >
                  <option value="">-- Chọn Giảng viên hướng dẫn --</option>
                  {teachersQuery.data?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.academic_degree ? `${t.academic_degree}. ` : ""}
                      {t.name} ({t.department_name || "Khoa CNTT"})
                    </option>
                  ))}
                </select>
                {myAdvisorQuery.data?.has_advisor && (
                  <p className="text-[11px] text-[#006A60] font-semibold mt-1">
                    ✓ Đã tự động chọn GVHD chính thức của bạn
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bộ môn <span className="text-rose-600">*</span>
                  </label>
                  <select
                    required
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : "")}
                    disabled={hasActiveTopic || !!pendingProposal}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-[#006A60] focus:outline-none disabled:bg-slate-100"
                  >
                    <option value="">-- Chọn bộ môn --</option>
                    {departmentsQuery.data?.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lĩnh vực nghiên cứu
                  </label>
                  <select
                    value={fieldId}
                    onChange={(e) => setFieldId(e.target.value ? Number(e.target.value) : "")}
                    disabled={hasActiveTopic || !!pendingProposal}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-[#006A60] focus:outline-none disabled:bg-slate-100"
                  >
                    <option value="">-- Chọn lĩnh vực --</option>
                    {fieldsQuery.data?.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Khóa học <span className="text-rose-600">*</span>
                  </label>
                  <select
                    required
                    value={cohortId}
                    onChange={(e) => setCohortId(e.target.value ? Number(e.target.value) : "")}
                    disabled={hasActiveTopic || !!pendingProposal}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-[#006A60] focus:outline-none disabled:bg-slate-100"
                  >
                    <option value="">-- Chọn khóa --</option>
                    {cohortsQuery.data?.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Năm học <span className="text-rose-600">*</span>
                  </label>
                  <select
                    required
                    value={academicYearId}
                    onChange={(e) => {
                      setAcademicYearId(e.target.value ? Number(e.target.value) : "");
                      setSemesterId("");
                    }}
                    disabled={hasActiveTopic || !!pendingProposal}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-[#006A60] focus:outline-none disabled:bg-slate-100"
                  >
                    <option value="">-- Năm học --</option>
                    {yearsQuery.data?.map((y) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Học kỳ <span className="text-rose-600">*</span>
                  </label>
                  <select
                    required
                    value={semesterId}
                    onChange={(e) => setSemesterId(e.target.value ? Number(e.target.value) : "")}
                    disabled={hasActiveTopic || !!pendingProposal || !academicYearId}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-[#006A60] focus:outline-none disabled:bg-slate-100"
                  >
                    <option value="">-- Học kỳ --</option>
                    {semestersQuery.data?.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Công nghệ & Kiến trúc dự kiến
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: React, Django REST, PostgreSQL, Docker, PhoBERT..."
                  value={expectedTech}
                  onChange={(e) => setExpectedTech(e.target.value)}
                  disabled={hasActiveTopic || !!pendingProposal}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-[#006A60] focus:outline-none disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mô tả mục tiêu & phạm vi đề tài
                </label>
                <textarea
                  rows={4}
                  placeholder="Nêu rõ bài toán cần giải quyết, đối tượng sử dụng, các chức năng chính dự kiến..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={hasActiveTopic || !!pendingProposal}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-800 focus:bg-white focus:border-[#006A60] focus:outline-none disabled:bg-slate-100"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={hasActiveTopic || !!pendingProposal || proposeMutation.isPending}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#006A60] text-white hover:bg-[#00524a] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition shadow-xs"
                >
                  {proposeMutation.isPending ? "Đang gửi đề xuất..." : "Gửi đề xuất cho Giảng viên"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* List of Previous Proposals */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#006A60]" /> Các Đề xuất của bạn ({proposalsQuery.data?.length ?? 0})
            </h2>

            {proposalsQuery.isLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs">Đang tải đề xuất...</div>
            ) : proposalsQuery.data?.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center italic">
                Bạn chưa gửi đề xuất đề tài nào.
              </p>
            ) : (
              <div className="space-y-3">
                {proposalsQuery.data?.map((prop) => (
                  <div
                    key={prop.id}
                    className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2 hover:bg-white transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-xs leading-snug">
                        {prop.title}
                      </h3>
                      {prop.status === "approved" ? (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3" /> GV đã duyệt
                        </span>
                      ) : prop.status === "revision_requested" ? (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <AlertTriangle className="w-3 h-3" /> Cần sửa
                        </span>
                      ) : prop.status === "rejected" ? (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3" /> Từ chối
                        </span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" /> Chờ GV xử lý
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500">
                      GV nhận: <strong>{prop.teacher_name}</strong> · Khóa: {prop.cohort_name}
                    </p>

                    {prop.expected_technologies && (
                      <p className="text-[11px] text-slate-600 bg-white p-1.5 rounded border border-slate-100">
                        CN: {prop.expected_technologies}
                      </p>
                    )}

                    {prop.teacher_note && (
                      <div className="p-2 rounded bg-amber-50 text-[11px] text-amber-900 border border-amber-200">
                        <strong>Phản hồi từ GV:</strong> {prop.teacher_note}
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400">
                      Gửi ngày: {new Date(prop.created_at).toLocaleString("vi-VN")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
