import { api } from "@/shared/lib/axios";
import type { ManagedUser } from "@/features/accounts/api";
import type { Topic } from "@/features/topics/types";
import type { User } from "@/types";
import type { CohortOption, DepartmentOption } from "@/features/accounts/api";

interface Page<T> {
  results: T[];
  next: string | null;
}

export interface TopicAssignmentSummary {
  id: number;
  topic: number;
  topic_title: string;
  proposed_by_detail: User;
  students_detail: User[];
  assigned_at: string;
  note: string;
}

export interface PeopleProfilePayload {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "teacher" | "student";
  phone_number: string;
  department: number | null;
  cohort: number | null;
  student_code: string;
}

async function allPages<T>(url: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const { data } = await api.get<T[] | Page<T>>(url, { params: { page } });
    if (Array.isArray(data)) return data;
    items.push(...data.results);
    if (!data.next) return items;
  }
}

async function allTopics(): Promise<Topic[]> {
  const items: Topic[] = [];
  for (let page = 1; ; page += 1) {
    const { data } = await api.get<Page<Topic>>("/topics/topics/", { params: { page } });
    items.push(...data.results);
    if (!data.next) return items;
  }
}

export const peopleApi = {
  list: () => allPages<ManagedUser>("/management/people/"),
  topics: allTopics,
  assignments: () => allPages<TopicAssignmentSummary>("/topics/assignments/"),
  departments: () => allPages<DepartmentOption>("/academics/departments/"),
  cohorts: () => allPages<CohortOption>("/academics/cohorts/"),
  create: (payload: PeopleProfilePayload) => api.post<ManagedUser>("/management/people/", payload).then((r) => r.data),
  update: (id: number, payload: Partial<PeopleProfilePayload>) =>
    api.patch<ManagedUser>(`/management/people/${id}/`, payload).then((r) => r.data),
};
