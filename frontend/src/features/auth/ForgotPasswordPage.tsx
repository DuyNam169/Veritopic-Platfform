import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "./api";

interface ForgotPasswordForm {
  email: string;
}

export default function ForgotPasswordPage() {
  const { register, handleSubmit } = useForm<ForgotPasswordForm>();
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  const forgotMutation = useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    onSuccess: (data: any, variables: string) => {
      setSuccessMsg(data.detail || "Mã OTP đã được gửi đến email của bạn.");
      setErrorMsg("");
      sessionStorage.setItem("resetEmail", variables);
      setTimeout(() => {
        navigate("/reset-password", { state: { email: variables } });
      }, 2000);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.email?.[0] || err.response?.data?.detail || "Đã có lỗi xảy ra.");
      setSuccessMsg("");
    },
  });

  const onSubmit = (data: ForgotPasswordForm) => {
    forgotMutation.mutate(data.email);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
        <h1 className="text-center text-xl font-semibold">Quên mật khẩu</h1>
        <p className="text-sm text-gray-500 text-center">
          Nhập email của bạn để nhận mã OTP khôi phục mật khẩu.
        </p>

        <input
          {...register("email", { required: true })}
          type="email"
          placeholder="Địa chỉ email"
          className="w-full rounded-md border px-3 py-2"
        />

        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        {successMsg && <p className="text-sm text-green-600">{successMsg}</p>}

        <button
          type="submit"
          disabled={forgotMutation.isPending}
          className="w-full rounded-md bg-slate-900 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {forgotMutation.isPending ? "Đang gửi..." : "Gửi mã OTP"}
        </button>

        <div className="text-center mt-4">
          <Link to="/login" className="text-sm text-blue-600 hover:underline">
            Quay lại Đăng nhập
          </Link>
        </div>
      </form>
    </div>
  );
}
