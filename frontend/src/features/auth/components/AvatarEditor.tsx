import { useEffect, useRef, useState, type ChangeEvent } from "react";
import axios from "axios";

import { Camera } from "@/shared/components/icons";
import { Button } from "@/shared/components/ui";
import { toast } from "@/shared/lib/toast";
import type { User } from "@/types";
import { useDeleteAvatar, useUploadAvatar } from "../hooks";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxAvatarSize = 2 * 1024 * 1024;

function apiError(error: unknown) {
  if (axios.isAxiosError<Record<string, string | string[]>>(error)) {
    const value = error.response?.data?.avatar;
    if (Array.isArray(value)) return value.join(" ");
    if (value) return value;
  }
  return "Không thể cập nhật ảnh đại diện. Vui lòng thử lại.";
}

export default function AvatarEditor({ user, initials }: { user: User; initials: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const upload = useUploadAvatar();
  const remove = useDeleteAvatar();

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    if (!allowedTypes.has(selected.type)) {
      toast.error("Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.");
      return;
    }
    if (selected.size > maxAvatarSize) {
      toast.error("Ảnh đại diện không được lớn hơn 2 MB.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  function cancelPreview() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
  }

  function save() {
    if (!file) return;
    upload.mutate(file, {
      onSuccess: () => {
        toast.success("Đã cập nhật ảnh đại diện.");
        cancelPreview();
      },
      onError: (error) => toast.error(apiError(error)),
    });
  }

  function deleteAvatar() {
    remove.mutate(undefined, {
      onSuccess: () => toast.success("Đã xóa ảnh đại diện."),
      onError: (error) => toast.error(apiError(error)),
    });
  }

  const imageUrl = preview || user.avatar;
  const busy = upload.isPending || remove.isPending;

  return <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
    <div className="relative shrink-0">
      {imageUrl ? <img src={imageUrl} alt={`Ảnh đại diện của ${user.username}`} className="h-24 w-24 rounded-2xl border-2 border-white object-cover shadow-md ring-1 ring-slate-200" /> : <div className="grid h-24 w-24 place-items-center rounded-2xl border border-brand-600 bg-gradient-to-tr from-brand-600 via-brand-700 to-brand-800 text-2xl font-bold text-white shadow-md">{initials}</div>}
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} aria-label="Chọn ảnh đại diện" className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-brand-700 text-white shadow-lg transition hover:bg-brand-800 disabled:opacity-50"><Camera className="h-4 w-4" /></button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} className="sr-only" />
    </div>
    <div>
      <p className="text-sm font-semibold text-slate-900">Ảnh đại diện</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">JPG, PNG hoặc WebP. Dung lượng tối đa 2 MB.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {file ? <><Button variant="primary" busy={upload.isPending} onClick={save}>Lưu ảnh</Button><Button disabled={busy} onClick={cancelPreview}>Hủy</Button></> : <><Button disabled={busy} onClick={() => inputRef.current?.click()}>{user.avatar ? "Đổi ảnh" : "Chọn ảnh"}</Button>{user.avatar && <Button variant="ghost" busy={remove.isPending} onClick={deleteAvatar} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">Xóa ảnh</Button>}</>}
      </div>
    </div>
  </div>;
}
