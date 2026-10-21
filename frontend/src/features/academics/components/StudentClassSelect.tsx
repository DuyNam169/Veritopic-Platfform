import { useQuery } from "@tanstack/react-query";
import { catalogApi, type CatalogItem } from "../api";
import { fieldClass } from "@/shared/components/ui";

interface Props {
  value?: number | null;
  department?: number | null;
  cohort?: number | null;
  onChange: (item: CatalogItem | null) => void;
}

export default function StudentClassSelect({ value, department, cohort, onChange }: Props) {
  const classes = useQuery({ queryKey: ["catalog", "classes", ""], queryFn: () => catalogApi.list("classes") });
  const options = (classes.data ?? []).filter((item) => item.id === value ||
    ((!department || !item.department || item.department === department) && (!cohort || !item.cohort || item.cohort === cohort)));
  return <label className="block text-sm font-medium text-slate-700">
    Lớp
    <select required value={value ?? ""} disabled={classes.isLoading || classes.isError}
      onChange={(event) => onChange(classes.data?.find((item) => item.id === Number(event.target.value)) ?? null)} className={fieldClass}>
      <option value="">{classes.isLoading ? "Đang tải lớp..." : "Chọn lớp"}</option>
      {options.map((item) => <option key={item.id} value={item.id}>{item.code === item.name ? item.name : `${item.code} · ${item.name}`}{item.cohort_name ? ` (${item.cohort_name})` : ""}</option>)}
    </select>
    {classes.isError && <span role="alert" className="mt-1 block text-xs text-rose-600">Không tải được lớp. <button type="button" onClick={() => void classes.refetch()} className="underline">Thử lại</button></span>}
    {classes.isSuccess && !options.length && <span className="mt-1 block text-xs text-amber-700">Chưa có lớp phù hợp. Hãy thêm lớp trong Danh mục hệ thống.</span>}
  </label>;
}
