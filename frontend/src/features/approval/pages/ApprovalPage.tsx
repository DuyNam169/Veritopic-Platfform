import { useApproveTopic, usePendingTopics, useRejectTopic } from "../hooks";

/** Trang duyệt đề tài — chỉ Admin/Trưởng bộ môn (chặn ở router.tsx bằng RoleGuard). */
export default function ApprovalPage() {
  const { data: pendingTopics, isLoading } = usePendingTopics();
  const approveMutation = useApproveTopic();
  const rejectMutation = useRejectTopic();

  if (isLoading) return <p>Đang tải...</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Đề tài chờ duyệt</h2>
      {(pendingTopics ?? []).map((topic) => (
        <div key={topic.id} className="flex items-center justify-between rounded-md border bg-white p-4">
          <div>
            <p className="font-medium">{topic.title}</p>
            <p className="text-sm text-slate-500">{topic.description}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => approveMutation.mutate({ id: topic.id })}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
            >
              Duyệt
            </button>
            <button
              onClick={() => rejectMutation.mutate({ id: topic.id })}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
            >
              Từ chối
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
