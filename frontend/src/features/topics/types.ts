import type { User } from "@/types";

export type TopicStatus = "pending" | "approved" | "rejected" | "rename_requested";
export type WarningLevel = "normal" | "review" | "high" | "duplicate";

export interface Topic {
  id: number;
  title: string;
  description: string;
  department: number;
  field: number | null;
  cohort: number;
  academic_year: number;
  semester: number;
  proposed_by: number;
  proposed_by_detail?: User;
  department_name: string;
  field_name: string | null;
  cohort_name: string;
  academic_year_name: string;
  semester_name: string;
  assignment_count: number;
  status: TopicStatus;
  reviewed_by: number | null;
  review_note: string;
  created_at: string;
  updated_at: string;
}

export interface SimilarTopicResult {
  topic: Topic;
  similarity_percent: number;
  warning_level: WarningLevel;
}

export interface StoredSimilarityResult {
  groq_score?: number | null;
  groq_explanation?: string;
  assessment_status?: string;
  id: number;
  similar_topic: number;
  similar_topic_title: string;
  similarity_percent: number;
  warning_level: WarningLevel;
  created_at: string;
}

export interface TopicHistoryEntry {
  id: number;
  action: string;
  actor: number | null;
  actor_name: string;
  note: string;
  created_at: string;
}

export type TopicUpdatePayload = Pick<
  Topic,
  "title" | "description" | "department" | "field" | "cohort" | "academic_year" | "semester"
>;
