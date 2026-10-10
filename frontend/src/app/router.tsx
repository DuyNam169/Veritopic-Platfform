import { createBrowserRouter } from "react-router-dom";

import AppLayout from "@/shared/components/AppLayout";
import PrivateRoute from "@/shared/components/PrivateRoute";
import RoleGuard from "@/shared/components/RoleGuard";

import LoginPage from "@/features/auth/LoginPage";
import AcademicsPage from "@/features/academics/pages/AcademicsPage";
import UserManagementPage from "@/features/accounts/pages/UserManagementPage";
import ApprovalPage from "@/features/approval/pages/ApprovalPage";
import StatisticsPage from "@/features/statistics/pages/StatisticsPage";
import TopicDetailPage from "@/features/topics/pages/TopicDetailPage";
import TopicListPage from "@/features/topics/pages/TopicListPage";
import ProfilePage from "@/features/auth/pages/ProfilePage";
import PeopleDirectoryPage from "@/features/people/pages/PeopleDirectoryPage";
import SimilarityCheckPage from "@/features/topics/pages/SimilarityCheckPage";
import TechnologiesPage from "@/features/academics/pages/TechnologiesPage";

/**
 * Route quản lý riêng (Duyệt đề tài, Danh mục hệ thống) được tách nhóm bằng RoleGuard,
 * khớp với route /api/v1/management/ ở Backend — chỉ admin/department_head vào được /approval,
 * chỉ admin vào được /academics.
 */
export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <PrivateRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <TopicListPage /> },
          { path: "/topics", element: <TopicListPage /> },
          { path: "/topics/:id", element: <TopicDetailPage /> },
          {
            element: <RoleGuard allow={["admin", "department_head", "teacher"]} />,
            children: [{ path: "/topics/similarity", element: <SimilarityCheckPage /> }],
          },
          { path: "/profile", element: <ProfilePage /> },
          {
            element: <RoleGuard allow={["admin", "department_head"]} />,
            children: [
              { path: "/approval", element: <ApprovalPage /> },
              { path: "/people", element: <PeopleDirectoryPage /> },
            ],
          },
          {
            element: <RoleGuard allow={["admin"]} />,
            children: [
              { path: "/academics", element: <AcademicsPage /> },
              { path: "/technologies", element: <TechnologiesPage /> },
              { path: "/statistics", element: <StatisticsPage /> },
            ],
          },
          {
            element: <RoleGuard allow={["admin"]} />,
            children: [{ path: "/users", element: <UserManagementPage /> }],
          },
        ],
      },
    ],
  },
]);
