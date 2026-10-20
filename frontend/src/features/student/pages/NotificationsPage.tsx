import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { studentApi } from "../api";
import type { NotificationItem } from "../types";
import {
  Bell,
  CheckCircle,
  UserCheck,
  BookOpen,
  GraduationCap,
} from "@/shared/components/icons";

export const NotificationsPage: React.FC = () => {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const notificationsQuery = useQuery({
    queryKey: ["notifications-full"],
    queryFn: studentApi.getNotifications,
  });

  const markReadMutation = useMutation({
    mutationFn: studentApi.markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications-full"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: studentApi.markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications-full"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const allItems = notificationsQuery.data ?? [];
  const items = filter === "unread" ? allItems.filter((n) => !n.is_read) : allItems;
  const unreadCount = allItems.filter((n) => !n.is_read).length;

  const handleClick = (item: NotificationItem) => {
    if (!item.is_read) {
      markReadMutation.mutate(item.id);
    }
    if (item.link) {
      navigate(item.link);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "advisor_request":
      case "advisor_response":
        return <UserCheck className="w-5 h-5 text-[#006A60]" />;
      case "topic_proposal":
      case "topic_proposal_response":
        return <BookOpen className="w-5 h-5 text-indigo-600" />;
      case "topic_registration":
      case "topic_registration_response":
        return <GraduationCap className="w-5 h-5 text-amber-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="text-[11px] font-black tracking-widest text-[#006A60] uppercase mb-1 block">
            HỘP THƯ HỆ THỐNG
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Trung tâm Thông báo</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Lịch sử toàn bộ thông báo gửi tới bạn về phân công đồ án, phản hồi của giảng viên và cập nhật hệ thống.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs self-start"
          >
            Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      <div className="flex border-b border-slate-200 gap-4 text-xs font-semibold">
        <button
          onClick={() => setFilter("all")}
          className={`pb-3 px-2 border-b-2 transition ${
            filter === "all"
              ? "border-[#006A60] text-[#006A60]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Tất cả thông báo ({allItems.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`pb-3 px-2 border-b-2 transition ${
            filter === "unread"
              ? "border-[#006A60] text-[#006A60]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Chưa đọc ({unreadCount})
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs divide-y divide-slate-100 overflow-hidden">
        {notificationsQuery.isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Đang tải thông báo...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">Không có thông báo nào.</div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              className={`p-4 flex items-start gap-4 cursor-pointer hover:bg-slate-50/70 transition ${
                !n.is_read ? "bg-teal-50/20" : ""
              }`}
            >
              <div className="p-2.5 rounded-xl bg-slate-100 shrink-0 mt-0.5">{getIcon(n.notification_type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`text-xs sm:text-sm ${!n.is_read ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
                    {n.title}
                  </h3>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(n.created_at).toLocaleString("vi-VN")}
                    </span>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#006A60]" />}
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                {n.link && (
                  <span className="inline-block text-[11px] font-semibold text-[#006A60] hover:underline mt-2">
                    Đi tới liên kết →
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
