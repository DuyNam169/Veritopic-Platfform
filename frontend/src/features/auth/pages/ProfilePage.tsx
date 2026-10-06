import { useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import {
  User as UserIcon,
  Mail,
  Phone,
  Shield,
  KeyRound,
  Calendar,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Users,
  Layers,
  CheckSquare,
  BarChart3,
  ShieldCheck,
} from "@/shared/components/icons";

import { useAuthStore } from "../store";
import { useCurrentUser, useUpdateProfile, useChangePassword } from "../hooks";
import type { UpdateProfilePayload, ChangePasswordPayload } from "../api";
import type { Role } from "@/types";
import { toast } from "@/shared/lib/toast";
import AvatarEditor from "../components/AvatarEditor";

const roleLabels: Record<Role, string> = {
  admin: "Quản trị viên",
  department_head: "Trưởng bộ môn",
  teacher: "Giảng viên",
  student: "Sinh viên",
};

const roleBadges: Record<Role, string> = {
  admin: "bg-brand-50 text-brand-700 border-brand-200",
  department_head: "bg-amber-50 text-amber-700 border-amber-200",
  teacher: "bg-sky-50 text-sky-700 border-sky-200",
  student: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  useCurrentUser();

  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const profileForm = useForm<UpdateProfilePayload>({
    values: user
      ? {
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          phone_number: user.phone_number ?? "",
        }
      : undefined,
  });

  const pwForm = useForm<ChangePasswordPayload>();

  if (!user) return null;

  const initials =
    `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}` ||
    user.username.slice(0, 2).toUpperCase();
  const fullName = `${user.last_name} ${user.first_name}`.trim() || user.username;
  const joinDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

  const onProfileSubmit = profileForm.handleSubmit((data) => {
    updateProfile.mutate(data, {
      onSuccess: () => {
        toast.success("Thông tin tài khoản đã được lưu.", "Cập nhật thành công");
      },
      onError: (err: unknown) => {
        const emailError = axios.isAxiosError<Record<string, string | string[]>>(err) ? err.response?.data?.email : undefined;
        const errorDetail = Array.isArray(emailError) ? emailError[0] : emailError;
        if (errorDetail) {
          profileForm.setError("email", { message: errorDetail });
          toast.error(errorDetail, "Lỗi cập nhật");
        } else {
          toast.error("Không thể cập nhật hồ sơ. Vui lòng kiểm tra lại thông tin.", "Lỗi cập nhật");
        }
      },
    });
  });

  const onPwSubmit = pwForm.handleSubmit((data) => {
    changePassword.mutate(data, {
      onSuccess: () => {
        toast.success("Mật khẩu của bạn đã được thay đổi an toàn.", "Đổi mật khẩu thành công");
        pwForm.reset();
      },
      onError: (err: unknown) => {
        const detail = axios.isAxiosError<Record<string, string | string[]>>(err) ? err.response?.data : undefined;
        if (detail?.old_password) {
          const msg = Array.isArray(detail.old_password) ? detail.old_password[0] : detail.old_password;
          pwForm.setError("old_password", { message: msg });
          toast.error(msg, "Lỗi đổi mật khẩu");
        } else if (detail?.new_password) {
          const msg = Array.isArray(detail.new_password) ? detail.new_password[0] : detail.new_password;
          pwForm.setError("new_password", { message: msg });
          toast.error(msg, "Lỗi đổi mật khẩu");
        } else if (detail?.confirm_password) {
          const msg = Array.isArray(detail.confirm_password) ? detail.confirm_password[0] : detail.confirm_password;
          pwForm.setError("confirm_password", { message: msg });
          toast.error(msg, "Lỗi đổi mật khẩu");
        } else {
          toast.error("Đổi mật khẩu thất bại. Vui lòng kiểm tra lại dữ liệu.", "Lỗi hệ thống");
        }
      },
    });
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* HEADER BANNER */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-gradient-to-br from-brand-50 to-slate-100 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <AvatarEditor user={user} initials={initials} />
          <div className="lg:text-right">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-950">{fullName}</h1>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold ${roleBadges[user.role]}`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {roleLabels[user.role]}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500 font-mono">@{user.username}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500 lg:justify-end">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Tham gia: {joinDate}
                </span>
                <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Tài khoản đang hoạt động
                </span>
              </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* SECTION 1: THÔNG TIN CÁ NHÂN */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-brand-50 text-brand-700">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Thông tin cá nhân</h2>
              <p className="text-xs text-slate-500">Cập nhật họ tên và thông tin liên hệ của bạn</p>
            </div>
          </div>

          <form onSubmit={onProfileSubmit} className="p-6 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Họ & tên đệm
                  <input
                    {...profileForm.register("last_name", { required: "Vui lòng nhập họ & tên đệm" })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100/50"
                  />
                  {profileForm.formState.errors.last_name && (
                    <span className="mt-1 block text-xs text-red-600">
                      {profileForm.formState.errors.last_name.message}
                    </span>
                  )}
                </label>

                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Tên
                  <input
                    {...profileForm.register("first_name", { required: "Vui lòng nhập tên" })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100/50"
                  />
                  {profileForm.formState.errors.first_name && (
                    <span className="mt-1 block text-xs text-red-600">
                      {profileForm.formState.errors.first_name.message}
                    </span>
                  )}
                </label>
              </div>

              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Email liên hệ
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    {...profileForm.register("email", { required: "Vui lòng nhập email" })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-9 pr-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100/50"
                  />
                </div>
                {profileForm.formState.errors.email && (
                  <span className="mt-1 block text-xs text-red-600">
                    {profileForm.formState.errors.email.message}
                  </span>
                )}
              </label>

              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Số điện thoại
                <div className="relative mt-1.5">
                  <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="tel"
                    placeholder="VD: 0912345678"
                    {...profileForm.register("phone_number")}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-9 pr-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100/50"
                  />
                </div>
              </label>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tên đăng nhập (Username):</span>
                  <span className="font-mono font-medium text-slate-700">@{user.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phòng ban / Bộ môn:</span>
                  <span className="font-medium text-slate-700">
                    {user.department ? `Bộ môn #${user.department}` : "Quản trị hệ thống"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={updateProfile.isPending}
                className="flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-brand-800 transition active:scale-98 disabled:opacity-60"
              >
                {updateProfile.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Lưu thay đổi</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* SECTION 2: ĐỔI MẬT KHẨU */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Bảo mật tài khoản</h2>
              <p className="text-xs text-slate-500">Đổi mật khẩu định kỳ để bảo vệ tài khoản</p>
            </div>
          </div>

          <form onSubmit={onPwSubmit} className="p-6 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Mật khẩu hiện tại
                <div className="relative mt-1.5">
                  <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showOldPw ? "text" : "password"}
                    placeholder="Nhập mật khẩu hiện tại"
                    {...pwForm.register("old_password", { required: "Vui lòng nhập mật khẩu hiện tại" })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-9 pr-10 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPw(!showOldPw)}
                    className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showOldPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {pwForm.formState.errors.old_password && (
                  <span className="mt-1 block text-xs text-red-600">
                    {pwForm.formState.errors.old_password.message}
                  </span>
                )}
              </label>

              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Mật khẩu mới
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showNewPw ? "text" : "password"}
                    placeholder="Tối thiểu 8 ký tự"
                    {...pwForm.register("new_password", {
                      required: "Vui lòng nhập mật khẩu mới",
                      minLength: { value: 8, message: "Mật khẩu mới cần tối thiểu 8 ký tự" },
                    })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-9 pr-10 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {pwForm.formState.errors.new_password && (
                  <span className="mt-1 block text-xs text-red-600">
                    {pwForm.formState.errors.new_password.message}
                  </span>
                )}
              </label>

              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Nhập lại mật khẩu mới
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    placeholder="Nhập lại mật khẩu mới"
                    {...pwForm.register("confirm_password", {
                      required: "Vui lòng xác nhận mật khẩu mới",
                      validate: (val) => val === pwForm.watch("new_password") || "Mật khẩu xác nhận không khớp",
                    })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-9 pr-10 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {pwForm.formState.errors.confirm_password && (
                  <span className="mt-1 block text-xs text-red-600">
                    {pwForm.formState.errors.confirm_password.message}
                  </span>
                )}
              </label>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-500">
                <p className="font-semibold text-slate-700 mb-1">Yêu cầu bảo mật:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Tối thiểu 8 ký tự.</li>
                  <li>Không được trùng với mật khẩu hiện tại.</li>
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={changePassword.isPending}
                className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:border-brand-600 hover:bg-slate-50 transition active:scale-98 disabled:opacity-50"
              >
                {changePassword.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-800" />
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Cập nhật mật khẩu</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* SECTION 3: ĐẶC QUYỀN QUẢN TRỊ VIÊN (Nếu role === 'admin') */}
      {user.role === "admin" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Đặc quyền Quản trị viên</h2>
                <p className="text-xs text-slate-500">
                  Các chức năng quản trị hệ thống thuộc quyền hạn của bạn (Mục 3.1 & 3.3)
                </p>
              </div>
            </div>
            <span className="rounded-full bg-brand-700 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white uppercase">
              Full Access
            </span>
          </div>

          <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              to="/users"
              className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                    <Users className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Quản lý tài khoản</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Cấp tài khoản, phân quyền Giảng viên/Trưởng bộ môn, khóa tài khoản.
                </p>
              </div>
            </Link>

            <Link
              to="/academics"
              className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-700 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                    <Layers className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Danh mục hệ thống</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Quản lý Khóa học, Năm học, Học kỳ, Bộ môn và Lĩnh vực đề tài.
                </p>
              </div>
            </Link>

            <Link
              to="/approval"
              className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Duyệt đề tài</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Xem kiểm tra tương đồng AI và phê duyệt đề tài thay thế khi cần.
                </p>
              </div>
            </Link>

            <Link
              to="/statistics"
              className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Thống kê & Báo cáo</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Xem biểu đồ tổng hợp số liệu và xuất báo cáo Excel / PDF toàn trường.
                </p>
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
