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
  status: TopicStatus;
  review_note: string;
  created_at: string;
}

export interface SimilarTopicResult {
  topic: Topic;
  similarity_percent: number;
  warning_level: WarningLevel;
}
