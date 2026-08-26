import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { useLogin } from "./hooks";
import type { LoginPayload } from "./api";

export default function LoginPage() {
  const { register, handleSubmit } = useForm<LoginPayload>();
  const loginMutation = useLogin();
  const navigate = useNavigate();

  const onSubmit = (data: LoginPayload) => {
    loginMutation.mutate(data, { onSuccess: () => navigate("/") });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
        <h1 className="text-center text-xl font-semibold">Đăng nhập</h1>
        <input
          {...register("username", { required: true })}
          placeholder="Tên đăng nhập"
          className="w-full rounded-md border px-3 py-2"
        />
        <input
          {...register("password", { required: true })}
          type="password"
          placeholder="Mật khẩu"
          className="w-full rounded-md border px-3 py-2"
        />
        {loginMutation.isError && (
          <p className="text-sm text-red-600">Sai tên đăng nhập hoặc mật khẩu.</p>
        )}
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full rounded-md bg-slate-900 py-2 text-white hover:bg-slate-800"
        >
          {loginMutation.isPending ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
}
