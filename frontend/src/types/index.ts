export type Role = "admin" | "department_head" | "teacher" | "student";

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  department: number | null;
  student_code: string;
}
