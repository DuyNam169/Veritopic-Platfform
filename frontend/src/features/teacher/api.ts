import { api } from "@/shared/lib/axios";
import type {
  MyStudentItem,
  ProjectProgressItem,
  ProgressFeedback,
  ProgressReport,
  ProposeTopicResponse,
  SimilarTopicResult,
  Topic,
  UserDetail,
} from "./types";

export interface TopicListParams {
  search?: string;
  department?: number;
  cohort?: number;
  academic_year?: number;
  semester?: number;
  status?: string;
  mine?: boolean;
  page?: number;
}

export const teacherApi = {
  // Topics CRUD & Check
  getMyTopics: (params?: TopicListParams) =>
    api.get("/topics/topics/", { params: { ...params, mine: true } }).then((r) => r.data),

  getAllTopics: (params?: TopicListParams) =>
    api.get("/topics/topics/", { params }).then((r) => r.data),

  getTopicDetail: (id: number) =>
    api.get<Topic>(`/topics/topics/${id}/`).then((r) => r.data),

  checkTitle: (title: string) =>
    api.post<{ exact_duplicate: boolean; title: string }>("/topics/topics/check-title/", { title }).then((r) => r.data),

  checkSimilarityDraft: (payload: { title: string; description?: string; keywords?: string[] }) =>
    api.post<SimilarTopicResult[]>("/topics/topics/check-similarity/", payload).then((r) => r.data),

  proposeTopic: (payload: Partial<Topic>) =>
    api.post<ProposeTopicResponse>("/topics/topics/", payload).then((r) => r.data),

  resubmitTopic: (id: number, payload: Partial<Topic>) =>
    api.post<ProposeTopicResponse>(`/topics/topics/${id}/resubmit/`, payload).then((r) => r.data),

  getTopicHistory: (id: number) =>
    api.get(`/topics/topics/${id}/history/`).then((r) => r.data),

  getTopicSimilarityResults: (id: number) =>
    api.get<SimilarTopicResult[]>(`/topics/topics/${id}/similarity-check/`).then((r) => r.data),

  // Student Assignment & Management
  getAssignableStudents: (semesterId?: number, search?: string) =>
    api
      .get<UserDetail[]>("/topics/assignable-students/", { params: { semester_id: semesterId, search } })
      .then((r) => r.data),

  assignTopic: (topicId: number, studentIds: number[], dueDate?: string, note = "") =>
    api
      .post(`/topics/topics/${topicId}/assign/`, {
        student_ids: studentIds,
        due_date: dueDate || null,
        note,
      })
      .then((r) => r.data),

  getMyStudents: (search?: string) =>
    api.get<MyStudentItem[]>("/topics/my-students/", { params: { search } }).then((r) => r.data),

  updateAssignmentStatus: (assignmentId: number, status: "completed" | "cancelled" | "active") =>
    api.patch(`/topics/assignments/${assignmentId}/update-status/`, { status }).then((r) => r.data),

  // Progress Monitoring & Feedback
  getProjectsProgress: () =>
    api.get<ProjectProgressItem[]>("/progress/projects/").then((r) => r.data),

  getAssignmentReports: (assignmentId: number) =>
    api.get<ProgressReport[]>(`/progress/projects/${assignmentId}/reports/`).then((r) => r.data),

  addProgressFeedback: (
    reportId: number,
    payload: { comment: string; score?: number; result?: "passed" | "need_revision" | "failed" }
  ) =>
    api.post<ProgressFeedback>(`/progress/reports/${reportId}/feedback/`, payload).then((r) => r.data),

  getDownloadAttachmentUrl: (reportId: number) =>
    `${import.meta.env.VITE_API_BASE_URL}/progress/reports/${reportId}/download-attachment/`,
};
