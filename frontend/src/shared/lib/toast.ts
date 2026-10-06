import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (newToast) => {
    const id = Math.random().toString(36).substring(2, 9);
    const duration = newToast.duration ?? 4000;
    set((state) => ({ toasts: [...state.toasts, { ...newToast, id }] }));

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = {
  success: (message: string, title = "Thành công") =>
    useToastStore.getState().addToast({ type: "success", title, message }),
  error: (message: string, title = "Đã xảy ra lỗi") =>
    useToastStore.getState().addToast({ type: "error", title, message }),
  info: (message: string, title = "Thông báo") =>
    useToastStore.getState().addToast({ type: "info", title, message }),
  warning: (message: string, title = "Cảnh báo") =>
    useToastStore.getState().addToast({ type: "warning", title, message }),
};

