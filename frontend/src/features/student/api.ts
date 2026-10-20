import { api } from "@/shared/lib/axios";
import type {
  AdvisorRequestItem,
  MyTopicStatusResponse,
  NotificationItem,
  StudentTopicProposalItem,
  TeacherItem,
  TopicRegistrationItem,
} from "./types";

export const studentApi = {
  // Notifications
  getNotifications: async () => {
    const res = await api.get<NotificationItem[] | { results: NotificationItem[] }>(
      "/auth/notifications/"
    );
    return Array.isArray(res.data) ? res.data : (res.data.results ?? []);
  },
  markNotificationRead: async (id: number) => {
    const res = await api.post<NotificationItem>(`/auth/notifications/${id}/read/`);
    return res.data;
  },
  markAllNotificationsRead: async () => {
    const res = await api.post<{ detail: string }>("/auth/notifications/read-all/");
    return res.data;
  },
  getUnreadCount: async () => {
    const res = await api.get<{ unread_count: number }>("/auth/notifications/unread-count/");
    return res.data.unread_count;
  },

  // Advisor requests
  getAvailableTeachers: async (params?: { department_id?: number; search?: string }) => {
    const res = await api.get<TeacherItem[]>("/auth/advisor-requests/teachers/", { params });
    return res.data;
  },
  getMyAdvisor: async () => {
    const res = await api.get<{
      has_advisor: boolean;
      advisor: {
        id: number;
        first_name: string;
        last_name: string;
        username: string;
        email: string;
        academic_degree?: string;
        specialization?: string;
        phone_number?: string;
        department_name?: string;
      } | null;
      request: AdvisorRequestItem | null;
    }>("/auth/advisor-requests/my-advisor/");
    return res.data;
  },
  getAdvisorRequests: async () => {
    const res = await api.get<AdvisorRequestItem[] | { results: AdvisorRequestItem[] }>(
      "/auth/advisor-requests/"
    );
    return Array.isArray(res.data) ? res.data : (res.data.results ?? []);
  },
  createAdvisorRequest: async (payload: { teacher_id: number; message?: string }) => {
    const res = await api.post<AdvisorRequestItem>("/auth/advisor-requests/", payload);
    return res.data;
  },
  respondAdvisorRequest: async (
    id: number,
    payload: { action: "accept" | "reject"; response_note?: string }
  ) => {
    const res = await api.post<AdvisorRequestItem>(`/auth/advisor-requests/${id}/respond/`, payload);
    return res.data;
  },

  // Student topic proposals
  getStudentProposals: async () => {
    const res = await api.get<
      StudentTopicProposalItem[] | { results: StudentTopicProposalItem[] }
    >("/topics/student-proposals/");
    return Array.isArray(res.data) ? res.data : (res.data.results ?? []);
  },
  createStudentProposal: async (payload: {
    teacher: number;
    title: string;
    description?: string;
    expected_technologies?: string;
    department: number;
    field?: number | null;
    cohort: number;
    academic_year: number;
    semester: number;
  }) => {
    const res = await api.post<StudentTopicProposalItem>(
      "/topics/student-proposals/",
      payload
    );
    return res.data;
  },
  respondStudentProposal: async (
    id: number,
    payload: { action: "approve" | "reject" | "revision_requested"; teacher_note?: string }
  ) => {
    const res = await api.post<StudentTopicProposalItem>(
      `/topics/student-proposals/${id}/respond/`,
      payload
    );
    return res.data;
  },

  // Topic registrations
  getTopicRegistrations: async () => {
    const res = await api.get<
      TopicRegistrationItem[] | { results: TopicRegistrationItem[] }
    >("/topics/registrations/");
    return Array.isArray(res.data) ? res.data : (res.data.results ?? []);
  },
  createTopicRegistration: async (payload: { topic_id: number; note?: string }) => {
    const res = await api.post<TopicRegistrationItem>("/topics/registrations/", payload);
    return res.data;
  },
  respondTopicRegistration: async (
    id: number,
    payload: { action: "approve" | "reject"; teacher_note?: string }
  ) => {
    const res = await api.post<TopicRegistrationItem>(
      `/topics/registrations/${id}/respond/`,
      payload
    );
    return res.data;
  },
  getMyTopicStatus: async () => {
    const res = await api.get<MyTopicStatusResponse>("/topics/registrations/my-topic-status/");
    return res.data;
  },
};
