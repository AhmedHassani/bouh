"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Input, Select } from "@/components/ui/form";

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

type Slot = { dayOfWeek: number; startTime: string; endTime: string; slotDuration: number; enabled: boolean };

const defaultSlots = (): Slot[] =>
  DAYS.map((_, i) => ({
    dayOfWeek: i,
    startTime: "09:00",
    endTime: "17:00",
    slotDuration: 60,
    enabled: i >= 0 && i <= 4, // Sun–Thu enabled by default
  }));

export default function AvailabilityPage() {
  const { data: profile } = trpc.consultant.getMyProfile.useQuery();
  const [slots, setSlots] = useState<Slot[]>(defaultSlots());
  const [saved, setSaved] = useState(false);

  const { data: availability } = trpc.consultant.getAvailability.useQuery(
    { consultantId: profile?.id ?? "" },
    { enabled: !!profile?.id },
  );

  useEffect(() => {
    if (availability && availability.length > 0) {
      setSlots(
        DAYS.map((_, i) => {
          const existing = availability.find((a) => a.dayOfWeek === i);
          return existing
            ? { dayOfWeek: i, startTime: existing.startTime, endTime: existing.endTime, slotDuration: existing.slotDuration, enabled: true }
            : { dayOfWeek: i, startTime: "09:00", endTime: "17:00", slotDuration: 60, enabled: false };
        }),
      );
    }
  }, [availability]);

  const setMutation = trpc.consultant.setAvailability.useMutation({
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  const update = (i: number, key: keyof Slot, value: unknown) =>
    setSlots((s) => s.map((slot, j) => (j === i ? { ...slot, [key]: value } : slot)));

  const save = () => {
    setMutation.mutate(slots.filter((s) => s.enabled).map(({ enabled: _, ...s }) => s));
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="أوقات العمل" subtitle="حدد مواعيد توفرك أسبوعياً" />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-50">
          {slots.map((slot, i) => (
            <div key={i} className={`p-4 flex items-center gap-4 ${!slot.enabled ? "opacity-50" : ""}`}>
              {/* Toggle */}
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input type="checkbox" checked={slot.enabled} onChange={(e) => update(i, "enabled", e.target.checked)} className="sr-only peer" />
                <div className="w-10 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
              </label>

              {/* Day */}
              <span className="w-24 font-medium text-gray-700 text-sm flex-shrink-0">{DAYS[i]}</span>

              {/* Times */}
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="time" value={slot.startTime}
                  onChange={(e) => update(i, "startTime", e.target.value)}
                  disabled={!slot.enabled}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 disabled:opacity-40 bg-white"
                />
                <span className="text-gray-400 text-sm">إلى</span>
                <input
                  type="time" value={slot.endTime}
                  onChange={(e) => update(i, "endTime", e.target.value)}
                  disabled={!slot.enabled}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 disabled:opacity-40 bg-white"
                />
              </div>

              {/* Duration */}
              <Select
                value={String(slot.slotDuration)}
                onChange={(e) => update(i, "slotDuration", +e.target.value)}
                disabled={!slot.enabled}
                options={[
                  { value: "30", label: "30 د" },
                  { value: "45", label: "45 د" },
                  { value: "60", label: "60 د" },
                  { value: "90", label: "90 د" },
                ]}
                className="w-24"
              />
            </div>
          ))}
        </div>

        <div className="px-4 py-4 border-t border-gray-50 flex justify-between items-center">
          {saved && <span className="text-sm text-emerald-600">✅ تم الحفظ</span>}
          <div className="flex-1" />
          <Button onClick={save} loading={setMutation.isPending}>حفظ الجدول</Button>
        </div>
      </div>
    </div>
  );
}
