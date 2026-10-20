import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store";
import { studentApi } from "../api";
import {
  BookOpen,
  CheckCircle,
  Clock,
  GraduationCap,
  PlusCircle,
  UserCheck,
  AlertTriangle,
} from "@/shared/components/icons";

export const StudentDashboardPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);

  const advisorQuery = useQuery({
    queryKey: ["my-advisor", user?.id],
    queryFn: studentApi.getMyAdvisor,
  });

  const topicStatusQuery = useQuery({
    queryKey: ["my-topic-status", user?.id],
    queryFn: studentApi.getMyTopicStatus,
  });

  const advisorData = advisorQuery.data;
  const topicData = topicStatusQuery.data;
  const isLoading = advisorQuery.isLoading || topicStatusQuery.isLoading;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Welcome Header */}
      <div className="rounded-2xl bg-gradient-to-r from-[#006A60] to-[#004f46] p-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
            Không gian sinh viên · {user?.cohort_name || topicData?.cohort_name || "Sinh viên"}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold">
            Xin chào, {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}!
          </h1>
          <p className="text-white/80 text-xs sm:text-sm mt-1">
            MSSV: {user?.student_code || "Chưa cập nhật"} · Lớp: {user?.class_name || "Chưa cập nhật"} · Khoa: {user?.department_name || "CNTT"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            to="/student/advisor"
            className="px-4 py-2 bg-white text-[#006A60] font-semibold text-xs rounded-xl hover:bg-slate-100 transition shadow-xs"
          >
            Giảng viên hướng dẫn
          </Link>
          <Link
            to="/topics"
            className="px-4 py-2 bg-white/20 text-white font-semibold text-xs rounded-xl hover:bg-white/30 transition shadow-xs"
          >
            Danh mục đề tài
          </Link>
        </div>
      </div>

      {/* Rules Alert Card */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 text-amber-900 shadow-xs">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs sm:text-sm">
            <p className="font-bold text-amber-950">Quy chế đăng ký đề tài đồ án tốt nghiệp:</p>
            <ul className="list-disc list-inside space-y-0.5 text-amber-800">
              <li>
                <strong>Mỗi sinh viên chỉ được chọn 1 đề tài đồ án tốt nghiệp</strong> duy nhất.
              </li>
              <li>
                <strong>Không sinh viên nào cùng khóa ({user?.cohort_name || "khóa học của bạn"}) được chọn chung 1 đề tài</strong> (đề tài đã có bạn cùng khóa đăng ký sẽ bị khóa).
              </li>
              <li>
                Bạn có thể <strong>chọn đề tài có sẵn</strong> từ ngân hàng đề tài hoặc <strong>tự đề xuất đề tài mới</strong> lên Giảng viên hướng dẫn.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-400">Đang tải dữ liệu hồ sơ đồ án...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Section 1: Giảng viên hướng dẫn */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-teal-50 text-[#006A60] rounded-xl">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Giảng viên hướng dẫn (GVHD)</h2>
                    <p className="text-xs text-slate-400">Người đồng hành và hướng dẫn đồ án của bạn</p>
                  </div>
                </div>
                {advisorData?.has_advisor ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle className="w-3.5 h-3.5" /> Đã có GVHD
                  </span>
                ) : advisorData?.request?.status === "pending" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock className="w-3.5 h-3.5" /> Đang chờ duyệt
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                    Chưa đăng ký
                  </span>
                )}
              </div>

              <div className="mt-5">
                {advisorData?.has_advisor && advisorData.advisor ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 text-base">
                          {advisorData.advisor.academic_degree ? `${advisorData.advisor.academic_degree}. ` : ""}
                          {advisorData.advisor.first_name} {advisorData.advisor.last_name}
                        </h3>
                        <span className="text-xs font-medium text-slate-500">
                          {advisorData.advisor.department_name || "Khoa CNTT"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Email: {advisorData.advisor.email}</p>
                      {advisorData.advisor.specialization && (
                        <p className="text-xs text-slate-600 mt-2 bg-white p-2 rounded-lg border border-slate-100">
                          <strong>Hướng nghiên cứu:</strong> {advisorData.advisor.specialization}
                        </p>
                      )}
                    </div>
                  </div>
                ) : advisorData?.request?.status === "pending" ? (
                  <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-100 text-amber-900 text-xs space-y-2">
                    <p className="font-semibold text-sm">Yêu cầu chọn GVHD đang chờ xử lý</p>
                    <p>
                      Bạn đã gửi yêu cầu tới giảng viên: <strong>{advisorData.request.teacher_name}</strong>
                    </p>
                    <p className="text-amber-700">
                      Lời nhắn: &ldquo;{advisorData.request.message || "Không có lời nhắn"}&rdquo;
                    </p>
                    <p className="text-[11px] text-amber-600">
                      Gửi lúc: {new Date(advisorData.request.created_at).toLocaleString("vi-VN")}
                    </p>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-500 space-y-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <GraduationCap className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs">
                      Bạn chưa chọn Giảng viên hướng dẫn. Hãy tìm và gửi yêu cầu tới giảng viên phù hợp với chuyên môn của bạn.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <Link
                to="/student/advisor"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006A60] text-white font-semibold text-xs hover:bg-[#00524a] transition shadow-xs"
              >
                {advisorData?.has_advisor ? "Xem danh sách giảng viên" : "Đăng ký chọn GVHD"} →
              </Link>
            </div>
          </div>

          {/* Section 2: Đề tài tốt nghiệp */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-sky-50 text-sky-700 rounded-xl">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Đề tài đồ án tốt nghiệp</h2>
                    <p className="text-xs text-slate-400">Thông tin đề tài sinh viên đang thực hiện</p>
                  </div>
                </div>
                {topicData?.has_topic ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle className="w-3.5 h-3.5" /> Đã phân công
                  </span>
                ) : topicData?.pending_proposal ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Clock className="w-3.5 h-3.5" /> Đề xuất chờ duyệt
                  </span>
                ) : topicData?.pending_registration ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock className="w-3.5 h-3.5" /> Đăng ký chờ duyệt
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                    Chưa có đề tài
                  </span>
                )}
              </div>

              <div className="mt-5">
                {topicData?.has_topic && topicData.active_assignment ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#006A60] bg-teal-50 px-2 py-0.5 rounded">
                      Đề tài chính thức
                    </span>
                    <h3 className="font-bold text-slate-900 text-base leading-snug">
                      {topicData.active_assignment.topic_title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Trạng thái: <strong>{topicData.active_assignment.status_display}</strong>
                    </p>
                    {topicData.active_assignment.due_date && (
                      <p className="text-xs text-slate-500">
                        Hạn nộp: {new Date(topicData.active_assignment.due_date).toLocaleDateString("vi-VN")}
                      </p>
                    )}
                  </div>
                ) : topicData?.pending_proposal ? (
                  <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-indigo-950 text-xs space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                      Đề tài tự đề xuất
                    </span>
                    <h3 className="font-bold text-indigo-950 text-sm">
                      {topicData.pending_proposal.title}
                    </h3>
                    <p className="text-indigo-800">
                      Gửi tới GVHD: <strong>{topicData.pending_proposal.teacher_name}</strong>
                    </p>
                    <p className="text-indigo-700">
                      Trạng thái: <strong>{topicData.pending_proposal.status_display}</strong>
                    </p>
                  </div>
                ) : topicData?.pending_registration ? (
                  <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-100 text-amber-950 text-xs space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      Đăng ký đề tài có sẵn
                    </span>
                    <h3 className="font-bold text-amber-950 text-sm">
                      {topicData.pending_registration.topic_title}
                    </h3>
                    <p className="text-amber-800">
                      GV phụ trách: <strong>{topicData.pending_registration.topic_teacher_name}</strong>
                    </p>
                    <p className="text-amber-700">
                      Trạng thái: <strong>{topicData.pending_registration.status_display}</strong>
                    </p>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-500 space-y-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs">
                      Bạn chưa chọn đề tài đồ án nào. Hãy chọn một đề tài từ danh sách hoặc đề xuất đề tài mới lên GVHD.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-2 justify-end">
              {topicData?.has_topic && topicData.active_assignment ? (
                <Link
                  to={`/projects/${topicData.active_assignment.id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006A60] text-white font-semibold text-xs hover:bg-[#00524a] transition shadow-xs"
                >
                  Không gian đồ án & Nộp báo cáo →
                </Link>
              ) : (
                <>
                  <Link
                    to="/student/propose"
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
                  >
                    <PlusCircle className="w-4 h-4 text-[#006A60]" /> Đề xuất đề tài mới
                  </Link>
                  <Link
                    to="/topics"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006A60] text-white font-semibold text-xs hover:bg-[#00524a] transition shadow-xs"
                  >
                    Chọn đề tài có sẵn →
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
