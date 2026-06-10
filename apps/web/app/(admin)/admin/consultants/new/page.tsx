"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui/page-header";
import { Input, Textarea, Select, Button } from "@/components/ui/form";

export default function NewConsultantPage() {
  const router = useRouter();
  const { data: specializations } = trpc.specialization.list.useQuery();

  const [form, setForm] = useState({
    name: "", email: "", password: "", bio: "",
    sessionPrice: 0, city: "", yearsOfExperience: 0,
    academicQualification: "", commissionRate: 0.2,
    specializationIds: [] as string[],
    certifications: [] as string[],
  });
  const [certInput, setCertInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = trpc.consultant.create.useMutation({
    onSuccess: () => router.push("/admin/consultants"),
    onError: (e) => setErrors({ general: e.message }),
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const toggleSpec = (id: string) =>
    set(
      "specializationIds",
      form.specializationIds.includes(id)
        ? form.specializationIds.filter((s) => s !== id)
        : [...form.specializationIds, id],
    );

  const addCert = () => {
    if (!certInput.trim()) return;
    set("certifications", [...form.certifications, certInput.trim()]);
    setCertInput("");
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name) e.name = "الاسم مطلوب";
    if (!form.email) e.email = "البريد مطلوب";
    if (!form.password || form.password.length < 8) e.password = "كلمة المرور 8 أحرف على الأقل";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    createMutation.mutate(form);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="إضافة مستشار جديد" />

      {errors.general && (
        <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {errors.general}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-3">معلومات الحساب</h3>

        <div className="grid grid-cols-2 gap-4">
          <Input label="الاسم الكامل" value={form.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
          <Input label="البريد الإلكتروني" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} error={errors.email} />
        </div>
        <Input label="كلمة المرور" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} error={errors.password} />

        <h3 className="font-semibold text-gray-700 text-sm border-b pb-3 pt-2">الملف المهني</h3>

        <Textarea label="نبذة تعريفية" value={form.bio} onChange={(e) => set("bio", e.target.value)} />

        <div className="grid grid-cols-2 gap-4">
          <Input label="المدينة" value={form.city} onChange={(e) => set("city", e.target.value)} />
          <Input label="سنوات الخبرة" type="number" value={form.yearsOfExperience} onChange={(e) => set("yearsOfExperience", +e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="سعر الجلسة (د.ع)" type="number" value={form.sessionPrice} onChange={(e) => set("sessionPrice", +e.target.value)} />
          <Input label="نسبة العمولة (0–1)" type="number" step="0.01" value={form.commissionRate} onChange={(e) => set("commissionRate", +e.target.value)} />
        </div>

        <Input label="المؤهل الأكاديمي" value={form.academicQualification} onChange={(e) => set("academicQualification", e.target.value)} />

        {/* Certifications */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">الدورات والشهادات</label>
          <div className="flex gap-2 mb-2">
            <input
              value={certInput}
              onChange={(e) => setCertInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCert()}
              placeholder="اسم الشهادة / الدورة"
              className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400"
            />
            <Button size="sm" type="button" onClick={addCert}>إضافة</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.certifications.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs">
                {c}
                <button onClick={() => set("certifications", form.certifications.filter((_, j) => j !== i))} className="hover:text-rose-500">✕</button>
              </span>
            ))}
          </div>
        </div>

        {/* Specializations */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">التخصصات</label>
          <div className="flex flex-wrap gap-2">
            {specializations?.map((s) => {
              const selected = form.specializationIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSpec(s.id)}
                  className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                    selected
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                  }`}
                >
                  {s.nameAr}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={() => router.back()}>إلغاء</Button>
          <Button onClick={submit} loading={createMutation.isPending}>حفظ المستشار</Button>
        </div>
      </div>
    </div>
  );
}
