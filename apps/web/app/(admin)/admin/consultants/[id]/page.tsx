"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui/page-header";
import { StatsCard } from "@/components/ui/stats-card";
import { AvatarUpload } from "@/components/ui/avatar-upload";
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
  const updateAvatar    = trpc.auth.updateAvatar.useMutation({ onSuccess: () => refetch() });

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

      {/* Avatar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6 flex justify-center">
        <AvatarUpload
          value={consultant.user.avatar}
          onChange={(v) => updateAvatar.mutate({ userId: consultant.user.id, avatar: v })}
          fallback={consultant.user.name?.[0] ?? "؟"}
          size="lg"
        />
      </div>

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

      {/* ── Bonuses Section ── */}
      <BonusesSection consultantId={id} />

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


// ══════════════════════════════════════════════════════════════════════════════
// ── Bonuses section ──
function BonusesSection({ consultantId }: { consultantId: string }) {
  const utils = trpc.useUtils();
  const { data: bonuses } = trpc.bonus.listForConsultant.useQuery({ consultantId });

  const create   = trpc.bonus.create.useMutation({ onSuccess: () => { utils.bonus.listForConsultant.invalidate({ consultantId }); reset(); } });
  const markPaid = trpc.bonus.markPaid.useMutation({ onSuccess: () => utils.bonus.listForConsultant.invalidate({ consultantId }) });
  const remove   = trpc.bonus.delete.useMutation({ onSuccess: () => utils.bonus.listForConsultant.invalidate({ consultantId }) });

  const [amount, setAmount]       = useState<number | "">("");
  const [reason, setReason]       = useState("");
  const [markAsPaid, setMarkPaid] = useState(true);
  const [showForm, setShowForm]   = useState(false);

  function reset() {
    setAmount("");
    setReason("");
    setMarkPaid(true);
    setShowForm(false);
  }

  const totalPaid    = (bonuses ?? []).filter((b) => b.status === "PAID").reduce((s, b) => s + Number(b.amount), 0);
  const totalPending = (bonuses ?? []).filter((b) => b.status === "PENDING").reduce((s, b) => s + Number(b.amount), 0);

  return (
    <div className="mt-5 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm" dir="rtl">
      <div className="flex items-center justify-between border-b pb-3 mb-5">
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
        >
          {showForm ? "إلغاء" : "+ إضافة مكافأة"}
        </button>
        <h3 className="font-semibold text-gray-700 text-sm">🎁 المكافآت</h3>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-emerald-50 rounded-xl p-3 text-right">
          <p className="text-xs text-emerald-600 mb-1">مدفوع</p>
          <p className="text-xl font-extrabold text-emerald-700">{totalPaid.toLocaleString("ar")} <span className="text-xs font-normal">د.ع</span></p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-right">
          <p className="text-xs text-amber-600 mb-1">قيد الانتظار</p>
          <p className="text-xl font-extrabold text-amber-700">{totalPending.toLocaleString("ar")} <span className="text-xs font-normal">د.ع</span></p>
        </div>
      </div>

      {/* New bonus form */}
      {showForm && (
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 mb-4 space-y-3">
          <div>
            <label className="text-xs text-gray-600 font-medium block mb-1.5">المبلغ (د.ع)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value ? +e.target.value : "")}
              placeholder="مثلاً: 50000"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-400 text-right"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 font-medium block mb-1.5">السبب (اختياري)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثلاً: مكافأة شهرية تقديراً للأداء"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-400 text-right resize-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markAsPaid}
              onChange={(e) => setMarkPaid(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
            <span className="text-xs text-gray-600">دفع المكافأة فوراً</span>
          </label>
          <button
            onClick={() => create.mutate({ consultantId, amount: +amount, reason: reason || undefined, markAsPaid })}
            disabled={!amount || create.isPending}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
          >
            {create.isPending ? "..." : "تأكيد إضافة المكافأة"}
          </button>
        </div>
      )}

      {/* Bonuses list */}
      {!bonuses?.length ? (
        <p className="text-sm text-gray-400 text-center py-8">لا توجد مكافآت حالياً</p>
      ) : (
        <div className="space-y-2">
          {bonuses.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                {b.status === "PENDING" && (
                  <button
                    onClick={() => markPaid.mutate({ id: b.id })}
                    disabled={markPaid.isPending}
                    className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-semibold hover:bg-emerald-200"
                  >
                    تأكيد الدفع
                  </button>
                )}
                <button
                  onClick={() => { if (confirm("حذف المكافأة؟")) remove.mutate({ id: b.id }); }}
                  className="text-xs px-2 py-1 text-red-400 hover:text-red-600"
                >🗑</button>
              </div>
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center gap-2 justify-end mb-0.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    b.status === "PAID" ? "bg-emerald-100 text-emerald-700" :
                    "bg-amber-100 text-amber-700"
                  }`}>
                    {b.status === "PAID" ? "مدفوع" : "معلّق"}
                  </span>
                  <p className="font-bold text-gray-900 text-sm">{Number(b.amount).toLocaleString("ar")} <span className="text-xs font-normal text-gray-400">د.ع</span></p>
                </div>
                {b.reason && <p className="text-xs text-gray-500 truncate">{b.reason}</p>}
                <p className="text-[10px] text-gray-300 mt-0.5">{new Date(b.createdAt).toLocaleDateString("ar-IQ-u-nu-latn")}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
