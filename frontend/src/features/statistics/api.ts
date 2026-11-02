import { api } from "@/shared/lib/axios";

export interface StatisticsFilters {
  search?: string;
  academic_year?: number;
  cohort?: number;
  department?: number;
  field?: number;
  semester?: number;
  proposed_by?: number;
  status?: string;
}

interface CountRow { count: number; }

export interface SupervisedStudentItem {
  student_id: number;
  student_name: string;
  student_code: string;
  class_name: string;
  email: string;
  phone_number: string;
  cohort_name: string;
  department_name: string;
  has_topic: boolean;
  topic_id: number | null;
  topic_title: string | null;
  assignment_id: number | null;
  assignment_status: string;
  assignment_status_display: string;
  latest_percent: number;
  latest_submitted_at: string | null;
  reports_count: number;
  is_late: boolean;
  has_pending_feedback: boolean;
}

export interface TeacherStudentsOverview {
  total_students: number;
  assigned_topic_count: number;
  unassigned_topic_count: number;
  active_students_count: number;
  completed_students_count: number;
  average_progress: number;
  late_students_count: number;
  pending_feedback_count: number;
  by_cohort: Array<{ label: string; count: number }>;
  by_status: Array<{ status: string; label: string; count: number }>;
  by_progress: Array<{ label: string; count: number }>;
  students_list: SupervisedStudentItem[];
}

export interface StatisticsOverview {
  total: number;
  by_academic_year: Array<CountRow & { academic_year__name: string }>;
  by_cohort: Array<CountRow & { cohort__name: string }>;
  by_teacher: Array<CountRow & {
    proposed_by__id: number;
    proposed_by__username: string;
    proposed_by__first_name: string;
    proposed_by__last_name: string;
  }>;
  by_field: Array<CountRow & { field__name: string | null }>;
  by_status: Array<CountRow & { status: string }>;
  students_overview?: TeacherStudentsOverview | null;
}

export const statisticsApi = {
  overview: (params: StatisticsFilters = {}) =>
    api.get<StatisticsOverview>("/statistics/overview/", { params }).then((r) => r.data),
  download: async (format: "excel" | "pdf", params: StatisticsFilters = {}) => {
    const response = await api.get<Blob>("/statistics/export/", {
      params: { export_format: format, ...params },
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = format === "pdf" ? "danh_sach_de_tai.pdf" : "danh_sach_de_tai.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  },
};
