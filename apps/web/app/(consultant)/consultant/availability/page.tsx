"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";

const DAYS_AR = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

const DURATION_OPTIONS = [
  { value: 30,  label: "30 دقيقة" },
  { value: 45,  label: "45 دقيقة" },
  { value: 60,  label: "ساعة"      },
  { value: 90,  label: "ساعة ونصف" },
  { value: 120, label: "ساعتان"    },
];

type DaySlot = {
  dayOfWeek: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
  slotDuration: number;
};

function defaultSlots(): DaySlot[] {
  return Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    enabled: i >= 0 && i <= 4,
    startTime: "09:00",
    endTime: "17:00",
    slotDuration: 60,
  }));
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function AvailabilityPage() {
  const { data: profile } = trpc.consultant.getMyProfile.useQuery();
  const [slots, setSlots] = useState<DaySlot[]>(defaultSlots());
  const [saved, setSaved] = useState(false);

  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const { data: availability } = trpc.consultant.getAvailability.useQuery(
    { consultantId: profile?.id ?? "" },
    { enabled: !!profile?.id },
  );

  useEffect(() => {
    if (availability?.length) {
      setSlots(defaultSlots().map((s) => {
        const existing = availability.find((a) => a.dayOfWeek === s.dayOfWeek);
        return existing
          ? { ...s, enabled: true, startTime: existing.startTime, endTime: existing.endTime, slotDuration: existing.slotDuration }
          : { ...s, enabled: false };
      }));
    }
  }, [availability]);

  const setMutation = trpc.consultant.setAvailability.useMutation({
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  function update(i: number, key: keyof DaySlot, value: unknown) {
    setSlots((s) => s.map((slot, j) => j === i ? { ...slot, [key]: value } : slot));
  }

  function save() {
    setMutation.mutate(slots.filter((s) => s.enabled).map(({ enabled: _, ...s }) => s));
  }

  const daysInMonth    = getDaysInMonth(calYear, calMonth);
  const firstDayOfMonth = getFirstDayOfMonth(calYear, calMonth);
  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const enabledDays = new Set(slots.filter((s) => s.enabled).map((s) => s.dayOfWeek));

  // Time off
  const { data: timeOffs, refetch: refetchTimeOffs } = trpc.consultant.getTimeOff.useQuery();
  const addTimeOff    = trpc.consultant.addTimeOff.useMutation({ onSuccess: () => refetchTimeOffs() });
  const deleteTimeOff = trpc.consultant.deleteTimeOff.useMutation({ onSuccess: () => refetchTimeOffs() });

  // Find time-off record that covers exactly one specific date
  function findTimeOffForDate(day: number): NonNullable<typeof timeOffs>[0] | undefined {
    if (!timeOffs) return undefined;
    const d = new Date(calYear, calMonth, day);
    const dateStr = toISODate(d);
    return timeOffs.find((t) => {
      const s = toISODate(new Date(t.startDate));
      const e = toISODate(new Date(t.endDate));
      return dateStr >= s && dateStr <= e;
    });
  }

  function isInTimeOff(day: number | null): boolean {
    if (!day) return false;
    return !!findTimeOffForDate(day);
  }

  function toISODate(d: Date) {
    return d.toISOString().slice(0, 10);
  }

  // Click on calendar day: toggle blocked
  function toggleDay(day: number | null) {
    if (!day) return;
    const d = new Date(calYear, calMonth, day);
    if (d < new Date(today.getFullYear(), today.getMonth(), today.getDate())) return; // no past
    const existing = findTimeOffForDate(day);
    if (existing) {
      deleteTimeOff.mutate({ id: existing.id });
    } else {
      const dateStr = toISODate(d);
      addTimeOff.mutate({ startDate: dateStr, endDate: dateStr });
    }
  }

  function isAvailable(day: number | null) {
    if (!day) return false;
    if (isInTimeOff(day)) return false;
    return enabledDays.has(new Date(calYear, calMonth, day).getDay());
  }

  function isPast(day: number | null) {
    if (!day) return false;
    return new Date(calYear, calMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  function isToday(day: number | null) {
    return !!day && day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
  }

  function formatDateAr(d: string | Date) {
    return new Intl.DateTimeFormat("ar-IQ", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d));
  }

  return (
    <div dir="rtl" className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg">✅ تم الحفظ</span>}
          <button onClick={save} disabled={setMutation.isPending}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
            {setMutation.isPending ? "جارٍ الحفظ..." : "حفظ الجدول"}
          </button>
        </div>
        <div className="text-right">
          <h1 className="text-xl font-bold text-gray-900">أوقات العمل</h1>
          <p className="text-sm text-gray-400 mt-0.5">حدد أيام وساعات عملك الأسبوعية</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

        {/* ── Weekly schedule ── */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50">
            <p className="font-bold text-gray-800 text-sm">الجدول الأسبوعي المتكرر</p>
            <p className="text-xs text-gray-400 mt-0.5">يطبّق على كل الأسابيع القادمة</p>
          </div>

          <div className="divide-y divide-gray-50">
            {slots.map((slot, i) => (
              <div key={i} className={`px-5 py-4 ${!slot.enabled ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-3">
                  {/* Toggle */}
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input type="checkbox" checked={slot.enabled}
                      onChange={(e) => update(i, "enabled", e.target.checked)} className="sr-only peer" />
                    <div className="w-10 h-5 bg-gray-200 rounded-full peer peer-checked:bg-indigo-600
                      after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white
                      after:rounded-full after:h-4 after:w-4 after:transition-all
                      peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full" />
                  </label>

                  <span className={`w-12 text-sm font-bold flex-shrink-0 ${slot.enabled ? "text-gray-800" : "text-gray-300"}`}>
                    {DAYS_AR[i]}
                  </span>

                  {slot.enabled ? (
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      <input type="time" value={slot.startTime}
                        onChange={(e) => update(i, "startTime", e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-400 bg-white w-28" />
                      <span className="text-gray-300 text-xs">←</span>
                      <input type="time" value={slot.endTime}
                        onChange={(e) => update(i, "endTime", e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-400 bg-white w-28" />
                      <select value={slot.slotDuration}
                        onChange={(e) => update(i, "slotDuration", +e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-400 bg-white">
                        {DURATION_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300 mr-2">مغلق</span>
                  )}
                </div>

                {/* Slot count */}
                {slot.enabled && (() => {
                  const [sh, sm] = slot.startTime.split(":").map(Number);
                  const [eh, em] = slot.endTime.split(":").map(Number);
                  const mins  = (eh * 60 + em) - (sh * 60 + sm);
                  const count = Math.max(0, Math.floor(mins / slot.slotDuration));
                  return (
                    <p className="text-xs text-indigo-400 font-medium mt-1.5 pr-14">
                      {count} موعد متاح يومياً
                    </p>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>

        {/* ── Calendar preview ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50">
            <button onClick={() => calMonth === 0 ? (setCalMonth(11), setCalYear(y => y-1)) : setCalMonth(m => m-1)}
              className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-50 flex items-center justify-center text-base">›</button>
            <p className="text-sm font-bold text-gray-800">{MONTHS_AR[calMonth]} {calYear}</p>
            <button onClick={() => calMonth === 11 ? (setCalMonth(0), setCalYear(y => y+1)) : setCalMonth(m => m+1)}
              className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-50 flex items-center justify-center text-base">‹</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7">
            {DAYS_AR.map((d) => (
              <div key={d} className="text-center py-2 text-xs font-semibold text-gray-300">{d[0]}</div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 gap-0.5 p-2">
            {cells.map((day, idx) => {
              const past      = isPast(day);
              const blocked   = isInTimeOff(day);
              const available = isAvailable(day);
              const todayCell = isToday(day);
              const clickable = !!day && !past && !todayCell;
              return (
                <div key={idx}
                  onClick={() => clickable && toggleDay(day)}
                  title={clickable ? (blocked ? "اضغط لإلغاء التعطيل" : "اضغط لتعطيل هذا اليوم") : undefined}
                  className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                    !day        ? "" :
                    todayCell   ? "bg-indigo-600 text-white font-bold" :
                    past        ? "text-gray-200" :
                    blocked     ? "bg-red-100 text-red-500 cursor-pointer hover:bg-red-200 ring-1 ring-red-200" :
                    available   ? "bg-indigo-50 text-indigo-700 cursor-pointer hover:bg-red-50 hover:text-red-400" :
                                  "text-gray-300 cursor-pointer hover:bg-red-50 hover:text-red-300"
                  }`}>
                  {day ?? ""}
                </div>
              );
            })}
          </div>

          {/* Hint */}
          <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50/50 text-center">
            <p className="text-xs text-gray-400">اضغط على أي يوم لتعطيله أو استعادته</p>
          </div>

          {/* Legend */}
          <div className="px-4 py-2.5 flex justify-center gap-3 flex-wrap">
            {[
              { cls: "bg-indigo-50 border border-indigo-100", label: "متاح"    },
              { cls: "bg-red-100 ring-1 ring-red-200",        label: "معطّل"   },
              { cls: "bg-gray-100",                            label: "مغلق"   },
              { cls: "bg-indigo-600",                          label: "اليوم"  },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${l.cls}`} />
                <span className="text-xs text-gray-400">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Blocked dates list ── */}
      {!!timeOffs?.length && (
        <div className="mt-4 bg-white rounded-2xl border border-red-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-red-50 flex items-center justify-between">
            <span className="text-xs text-red-400">{timeOffs.length} يوم معطّل</span>
            <p className="font-semibold text-gray-800 text-sm">الأيام المعطّلة 🔴</p>
          </div>
          <div className="divide-y divide-gray-50">
            {timeOffs
              .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
              .map((t) => {
                const start = new Date(t.startDate);
                const end   = new Date(t.endDate);
                const days  = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
                return (
                  <div key={t.id} className="flex items-center justify-between px-5 py-3">
                    <button
                      onClick={() => deleteTimeOff.mutate({ id: t.id })}
                      disabled={deleteTimeOff.isPending}
                      className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      إلغاء التعطيل
                    </button>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-800">
                        {formatDateAr(t.startDate)}
                        {toISODate(start) !== toISODate(end) && (
                          <span className="text-gray-400 font-normal mx-1">←</span>
                        )}
                        {toISODate(start) !== toISODate(end) && formatDateAr(t.endDate)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {days === 1 ? "يوم واحد" : `${days} أيام`}
                        {t.note && ` · ${t.note}`}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
