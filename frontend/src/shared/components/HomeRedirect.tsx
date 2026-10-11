import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store";
import TopicListPage from "@/features/topics/pages/TopicListPage";

export default function HomeRedirect() {
  const role = useAuthStore((s) => s.user?.role);

  if (role === "teacher") {
    return <Navigate to="/teacher" replace />;
  }
  if (role === "department_head" || role === "admin") {
    return <Navigate to="/approval" replace />;
  }

  return <TopicListPage />;
}
