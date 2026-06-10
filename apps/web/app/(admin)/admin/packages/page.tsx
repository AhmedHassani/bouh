"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";

const DEFAULT_ICONS = ["🌱", "🌿", "🌳", "💎", "⭐", "🏆", "🎯", "💪"];

export default function AdminPackagesPage() {
  const { data: packages, refetch } = trpc.package.listAll.useQuery();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const createForm = {
    nameAr:        "",
    descriptionAr: "",
    sessions:      6,
    price:         50000,
    icon:          "🌱",
    isFeatured:    false,
    sortOrder:     0,
  };

  const [form, setForm] = useState(createForm);

  const createPkg = trpc.package.create.useMutation({
    onSuccess: () => { refetch(); setCreating(false); setForm(createForm); },
  });
  const updatePkg = trpc.package.update.useMutation({ onSuccess: () => { refetch(); setEditing(null); } });
  const deletePkg = trpc.package.delete.useMutation({
    onSuccess: () => refetch(),
    onError:   (e) => alert(e.message),
  });

  function startEdit(pkg: NonNullable<typeof packages>[0]) {
    setEditing(pkg.id);
    setCreating(false);
    setForm({
      nameAr:        pkg.nameAr,
      descriptionAr: pkg.descriptionAr ?? "",
      sessions:      pkg.sessions,
      price:         Number(pkg.price),
      icon:          pkg.icon ?? "🌱",
      isFeatured:    pkg.isFeatured,
      sortOrder:     pkg.sortOrder,
    });
  }

  function saveEdit() {
    if (!editing) return;
    updatePkg.mutate({ id: editing, data: form });
  }

  function saveCreate() {
    createPkg.mutate(form);
  }

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => { setCreating(true); setEditing(null); setForm(createForm); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          + باقة جديدة
        </button>
        <div className="text-right">
          <h1 className="text-xl font-bold text-gray-900">الباقات</h1>
          <p className="text-sm text-gray-400 mt-0.5">إدارة باقات الجلسات للعملاء</p>
        </div>
      </div>

      {/* Create form */}
      {creating && (
        <PackageForm form={form} setForm={setForm} onSave={saveCreate} onCancel={() => setCreating(false)}
          saving={createPkg.isPending} title="باقة جديدة" />
      )}

      {/* List */}
      <div className="space-y-3">
        {packages?.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center text-gray-300">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-sm">لا توجد باقات بعد — اضغط "باقة جديدة"</p>
          </div>
        )}

        {packages?.map((pkg) => {
          if (editing === pkg.id) {
            return (
              <PackageForm key={pkg.id} form={form} setForm={setForm} onSave={saveEdit}
                onCancel={() => setEditing(null)} saving={updatePkg.isPending} title={`تعديل: ${pkg.nameAr}`} />
            );
          }
          return (
            <div key={pkg.id} className={`bg-white rounded-2xl border p-5 ${pkg.isFeatured ? "border-indigo-300 shadow-md shadow-indigo-50" : "border-gray-100"}`}>
              <div className="flex items-center justify-between gap-4">
                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => startEdit(pkg)}
                    className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100 transition-colors">
                    تعديل
                  </button>
                  <button onClick={() => updatePkg.mutate({ id: pkg.id, data: { isActive: !pkg.isActive } })}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      pkg.isActive ? "bg-amber-50 text-amber-600 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}>
                    {pkg.isActive ? "إيقاف" : "تفعيل"}
                  </button>
                  <button onClick={() => { if (confirm("حذف الباقة؟")) deletePkg.mutate({ id: pkg.id }); }}
                    className="text-xs px-2.5 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    🗑
                  </button>
                </div>

                {/* Info */}
                <div className="flex-1 text-right">
                  <div className="flex items-center justify-end gap-2 mb-1 flex-wrap">
                    {pkg.isFeatured && <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-lg font-medium">⭐ الأكثر طلباً</span>}
                    {!pkg.isActive && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg">معطّلة</span>}
                    <h3 className="font-bold text-gray-900 text-base">{pkg.nameAr}</h3>
                  </div>
                  {pkg.descriptionAr && <p className="text-sm text-gray-400">{pkg.descriptionAr}</p>}
                  <div className="flex items-center justify-end gap-4 mt-2 text-sm">
                    <span className="text-gray-500">📊 {pkg._count.userPackages} مشتركاً</span>
                    <span className="text-indigo-600 font-bold">{Number(pkg.price).toLocaleString("ar")} د.ع</span>
                    <span className="text-emerald-600 font-semibold">{pkg.sessions} جلسات</span>
                  </div>
                </div>

                {/* Icon */}
                <div className="text-4xl w-14 h-14 flex items-center justify-center bg-gray-50 rounded-2xl flex-shrink-0">
                  {pkg.icon ?? "📦"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Form ──
function PackageForm({
  form, setForm, onSave, onCancel, saving, title,
}: {
  form: { nameAr: string; descriptionAr: string; sessions: number; price: number; icon: string; isFeatured: boolean; sortOrder: number };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  title: string;
}) {
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="bg-white border-2 border-indigo-200 rounded-2xl p-5 mb-4">
      <p className="text-xs font-semibold text-indigo-500 mb-4">{title}</p>

      <div className="space-y-4">
        {/* Name + Icon */}
        <div className="flex gap-3 items-end">
          <div className="flex-shrink-0">
            <label className="text-xs text-gray-500 block mb-1.5">الأيقونة</label>
            <div className="flex gap-1.5">
              {DEFAULT_ICONS.map((emoji) => (
                <button key={emoji} onClick={() => set("icon", emoji)}
                  className={`w-9 h-9 text-lg rounded-xl border-2 transition-all ${
                    form.icon === emoji ? "border-indigo-400 bg-indigo-50" : "border-gray-100 hover:border-gray-200"
                  }`}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1.5">اسم الباقة</label>
            <input value={form.nameAr} onChange={(e) => set("nameAr", e.target.value)}
              placeholder="مثال: باقة الاستمرار"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 text-right" />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-gray-500 block mb-1.5">الوصف</label>
          <input value={form.descriptionAr} onChange={(e) => set("descriptionAr", e.target.value)}
            placeholder="وصف الباقة (اختياري)"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 text-right" />
        </div>

        {/* Sessions + Price */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1.5">عدد الجلسات</label>
            <input type="number" min={1} value={form.sessions}
              onChange={(e) => set("sessions", +e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 text-center font-bold text-indigo-600" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1.5">السعر (د.ع)</label>
            <input type="number" min={0} value={form.price}
              onChange={(e) => set("price", +e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 text-center font-bold text-indigo-600" />
          </div>
        </div>

        {/* Featured + Sort */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isFeatured}
              onChange={(e) => set("isFeatured", e.target.checked)} className="w-4 h-4 accent-indigo-600" />
            <span className="text-sm text-gray-600">⭐ الأكثر طلباً</span>
          </label>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">الترتيب</label>
            <input type="number" value={form.sortOrder}
              onChange={(e) => set("sortOrder", +e.target.value)}
              className="w-16 px-2 py-1 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-400 text-center" />
          </div>
        </div>

        {/* Price per session */}
        <div className="bg-indigo-50 rounded-xl px-4 py-2.5 text-center">
          <span className="text-xs text-indigo-400">سعر الجلسة الواحدة: </span>
          <span className="font-bold text-indigo-700 text-sm">
            {form.sessions > 0 ? (form.price / form.sessions).toLocaleString("ar", { maximumFractionDigits: 0 }) : 0} د.ع
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-start pt-3 border-t border-gray-100">
          <button onClick={onSave}
            disabled={!form.nameAr.trim() || form.sessions < 1 || form.price < 0 || saving}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
          <button onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
