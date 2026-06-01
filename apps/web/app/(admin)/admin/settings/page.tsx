"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui/page-header";
import { Input, Button } from "@/components/ui/form";

export default function SettingsPage() {
  const { data: settings, refetch } = trpc.setting.getAll.useQuery();
  const updateMany = trpc.setting.updateMany.useMutation({ onSuccess: () => refetch() });

  const [form, setForm] = useState({
    whatsapp_support: "",
    global_discount_enabled: "false",
    global_discount_percentage: "0",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        whatsapp_support: settings.whatsapp_support ?? "",
        global_discount_enabled: settings.global_discount_enabled ?? "false",
        global_discount_percentage: settings.global_discount_percentage ?? "0",
      });
    }
  }, [settings]);

  const save = () => {
    updateMany.mutate([
      { key: "whatsapp_support", value: form.whatsapp_support },
      { key: "global_discount_enabled", value: form.global_discount_enabled },
      { key: "global_discount_percentage", value: form.global_discount_percentage },
    ]);
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="إعدادات المنصة" />

      <div className="space-y-6">
        {/* Support */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span>📞</span> إعدادات الدعم
          </h3>
          <Input
            label="رقم واتساب للدعم"
            value={form.whatsapp_support}
            onChange={(e) => setForm((f) => ({ ...f, whatsapp_support: e.target.value }))}
            placeholder="+966500000000"
          />
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span>💰</span> إعدادات التسعير
          </h3>

          <div className="flex items-center gap-3 mb-4">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.global_discount_enabled === "true"}
                onChange={(e) => setForm((f) => ({ ...f, global_discount_enabled: e.target.checked ? "true" : "false" }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
            </label>
            <span className="text-sm font-medium text-gray-700">تفعيل خصم عام على جميع الجلسات</span>
          </div>

          {form.global_discount_enabled === "true" && (
            <Input
              label="نسبة الخصم العام (%)"
              type="number"
              min={0}
              max={100}
              value={form.global_discount_percentage}
              onChange={(e) => setForm((f) => ({ ...f, global_discount_percentage: e.target.value }))}
            />
          )}

          {form.global_discount_enabled === "true" && (
            <p className="text-xs text-indigo-600 mt-2 bg-indigo-50 p-3 rounded-xl">
              ⚡ سيُطبَّق خصم {form.global_discount_percentage}% تلقائياً على جميع أسعار الجلسات
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={save} loading={updateMany.isPending}>حفظ الإعدادات</Button>
        </div>

        {updateMany.isSuccess && (
          <p className="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-xl text-center">
            ✅ تم حفظ الإعدادات بنجاح
          </p>
        )}
      </div>
    </div>
  );
}
