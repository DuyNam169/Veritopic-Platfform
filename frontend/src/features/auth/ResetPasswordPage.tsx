import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "./api";

interface ResetPasswordForm {
  email: string;
  otp: string;
  new_password: string;
}

export default function ResetPasswordPage() {
  const location = useLocation();
  const initialEmail = location.state?.email || sessionStorage.getItem("resetEmail") || "";

  const { register, handleSubmit } = useForm<ResetPasswordForm>({
    defaultValues: { email: initialEmail },
  });

  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  const resetMutation = useMutation({
    mutationFn: (data: ResetPasswordForm) => authApi.resetPassword(data),
    onSuccess: (data: any) => {
      setSuccessMsg(data.detail || "Đặt lại mật khẩu thành công.");
      setErrorMsg("");
      sessionStorage.removeItem("resetEmail");
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || err.response?.data?.otp?.[0] || err.response?.data?.new_password?.[0] || "Đã có lỗi xảy ra.");
      setSuccessMsg("");
    },
  });

  const onSubmit = (data: ResetPasswordForm) => {
    resetMutation.mutate(data);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
        <h1 className="text-center text-xl font-semibold">Đặt lại mật khẩu</h1>
        <p className="text-sm text-gray-500 text-center">
          Nhập mã OTP đã được gửi đến email của bạn và mật khẩu mới.
        </p>

        <input type="hidden" {...register("email", { required: true })} />

        <input
          {...register("otp", { required: true })}
          type="text"
          placeholder="Mã OTP (6 số)"
          maxLength={6}
          className="w-full rounded-md border px-3 py-2 tracking-widest text-center"
        />

        <input
          {...register("new_password", { required: true, minLength: 8 })}
          type="password"
          placeholder="Mật khẩu mới (ít nhất 8 ký tự)"
          className="w-full rounded-md border px-3 py-2"
        />

        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        {successMsg && <p className="text-sm text-green-600">{successMsg}</p>}

        <button
          type="submit"
          disabled={resetMutation.isPending}
          className="w-full rounded-md bg-slate-900 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {resetMutation.isPending ? "Đang xử lý..." : "Xác nhận đổi mật khẩu"}
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
