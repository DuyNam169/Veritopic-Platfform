import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { teacherApi } from "../api";
import { ProgressTimeline } from "../components/ProgressTimeline";
import type { ProgressReport, ProjectProgressItem } from "../types";

export const ProgressDetailPage: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [project, setProject] = useState<ProjectProgressItem | null>(null);
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(() => {
    if (!assignmentId) return;
    const id = Number(assignmentId);
    Promise.all([teacherApi.getProjectsProgress(), teacherApi.getAssignmentReports(id)])
      .then(([projects, reps]) => {
        const found = projects.find((p: ProjectProgressItem) => p.assignment_id === id);
        setProject(found || null);
        setReports(reps);
      })
      .finally(() => setIsLoading(false));
  }, [assignmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-slate-400">Đang tải dữ liệu tiến độ...</div>;
  }

  if (!project) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="font-semibold">Không tìm thấy dữ liệu đồ án này.</p>
        <Link to="/teacher/progress" className="text-xs text-indigo-600 hover:underline mt-2 inline-block">
          ← Quay lại danh sách tiến độ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/teacher/progress"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          ← Danh sách Tiến độ
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-xs text-slate-500">Chi tiết Đồ án</span>
      </div>

      {/* Project Summary Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-slate-900 leading-tight">{project.topic_title}</h1>
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span>Nhóm: {project.students.map((s) => s.full_name).join(", ")}</span>
              {project.due_date && (
                <span>Due: {new Date(project.due_date).toLocaleDateString("vi-VN")}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-indigo-700">{project.latest_percent}%</div>
            <div className="text-[11px] text-slate-500">Hoàn thành</div>
            {project.is_late && (
              <span className="inline-block mt-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                Trễ tiến độ
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all"
            style={{ width: `${project.latest_percent}%` }}
          />
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          {project.students.map((s) => (
            <div key={s.id} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 space-y-0.5">
              <div className="font-bold text-slate-900">{s.full_name}</div>
              <div className="text-slate-500">MSSV: {s.student_code}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline Reports */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Lịch sử báo cáo tiến độ
            <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 font-semibold">
              {reports.length} báo cáo
            </span>
          </h2>
        </div>

        <ProgressTimeline reports={reports} onFeedbackAdded={fetchData} />
      </div>
    </div>
  );
};
