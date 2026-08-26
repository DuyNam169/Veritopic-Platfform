import { useParams } from "react-router-dom";

import { useSimilarityCheck, useTopicDetail } from "../hooks";
import SimilarityWarning from "../components/SimilarityWarning";

export default function TopicDetailPage() {
  const { id } = useParams();
  const topicId = Number(id);
  const { data: topic } = useTopicDetail(topicId);
  const { data: similarResults } = useSimilarityCheck(topicId);

  if (!topic) return <p>Đang tải...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{topic.title}</h2>
        <p className="mt-2 text-slate-600">{topic.description}</p>
      </div>
      <div>
        <h3 className="mb-2 font-medium">Đề tài tương đồng</h3>
        <SimilarityWarning results={similarResults ?? []} />
      </div>
    </div>
  );
}
