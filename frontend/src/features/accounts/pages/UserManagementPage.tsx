import { useMemo, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import axios from "axios";
import {
  Users,
  UserCheck,
  UserX,
  Search,
  Filter,
  UserPlus,
  KeyRound,
  Lock,
  Unlock,
  Loader2,
  X,
  ShieldAlert,
  RotateCcw,
} from "@/shared/components/icons";

import { usersApi, type CohortOption, type CreateUserPayload, type DepartmentOption, type ManagedUser, type UpdateUserPayload } from "../api";
import type { Role } from "@/types";
import { toast } from "@/shared/lib/toast";

const labels: Record<Role, string> = {
  admin: "Quản trị viên",
  department_head: "Trưởng bộ môn",
  teacher: "Giảng viên",
  student: "Sinh viên",
};

const roles: Role[] = ["admin", "department_head", "teacher", "student"];

const badges: Record<Role, string> = {
  admin: "bg-brand-700 text-white border-slate-800",
  department_head: "bg-brand-50 text-brand-700 border-brand-200",
  teacher: "bg-sky-50 text-sky-700 border-sky-200",
  student: "bg-slate-100 text-slate-700 border-slate-200",
};

type ApiErrorData = Record<string, string | string[]>;

function apiErrorData(error: unknown): ApiErrorData {
  const data = axios.isAxiosError<ApiErrorData>(error) ? error.response?.data : undefined;
  return data && typeof data === "object" ? data : {};
}

function firstError(data: ApiErrorData, field: string): string | undefined {
  const value = data[field];
  return Array.isArray(value) ? value[0] : value;
}

export default function UserManagementPage() {
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [toggleUser, setToggleUser] = useState<ManagedUser | null>(null);
  const [roleChange, setRoleChange] = useState<{ user: ManagedUser; nextRole: Role } | null>(null);
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"all" | Role>("all");
  const [department, setDepartment] = useState<"all" | number>("all");

  const client = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["managed-users"],
    queryFn: usersApi.list,
  });
  const cohorts = useQuery({
    queryKey: ["catalog", "cohorts"],
    queryFn: usersApi.cohorts,
  });
  const departments = useQuery({
    queryKey: ["catalog", "departments"],
    queryFn: usersApi.departments,
  });

  const refresh = () => client.invalidateQueries({ queryKey: ["managed-users"] });

  const update = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: UpdateUserPayload;
    }) => usersApi.update(id, payload),
    onSuccess: (_, variables) => {
      refresh();
      if (variables.payload.role) {
        toast.success(`Đã cập nhật vai trò sang ${labels[variables.payload.role]}.`);
      }
      if (variables.payload.cohort !== undefined) {
        toast.success("Đã cập nhật khóa học của sinh viên.");
      }
      if (variables.payload.is_active !== undefined) {
        toast.success(
          variables.payload.is_active
            ? "Tài khoản đã được mở khóa."
            : "Tài khoản đã bị khóa truy cập."
        );
      }
    },
    onError: (err: unknown) => {
      const data = apiErrorData(err);
      const errorMsg =
        firstError(data, "detail") ||
        firstError(data, "role") ||
        firstError(data, "is_active") ||
        firstError(data, "cohort") ||
        firstError(data, "non_field_errors") ||
        "Không thể cập nhật trạng thái người dùng.";
      toast.error(errorMsg);
    },
  });

  const users = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.trim().toLowerCase();
      const matchesText =
        !q || [u.username, u.email, u.first_name, u.last_name, u.student_code].join(" ").toLowerCase().includes(q);
      const matchesRole = role === "all" || u.role === role;
      const matchesDepartment = department === "all" || u.department === department;
      return matchesText && matchesRole && matchesDepartment;
    });
  }, [users, search, role, department]);

  const activeCount = users.filter((u) => u.is_active).length;
  const lockedCount = users.length - activeCount;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* HEADER */}
      <header className="border-b border-slate-200 pb-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] uppercase text-slate-500">
              Quản trị hệ thống
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Tài khoản người dùng
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Cấp tài khoản nội bộ, phân quyền truy cập và quản lý trạng thái người dùng.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-brand-800 transition active:scale-98"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Cấp tài khoản</span>
          </button>
        </div>
      </header>

      {/* METRIC CARDS */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tổng tài khoản
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-950">{users.length}</p>
          </div>
          <div className="p-3 rounded-2xl bg-brand-50 text-brand-700">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Đang hoạt động
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{activeCount}</p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Đã bị khóa
            </p>
            <p className="mt-2 text-3xl font-bold text-rose-600">{lockedCount}</p>
          </div>
          <div className="p-3 rounded-2xl bg-rose-50 text-rose-600">
            <UserX className="w-6 h-6" />
          </div>
        </div>
      </section>

      {/* SEARCH & FILTERS BAR */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo họ tên, username, email hoặc mã SV..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "all" | Role)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:bg-white cursor-pointer"
              >
                <option value="all">Tất cả vai trò</option>
                {roles.map((item) => (
                  <option key={item} value={item}>
                    {labels[item]}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:bg-white cursor-pointer"
              aria-label="Lọc theo bộ môn"
            >
              <option value="all">Tất cả bộ môn</option>
              {departments.data?.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
            </select>

            {(search || role !== "all" || department !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setRole("all");
                  setDepartment("all");
                }}
                className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                title="Xóa bộ lọc"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Đặt lại</span>
              </button>
            )}
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="min-w-[800px] w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Người dùng</th>
                <th className="px-6 py-4">Vai trò (RBAC)</th>
                <th className="px-6 py-4">Bộ môn</th>
                <th className="px-6 py-4">Khóa học</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                // SKELETON LOADING
                <>
                  {[...Array(4)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-slate-200" />
                          <div className="space-y-2">
                            <div className="h-4 w-32 rounded bg-slate-200" />
                            <div className="h-3 w-48 rounded bg-slate-100" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-7 w-28 rounded-full bg-slate-200" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-7 w-24 rounded bg-slate-200" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-7 w-24 rounded bg-slate-200" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-5 w-24 rounded-full bg-slate-200" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="ml-auto h-7 w-28 rounded bg-slate-200" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                      <Users className="w-6 h-6" />
                    </div>
                    <p className="font-semibold text-slate-700">Không tìm thấy tài khoản phù hợp</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh bộ lọc vai trò, bộ môn.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    departmentName={departments.data?.find((item) => item.id === user.department)?.name}
                    cohorts={cohorts.data ?? []}
                    saving={update.isPending}
                    onRole={(next) => setRoleChange({ user, nextRole: next })}
                    onCohort={(cohort) => update.mutate({ id: user.id, payload: { cohort } })}
                    onEdit={() => setEditingUser(user)}
                    onToggle={() => setToggleUser(user)}
                    onReset={() => setResetUser(user)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* DIALOGS */}
      {open && (
        <CreateUserDialog
          cohorts={cohorts.data ?? []}
          departments={departments.data ?? []}
          close={() => setOpen(false)}
          done={() => {
            setOpen(false);
            refresh();
          }}
        />
      )}
      {editingUser && <EditUserDialog
        user={editingUser}
        cohorts={cohorts.data ?? []}
        departments={departments.data ?? []}
        close={() => setEditingUser(null)}
        done={() => { setEditingUser(null); void refresh(); }}
      />}
      {toggleUser && <ToggleStatusDialog
        user={toggleUser}
        busy={update.isPending}
        close={() => setToggleUser(null)}
        confirm={() => update.mutate(
          { id: toggleUser.id, payload: { is_active: !toggleUser.is_active } },
          { onSuccess: () => setToggleUser(null) },
        )}
      />}
      {roleChange && <RoleChangeDialog
        user={roleChange.user}
        nextRole={roleChange.nextRole}
        busy={update.isPending}
        close={() => setRoleChange(null)}
        confirm={() => update.mutate(
          {
            id: roleChange.user.id,
            payload: {
              role: roleChange.nextRole,
              ...(roleChange.nextRole !== "student" ? { cohort: null } : {}),
            },
          },
          { onSuccess: () => setRoleChange(null) },
        )}
      />}
      {resetUser && <ResetPasswordDialog user={resetUser} close={() => setResetUser(null)} />}
    </div>
  );
}

function UserRow({
  user,
  departmentName,
  cohorts,
  saving,
  onRole,
  onCohort,
  onEdit,
  onToggle,
  onReset,
}: {
  user: ManagedUser;
  departmentName?: string;
  cohorts: CohortOption[];
  saving: boolean;
  onRole: (role: Role) => void;
  onCohort: (cohort: number | null) => void;
  onEdit: () => void;
  onToggle: () => void;
  onReset: () => void;
}) {
  const initials =
    `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}` ||
    user.username.slice(0, 2).toUpperCase();
  const fullName = `${user.first_name} ${user.last_name}`.trim() || user.username;

  return (
    <tr className="transition-colors hover:bg-slate-50/70">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={`Ảnh đại diện của ${fullName}`}
              className="h-10 w-10 rounded-full border border-slate-300/60 object-cover shadow-sm"
            />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-tr from-slate-100 to-slate-200 text-xs font-bold text-slate-700 border border-slate-300/60 shadow-sm">
              {initials}
            </span>
          )}
          <div>
            <strong className="block font-semibold text-slate-900">{fullName}</strong>
            <span className="mt-0.5 block text-xs text-slate-500 font-mono">
              @{user.username} · {user.email || "Chưa có email"}
              {user.student_code && ` · Mã SV: ${user.student_code}`}
            </span>
          </div>
        </div>
      </td>

      <td className="px-6 py-4">
        <select
          value={user.role}
          disabled={saving}
          onChange={(e) => onRole(e.target.value as Role)}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold outline-none cursor-pointer transition ${badges[user.role]}`}
        >
          {roles.map((item) => (
            <option key={item} value={item} className="bg-white text-slate-900 font-normal">
              {labels[item]}
            </option>
          ))}
        </select>
      </td>

      <td className="px-6 py-4 text-xs text-slate-600">{departmentName || "Chưa gắn"}</td>

      <td className="px-6 py-4">
        {user.role === "student" ? (
          <select
            value={user.cohort ?? ""}
            disabled={saving}
            onChange={(e) => onCohort(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-600 disabled:opacity-50"
            aria-label={`Khóa học của ${fullName}`}
          >
            <option value="">Chưa gắn</option>
            {cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
            ))}
          </select>
        ) : "—"}
      </td>

      <td className="px-6 py-4">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${
            user.is_active
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
              : "bg-slate-100 text-slate-500 border border-slate-200"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              user.is_active ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
            }`}
          />
          {user.is_active ? "Đang hoạt động" : "Đã khóa"}
        </span>
      </td>

      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            disabled={saving}
            onClick={onEdit}
            className="rounded-lg border border-blue-200 bg-blue-50/50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            Sửa
          </button>
          <button
            disabled={saving}
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 active:scale-95 disabled:opacity-50"
            title="Đặt lại mật khẩu cho tài khoản này"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-500" />
            <span>Đổi MK</span>
          </button>

          <button
            disabled={saving}
            onClick={onToggle}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 disabled:opacity-50 ${
              user.is_active
                ? "border-rose-200 bg-rose-50/50 text-rose-700 hover:bg-rose-100/70"
                : "border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100/70"
            }`}
          >
            {user.is_active ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Khóa</span>
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5" />
                <span>Mở khóa</span>
              </>
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}

function CreateUserDialog({
  cohorts,
  departments,
  close,
  done,
}: {
  cohorts: CohortOption[];
  departments: DepartmentOption[];
  close: () => void;
  done: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateUserPayload>({ defaultValues: { role: "student" }, shouldUnregister: true });
  const selectedRole = watch("role");

  const create = useMutation({
    mutationFn: usersApi.create,
    onSuccess: (newUser) => {
      toast.success(`Đã cấp tài khoản @${newUser.username} thành công!`);
      done();
    },
    onError: (err: unknown) => {
      const errorData = apiErrorData(err);
      if (errorData.username) toast.error(firstError(errorData, "username")!, "Lỗi username");
      else if (errorData.email) toast.error(firstError(errorData, "email")!, "Lỗi email");
      else if (errorData.password) toast.error(firstError(errorData, "password")!, "Lỗi mật khẩu");
      else if (errorData.cohort) toast.error(firstError(errorData, "cohort")!, "Lỗi khóa học");
      else toast.error("Không thể cấp tài khoản. Vui lòng kiểm tra lại thông tin.");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fade-in">
      <form
        onSubmit={handleSubmit((data) => create.mutate(data))}
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 animate-scale-in"
      >
        <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5 bg-slate-50/50">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] uppercase text-slate-500">
              Cấp tài khoản nội bộ
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Tạo tài khoản mới</h2>
          </div>
          <button
            type="button"
            onClick={close}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-950 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <Input label="Họ & tên đệm" {...register("last_name", { required: true })} />
          <Input label="Tên" {...register("first_name", { required: true })} />
          <Input label="Tên đăng nhập" {...register("username", { required: true })} />
          <Input label="Email trường" type="email" {...register("email", { required: true })} />
          <Input label="Số điện thoại" {...register("phone_number")} />
          <Input
            label="Mật khẩu ban đầu"
            type="password"
            placeholder="Tối thiểu 8 ký tự"
            {...register("password", { required: true, minLength: 8 })}
          />
          <label className="text-sm font-medium text-slate-800">
            Vai trò
            <select
              {...register("role")}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-brand-600 transition"
            >
              {roles.map((item) => (
                <option key={item} value={item}>
                  {labels[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-800">
            Bộ môn
            <select
              {...register("department", { setValueAs: (value) => value ? Number(value) : null })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-brand-600 transition"
            >
              <option value="">Chưa gắn bộ môn</option>
              {departments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
            </select>
          </label>
          {selectedRole === "student" && (
            <>
              <Input label="Mã sinh viên" {...register("student_code")} />
              <label className="text-sm font-medium text-slate-800">
                Khóa học
                <select
                  {...register("cohort", { setValueAs: (value) => value ? Number(value) : null })}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-brand-600 transition"
                >
                  <option value="">Chưa gắn khóa học</option>
                  {cohorts.map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.name} ({cohort.start_year}–{cohort.end_year})
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="mx-6 mb-2 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800 font-medium">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Vui lòng điền đầy đủ các trường và mật khẩu tối thiểu 8 ký tự.</span>
          </div>
        )}

        <footer className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <button
            type="button"
            onClick={close}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-brand-800 transition active:scale-98 disabled:opacity-60"
          >
            {create.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang cấp...</span>
              </>
            ) : (
              <span>Cấp tài khoản</span>
            )}
          </button>
        </footer>
      </form>
    </div>
  );
}

function EditUserDialog({
  user,
  cohorts,
  departments,
  close,
  done,
}: {
  user: ManagedUser;
  cohorts: CohortOption[];
  departments: DepartmentOption[];
  close: () => void;
  done: () => void;
}) {
  const [confirmRoleChange, setConfirmRoleChange] = useState(false);
  const [payload, setPayload] = useState<UpdateUserPayload>({
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    phone_number: user.phone_number ?? "",
    role: user.role,
    department: user.department,
    cohort: user.cohort,
    student_code: user.student_code,
  });
  const update = useMutation({
    mutationFn: () => usersApi.update(user.id, payload),
    onSuccess: () => { toast.success(`Đã cập nhật tài khoản @${user.username}.`); done(); },
  });
  const updateError = update.isError ? apiErrorData(update.error) : {};
  const message = ["username", "email", "role", "cohort", "detail", "non_field_errors"]
    .map((field) => firstError(updateError, field)).find(Boolean);
  const role = payload.role ?? user.role;
  const inputClass = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600";

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role !== user.role) {
      setConfirmRoleChange(true);
      return;
    }
    update.mutate();
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
    <form onSubmit={submitEdit} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Quản lý tài khoản</p><h2 className="mt-1 text-xl font-bold">Chỉnh sửa @{user.username}</h2></div><button type="button" onClick={close}><X className="h-5 w-5" /></button></header>
      <fieldset disabled={update.isPending} className="grid gap-4 p-6 sm:grid-cols-2">
        {message && <p role="alert" className="sm:col-span-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{message}</p>}
        <label className="text-sm font-medium">Họ và tên đệm<input required value={payload.last_name ?? ""} onChange={(e) => setPayload({ ...payload, last_name: e.target.value })} className={inputClass} /></label>
        <label className="text-sm font-medium">Tên<input required value={payload.first_name ?? ""} onChange={(e) => setPayload({ ...payload, first_name: e.target.value })} className={inputClass} /></label>
        <label className="text-sm font-medium">Tên đăng nhập<input required value={payload.username ?? ""} onChange={(e) => setPayload({ ...payload, username: e.target.value })} className={inputClass} /></label>
        <label className="text-sm font-medium">Email<input required type="email" value={payload.email ?? ""} onChange={(e) => setPayload({ ...payload, email: e.target.value })} className={inputClass} /></label>
        <label className="text-sm font-medium">Số điện thoại<input value={payload.phone_number ?? ""} onChange={(e) => setPayload({ ...payload, phone_number: e.target.value })} className={inputClass} /></label>
        <label className="text-sm font-medium">Vai trò<select value={role} onChange={(e) => { const next = e.target.value as Role; setPayload({ ...payload, role: next, ...(next !== "student" ? { cohort: null } : {}) }); }} className={inputClass}>{roles.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select></label>
        <label className="text-sm font-medium">Bộ môn<select value={payload.department ?? ""} onChange={(e) => setPayload({ ...payload, department: e.target.value ? Number(e.target.value) : null })} className={inputClass}><option value="">Chưa gắn bộ môn</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
        {role === "student" && <><label className="text-sm font-medium">Mã sinh viên<input value={payload.student_code ?? ""} onChange={(e) => setPayload({ ...payload, student_code: e.target.value })} className={inputClass} /></label><label className="text-sm font-medium">Khóa học<select value={payload.cohort ?? ""} onChange={(e) => setPayload({ ...payload, cohort: e.target.value ? Number(e.target.value) : null })} className={inputClass}><option value="">Chưa gắn khóa học</option>{cohorts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></>}
      </fieldset>
      <footer className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4"><button type="button" onClick={close} className="px-4 py-2 text-sm font-semibold text-slate-600">Hủy</button><button type="submit" disabled={update.isPending} className="rounded-xl bg-brand-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{update.isPending ? "Đang lưu..." : "Lưu thay đổi"}</button></footer>
    </form>
    {confirmRoleChange && <RoleChangeDialog
      user={user}
      nextRole={role}
      busy={update.isPending}
      close={() => setConfirmRoleChange(false)}
      confirm={() => update.mutate(undefined, { onSuccess: () => setConfirmRoleChange(false) })}
    />}
  </div>;
}

function RoleChangeDialog({ user, nextRole, busy, close, confirm }: { user: ManagedUser; nextRole: Role; busy: boolean; close: () => void; confirm: () => void }) {
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4"><div role="dialog" aria-modal="true" aria-labelledby="role-change-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 id="role-change-title" className="text-xl font-bold">Xác nhận thay đổi vai trò</h2><p className="mt-3 text-sm text-slate-600">Bạn sắp đổi vai trò của <strong>@{user.username}</strong> từ <strong>{labels[user.role]}</strong> sang <strong>{labels[nextRole]}</strong>. Quyền truy cập của người dùng sẽ thay đổi ngay lập tức.</p>{user.role === "admin" && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Hệ thống sẽ từ chối nếu đây là Quản trị viên hoạt động cuối cùng.</p>}{user.role === "department_head" && nextRole !== "department_head" && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Cần đổi người phụ trách trước nếu tài khoản đang quản lý Bộ môn.</p>}<div className="mt-6 flex justify-end gap-3"><button disabled={busy} onClick={close} className="px-4 py-2 text-sm font-semibold text-slate-600">Hủy</button><button disabled={busy} onClick={confirm} className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang cập nhật..." : "Xác nhận đổi vai trò"}</button></div></div></div>;
}

function ToggleStatusDialog({ user, busy, close, confirm }: { user: ManagedUser; busy: boolean; close: () => void; confirm: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-bold">{user.is_active ? "Xác nhận khóa tài khoản" : "Xác nhận mở khóa"}</h2><p className="mt-3 text-sm text-slate-600">{user.is_active ? <>Tài khoản <strong>@{user.username}</strong> sẽ không thể đăng nhập cho đến khi được mở khóa.</> : <>Cho phép tài khoản <strong>@{user.username}</strong> đăng nhập trở lại?</>}</p>{user.is_active && user.role === "admin" && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Hệ thống sẽ từ chối nếu đây là Quản trị viên hoạt động cuối cùng.</p>}<div className="mt-6 flex justify-end gap-3"><button disabled={busy} onClick={close} className="px-4 py-2 text-sm font-semibold text-slate-600">Hủy</button><button disabled={busy} onClick={confirm} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${user.is_active ? "bg-rose-600" : "bg-emerald-600"}`}>{busy ? "Đang xử lý..." : user.is_active ? "Khóa tài khoản" : "Mở khóa"}</button></div></div></div>;
}

