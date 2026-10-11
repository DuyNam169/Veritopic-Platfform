import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { teacherApi } from "../api";
import { SimilarityPanel } from "../components/SimilarityPanel";
import type { SimilarTopicResult, Topic } from "../types";
import { parseKeywords } from "@/shared/lib/keywords";

export const EditResubmitPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [topic, setTopic] = useState<Topic | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [maxStudents, setMaxStudents] = useState<number>(1);
  const [requirements, setRequirements] = useState("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [fieldId, setFieldId] = useState<number | "">("");
  const [cohortId, setCohortId] = useState<number | "">("");
  const [academicYearId, setAcademicYearId] = useState<number | "">("");
  const [semesterId, setSemesterId] = useState<number | "">("");

  const [similarityResults, setSimilarityResults] = useState<SimilarTopicResult[]>([]);
  const [isCheckingSimilarity, setIsCheckingSimilarity] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!id) return;
    teacherApi.getTopicDetail(Number(id)).then((t) => {
      setTopic(t);
      setTitle(t.title);
      setDescription(t.description || "");
      setKeywords(parseKeywords(t.keywords));
      setMaxStudents(t.max_students || 1);
      setRequirements(t.requirements || "");
      setDepartmentId(t.department);
      setFieldId(t.field || "");
      setCohortId(t.cohort);
      setAcademicYearId(t.academic_year);
      setSemesterId(t.semester);
    });
  }, [id]);

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setKeywordInput("");
    }
  };

  const removeKeyword = (tag: string) => {
    setKeywords(keywords.filter((k) => k !== tag));
  };

  const handleCheckSimilarity = async () => {
    try {
      setIsCheckingSimilarity(true);
      const res = await teacherApi.checkSimilarityDraft({ title, description, keywords });
      setSimilarityResults(res);
    } finally {
      setIsCheckingSimilarity(false);
    }
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !topic) return;

    try {
      setIsSubmitting(true);
      setErrorMsg("");
      await teacherApi.resubmitTopic(Number(id), {
        title,
        description,
        keywords,
        max_students: maxStudents,
        requirements,
        department: Number(departmentId),
        field: fieldId ? Number(fieldId) : null,
        cohort: Number(cohortId),
        academic_year: Number(academicYearId),
        semester: Number(semesterId),
      });
      alert("Đã gửi lại đề tài, đang chờ phê duyệt");
      navigate("/teacher/topics");
    } catch (err: any) {
      if (err.response?.status === 409) {
        setErrorMsg("Đề tài không ở trạng thái Yêu cầu sửa. Vui lòng tải lại trang để xem trạng thái mới nhất.");
      } else {
        setErrorMsg(err.response?.data?.detail || "Nộp lại đề tài thất bại. Kiểm tra lại dữ liệu.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!topic) {
    return <div className="p-8 text-center text-xs text-slate-400">Đang tải thông tin đề tài...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Chỉnh sửa & Nộp lại Đề tài</h1>
        <p className="text-sm text-slate-500">Mã đề tài #{topic.id}</p>
      </div>

      {/* Review note banner */}
      {topic.review_note && (
        <div className="rounded-xl border border-indigo-300 bg-indigo-50 p-5 shadow-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-indigo-900">
            <span>📝 Ý kiến / Yêu cầu sửa từ Trưởng bộ môn</span>
          </div>
          <p className="text-xs text-indigo-800 leading-relaxed font-medium bg-white/80 p-3 rounded-lg border border-indigo-200">
            {topic.review_note}
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleResubmit} className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm border-b pb-2">Chỉnh sửa thông tin</h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tên Đề tài *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả Đề tài</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Từ khóa</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none"
              />
              <button
                type="button"
                onClick={addKeyword}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Thêm
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 border border-indigo-200">
                  {tag}
                  <button type="button" onClick={() => removeKeyword(tag)} className="text-indigo-400 hover:text-indigo-700 font-bold">
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleCheckSimilarity}
            disabled={isCheckingSimilarity}
            className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
          >
            {isCheckingSimilarity ? "Đang kiểm tra AI..." : "🔍 Kiểm tra Tương đồng Tiêu đề Mới"}
          </button>

          <SimilarityPanel
            results={similarityResults}
            isLoading={isCheckingSimilarity}
            currentDraft={{ title, description }}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate("/teacher/topics")}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting ? "Đang gửi lại..." : "Xác nhận Nộp Lại Đề Tài"}
          </button>
        </div>
      </form>
    </div>
  );
};
