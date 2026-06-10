"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui/page-header";
import { StatsCard } from "@/components/ui/stats-card";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Button } from "@/components/ui/form";

export default function ConsultantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: consultant, refetch } = trpc.consultant.getById.useQuery({ id });
  const { data: specializations } = trpc.specialization.list.useQuery();

  const [form, setForm] = useState({
    bio: "", sessionPrice: 0, city: "", yearsOfExperience: 0,
    academicQualification: "", commissionRate: 0.2, specializationIds: [] as string[], certifications: [] as string[],
  });

  useEffect(() => {
    if (consultant) {
      setForm({
        bio: consultant.bio ?? "",
        sessionPrice: Number(consultant.sessionPrice),
        city: consultant.city ?? "",
        yearsOfExperience: consultant.yearsOfExperience,
        academicQualification: consultant.academicQualification ?? "",
        commissionRate: Number(consultant.commissionRate),
        specializationIds: consultant.specializations.map((s) => s.specializationId),
        certifications: consultant.certifications,
      });
    }
  }, [consultant]);

  const updateMutation  = trpc.consultant.update.useMutation({ onSuccess: () => refetch() });
  const toggleActive    = trpc.consultant.toggleActive.useMutation({ onSuccess: () => refetch() });
  const resetPassword   = trpc.auth.resetPassword.useMutation({ onSuccess: () => { setNewPassword(""); setPasswordMsg("✅ تم تغيير كلمة المرور"); } });
  const updateEmail     = trpc.auth.updateEmail.useMutation({ onSuccess: () => { refetch(); setEmailMsg("✅ تم تحديث البريد الإلكتروني"); } });

  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail]       = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [emailMsg, setEmailMsg]       = useState("");

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const toggleSpec = (sid: string) =>
    set("specializationIds", form.specializationIds.includes(sid)
      ? form.specializationIds.filter((s) => s !== sid)
      : [...form.specializationIds, sid]);

  if (!consultant) return <div className="text-center py-20 text-gray-400">جاري التحميل...</div>;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={consultant.user.name ?? ""}
        subtitle={consultant.user.email}
        action={
          <div className="flex gap-2">
            <Button
              variant={consultant.user.isActive ? "danger" : "secondary"}
              size="sm"
              onClick={() => toggleActive.mutate({ id })}
              loading={toggleActive.isPending}
            >
              {consultant.user.isActive ? "⛔ إيقاف الحساب" : "✅ تفعيل الحساب"}
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatsCard title="الجلسات" value={consultant._count.appointments} icon="📅" color="indigo" />
        <StatsCard title="التقييمات" value={`⭐ ${Number(consultant.rating).toFixed(1)}`} icon="⭐" color="amber" />
        <StatsCard title="سعر الجلسة" value={`${Number(consultant.sessionPrice)} د.ع`} icon="💰" color="emerald" />
      </div>

      {/* Edit Form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-3">تعديل البيانات</h3>

        <Textarea label="النبذة التعريفية" value={form.bio} onChange={(e) => set("bio", e.target.value)} />

        <div className="grid grid-cols-2 gap-4">
          <Input label="المدينة" value={form.city} onChange={(e) => set("city", e.target.value)} />
          <Input label="سنوات الخبرة" type="number" value={form.yearsOfExperience} onChange={(e) => set("yearsOfExperience", +e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="سعر الجلسة (د.ع)" type="number" value={form.sessionPrice} onChange={(e) => set("sessionPrice", +e.target.value)} />
          <Input label="نسبة العمولة" type="number" step="0.01" value={form.commissionRate} onChange={(e) => set("commissionRate", +e.target.value)} />
        </div>

        <Input label="المؤهل الأكاديمي" value={form.academicQualification} onChange={(e) => set("academicQualification", e.target.value)} />

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

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={() => router.back()}>إلغاء</Button>
          <Button
            onClick={() => updateMutation.mutate({ id, data: form })}
            loading={updateMutation.isPending}
          >
            حفظ التعديلات
          </Button>
        </div>
      </div>

      {/* ── Account Security ── */}
      <div className="mt-5 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-3 mb-5">إعدادات الحساب</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Update Email */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">تحديث البريد الإلكتروني</p>
            <p className="text-xs text-gray-400 mb-3">البريد الحالي: <span className="font-medium text-gray-600">{consultant.user.email}</span></p>
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); setEmailMsg(""); }}
                placeholder="البريد الجديد"
                dir="ltr"
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition"
              />
              <button
                onClick={() => updateEmail.mutate({ userId: consultant.user.id, email: newEmail })}
                disabled={!newEmail.includes("@") || updateEmail.isPending}
                className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {updateEmail.isPending ? "..." : "تحديث"}
              </button>
            </div>
            {emailMsg && <p className="text-xs text-emerald-600 mt-2">{emailMsg}</p>}
            {updateEmail.error && <p className="text-xs text-red-500 mt-2">{updateEmail.error.message}</p>}
          </div>

          {/* Reset Password */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">إعادة تعيين كلمة المرور</p>
            <p className="text-xs text-gray-400 mb-3">سيتم إنهاء جميع الجلسات الحالية</p>
            <div className="flex gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setPasswordMsg(""); }}
                placeholder="كلمة المرور الجديدة"
                dir="ltr"
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition"
              />
              <button
                onClick={() => resetPassword.mutate({ userId: consultant.user.id, newPassword })}
                disabled={newPassword.length < 6 || resetPassword.isPending}
                className="px-4 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {resetPassword.isPending ? "..." : "إعادة تعيين"}
              </button>
            </div>
            {passwordMsg && <p className="text-xs text-emerald-600 mt-2">{passwordMsg}</p>}
            {resetPassword.error && <p className="text-xs text-red-500 mt-2">{resetPassword.error.message}</p>}
          </div>
        </div>
      </div>

      {/* Reviews */}
      {consultant.reviews && consultant.reviews.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">التقييمات</h3>
          <div className="space-y-4">
            {consultant.reviews.map((r) => (
              <div key={r.id} className="border-b border-gray-50 pb-4 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{r.client.user.name}</span>
                  <span className="text-amber-500">{"⭐".repeat(r.rating)}</span>
                </div>
                {r.comment && <p className="text-sm text-gray-500">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
