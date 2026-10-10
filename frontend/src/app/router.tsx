import { createBrowserRouter } from "react-router-dom";

import AppLayout from "@/shared/components/AppLayout";
import PrivateRoute from "@/shared/components/PrivateRoute";
import RoleGuard from "@/shared/components/RoleGuard";
import HomeRedirect from "@/shared/components/HomeRedirect";

import LoginPage from "@/features/auth/LoginPage";
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/features/auth/pages/ResetPasswordPage";
import ProfilePage from "@/features/auth/pages/ProfilePage";

import AcademicsPage from "@/features/academics/pages/AcademicsPage";
import UserManagementPage from "@/features/accounts/pages/UserManagementPage";
import ApprovalPage from "@/features/approval/pages/ApprovalPage";
import StatisticsPage from "@/features/statistics/pages/StatisticsPage";
import TopicDetailPage from "@/features/topics/pages/TopicDetailPage";
import TopicListPage from "@/features/topics/pages/TopicListPage";

// Teacher pages
import { TeacherDashboardPage } from "@/features/teacher/pages/TeacherDashboardPage";
import { ProposeTopicPage } from "@/features/teacher/pages/ProposeTopicPage";
import { MyTopicsPage } from "@/features/teacher/pages/MyTopicsPage";
import { EditResubmitPage } from "@/features/teacher/pages/EditResubmitPage";
import { MyStudentsPage } from "@/features/teacher/pages/MyStudentsPage";
import { ProgressListPage } from "@/features/teacher/pages/ProgressListPage";
import { ProgressDetailPage } from "@/features/teacher/pages/ProgressDetailPage";

/**
 * Route quản lý riêng (Duyệt đề tài, Danh mục hệ thống) được tách nhóm bằng RoleGuard,
 * khớp với route /api/v1/management/ ở Backend — chỉ admin/department_head vào được /approval,
 * chỉ admin vào được /academics.
 */
export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: <PrivateRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <HomeRedirect /> },
          { path: "/topics", element: <TopicListPage /> },
          { path: "/topics/:id", element: <TopicDetailPage /> },
          { path: "/profile", element: <ProfilePage /> },
          {
            element: <RoleGuard allow={["admin", "department_head"]} />,
            children: [{ path: "/approval", element: <ApprovalPage /> }],
          },
          {
            element: <RoleGuard allow={["admin"]} />,
            children: [
              { path: "/academics", element: <AcademicsPage /> },
              { path: "/statistics", element: <StatisticsPage /> },
            ],
          },
          {
            element: <RoleGuard allow={["admin"]} />,
            children: [{ path: "/users", element: <UserManagementPage /> }],
          },
          // ---- Teacher-only routes ----
          {
            element: <RoleGuard allow={["teacher"]} />,
            children: [
              { path: "/teacher", element: <TeacherDashboardPage /> },
              { path: "/teacher/propose", element: <ProposeTopicPage /> },
              { path: "/teacher/topics", element: <MyTopicsPage /> },
              { path: "/teacher/topics/:id/edit", element: <EditResubmitPage /> },
              { path: "/teacher/students", element: <MyStudentsPage /> },
              { path: "/teacher/progress", element: <ProgressListPage /> },
              { path: "/teacher/progress/:assignmentId", element: <ProgressDetailPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
