import { Link } from "react-router-dom";

import type { Topic } from "../types";

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  rename_requested: "Yêu cầu sửa tên",
};

export default function TopicTable({ topics }: { topics: Topic[] }) {
  return (
    <table className="w-full border-collapse overflow-hidden rounded-lg bg-white text-sm shadow">
      <thead className="bg-slate-100 text-left">
        <tr>
          <th className="p-3">Tên đề tài</th>
          <th className="p-3">Trạng thái</th>
          <th className="p-3">Ngày tạo</th>
        </tr>
      </thead>
      <tbody>
        {topics.map((t) => (
          <tr key={t.id} className="border-t hover:bg-slate-50">
            <td className="p-3">
              <Link to={`/topics/${t.id}`} className="text-slate-900 hover:underline">
                {t.title}
              </Link>
            </td>
            <td className="p-3">{STATUS_LABEL[t.status]}</td>
            <td className="p-3">{new Date(t.created_at).toLocaleDateString("vi-VN")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
