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
  department_name?: string | null;
  cohort: number | null;
  cohort_name?: string | null;
  student_code: string;
  class_name?: string;
  academic_degree?: string;
  specialization?: string;
  phone_number?: string;
  created_at?: string;
  last_login?: string | null;
}
