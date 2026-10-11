import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { teacherApi } from "../api";
import { SimilarityPanel } from "../components/SimilarityPanel";
import type { SimilarTopicResult } from "../types";
import { api } from "@/shared/lib/axios";

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

  // Check state
  const [titleCheckResult, setTitleCheckResult] = useState<{ exact_duplicate?: boolean } | null>(null);
  const [isCheckingTitle, setIsCheckingTitle] = useState(false);
  const [similarityResults, setSimilarityResults] = useState<SimilarTopicResult[]>([]);
  const [isCheckingSimilarity, setIsCheckingSimilarity] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const DRAFT_KEY = "veritopic_propose_draft";

  // Khôi phục bản nháp từ localStorage nếu có
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.keywords) setKeywords(parsed.keywords);
        if (parsed.requirements) setRequirements(parsed.requirements);
      } catch (e) {
        console.error("Lỗi đọc bản nháp", e);
      }
    }
  }, []);

  // Tự động lưu nháp cục bộ khi nhập thông tin
  useEffect(() => {
    if (title || description || keywords.length > 0 || requirements) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, description, keywords, requirements }));
    }
  }, [title, description, keywords, requirements]);

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

      if (depList.length > 0) setDepartmentId(depList[0].id);
      if (cohortList.length > 0) setCohortId(cohortList[0].id);
      if (ayList.length > 0) setAcademicYearId(ayList[0].id);
      if (semList.length > 0) setSemesterId(semList[0].id);
    }).catch(() => {
      setErrorMsg("Không thể tải danh mục đào tạo.");
    });
  }, []);

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

  const handleCheckTitle = async () => {
    if (!title.trim()) return;
    try {
      setIsCheckingTitle(true);
      const res = await teacherApi.checkTitle(title);
      setTitleCheckResult(res);
    } catch {
      setErrorMsg("Không thể kiểm tra trùng tên.");
    } finally {
      setIsCheckingTitle(false);
    }
  };

  const handleCheckSimilarity = async () => {
    if (!title.trim()) {
      setErrorMsg("Vui lòng nhập tên đề tài trước khi kiểm tra tương đồng.");
      return;
    }
    try {
      setIsCheckingSimilarity(true);
      setErrorMsg("");
      const res = await teacherApi.checkSimilarityDraft({
        title,
        description,
        keywords,
      });
      setSimilarityResults(res);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Không thể kiểm tra tương đồng. Thử lại sau.");
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
      localStorage.removeItem(DRAFT_KEY);
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
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3">Thông tin Đề tài</h3>

          {/* Title input with Check Title button */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tên Đề tài <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nhập tiêu đề đề tài đồ án (1 - 500 ký tự)"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleCheckResult(null);
                }}
                className="flex-1 rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={handleCheckTitle}
                disabled={isCheckingTitle || !title.trim()}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {isCheckingTitle ? "Đang kiểm tra..." : "Kiểm tra trùng tên"}
              </button>
            </div>
            {titleCheckResult && (
              <p className={`mt-1.5 text-xs font-semibold ${titleCheckResult.exact_duplicate ? "text-rose-600" : "text-emerald-600"}`}>
                {titleCheckResult.exact_duplicate ? "⚠️ Phát hiện trùng tên chính xác với đề tài khác!" : "✓ Tiêu đề chưa bị trùng lặp chính xác."}
              </p>
            )}
          </div>

          {/* Description */}
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

          {/* Keywords Tag Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Từ khóa (Keywords)</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Ví dụ: React, Django, Blockchain (Nhấn Thêm)"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                className="flex-1 rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
              />
              <button
                type="button"
                onClick={addKeyword}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Thêm
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[#E6F4F1] px-3 py-1 text-xs font-semibold text-[#006A60]">
                  #{tag}
                  <button type="button" onClick={() => removeKeyword(tag)} className="text-[#006A60]/60 hover:text-[#006A60] font-bold">
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Số sinh viên tối đa</label>
              <input
                type="number"
                min="1"
                max="5"
                value={maxStudents}
                onChange={(e) => setMaxStudents(parseInt(e.target.value) || 1)}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Yêu cầu thực hiện</label>
              <input
                type="text"
                placeholder="Ví dụ: Thành thạo Python, SQL..."
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Academic Selectors */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3">Danh mục Đào tạo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Bộ môn *</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(Number(e.target.value))}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
                required
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Lĩnh vực chuyên sâu</label>
              <select
                value={fieldId}
                onChange={(e) => setFieldId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
              >
                <option value="">-- Không chọn --</option>
                {fields.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Khóa sinh viên *</label>
              <select
                value={cohortId}
                onChange={(e) => setCohortId(Number(e.target.value))}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
                required
              >
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Năm học *</label>
              <select
                value={academicYearId}
                onChange={(e) => setAcademicYearId(Number(e.target.value))}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
                required
              >
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>{ay.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Học kỳ *</label>
              <select
                value={semesterId}
                onChange={(e) => setSemesterId(Number(e.target.value))}
                className="w-full rounded-full border border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-700 focus:bg-white focus:border-[#006A60] focus:outline-none"
                required
              >
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Live Similarity Check Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleCheckSimilarity}
              disabled={isCheckingSimilarity}
              className="rounded-full border border-[#006A60]/30 bg-[#E6F4F1] px-5 py-2 text-xs font-bold text-[#006A60] hover:bg-[#d5eee9] transition-colors"
            >
              {isCheckingSimilarity ? "Đang quét AI..." : "🔍 Chạy Kiểm Tra Tương Đồng AI (Bản Nháp)"}
            </button>
          </div>

          <SimilarityPanel
            results={similarityResults}
            exactDuplicate={titleCheckResult?.exact_duplicate}
            isLoading={isCheckingSimilarity}
            currentDraft={{ title, description }}
          />
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
    </div>
  );
};

