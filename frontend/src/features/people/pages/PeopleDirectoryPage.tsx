import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ManagedUser } from "@/features/accounts/api";
import { peopleApi, type PeopleProfilePayload, type TopicAssignmentSummary } from "@/features/people/api";
import type { Topic } from "@/features/topics/types";
import type { User } from "@/types";
import { useAuthStore } from "@/features/auth/store";
import PeopleProfileDialog from "@/features/people/components/PeopleProfileDialog";
import {
  BookOpen,
  ChevronRight,
  Search,
  User as UserIcon,
  Users,
} from "@/shared/components/icons";
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  PageSkeleton,
  Panel,
  fieldClass,
} from "@/shared/components/ui";
import { toast } from "@/shared/lib/toast";

type PersonRole = "teacher" | "student";
type TopicSummary = Pick<Topic, "id" | "title" | "status">;

const roleNames: Record<PersonRole, string> = {
  teacher: "Giảng viên",
  student: "Sinh viên",
};

const statusNames: Record<Topic["status"], string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
  rename_requested: "Yêu cầu sửa tên",
};

function fullName(person: Pick<User, "first_name" | "last_name" | "username">) {
  return `${person.first_name} ${person.last_name}`.trim() || person.username;
}

export default function PeopleDirectoryPage() {
  const currentUser = useAuthStore((state) => state.user);
  const [role, setRole] = useState<PersonRole>("teacher");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ role: PersonRole; person: ManagedUser | null } | null>(null);
  const client = useQueryClient();

  const people = useQuery({ queryKey: ["people-directory"], queryFn: peopleApi.list });
  const topics = useQuery({ queryKey: ["people-topics"], queryFn: peopleApi.topics });
  const assignments = useQuery({ queryKey: ["people-assignments"], queryFn: peopleApi.assignments });
  const departments = useQuery({
    queryKey: ["catalog", "departments"],
    queryFn: peopleApi.departments,
    enabled: editor?.role === "teacher",
  });
  const cohorts = useQuery({
    queryKey: ["catalog", "cohorts"],
    queryFn: peopleApi.cohorts,
    enabled: editor?.role === "student",
  });
  const saveProfile = useMutation({
    mutationFn: ({ id, payload }: { id: number | null; payload: PeopleProfilePayload }) =>
      id ? peopleApi.update(id, payload) : peopleApi.create(payload),
    onSuccess: (person) => {
      void client.invalidateQueries({ queryKey: ["people-directory"] });
      if (person.role === "teacher" || person.role === "student") setRole(person.role);
      setSelectedId(person.id);
      setEditor(null);
      toast.success("Đã lưu hồ sơ.");
    },
    onError: (error: unknown) => toast.error(profileError(error)),
  });

  const filteredPeople = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return (people.data ?? []).filter((person) => {
      if (person.role !== role) return false;
      if (!query) return true;
      return [
        person.username,
        person.email,
        person.first_name,
        person.last_name,
        person.student_code,
        person.phone_number,
      ].join(" ").toLocaleLowerCase("vi").includes(query);
    });
  }, [people.data, role, search]);

  const selected = filteredPeople.find((person) => person.id === selectedId) ?? filteredPeople[0] ?? null;
  const topicsForSelected = selected
    ? getPersonTopics(selected, topics.data ?? [], assignments.data ?? [])
    : [];
  const isLoading = people.isLoading || topics.isLoading || assignments.isLoading;
  const errorQuery = [people, topics, assignments].find((query) => query.isError);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Nhân sự học thuật"
        title="Giảng viên & sinh viên"
        description="Tra cứu người hướng dẫn, đề tài đang phụ trách và đề tài được giao cho từng sinh viên."
        actions={<>
          <Button variant="primary" onClick={() => setEditor({ role, person: null })}>Thêm hồ sơ</Button>
          {currentUser?.role === "admin" && (
            <Link to="/users" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800">
              Quản lý tài khoản
            </Link>
          )}
        </>}
      />

      {errorQuery?.isError ? (
        <ErrorState
          message="Không thể tải danh sách giảng viên, sinh viên hoặc phân công đề tài."
          retry={() => {
            void people.refetch();
            void topics.refetch();
            void assignments.refetch();
          }}
        />
      ) : isLoading ? (
        <PageSkeleton cards={2} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Panel className="p-0">
            <div className="border-b border-slate-100 p-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                {(["teacher", "student"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setRole(item);
                      setSelectedId(null);
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      role === item ? "bg-white text-brand-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {roleNames[item]}
                  </button>
                ))}
              </div>
              <label className="relative mt-3 block">
                <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm theo tên, mã hoặc email..."
                  className={`${fieldClass} pl-10`}
                  aria-label={`Tìm ${roleNames[role].toLocaleLowerCase("vi")}`}
                />
              </label>
              <p className="mt-3 text-xs font-medium text-slate-500">
                {filteredPeople.length} {roleNames[role].toLocaleLowerCase("vi")}
              </p>
            </div>
            <div className="max-h-[640px] divide-y divide-slate-100 overflow-y-auto">
              {filteredPeople.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => setSelectedId(person.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-brand-50/60 ${
                    selected?.id === person.id ? "bg-brand-50" : ""
                  }`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
                    {initials(person)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{fullName(person)}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {role === "student" ? person.student_code || person.username : person.email || person.username}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))}
              {!filteredPeople.length && (
                <div className="p-5">
                  <EmptyState
                    title={`Không tìm thấy ${roleNames[role].toLocaleLowerCase("vi")}`}
                    description="Thử từ khóa khác hoặc đổi loại hồ sơ."
                    icon={<Users className="h-5 w-5" />}
                  />
                </div>
              )}
            </div>
          </Panel>

          {selected ? (
            <Panel className="space-y-5">
              <div className="flex items-start gap-4 border-b border-slate-100 pb-5">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-800">
                  <UserIcon className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">{roleNames[role]}</p>
                  <h2 className="mt-1 truncate text-xl font-bold text-slate-950">{fullName(selected)}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {role === "student" && selected.student_code ? `${selected.student_code} · ` : ""}
                    {selected.email || selected.username}
                  </p>
                  {selected.phone_number && <p className="mt-1 text-sm text-slate-500">{selected.phone_number}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    selected.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {selected.is_active ? "Đang hoạt động" : "Đã khóa"}
                  </span>
                  <Button className="px-3 py-1.5" onClick={() => setEditor({ role, person: selected })}>Sửa hồ sơ</Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-brand-700" />
                  <h3 className="font-semibold text-slate-900">
                    {role === "teacher" ? "Đề tài hướng dẫn" : "Đề tài được giao"}
                  </h3>
                </div>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800">
                  {topicsForSelected.length}
                </span>
              </div>

              {topicsForSelected.length ? (
                <ul className="space-y-3">
                  {topicsForSelected.map((item) => (
                    <li key={`${item.topic.id}-${item.advisor?.id ?? selected.id}`} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <Link
                          to={`/topics/${item.topic.id}`}
                          className="font-semibold text-brand-800 hover:underline"
                        >
                          {item.topic.title}
                        </Link>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(item.topic.status)}`}>
                          {statusNames[item.topic.status]}
                        </span>
                      </div>
                      {role === "teacher" ? (
                        <p className="mt-2 text-sm text-slate-600">
                          {item.students.length
                            ? `Sinh viên: ${item.students.map(fullName).join(", ")}`
                            : "Chưa có sinh viên được phân công."}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-slate-600">
                          Giảng viên hướng dẫn: {item.advisor ? fullName(item.advisor) : "Chưa xác định"}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title={role === "teacher" ? "Chưa hướng dẫn đề tài nào" : "Chưa được giao đề tài"}
                  description="Thông tin sẽ xuất hiện sau khi đề tài được phân công trong hệ thống."
                  icon={<BookOpen className="h-5 w-5" />}
                />
              )}
            </Panel>
          ) : (
            <EmptyState
              title={`Chọn một ${roleNames[role].toLocaleLowerCase("vi")}`}
              description="Thông tin đề tài và phân công sẽ hiển thị tại đây."
              icon={<UserIcon className="h-5 w-5" />}
            />
          )}
        </div>
      )}
      {editor && (
        <PeopleProfileDialog
          role={editor.role}
          person={editor.person}
          departments={departments.data ?? []}
          cohorts={cohorts.data ?? []}
          busy={saveProfile.isPending}
          onClose={() => setEditor(null)}
          onSave={(payload) => saveProfile.mutate({ id: editor.person?.id ?? null, payload })}
        />
      )}
    </div>
  );
}

