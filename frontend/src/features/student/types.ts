export interface NotificationItem {
  id: number;
  recipient: number;
  sender: number | null;
  sender_name: string;
  title: string;
  message: string;
  notification_type:
    | "advisor_request"
    | "advisor_response"
    | "topic_proposal"
    | "topic_proposal_response"
    | "topic_registration"
    | "topic_registration_response"
    | "system";
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface TeacherItem {
  id: number;
  username: string;
  name: string;
  email: string;
  phone_number?: string;
  department_id?: number;
  department_name?: string;
  lecturer_code?: string;
  academic_degree?: string;
  specialization?: string;
  active_student_count: number;
}

export interface AdvisorRequestItem {
  id: number;
  student: number;
  student_name: string;
  student_code: string;
  student_email: string;
  class_name: string;
  cohort_name: string | null;
  department_name: string | null;
  teacher: number;
  teacher_name: string;
  teacher_email: string;
  teacher_degree?: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  status_display: string;
  message: string;
  response_note: string;
  created_at: string;
  updated_at: string;
}

export interface StudentTopicProposalItem {
  id: number;
  student: number;
  student_name: string;
  student_code: string;
  student_email: string;
  class_name: string;
  teacher: number;
  teacher_name: string;
  teacher_email: string;
  title: string;
  description: string;
  expected_technologies: string;
  department: number;
  department_name: string;
  field: number | null;
  field_name: string | null;
  cohort: number;
  cohort_name: string;
  academic_year: number;
  academic_year_name: string;
  semester: number;
  semester_name: string;
  status: "pending" | "approved" | "rejected" | "revision_requested";
  status_display: string;
  teacher_note: string;
  created_topic: number | null;
  created_at: string;
  updated_at: string;
}

export interface TopicRegistrationItem {
  id: number;
  topic: number;
  topic_title: string;
  topic_code?: string;
  topic_cohort_name: string;
  topic_teacher_name: string;
  student: number;
  student_name: string;
  student_code: string;
  student_cohort_name: string | null;
  class_name: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  status_display: string;
  note: string;
  teacher_note: string;
  created_at: string;
  updated_at: string;
}

export interface MyTopicStatusResponse {
  has_topic: boolean;
  can_choose_topic: boolean;
  cohort_name: string;
  active_assignment: {
    id: number;
    topic_id: number;
    topic_title: string;
    status: string;
    status_display: string;
    due_date?: string;
    assigned_by_name?: string;
    assigned_at: string;
  } | null;
  pending_registration: TopicRegistrationItem | null;
  pending_proposal: StudentTopicProposalItem | null;
}
