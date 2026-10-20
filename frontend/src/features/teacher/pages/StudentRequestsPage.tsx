import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { studentApi } from "@/features/student/api";
import type { AdvisorRequestItem, StudentTopicProposalItem, TopicRegistrationItem } from "@/features/student/types";
import { toast } from "@/shared/lib/toast";
import {
  CheckCircle,
  Clock,
  UserCheck,
  BookOpen,
  XCircle,
  AlertTriangle,
  GraduationCap,
} from "@/shared/components/icons";

export const StudentRequestsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"advisors" | "proposals" | "registrations">("advisors");

  // Advisor Modal
  const [targetAdvisorReq, setTargetAdvisorReq] = useState<{
    item: AdvisorRequestItem;
    action: "accept" | "reject";
  } | null>(null);
  const [advisorNote, setAdvisorNote] = useState("");

  // Proposal Modal
  const [targetProposal, setTargetProposal] = useState<{
    item: StudentTopicProposalItem;
    action: "approve" | "reject" | "revision_requested";
  } | null>(null);
  const [proposalNote, setProposalNote] = useState("");

  // Registration Modal
  const [targetRegistration, setTargetRegistration] = useState<{
    item: TopicRegistrationItem;
    action: "approve" | "reject";
  } | null>(null);
  const [regNote, setRegNote] = useState("");

  // Queries
  const advisorRequestsQuery = useQuery({
    queryKey: ["teacher-advisor-requests"],
    queryFn: studentApi.getAdvisorRequests,
  });

  const proposalsQuery = useQuery({
    queryKey: ["teacher-student-proposals"],
    queryFn: studentApi.getStudentProposals,
  });

  const registrationsQuery = useQuery({
    queryKey: ["teacher-topic-registrations"],
    queryFn: studentApi.getTopicRegistrations,
  });

  // Mutations
  const respondAdvisorMutation = useMutation({
    mutationFn: ({ id, action, response_note }: { id: number; action: "accept" | "reject"; response_note?: string }) =>
      studentApi.respondAdvisorRequest(id, { action, response_note }),
    onSuccess: () => {
      toast.success("Đã phản hồi yêu cầu hướng dẫn của sinh viên thành công!");
      setTargetAdvisorReq(null);
      setAdvisorNote("");
      void queryClient.invalidateQueries({ queryKey: ["teacher-advisor-requests"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Xử lý thất bại.");
    },
  });

  const respondProposalMutation = useMutation({
    mutationFn: ({
      id,
      action,
      teacher_note,
    }: {
      id: number;
      action: "approve" | "reject" | "revision_requested";
      teacher_note?: string;
    }) => studentApi.respondStudentProposal(id, { action, teacher_note }),
    onSuccess: () => {
      toast.success("Đã xử lý đề xuất đề tài của sinh viên thành công!");
      setTargetProposal(null);
      setProposalNote("");
      void queryClient.invalidateQueries({ queryKey: ["teacher-student-proposals"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Xử lý thất bại.");
    },
  });

  const respondRegistrationMutation = useMutation({
    mutationFn: ({ id, action, teacher_note }: { id: number; action: "approve" | "reject"; teacher_note?: string }) =>
      studentApi.respondTopicRegistration(id, { action, teacher_note }),
    onSuccess: () => {
      toast.success("Đã xử lý đăng ký đề tài của sinh viên thành công!");
      setTargetRegistration(null);
      setRegNote("");
      void queryClient.invalidateQueries({ queryKey: ["teacher-topic-registrations"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Xử lý thất bại.");
    },
  });

  const pendingAdvisors = advisorRequestsQuery.data?.filter((r) => r.status === "pending") ?? [];
  const pendingProposals = proposalsQuery.data?.filter((p) => p.status === "pending") ?? [];
  const pendingRegs = registrationsQuery.data?.filter((r) => r.status === "pending") ?? [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <span className="text-[11px] font-black tracking-widest text-[#006A60] uppercase mb-1 block">
          QUẢN LÝ TƯƠNG TÁC SINH VIÊN
        </span>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Yêu cầu & Đề xuất từ Sinh viên
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Tiếp nhận và phản hồi các yêu cầu chọn GVHD, đề xuất đề tài mới và đăng ký đề tài của sinh viên.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("advisors")}
          className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition ${
            activeTab === "advisors"
              ? "border-[#006A60] text-[#006A60]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <UserCheck className="w-4 h-4" /> Yêu cầu chọn GVHD
          {pendingAdvisors.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold">
              {pendingAdvisors.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("proposals")}
          className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition ${
            activeTab === "proposals"
              ? "border-[#006A60] text-[#006A60]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BookOpen className="w-4 h-4" /> Đề xuất đề tài từ SV
          {pendingProposals.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold">
              {pendingProposals.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("registrations")}
          className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition ${
            activeTab === "registrations"
              ? "border-[#006A60] text-[#006A60]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <GraduationCap className="w-4 h-4" /> Đăng ký đề tài có sẵn
          {pendingRegs.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold">
              {pendingRegs.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Advisor Requests */}
      {activeTab === "advisors" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {advisorRequestsQuery.isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Đang tải yêu cầu...</div>
          ) : advisorRequestsQuery.data?.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              Hiện tại không có yêu cầu chọn GVHD nào.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">SINH VIÊN</th>
                    <th className="px-6 py-4">MSSV / LỚP / KHÓA</th>
                    <th className="px-6 py-4">NGUYỆN VỌNG & LỜI NHẮN</th>
                    <th className="px-6 py-4">NGÀY GỬI</th>
                    <th className="px-6 py-4">TRẠNG THÁI</th>
                    <th className="px-6 py-4 text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {advisorRequestsQuery.data?.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{req.student_name}</div>
                        <div className="text-[11px] text-slate-400">{req.student_email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{req.student_code || "N/A"}</div>
                        <div className="text-[11px] text-slate-400">
                          {req.class_name ? `Lớp: ${req.class_name}` : ""} · {req.cohort_name || ""}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-sm">
                        <p className="line-clamp-2 text-slate-600">{req.message || "Không có lời nhắn"}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                        {new Date(req.created_at).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {req.status === "accepted" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5" /> Đã đồng ý
                          </span>
                        ) : req.status === "rejected" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5" /> Đã từ chối
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
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {req.status === "pending" ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setTargetAdvisorReq({ item: req, action: "accept" });
                                setAdvisorNote("");
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-xs"
                            >
                              Đồng ý
                            </button>
                            <button
                              onClick={() => {
                                setTargetAdvisorReq({ item: req, action: "reject" });
                                setAdvisorNote("");
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
                            >
                              Từ chối
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Đã xử lý</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Topic Proposals */}
      {activeTab === "proposals" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {proposalsQuery.isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Đang tải đề xuất...</div>
          ) : proposalsQuery.data?.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              Hiện tại không có đề xuất đề tài nào từ sinh viên.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">TÊN ĐỀ TÀI ĐỀ XUẤT</th>
                    <th className="px-6 py-4">SINH VIÊN</th>
                    <th className="px-6 py-4">BỘ MÔN / KHÓA</th>
                    <th className="px-6 py-4">CÔNG NGHỆ DỰ KIẾN</th>
                    <th className="px-6 py-4">TRẠNG THÁI</th>
                    <th className="px-6 py-4 text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {proposalsQuery.data?.map((prop) => (
                    <tr key={prop.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 max-w-sm">
                        <div className="font-bold text-slate-900">{prop.title}</div>
                        {prop.description && (
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{prop.description}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{prop.student_name}</div>
                        <div className="text-[11px] text-slate-400">{prop.student_code} · {prop.class_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-700">{prop.department_name}</div>
                        <div className="text-[11px] text-slate-400">{prop.cohort_name} · {prop.semester_name}</div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {prop.expected_technologies || "Không nêu"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {prop.status === "approved" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5" /> Đã chấp thuận
                          </span>
                        ) : prop.status === "revision_requested" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <AlertTriangle className="w-3.5 h-3.5" /> Yêu cầu sửa
                          </span>
                        ) : prop.status === "rejected" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5" /> Từ chối
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5" /> Chờ xử lý
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {prop.status === "pending" || prop.status === "revision_requested" ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setTargetProposal({ item: prop, action: "approve" });
                                setProposalNote("");
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#006A60] text-white hover:bg-[#00524a] transition shadow-xs"
                            >
                              Duyệt & Giao SV
                            </button>
                            <button
                              onClick={() => {
                                setTargetProposal({ item: prop, action: "revision_requested" });
                                setProposalNote("");
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
                            >
                              Yêu cầu sửa
                            </button>
                            <button
                              onClick={() => {
                                setTargetProposal({ item: prop, action: "reject" });
                                setProposalNote("");
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
                            >
                              Từ chối
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Đã xử lý</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Topic Registrations */}
      {activeTab === "registrations" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {registrationsQuery.isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Đang tải đăng ký...</div>
          ) : registrationsQuery.data?.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              Hiện tại không có sinh viên nào đăng ký đề tài của bạn.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">ĐỀ TÀI ĐĂNG KÝ</th>
                    <th className="px-6 py-4">SINH VIÊN</th>
                    <th className="px-6 py-4">MSSV / LỚP / KHÓA</th>
                    <th className="px-6 py-4">NGUYỆN VỌNG</th>
                    <th className="px-6 py-4">TRẠNG THÁI</th>
                    <th className="px-6 py-4 text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registrationsQuery.data?.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 max-w-sm">
                        <div className="font-bold text-slate-900">{reg.topic_title}</div>
                        <div className="text-[11px] text-slate-400">Khóa áp dụng: {reg.topic_cohort_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{reg.student_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-700">{reg.student_code}</div>
                        <div className="text-[11px] text-slate-400">
                          {reg.class_name ? `Lớp: ${reg.class_name}` : ""} · {reg.student_cohort_name || ""}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="line-clamp-2 text-slate-600">{reg.note || "Không có ghi chú"}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {reg.status === "approved" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5" /> Đã chấp thuận
                          </span>
                        ) : reg.status === "rejected" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5" /> Từ chối
                          </span>
                        ) : reg.status === "cancelled" ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">
                            Đã hủy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5" /> Chờ duyệt
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {reg.status === "pending" ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setTargetRegistration({ item: reg, action: "approve" });
                                setRegNote("");
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#006A60] text-white hover:bg-[#00524a] transition shadow-xs"
                            >
                              Chấp thuận
                            </button>
                            <button
                              onClick={() => {
                                setTargetRegistration({ item: reg, action: "reject" });
                                setRegNote("");
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
                            >
                              Từ chối
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Đã xử lý</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Phản hồi Advisor */}
      {targetAdvisorReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="font-bold text-slate-900 text-base">
              {targetAdvisorReq.action === "accept"
                ? "Đồng ý hướng dẫn sinh viên"
                : "Từ chối yêu cầu hướng dẫn"}
            </h3>
            <p className="text-xs text-slate-600">
              Sinh viên: <strong>{targetAdvisorReq.item.student_name}</strong> (MSSV:{" "}
              {targetAdvisorReq.item.student_code})
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ghi chú phản hồi / Lý do (tùy chọn)
              </label>
              <textarea
                rows={3}
                value={advisorNote}
                onChange={(e) => setAdvisorNote(e.target.value)}
                placeholder="Nhập lời nhắn hoặc lưu ý cho sinh viên..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 focus:bg-white focus:border-[#006A60] focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTargetAdvisorReq(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() =>
                  respondAdvisorMutation.mutate({
                    id: targetAdvisorReq.item.id,
                    action: targetAdvisorReq.action,
                    response_note: advisorNote,
                  })
                }
                disabled={respondAdvisorMutation.isPending}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition shadow-xs ${
                  targetAdvisorReq.action === "accept"
                    ? "bg-[#006A60] hover:bg-[#00524a]"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {respondAdvisorMutation.isPending ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Phản hồi Proposal */}
      {targetProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="font-bold text-slate-900 text-base">
              {targetProposal.action === "approve"
                ? "Chấp thuận đề tài & Giao cho sinh viên"
                : targetProposal.action === "revision_requested"
                ? "Yêu cầu sinh viên chỉnh sửa đề tài"
                : "Từ chối đề tài của sinh viên"}
            </h3>
            <p className="text-xs text-slate-600">
              Đề tài: <strong>{targetProposal.item.title}</strong>
            </p>
            <p className="text-xs text-slate-500">
              Sinh viên: {targetProposal.item.student_name} ({targetProposal.item.student_code})
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nhận xét / Gợi ý chỉnh sửa của Giảng viên
              </label>
              <textarea
                rows={3}
                value={proposalNote}
                onChange={(e) => setProposalNote(e.target.value)}
                placeholder="Nhập nhận xét hoặc yêu cầu bổ sung tính năng..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 focus:bg-white focus:border-[#006A60] focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTargetProposal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() =>
                  respondProposalMutation.mutate({
                    id: targetProposal.item.id,
                    action: targetProposal.action,
                    teacher_note: proposalNote,
                  })
                }
                disabled={respondProposalMutation.isPending}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition shadow-xs ${
                  targetProposal.action === "approve"
                    ? "bg-[#006A60] hover:bg-[#00524a]"
                    : targetProposal.action === "revision_requested"
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {respondProposalMutation.isPending ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Phản hồi Registration */}
      {targetRegistration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="font-bold text-slate-900 text-base">
              {targetRegistration.action === "approve"
                ? "Chấp thuận & Giao đề tài cho sinh viên"
                : "Từ chối đăng ký đề tài"}
            </h3>
            <p className="text-xs text-slate-600">
              Đề tài: <strong>{targetRegistration.item.topic_title}</strong>
            </p>
            <p className="text-xs text-slate-500">
              Sinh viên: {targetRegistration.item.student_name} ({targetRegistration.item.student_code}) · Khóa: {targetRegistration.item.student_cohort_name}
            </p>

            {targetRegistration.action === "approve" && (
              <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                Lưu ý: Khi chấp thuận, sinh viên sẽ được chính thức giao đề tài này. Hệ thống sẽ tự động từ chối các đăng ký khác cùng khóa cho đề tài này.
              </p>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ghi chú cho sinh viên (tùy chọn)
              </label>
              <textarea
                rows={3}
                value={regNote}
                onChange={(e) => setRegNote(e.target.value)}
                placeholder="Nhập ghi chú phản hồi..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 focus:bg-white focus:border-[#006A60] focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTargetRegistration(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() =>
                  respondRegistrationMutation.mutate({
                    id: targetRegistration.item.id,
                    action: targetRegistration.action,
                    teacher_note: regNote,
                  })
                }
                disabled={respondRegistrationMutation.isPending}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition shadow-xs ${
                  targetRegistration.action === "approve"
                    ? "bg-[#006A60] hover:bg-[#00524a]"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {respondRegistrationMutation.isPending ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
