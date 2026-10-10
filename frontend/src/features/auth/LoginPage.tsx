import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { User, Lock, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck } from "@/shared/components/icons";

import { useLogin } from "./hooks";
import type { LoginPayload } from "./api";
import { toast } from "@/shared/lib/toast";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginPayload>();
  const loginMutation = useLogin();
  const navigate = useNavigate();

  const onSubmit = (data: LoginPayload) =>
    loginMutation.mutate(data, {
      onSuccess: () => {
        toast.success("Chào mừng bạn trở lại với Veritopic!", "Đăng nhập thành công");
        navigate("/");
      },
      onError: () => {
        toast.error("Sai tên đăng nhập hoặc mật khẩu. Vui lòng kiểm tra lại.", "Đăng nhập thất bại");
      },
    });

  return (
    <main className="grid min-h-screen bg-brand-50/60 lg:grid-cols-[1.15fr_0.85fr]">
      {/* LEFT HERO PANEL (DESKTOP) */}
      <section
        className="relative hidden overflow-hidden bg-brand-700 lg:block"
      >
        <div
          className="absolute -inset-1 bg-cover bg-center opacity-55 blur-[1px] scale-[1.01]"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1800&q=85')",
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/95 via-brand-900/88 to-brand-700/72" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white xl:p-16">
          <div className="flex items-center gap-3 text-lg font-bold tracking-tight">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-sm font-bold shadow-lg">
              V
            </span>
            <span>VERITOPIC</span>
          </div>

          <div className="max-w-xl border-l-2 border-brand-400 pl-6 animate-fade-in">
            <p className="text-xs font-semibold tracking-[0.22em] text-amber-300 uppercase">
              Nền tảng quản lý học thuật
            </p>
            <h1 className="mt-4 text-4xl xl:text-5xl font-bold leading-[1.15] tracking-tight">
              Quản lý đề tài.
              <br />
              Minh bạch, tin cậy.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-sky-100">
              Một hệ sinh thái thống nhất để đề xuất, kiểm tra tương đồng ngữ nghĩa AI, phê duyệt và
              theo dõi đề tài đồ án sinh viên.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs tracking-wider text-sky-100">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>HỆ THỐNG XÁC THỰC PHÂN QUYỀN BẢO MẬT (RBAC)</span>
          </div>
        </div>
      </section>

      {/* RIGHT LOGIN FORM */}
      <section className="flex min-h-screen items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 sm:p-10 shadow-xl shadow-slate-900/5 animate-scale-in">
          {/* Mobile Logo */}
          <div className="mb-8 lg:hidden flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-sm font-bold text-white shadow">
              V
            </span>
            <span className="text-lg font-bold text-slate-950">VERITOPIC</span>
          </div>

          <header className="mb-8">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-brand-700">
              Đăng nhập hệ thống
            </p>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Chào mừng trở lại
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Đăng nhập bằng tài khoản Veritopic của bạn để tiếp tục.
            </p>
          </header>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Tên đăng nhập
              <div className="relative mt-1.5">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  {...register("username", { required: "Vui lòng nhập tên đăng nhập." })}
                  autoComplete="username"
                  placeholder="admin_test, gv_test, ..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-4 focus:ring-brand-100"
                />
              </div>
              {errors.username && (
                <span className="mt-1 block text-xs text-rose-600 font-medium">
                  {errors.username.message}
                </span>
              )}
            </label>

            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Mật khẩu
              <div className="relative mt-1.5">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  {...register("password", { required: "Vui lòng nhập mật khẩu." })}
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Nhập mật khẩu của bạn"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-11 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-4 focus:ring-brand-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 p-1 text-slate-500 hover:text-slate-700 transition"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <span className="mt-1 block text-xs text-rose-600 font-medium">
                  {errors.password.message}
                </span>
              )}
            </label>

            {loginMutation.isError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-medium animate-shake">
                Sai tên đăng nhập hoặc mật khẩu. Vui lòng thử lại.
              </div>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white shadow-md hover:bg-brand-800 transition active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang đăng nhập…</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-100 pt-6 text-center">
            <p className="text-xs text-slate-500 leading-relaxed">
              Tài khoản do nhà trường cấp. Vui lòng liên hệ Quản trị viên nếu cần cấp hoặc mở khóa tài
              khoản.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
