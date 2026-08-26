import { useState } from "react";

import { useTopics } from "../hooks";
import TopicTable from "../components/TopicTable";

export default function TopicListPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useTopics({ search });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Danh mục đề tài</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên, từ khóa..."
          className="rounded-md border px-3 py-2 text-sm"
        />
      </div>
      {isLoading ? <p>Đang tải...</p> : <TopicTable topics={data?.results ?? []} />}
    </div>
  );
}
