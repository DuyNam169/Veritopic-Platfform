export type TopicStatus = "pending" | "approved" | "rejected" | "rename_requested";
export type WarningLevel = "normal" | "review" | "high" | "duplicate";

export interface UserDetail {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  student_code?: string;
  class_name?: string;
  phone_number?: string;
}

export interface Topic {
  id: number;
  title: string;
  description: string;
  keywords: string[];
  max_students: number;
  requirements: string;
  department: number;
  field: number | null;
  cohort: number;
  academic_year: number;
  semester: number;
  proposed_by: number;
  proposed_by_detail?: UserDetail;
  status: TopicStatus;
  reviewed_by?: number | null;
  review_note: string;
  created_at: string;
  updated_at: string;
}

export interface SimilarTopicResult {
  topic: Topic;
  similarity_percent: number;
  warning_level: WarningLevel;
}

export interface ProposeTopicResponse extends Topic {
  exact_duplicate?: boolean;
  top_similar?: Array<{
    topic_id: number;
    topic_title: string;
    similarity_percent: number;
    warning_level: WarningLevel;
  }>;
}

export interface MyStudentItem {
  assignment_id: number;
  assignment_status: string;
  assignment_status_display: string;
  due_date: string | null;
  topic_id: number;
  topic_title: string;
  student_id: number;
  student_code: string;
  class_name: string;
  student_name: string;
  email: string;
  phone_number: string;
  latest_percent: number;
  latest_submitted_at: string | null;
}

export interface ProjectProgressItem {
  assignment_id: number;
  topic_id: number;
  topic_title: string;
  status: string;
  status_display: string;
  due_date: string | null;
  students: Array<{
    id: number;
    full_name: string;
    student_code: string;
  }>;
  latest_percent: number;
  latest_submitted_at: string | null;
  is_late: boolean;
  total_reports: number;
}

export interface ProgressFeedback {
  id: number;
  report: number;
  teacher: number;
  teacher_info?: UserDetail;
  comment: string;
  score: number | null;
  result: "passed" | "need_revision" | "failed";
  result_display: string;
  created_at: string;
}

export interface ProgressReport {
  id: number;
  assignment: number;
  submitted_by: number;
  submitted_by_info?: UserDetail;
  period_label: string;
  stage: string;
  percent: number;
  content: string;
  attachment: string | null;
  submitted_at: string;
  is_late: boolean;
  feedbacks: ProgressFeedback[];
}
