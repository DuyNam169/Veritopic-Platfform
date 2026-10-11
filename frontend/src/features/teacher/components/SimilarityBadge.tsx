import React from "react";
import type { WarningLevel } from "../types";

const levelConfig: Record<WarningLevel, { label: string; bg: string; text: string; border: string }> = {
  normal: {
    label: "Bình thường",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-300 dark:border-emerald-800",
  },
  review: {
    label: "Cần xem xét",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-300 dark:border-amber-800",
  },
  high: {
    label: "Tương đồng cao",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-300 dark:border-orange-800",
  },
  duplicate: {
    label: "Trùng tên / Đề tài",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-300 dark:border-rose-800",
  },
};

export const SimilarityBadge: React.FC<{
  percent: number;
  level: WarningLevel;
  className?: string;
}> = ({ percent, level, className = "" }) => {
  const config = levelConfig[level] || levelConfig.normal;

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium shadow-xs ${config.bg} ${config.text} ${config.border} ${className}`}>
      <span className="font-bold">{percent}%</span>
      <span>•</span>
      <span>{config.label}</span>
    </div>
  );
};