function ResetPasswordDialog({ user, close }: { user: ManagedUser; close: () => void }) {
  const [password, setPassword] = useState("");
  const resetMutation = useMutation({
    mutationFn: () => usersApi.resetPassword(user.id, password),
    onSuccess: (res) => {
      toast.success(res.detail || `Đã đặt lại mật khẩu cho @${user.username}!`);
      close();
    },
    onError: (err: unknown) => {
      const errText = firstError(apiErrorData(err), "password") || "Không thể đặt lại mật khẩu.";
      toast.error(errText);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 animate-scale-in">
        <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5 bg-slate-50/50">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] uppercase text-slate-500">
              Quản trị viên
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Đặt lại mật khẩu</h2>
            <p className="mt-1 text-xs text-slate-500">
              Tài khoản: <strong className="text-slate-800">@{user.username}</strong> (
              {`${user.first_name} ${user.last_name}`.trim() || user.username})
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-950 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-6 space-y-4">
          <label className="block text-sm font-medium text-slate-800">
            Mật khẩu mới
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự..."
              className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>

        <footer className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <button
            type="button"
            onClick={close}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            Hủy
          </button>
          <button
            disabled={resetMutation.isPending || password.length < 8}
            onClick={() => resetMutation.mutate()}
            className="flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-brand-800 transition active:scale-98 disabled:opacity-50"
          >
            {resetMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <span>Xác nhận</span>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Input({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="text-sm font-medium text-slate-800">
      {label}
      <input
        {...props}
        className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
      />
    </label>
  );
}
