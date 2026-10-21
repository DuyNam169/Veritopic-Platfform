import StudentClassSelect from "@/features/academics/components/StudentClassSelect";
import { useEffect, useState, type FormEvent } from "react";

import type { ManagedUser } from "@/features/accounts/api";
import type { CohortOption, DepartmentOption } from "@/features/accounts/api";
import { X } from "@/shared/components/icons";
import { Button, fieldClass } from "@/shared/components/ui";
import type { PeopleProfilePayload } from "../api";

interface Props {
  role: "teacher" | "student";
  person: ManagedUser | null;
  departments: DepartmentOption[];
  cohorts: CohortOption[];
  busy: boolean;
  onClose: () => void;
  onSave: (payload: PeopleProfilePayload) => void;
}

interface FormState {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  department: string;
  cohort: string;
  student_code: string;
  student_class: number | null;
}

const emptyForm: FormState = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  phone_number: "",
  department: "",
  cohort: "",
  student_code: "",
  student_class: null,
};

export default function PeopleProfileDialog({
  role,
  person,
  departments,
  cohorts,
  busy,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    setForm(person ? {
      username: person.username,
      email: person.email ?? "",
      first_name: person.first_name,
      last_name: person.last_name,
      phone_number: person.phone_number ?? "",
      department: person.department?.toString() ?? "",
      cohort: person.cohort?.toString() ?? "",
      student_code: person.student_code ?? "",
      student_class: person.student_class ?? null,
    } : emptyForm);
  }, [person]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      ...form,
      role,
      student_class: role === "student" ? form.student_class : null,
      department: role === "teacher"
        ? form.department ? Number(form.department) : null
        : form.department ? Number(form.department) : null,
      cohort: role === "student"
        ? form.cohort ? Number(form.cohort) : null
        : person?.cohort ?? null,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="people-dialog-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-brand-700">
              {role === "teacher" ? "Giảng viên" : "Sinh viên"}
            </p>
            <h2 id="people-dialog-title" className="mt-1 text-xl font-bold text-slate-950">
              {person ? "Sửa hồ sơ" : "Thêm hồ sơ"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Hồ sơ không tạo mật khẩu và không cấp quyền đăng nhập.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên đăng nhập / mã hồ sơ" required value={form.username} onChange={(value) => update("username", value)} />
            {role === "student" && <Field label="Mã sinh viên" value={form.student_code} onChange={(value) => update("student_code", value)} />}
            {role === "student" && <StudentClassSelect value={form.student_class} department={form.department ? Number(form.department) : null} cohort={form.cohort ? Number(form.cohort) : null} onChange={(item) => setForm({ ...form, student_class: item?.id ?? null, ...(item?.cohort ? { cohort: String(item.cohort) } : {}), ...(item?.department ? { department: String(item.department) } : {}) })} />}
            <Field label="Họ" value={form.first_name} onChange={(value) => update("first_name", value)} />
            <Field label="Tên" value={form.last_name} onChange={(value) => update("last_name", value)} />
            <Field label="Email" type="email" value={form.email} onChange={(value) => update("email", value)} />
            <Field label="Số điện thoại" value={form.phone_number} onChange={(value) => update("phone_number", value)} />
            {role === "teacher" ? (
              <label className="text-sm font-medium text-slate-700">
                Bộ môn
                <select value={form.department} onChange={(event) => update("department", event.target.value)} className={fieldClass}>
                  <option value="">Chưa gán bộ môn</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </label>
            ) : (
              <label className="text-sm font-medium text-slate-700">
                Khóa học
                <select value={form.cohort} onChange={(event) => update("cohort", event.target.value)} className={fieldClass}>
                  <option value="">Chưa gán khóa học</option>
                  {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" onClick={onClose} disabled={busy}>Hủy</Button>
            <Button type="submit" variant="primary" busy={busy}>
              {person ? "Lưu thay đổi" : "Tạo hồ sơ"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  maxLength?: number;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        maxLength={maxLength}
        className={fieldClass}
      />
    </label>
  );
}
