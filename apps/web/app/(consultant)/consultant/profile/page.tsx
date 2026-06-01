"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui/page-header";
import { Input, Textarea, Button } from "@/components/ui/form";

export default function ConsultantProfilePage() {
  const { data: profile, refetch } = trpc.consultant.getMyProfile.useQuery();
  const { data: specializations } = trpc.specialization.list.useQuery({ isActive: true });

  const [form, setForm] = useState({ bio: "", sessionPrice: 0, city: "", yearsOfExperience: 0, academicQualification: "", certifications: [] as string[], specializationIds: [] as string[] });
  const [certInput, setCertInput] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        bio: profile.bio ?? "",
        sessionPrice: Number(profile.sessionPrice),
        city: profile.city ?? "",
        yearsOfExperience: profile.yearsOfExperience,
        academicQualification: profile.academicQualification ?? "",
        certifications: profile.certifications,
        specializationIds: profile.specializations.map((s) => s.specializationId),
      });
    }
  }, [profile]);

  const updateMutation = trpc.consultant.updateMyProfile.useMutation({
    onSuccess: () => { refetch(); setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const toggleSpec = (id: string) =>
    set("specializationIds", form.specializationIds.includes(id)
      ? form.specializationIds.filter((s) => s !== id)
      : [...form.specializationIds, id]);

  const addCert = () => {
    if (!certInput.trim()) return;
    set("certifications", [...form.certifications, certInput.trim()]);
    setCertInput("");
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="ملفي الشخصي" />

      {saved && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm">✅ تم حفظ التعديلات</div>}

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
        <Textarea label="نبذة تعريفية" value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={5} />

        <div className="grid grid-cols-2 gap-4">
          <Input label="المدينة" value={form.city} onChange={(e) => set("city", e.target.value)} />
          <Input label="سنوات الخبرة" type="number" value={form.yearsOfExperience} onChange={(e) => set("yearsOfExperience", +e.target.value)} />
        </div>

        <Input label="سعر الجلسة (ر.س)" type="number" value={form.sessionPrice} onChange={(e) => set("sessionPrice", +e.target.value)} />
        <Input label="المؤهل الأكاديمي" value={form.academicQualification} onChange={(e) => set("academicQualification", e.target.value)} />

        {/* Certs */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">الدورات والشهادات</label>
          <div className="flex gap-2 mb-2">
            <input value={certInput} onChange={(e) => setCertInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCert()}
              placeholder="اسم الدورة / الشهادة"
              className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400" />
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
                <button key={s.id} type="button" onClick={() => toggleSpec(s.id)}
                  className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${selected ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"}`}>
                  {s.nameAr}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => updateMutation.mutate(form)} loading={updateMutation.isPending}>حفظ التعديلات</Button>
        </div>
      </div>
    </div>
  );
}
