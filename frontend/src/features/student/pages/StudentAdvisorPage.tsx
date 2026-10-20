import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store";
import { catalogApi } from "@/features/academics/api";
import { studentApi } from "../api";
import type { TeacherItem } from "../types";
import { toast } from "@/shared/lib/toast";
import {
  CheckCircle,
  Clock,
  Filter,
  GraduationCap,
  Search,
  UserCheck,
  XCircle,
} from "@/shared/components/icons";

export const StudentAdvisorPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"teachers" | "history">("teachers");
  const [selectedDept, setSelectedDept] = useState<number | "">("");
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [targetTeacher, setTargetTeacher] = useState<TeacherItem | null>(null);
  const [message, setMessage] = useState("");

  const departmentsQuery = useQuery({
    queryKey: ["catalog", "departments"],
    queryFn: () => catalogApi.list("departments"),
  });

  const teachersQuery = useQuery({
    queryKey: ["teachers-list", selectedDept, searchTerm],
    queryFn: () =>
      studentApi.getAvailableTeachers({
        department_id: selectedDept ? Number(selectedDept) : undefined,
        search: searchTerm,
      }),
  });

  const myAdvisorQuery = useQuery({
    queryKey: ["my-advisor", user?.id],
    queryFn: studentApi.getMyAdvisor,
  });

  const requestsQuery = useQuery({
    queryKey: ["advisor-requests", user?.id],
    queryFn: studentApi.getAdvisorRequests,
  });

  const sendRequestMutation = useMutation({
    mutationFn: studentApi.createAdvisorRequest,
    onSuccess: () => {
      toast.success("Đã gửi yêu cầu tới giảng viên thành công! Vui lòng chờ phản hồi.");
      setTargetTeacher(null);
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["my-advisor"] });
      void queryClient.invalidateQueries({ queryKey: ["advisor-requests"] });
      setActiveTab("history");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Gửi yêu cầu thất bại. Vui lòng thử lại.";
      toast.error(msg);
    },
  });

  const hasAcceptedAdvisor = myAdvisorQuery.data?.has_advisor;
  const pendingRequest = requestsQuery.data?.find((r) => r.status === "pending");

  const handleOpenModal = (teacher: TeacherItem) => {
    if (hasAcceptedAdvisor) {
      toast.error("Bạn đã có Giảng viên hướng dẫn chính thức.");
      return;
    }
    if (pendingRequest) {
      toast.error("Bạn đang có một yêu cầu chờ phản hồi. Vui lòng chờ giảng viên xử lý.");
      return;
    }
    setTargetTeacher(teacher);
    setMessage("");
  };

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTeacher) return;
    sendRequestMutation.mutate({
      teacher_id: targetTeacher.id,
      message,
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Title */}
      <div>
        <span className="text-[11px] font-black tracking-widest text-[#006A60] uppercase mb-1 block">
          HƯỚNG DẪN ĐỒ ÁN
        </span>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Chọn Giảng viên Hướng dẫn
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Tìm kiếm giảng viên phù hợp với chuyên môn và gửi yêu cầu đăng ký hướng dẫn đồ án tốt nghiệp.
        </p>
      </div>

      {/* Current Status Banner */}
      {hasAcceptedAdvisor ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-xs sm:text-sm">
                Bạn đã có Giảng viên hướng dẫn:{" "}
                {myAdvisorQuery.data?.advisor?.academic_degree
                  ? `${myAdvisorQuery.data.advisor.academic_degree}. `
                  : ""}
                {myAdvisorQuery.data?.advisor?.first_name} {myAdvisorQuery.data?.advisor?.last_name}
              </p>
              <p className="text-xs text-emerald-700">
                Email: {myAdvisorQuery.data?.advisor?.email} · {myAdvisorQuery.data?.advisor?.department_name}
              </p>
            </div>
          </div>
        </div>
      ) : pendingRequest ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-xs sm:text-sm">
                Đang chờ phản hồi từ: {pendingRequest.teacher_name}
              </p>
              <p className="text-xs text-amber-700">
                Yêu cầu gửi lúc {new Date(pendingRequest.created_at).toLocaleString("vi-VN")}. Hệ thống sẽ thông báo ngay khi giảng viên xử lý.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("history")}
            className="text-xs font-semibold text-amber-900 underline ml-2"
          >
            Xem lịch sử
          </button>
        </div>
      ) : null}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("teachers")}
          className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition ${
            activeTab === "teachers"
              ? "border-[#006A60] text-[#006A60]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <GraduationCap className="w-4 h-4" /> Danh sách Giảng viên ({teachersQuery.data?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition ${
            activeTab === "history"
              ? "border-[#006A60] text-[#006A60]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="w-4 h-4" /> Lịch sử gửi yêu cầu ({requestsQuery.data?.length ?? 0})
        </button>
      </div>

      {activeTab === "teachers" ? (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm giảng viên theo tên, học vị, hướng nghiên cứu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-4 py-2 text-xs text-slate-800 focus:bg-white focus:border-[#006A60] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value ? Number(e.target.value) : "")}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-[#006A60] focus:outline-none"
              >
                <option value="">Tất cả bộ môn</option>
                {departmentsQuery.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Teachers Grid */}
          {teachersQuery.isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Đang tải danh sách giảng viên...</div>
          ) : teachersQuery.data?.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
              Không tìm thấy giảng viên phù hợp với tiêu chí tìm kiếm.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {teachersQuery.data?.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between hover:border-[#006A60]/40 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {t.academic_degree ? `${t.academic_degree}. ` : ""}
                          {t.name}
                        </h3>
                        <p className="text-[11px] text-[#006A60] font-semibold mt-0.5">
                          {t.department_name || "Khoa CNTT"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {t.active_student_count} SV hướng dẫn
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500">Email: {t.email}</p>

                    {t.specialization ? (
                      <div className="mt-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <strong className="text-slate-700">Hướng nghiên cứu:</strong>
                        <p className="mt-0.5 line-clamp-3">{t.specialization}</p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">Chưa cập nhật hướng nghiên cứu.</p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => handleOpenModal(t)}
                      disabled={hasAcceptedAdvisor || !!pendingRequest}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#006A60] text-white hover:bg-[#00524a] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition shadow-xs"
                    >
                      {hasAcceptedAdvisor
                        ? "Đã có GVHD"
                        : pendingRequest
                        ? "Đang chờ duyệt"
                        : "Chọn hướng dẫn"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* History Tab */
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {requestsQuery.isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Đang tải lịch sử...</div>
          ) : requestsQuery.data?.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              Bạn chưa gửi yêu cầu chọn Giảng viên hướng dẫn nào.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3.5">GIẢNG VIÊN</th>
                    <th className="px-6 py-3.5">LỜI NHẮN CỦA BẠN</th>
                    <th className="px-6 py-3.5">NGÀY GỬI</th>
                    <th className="px-6 py-3.5">TRẠNG THÁI</th>
                    <th className="px-6 py-3.5">PHẢN HỒI TỪ GV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requestsQuery.data?.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{req.teacher_name}</div>
                        <div className="text-[11px] text-slate-400">{req.teacher_email}</div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="line-clamp-2 text-slate-600">{req.message || "Không có lời nhắn"}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                        {new Date(req.created_at).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {req.status === "accepted" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5" /> Đã đồng ý
                          </span>
                        ) : req.status === "rejected" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5" /> Từ chối
                          </span>
                        ) : req.status === "cancelled" ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">
                            Đã hủy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5" /> Chờ phản hồi
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="text-slate-600 italic">
                          {req.response_note || (req.status === "pending" ? "Đang chờ giảng viên xem xét..." : "Không có ghi chú")}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Gửi yêu cầu hướng dẫn */}
      {targetTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSendRequest}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-scale-in"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-50 text-[#006A60] rounded-xl">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Gửi yêu cầu hướng dẫn đồ án</h3>
                <p className="text-xs text-slate-500">
                  Tới: {targetTeacher.academic_degree ? `${targetTeacher.academic_degree}. ` : ""}
                  {targetTeacher.name}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p>
                <strong>Sinh viên gửi:</strong> {user?.first_name} {user?.last_name} ({user?.student_code || user?.username})
              </p>
              <p className="mt-0.5">
                <strong>Khóa học:</strong> {user?.cohort_name || "N/A"} · <strong>Lớp:</strong> {user?.class_name || "N/A"}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lời nhắn & Nguyện vọng nghiên cứu (tùy chọn)
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Giới thiệu ngắn gọn về bản thân, thế mạnh công nghệ và định hướng đề tài bạn muốn được hướng dẫn..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 focus:bg-white focus:border-[#006A60] focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTargetTeacher(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={sendRequestMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#006A60] text-white hover:bg-[#00524a] transition shadow-xs disabled:opacity-50"
              >
                {sendRequestMutation.isPending ? "Đang gửi..." : "Gửi yêu cầu"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