function getPersonTopics(
  person: ManagedUser,
  topics: Topic[],
  assignments: TopicAssignmentSummary[],
): Array<{ topic: TopicSummary; students: User[]; advisor: User | null }> {
  if (person.role === "teacher") {
    return topics
      .filter((topic) => topic.proposed_by === person.id)
      .map((topic) => ({
        topic,
        students: uniquePeople(
          assignments
            .filter((assignment) => assignment.topic === topic.id)
            .flatMap((assignment) => assignment.students_detail),
        ),
        advisor: person,
      }));
  }

  const assigned = assignments.filter((assignment) =>
    assignment.students_detail.some((student) => student.id === person.id),
  );
  const byTopic = new Map<number, { topic: TopicSummary; students: User[]; advisor: User }>();
  for (const assignment of assigned) {
    if (!byTopic.has(assignment.topic)) {
      byTopic.set(assignment.topic, {
        topic: {
          id: assignment.topic,
          title: assignment.topic_title,
          status: topics.find((topic) => topic.id === assignment.topic)?.status ?? "pending",
        },
        students: [],
        advisor: assignment.proposed_by_detail,
      });
    }
  }
  return [...byTopic.values()];
}

function uniquePeople(people: User[]) {
  return [...new Map(people.map((person) => [person.id, person])).values()];
}

function initials(person: ManagedUser) {
  return `${person.first_name[0] ?? ""}${person.last_name[0] ?? ""}` || person.username.slice(0, 2).toUpperCase();
}

function statusClass(status: Topic["status"]) {
  const classes: Record<Topic["status"], string> = {
    pending: "bg-amber-50 text-amber-700",
    approved: "bg-emerald-50 text-emerald-700",
    rejected: "bg-rose-50 text-rose-700",
    rename_requested: "bg-sky-50 text-sky-700",
  };
  return classes[status];
}

function profileError(error: unknown) {
  if (axios.isAxiosError<Record<string, unknown>>(error)) {
    const data = error.response?.data;
    if (data && typeof data === "object") {
      if (typeof data.detail === "string") return data.detail;
      const first = Object.entries(data).find(([, value]) => typeof value === "string" || Array.isArray(value));
      if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1].join(", ") : first[1]}`;
    }
  }
  return error instanceof Error ? error.message : "Không thể lưu hồ sơ.";
}
