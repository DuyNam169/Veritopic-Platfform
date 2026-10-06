import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Loader2 } from "@/shared/components/icons";

import { queryClient } from "@/shared/lib/queryClient";
import { useCurrentUser } from "@/features/auth/hooks";
import ToastContainer from "@/shared/components/Toast";

function AuthBootstrap({ children }: { children: ReactNode }) {
  const accessToken = localStorage.getItem("access_token");
  const { isLoading } = useCurrentUser();

  if (accessToken && isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-50 text-slate-900">
        <div className="relative mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-700 border border-brand-600 shadow-lg animate-pulse">
          <span className="text-xl font-bold tracking-wider text-white">V</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-brand-700" />
          <span>Đang xác thực phiên đăng nhập…</span>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        {children}
        <ToastContainer />
      </AuthBootstrap>
    </QueryClientProvider>
  );
}
