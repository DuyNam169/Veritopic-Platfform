import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

import { AlertTriangle, BookOpen, Search } from "@/shared/components/icons";
import { Button, ErrorState, PageHeader, Panel, fieldClass } from "@/shared/components/ui";
import { topicResourcesApi, type ExtractedTitle, type SimilarityCheckResult } from "../resourcesApi";

const warningStyles = {
  duplicate: { label: "Có khả năng trùng", className: "border-rose-200 bg-rose-50 text-rose-800" },
  high: { label: "Tương đồng cao", className: "border-orange-200 bg-orange-50 text-orange-800" },
  review: { label: "Cần xem xét", className: "border-amber-200 bg-amber-50 text-amber-800" },
  normal: { label: "Tương đồng thấp", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
};

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<Record<string, unknown>>(error) && error.response?.data) {
    return Object.values(error.response.data)
      .map((value) => Array.isArray(value) ? value.join(" ") : String(value))
      .join(" ");
  }
  return "Không thể kết nối máy chủ. Vui lòng thử lại.";
}

export default function SimilarityCheckPage() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [extracted, setExtracted] = useState<{ candidates: ExtractedTitle[]; preview: string } | null>(null);
  const [results, setResults] = useState<SimilarityCheckResult[] | null>(null);

  async function extract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setExtracting(true);
    setError("");
    try {
      const response = await topicResourcesApi.extractFile(file);
      setExtracted({ candidates: response.title_candidates, preview: response.preview_text });
      if (response.suggested_title) setTitle(response.suggested_title);
      setResults(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExtracting(false);
    }
  }

  async function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setChecking(true);
    setError("");
    try {
      const response = await topicResourcesApi.checkSimilarity({ title: title.trim(), top_k: 10 });
      setResults(response.results);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  }

  return <div className="mx-auto max-w-5xl space-y-6">
    <PageHeader eyebrow="Công cụ AI" title="Kiểm tra tương đồng đề tài" description="Nhập tên đề tài hoặc tải tài liệu PDF/DOCX để trích xuất tiêu đề, sau đó đối chiếu với dữ liệu đề tài hiện có bằng PhoBERT." />
    <Panel>
      <form onSubmit={check} className="space-y-4">
        <label className="block text-sm font-semibold text-slate-700">Tên đề tài cần kiểm tra
          <textarea required rows={3} maxLength={1000} className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nhập tên đề tài..." />
        </label>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary" busy={checking} disabled={!title.trim()}><Search className="h-4 w-4" />Kiểm tra tương đồng</Button>
        </div>
      </form>

      <div className="my-5 border-t border-slate-100" />
      <form onSubmit={extract} className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1 text-sm font-semibold text-slate-700">Trích xuất tiêu đề từ tài liệu
          <input required type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className={fieldClass} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setExtracted(null); }} />
        </label>
        <Button type="submit" busy={extracting} disabled={!file}>Đọc PDF/DOCX</Button>
      </form>
      <p className="mt-2 text-xs text-slate-500">Chỉ nhận PDF/DOCX, tối đa 10 MB. Tiêu đề trích xuất được sẽ điền vào ô phía trên để bạn kiểm tra và chỉnh sửa.</p>
      {error && <div className="mt-4"><ErrorState message={error} /></div>}
    </Panel>

    {extracted && <Panel>
      <h2 className="font-semibold text-slate-900">Tiêu đề gợi ý từ tài liệu</h2>
      {extracted.candidates.length ? <div className="mt-3 flex flex-wrap gap-2">{extracted.candidates.map((candidate, index) => <button key={`${candidate.title}-${index}`} type="button" onClick={() => { setTitle(candidate.title); setResults(null); }} className={`rounded-xl border px-3 py-2 text-left text-sm transition ${title === candidate.title ? "border-brand-400 bg-brand-50 text-brand-800" : "border-slate-200 hover:border-brand-300"}`}><span className="font-medium">{candidate.title}</span><span className="ml-2 text-xs text-slate-500">độ tin cậy {(candidate.confidence * 100).toFixed(0)}%</span></button>)}</div>
        : <p className="mt-3 text-sm text-amber-700">Không nhận diện được tiêu đề tự động; bạn có thể nhập hoặc sửa tên đề tài ở ô phía trên.</p>}
      {extracted.preview && <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-slate-600">Xem nội dung trích xuất (tối đa 5.000 ký tự)</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs text-slate-600">{extracted.preview}</pre></details>}
    </Panel>}

    {results && <Panel>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><BookOpen className="h-5 w-5" /></div>
        <div><h2 className="font-semibold text-slate-900">Kết quả đối chiếu</h2><p className="mt-1 text-sm text-slate-500">{results.length ? `Tìm thấy ${results.length} đề tài gần nhất.` : "Chưa tìm thấy đề tài có embedding để đối chiếu."}</p></div>
      </div>
      {results.length ? <div className="mt-4 space-y-3">{results.map((result) => {
        const style = warningStyles[result.warning_level] ?? warningStyles.normal;
        return <article key={result.topic_id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><Link to={`/topics/${result.topic_id}`} className="font-semibold text-brand-700 hover:underline">{result.title}</Link><div className="mt-2 flex items-center gap-2 text-sm text-slate-600"><AlertTriangle className="h-4 w-4" />Mức tương đồng <strong>{result.percent.toFixed(1)}%</strong></div></div>
          <span className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${style.className}`}>{style.label}</span>
        </article>;
      })}</div> : <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Hãy chạy lệnh lập chỉ mục lại sau khi kết nối PhoBERT nếu đề tài cũ chưa có vector.</p>}
    </Panel>}
  </div>;
}
