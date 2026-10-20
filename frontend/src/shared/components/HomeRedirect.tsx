import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store";
import ProjectsPage from "@/features/progress/ProjectsPage";
import AdminOverviewPage from "@/features/statistics/pages/AdminOverviewPage";
import { StudentDashboardPage } from "@/features/student/pages/StudentDashboardPage";

export default function HomeRedirect() {
  const role = useAuthStore((s) => s.user?.role);

  if (role === "teacher") {
    return <Navigate to="/teacher" replace />;
  }
  if (role === "student") {
    return <StudentDashboardPage />;
  }
  if (role === "admin") return <AdminOverviewPage />;
  if (role === "department_head") {
    return <ProjectsPage overview />;
  }

  return <StudentDashboardPage />;
}
