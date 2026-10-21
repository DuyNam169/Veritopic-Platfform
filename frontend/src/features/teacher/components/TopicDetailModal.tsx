import React, { useEffect, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import type { Topic } from "../types";
import { api } from "@/shared/lib/axios";

interface Props {
  topic: Topic;
  onClose: () => void;
}

interface AssignmentSummary {
  id: number;
  students_detail: { id: number; first_name: string; last_name: string; student_code: string }[];
  status: string;
}

export const TopicDetailModal: React.FC<Props> = ({ topic, onClose }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/topics/topics/${topic.id}/history/`).then((r) => r.data).catch(() => []),
      api.get(`/topics/assignments/`, { params: { topic: topic.id } }).then((r) => {
        const d = r.data;
        return Array.isArray(d) ? d : (d.results ?? []);
      }).catch(() => []),
    ]).then(([hist, assigns]) => {
      setHistory(hist);
      setAssignments(assigns);
    }).finally(() => setIsLoading(false));
  }, [topic.id]);

  const activeAssignments = assignments.filter(a => a.status === "active");
  const assignedStudents = activeAssignments.flatMap(a => a.students_detail);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">

        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-white flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex-1 min-w-0 pr-4">
            <span className="text-[10px] font-black tracking-widest text-[#006A60] uppercase">Chi tiết đề tài</span>
            <h2 className="text-base font-bold text-slate-900 mt-1 leading-snug">{topic.title}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={topic.status} />
            <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-700 transition-colors text-lg leading-none">✕</button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* ── Ghi chú TBM ── */}
          {topic.review_note && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 flex gap-2">
              <span className="shrink-0 mt-0.5">📌</span>
              <div>
                <p className="font-bold mb-1">Ghi chú từ Trưởng bộ môn:</p>
                <p className="leading-relaxed">{topic.review_note}</p>
              </div>
            </div>
          )}

          {/* ── Thông tin học thuật ── */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Thông tin học thuật</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs">
              <InfoRow label="Bộ môn" value={topic.department_name} fallback="—" />
              <InfoRow label="Lĩnh vực" value={topic.field_name} fallback="Chưa phân loại" />
              <InfoRow label="Khóa sinh viên" value={topic.cohort_name} fallback="—" />
              <InfoRow label="Năm học" value={topic.academic_year_name} fallback="—" />
              <InfoRow label="Học kỳ" value={topic.semester_name} fallback="—" />
              <InfoRow label="Số SV tối đa" value={`${topic.max_students} sinh viên`} />
              <InfoRow label="Ngày tạo" value={new Date(topic.created_at).toLocaleDateString("vi-VN")} />
              <InfoRow label="Cập nhật" value={new Date(topic.updated_at).toLocaleDateString("vi-VN")} />
            </div>
          </div>

          {/* ── Giảng viên đề xuất ── */}
          {topic.proposed_by_detail && (
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Giảng viên đề xuất</h4>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#006A60]/10 text-sm font-bold text-[#006A60]">
                  {(topic.proposed_by_detail.first_name?.[0] ?? "") + (topic.proposed_by_detail.last_name?.[0] ?? "")}
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-900">
                    {`${topic.proposed_by_detail.first_name} ${topic.proposed_by_detail.last_name}`.trim() || topic.proposed_by_detail.username}
                  </p>
                  <p className="text-slate-500">{topic.proposed_by_detail.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Sinh viên đang thực hiện ── */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Sinh viên được giao
              <span className="ml-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 text-[10px] normal-case">
                {assignedStudents.length}/{topic.max_students} SV
              </span>
            </h4>
            {isLoading ? (
              <div className="text-xs text-slate-400 py-2">Đang tải...</div>
            ) : assignedStudents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-400">
                Chưa có sinh viên được giao cho đề tài này.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 divide-y divide-slate-100">
                {assignedStudents.map((sv) => (
                  <div key={sv.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-700">
                      {(sv.first_name?.[0] ?? "") + (sv.last_name?.[0] ?? "")}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800">{`${sv.first_name} ${sv.last_name}`.trim()}</span>
                      {sv.student_code && <span className="ml-2 text-slate-400">MSSV: {sv.student_code}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Yêu cầu thực hiện ── */}
          {topic.requirements && (
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Yêu cầu thực hiện</h4>
              <p className="text-xs text-slate-700 bg-slate-50/60 border border-slate-200 rounded-xl px-4 py-3 leading-relaxed">
                {topic.requirements}
              </p>
            </div>
          )}

          {/* ── Từ khóa ── */}
          {topic.keywords && topic.keywords.length > 0 && (
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Từ khóa</h4>
              <div className="flex flex-wrap gap-1.5">
                {topic.keywords.map((kw) => (
                  <span key={kw} className="rounded-full bg-[#E6F4F1] px-3 py-1 text-xs font-semibold text-[#006A60]">
                    #{kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Mô tả ── */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Mô tả chi tiết</h4>
            <p className="text-xs text-slate-600 bg-slate-50/60 border border-slate-200 rounded-xl px-4 py-3 whitespace-pre-wrap leading-relaxed">
              {topic.description || "Chưa có mô tả chi tiết."}
            </p>
          </div>

          {/* ── Audit Log ── */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Lịch sử tác động (Audit Log)</h4>
            {isLoading ? (
              <div className="text-xs text-slate-400">Đang tải lịch sử...</div>
            ) : history.length === 0 ? (
              <div className="text-xs text-slate-400">Chưa có lịch sử thay đổi.</div>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {history.map((h) => (
                  <div key={h.id} className="flex items-start justify-between gap-2 text-[11px] p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-slate-800">{h.actor_name || "Hệ thống"}</span>
                      <span className="text-slate-500 ml-1">{h.note || h.action}</span>
                    </div>
                    <span className="shrink-0 text-slate-400 text-[10px]">{new Date(h.created_at).toLocaleString("vi-VN")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

/** Hàng thông tin dạng label – value */
function InfoRow({ label, value, fallback = "—" }: { label: string; value?: string | null; fallback?: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}: </span>
      <span className="font-semibold text-slate-800">{value || fallback}</span>
    </div>
  );
}
