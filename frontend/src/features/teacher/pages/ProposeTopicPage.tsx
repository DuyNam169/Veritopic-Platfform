import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { teacherApi } from "../api";
import { api } from "@/shared/lib/axios";
import { useAuthStore } from "@/features/auth/store";
import { topicResourcesApi, type SimilarityCheckResult } from "@/features/topics/resourcesApi";
import { SimilarityBadge } from "../components/SimilarityBadge";

export const ProposeTopicPage: React.FC = () => {
  const navigate = useNavigate();

  // Academic categories
  const [departments, setDepartments] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);

  // Form State
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

  // AI Similarity Check state
  const [similarityResults, setSimilarityResults] = useState<SimilarityCheckResult[]>([]);
  const [isCheckingSimilarity, setIsCheckingSimilarity] = useState(false);
  const [exactDuplicate, setExactDuplicate] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [comparingItem, setComparingItem] = useState<SimilarityCheckResult | null>(null);

  // Submit
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const user = useAuthStore(s => s.user);

  useEffect(() => {
    Promise.all([
      api.get("/academics/departments/").then((r) => r.data),
      api.get("/academics/fields/").then((r) => r.data),
      api.get("/academics/cohorts/").then((r) => r.data),
      api.get("/academics/academic-years/").then((r) => r.data),
      api.get("/academics/semesters/").then((r) => r.data),
    ]).then(([d, f, c, a, s]) => {
      const depList = d.results || d || [];
      const fieldList = f.results || f || [];
      const cohortList = c.results || c || [];
      const ayList = a.results || a || [];
      const semList = s.results || s || [];

      setDepartments(depList);
      setFields(fieldList);
      setCohorts(cohortList);
      setAcademicYears(ayList);
      setSemesters(semList);

      if (depList.length > 0) setDepartmentId(user?.department ?? depList[0].id);
      if (cohortList.length > 0) setCohortId(cohortList[0].id);
      if (ayList.length > 0) setAcademicYearId(ayList[0].id);
      if (semList.length > 0) setSemesterId(semList[0].id);
    }).catch(() => {
      setErrorMsg("Không thể tải danh mục đào tạo.");
    });
  }, []);

  useEffect(() => {
    const available = semesters.filter(s => s.academic_year === academicYearId);
    if (!available.some(s => s.id === semesterId)) setSemesterId(available[0]?.id ?? "");
  }, [academicYearId, semesters, semesterId]);

  // Reset kết quả khi tiêu đề thay đổi
  useEffect(() => {
    setHasChecked(false);
    setSimilarityResults([]);
    setExactDuplicate(false);
  }, [title]);

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

  /** Gọi API AI kiểm tra tương đồng thật (cùng pipeline với khi tạo đề tài chính thức) */
  const handleCheckSimilarity = async () => {
    if (!title.trim()) {
      setErrorMsg("Vui lòng nhập tên đề tài trước khi kiểm tra tương đồng.");
      return;
    }
    try {
      setIsCheckingSimilarity(true);
      setErrorMsg("");
      const res = await topicResourcesApi.checkSimilarity({
        title: title.trim(),
        description: description.trim() || undefined,
        top_k: 10,
      });
      setSimilarityResults(res.results);
      // Phát hiện trùng tên chính xác nếu có kết quả 100%
      setExactDuplicate(
        res.results.some(r => r.warning_level === "duplicate" || r.percent >= 100)
      );
      setHasChecked(true);
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail ||
        "Không thể kiểm tra tương đồng. Dịch vụ AI có thể đang khởi động, vui lòng thử lại."
      );
    } finally {
      setIsCheckingSimilarity(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!title.trim()) missing.push("Tên đề tài");
    if (!departmentId) missing.push("Bộ môn");
    if (!cohortId) missing.push("Khóa sinh viên");
    if (!academicYearId) missing.push("Năm học");
    if (!semesterId) missing.push("Học kỳ");

    if (missing.length > 0) {
      setErrorMsg(`Vui lòng điền/chọn đầy đủ các trường: ${missing.join(", ")}`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");
      await teacherApi.proposeTopic({
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
      alert("Đề xuất đã được gửi thành công, đang chờ phê duyệt");
      navigate("/teacher/topics");
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail ||
          err.response?.data?.title?.[0] ||
          "Gửi đề xuất thất bại. Lỗi kết nối hoặc thông tin chưa hợp lệ. Vui lòng kiểm tra lại."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Label màu cảnh báo */
  const warningMeta: Record<string, { label: string; cls: string }> = {
    duplicate: { label: "Trùng tên", cls: "bg-rose-50 text-rose-700 border border-rose-200" },
    high:      { label: "Tương đồng cao", cls: "bg-orange-50 text-orange-700 border border-orange-200" },
    review:    { label: "Cần xem xét", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
    normal:    { label: "Bình thường", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="text-[11px] font-black tracking-widest text-[#006A60] uppercase mb-1">
          TẠO MỚI ĐỀ TÀI
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Đề xuất Đề tài Đồ án</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Nhập thông tin chi tiết đề tài và chạy kiểm tra tương đồng AI trước khi gửi lên Trưởng bộ môn.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Thông tin đề tài ── */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3">Thông tin Đề tài</h3>

          {/* Tên đề tài */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tên Đề tài <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Nhập tiêu đề đề tài đồ án (1 - 500 ký tự)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
              required
            />
          </div>

          {/* Mô tả */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Mô tả Đề tài</label>
            <textarea
              rows={4}
              placeholder="Tóm tắt mục tiêu, phạm vi và công nghệ dự kiến sử dụng..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
            />
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Từ khóa (Keywords)</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Ví dụ: React, Django, Blockchain (Nhấn Thêm)"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                className="flex-1 rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
              />
              <button type="button" onClick={addKeyword} className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                Thêm
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[#E6F4F1] px-3 py-1 text-xs font-semibold text-[#006A60]">
                  #{tag}
                  <button type="button" onClick={() => removeKeyword(tag)} className="text-[#006A60]/60 hover:text-[#006A60] font-bold">✕</button>
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Số sinh viên tối đa</label>
              <input
                type="number" min="1" max="5" value={maxStudents}
                onChange={(e) => setMaxStudents(parseInt(e.target.value) || 1)}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Yêu cầu thực hiện</label>
              <input
                type="text" placeholder="Ví dụ: Thành thạo Python, SQL..." value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ── Danh mục đào tạo ── */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3">Danh mục Đào tạo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Bộ môn *</label>
              <select value={departmentId} onChange={(e) => setDepartmentId(Number(e.target.value))}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none" required>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Lĩnh vực chuyên sâu</label>
              <select value={fieldId} onChange={(e) => setFieldId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none">
                <option value="">-- Không chọn --</option>
                {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Khóa sinh viên *</label>
              <select value={cohortId} onChange={(e) => setCohortId(Number(e.target.value))}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none" required>
                {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Năm học *</label>
              <select value={academicYearId} onChange={(e) => setAcademicYearId(Number(e.target.value))}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none" required>
                {academicYears.map((ay) => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Học kỳ *</label>
              <select value={semesterId} onChange={(e) => setSemesterId(Number(e.target.value))}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none" required>
                {semesters.filter(s => s.academic_year === academicYearId).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Kiểm tra tương đồng AI ── */}
        <div className="rounded-2xl border border-[#006A60]/20 bg-[#F0FAF8] p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-[#006A60] text-sm flex items-center gap-2">
                🤖 Kiểm tra Tương đồng AI
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sử dụng PhoBERT để so sánh ngữ nghĩa với toàn bộ ngân hàng đề tài trước khi gửi.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCheckSimilarity}
              disabled={isCheckingSimilarity || !title.trim()}
              className="rounded-full border border-[#006A60] bg-[#006A60] px-5 py-2 text-xs font-bold text-white hover:bg-[#00524a] disabled:opacity-40 transition-colors flex items-center gap-2"
            >
              {isCheckingSimilarity
                ? <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> Đang phân tích AI...</>
                : "🔍 Chạy Kiểm Tra Tương Đồng AI"}
            </button>
          </div>

          {/* Kết quả */}
          {isCheckingSimilarity && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#006A60] border-t-transparent" />
              <p className="mt-2 text-xs text-slate-500 font-medium">Đang phân tích ngữ nghĩa bằng PhoBERT...</p>
            </div>
          )}

          {!isCheckingSimilarity && hasChecked && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
                <span className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  Kết quả so sánh trùng lặp / tương đồng
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                    {similarityResults.length} kết quả
                  </span>
                </span>
                {exactDuplicate && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
                    ⚠️ Phát hiện trùng tên!
                  </span>
                )}
              </div>

              {/* Cảnh báo trùng tên */}
              {exactDuplicate && (
                <div className="px-5 py-3 bg-rose-50 border-b border-rose-100 text-xs text-rose-800">
                  Tên đề tài bạn nhập đã <strong>trùng 100%</strong> với đề tài trong hệ thống. Vui lòng đổi tên trước khi gửi.
                </div>
              )}

              {/* Danh sách kết quả */}
              {similarityResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  ✅ Không tìm thấy đề tài nào tương đồng đáng kể. Đề tài của bạn có vẻ rất mới lạ!
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {similarityResults.map((r, idx) => {
                    const meta = warningMeta[r.warning_level] ?? warningMeta.normal;
                    return (
                      <div key={r.topic_id ?? idx} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-semibold text-slate-900 line-clamp-2">{r.title}</h4>
                            <span className={`shrink-0 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${meta.cls}`}>
                              {meta.label}
                            </span>
                          </div>
                          {r.description && (
                            <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{r.description}</p>
                          )}
                          {r.groq_explanation && r.assessment_status === "completed" && (
                            <p className="mt-1 text-xs text-indigo-700 bg-indigo-50 rounded-lg px-2 py-1 line-clamp-2">
                              🤖 {r.groq_explanation}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <SimilarityBadge percent={r.percent} level={r.warning_level} />
                          <button
                            type="button"
                            onClick={() => setComparingItem(r)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            So sánh
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!isCheckingSimilarity && !hasChecked && (
            <p className="text-xs text-slate-400 text-center py-2">
              Nhập tên đề tài rồi bấm <strong>Chạy Kiểm Tra Tương Đồng AI</strong> để phát hiện đề tài tương tự trước khi gửi.
            </p>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/60">
          <button
            type="button"
            onClick={() => navigate("/teacher/topics")}
            className="rounded-full border border-slate-200 px-6 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-[#006A60] px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#00524a] disabled:opacity-50"
          >
            {isSubmitting ? "Đang gửi..." : "Gửi Đề Xuất Đề Tài"}
          </button>
        </div>
      </form>

      {/* Modal So sánh song song */}
      {comparingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">So sánh đối chiếu song song</h3>
              <button onClick={() => setComparingItem(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[#006A60]/30 bg-[#F0FAF8] p-4 space-y-2">
                <span className="text-xs font-bold text-[#006A60] uppercase tracking-wider">Đề tài bạn đang soạn</span>
                <h4 className="font-semibold text-slate-900 text-sm">{title || "Chưa có tên"}</h4>
                <p className="text-xs text-slate-600 whitespace-pre-wrap">{description || "Chưa có mô tả"}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Đề tài trong ngân hàng</span>
                <h4 className="font-semibold text-slate-900 text-sm">{comparingItem.title}</h4>
                <p className="text-xs text-slate-600 whitespace-pre-wrap">{comparingItem.description || "Chưa có mô tả"}</p>
                {comparingItem.groq_explanation && comparingItem.assessment_status === "completed" && (
                  <div className="mt-2 rounded-lg bg-indigo-50 border border-indigo-100 p-3">
                    <p className="text-xs font-semibold text-indigo-700 mb-1">🤖 Nhận xét AI:</p>
                    <p className="text-xs text-indigo-800">{comparingItem.groq_explanation}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => setComparingItem(null)} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800">
                Đóng đối chiếu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
