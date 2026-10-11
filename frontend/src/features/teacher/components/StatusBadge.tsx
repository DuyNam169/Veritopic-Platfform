import React from "react";
import type { TopicStatus } from "../types";

const statusConfig: Record<TopicStatus, { label: string; bg: string; text: string; border: string }> = {
  pending: {
    label: "Chờ phê duyệt",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
  },
  approved: {
    label: "Đã phê duyệt",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  rejected: {
    label: "Từ chối",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-800",
  },
  rename_requested: {
    label: "Yêu cầu sửa",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-400",
    border: "border-indigo-200 dark:border-indigo-800",
  },
};

export const StatusBadge: React.FC<{ status: TopicStatus; className?: string }> = ({ status, className = "" }) => {
  const config = statusConfig[status] || {
    label: status,
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-xs transition-colors ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full fill-current" />
      {config.label}
    </span>
  );
};
