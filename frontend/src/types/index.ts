export type Role = "admin" | "department_head" | "teacher" | "student";

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
  role: Role;
  department: number | null;
  cohort: number | null;
  student_code: string;
  phone_number?: string;
  created_at?: string;
  last_login?: string | null;
}
