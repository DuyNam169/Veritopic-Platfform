import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "./icons";
import { useToastStore, type ToastType } from "../lib/toast";

const icons: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles: Record<ToastType, { bg: string; border: string; text: string; iconColor: string; bar: string }> = {
  success: {
    bg: "bg-white/95 backdrop-blur-md",
    border: "border-emerald-200 shadow-emerald-900/5",
    text: "text-slate-900",
    iconColor: "text-emerald-600 bg-emerald-50",
    bar: "bg-emerald-500",
  },
  error: {
    bg: "bg-white/95 backdrop-blur-md",
    border: "border-rose-200 shadow-rose-900/5",
    text: "text-slate-900",
    iconColor: "text-rose-600 bg-rose-50",
    bar: "bg-rose-500",
  },
  warning: {
    bg: "bg-white/95 backdrop-blur-md",
    border: "border-amber-200 shadow-amber-900/5",
    text: "text-slate-900",
    iconColor: "text-amber-600 bg-amber-50",
    bar: "bg-amber-500",
  },
  info: {
    bg: "bg-white/95 backdrop-blur-md",
    border: "border-sky-200 shadow-sky-900/5",
    text: "text-slate-900",
    iconColor: "text-sky-600 bg-sky-50",
    bar: "bg-sky-500",
  },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((t) => {
        const Icon = icons[t.type];
        const style = styles[t.type];

        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto relative overflow-hidden rounded-xl border shadow-xl p-4 transition-all duration-300 animate-slide-in-right ${style.bg} ${style.border}`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-1.5 rounded-lg shrink-0 ${style.iconColor}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                {t.title && (
                  <h4 className="text-sm font-semibold tracking-tight text-slate-950">
                    {t.title}
                  </h4>
                )}
                <p className="mt-0.5 text-xs text-slate-600 leading-relaxed break-words">
                  {t.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition hover:bg-slate-100"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Thanh màu bên dưới */}
            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${style.bar}`} />
          </div>
        );
      })}
    </div>
  );
}

