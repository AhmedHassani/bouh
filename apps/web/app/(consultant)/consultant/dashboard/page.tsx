"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";

function formatDate(d: string | Date) {
  return new Intl.DateTimeFormat("ar-IQ", {
    weekday: "short", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

const STATUS_STYLE: Record<string, { label: string; class: string }> = {
  PENDING:   { label: "معلّق",   class: "bg-amber-50 text-amber-700"   },
  CONFIRMED: { label: "مؤكد",    class: "bg-emerald-50 text-emerald-700" },
  COMPLETED: { label: "مكتمل",   class: "bg-gray-50 text-gray-500"     },
  CANCELLED: { label: "ملغي",    class: "bg-red-50 text-red-500"       },
  NO_SHOW:   { label: "لم يحضر", class: "bg-orange-50 text-orange-600" },
};

export default function ConsultantDashboard() {
  const { data: earnings } = trpc.earning.myEarnings.useQuery();
  const { data: upcoming  } = trpc.appointment.myAppointments.useQuery({ status: "CONFIRMED", limit: 5 });
  const { data: allAppts  } = trpc.appointment.myAppointments.useQuery({ limit: 1 }); // for total count
  const { data: profile   } = trpc.consultant.getMyProfile.useQuery();

  const totalSessions  = allAppts?.total ?? 0;
  const upcomingCount  = upcoming?.total ?? 0;
  const grossRevenue   = earnings?.totals.gross ?? 0;
  const netRevenue     = earnings?.totals.net ?? 0;

  const stats = [
    { label: "إجمالي الجلسات",   value: totalSessions,                                     icon: "📅", sub: "كل الحالات"    },
    { label: "المواعيد القادمة", value: upcomingCount,                                      icon: "⏰", sub: "مؤكدة فقط"    },
    { label: "إجمالي الإيرادات", value: `${grossRevenue.toLocaleString("ar")} د.ع`,         icon: "💰", sub: "قبل العمولة"  },
    { label: "صافي الأرباح",     value: `${netRevenue.toLocaleString("ar")} د.ع`,           icon: "✅", sub: "بعد العمولة"  },
  ];

  return (
    <div dir="rtl">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">
          مرحباً، {profile?.user?.name ?? "المستشار"} 👋
        </h1>
        <p className="text-sm text-gray-400 mt-1">نظرة عامة على نشاطك</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400 bg-gray-50 rounded-lg px-2 py-1">{s.sub}</span>
              <span className="text-2xl">{s.icon}</span>
            </div>
            <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming appointments */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <Link href="/consultant/appointments" className="text-xs text-indigo-600 font-medium hover:underline">
              عرض الكل
            </Link>
            <h2 className="font-bold text-gray-800 text-sm">المواعيد القادمة</h2>
          </div>

          {upcoming?.data && upcoming.data.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {upcoming.data.map((appt) => {
                const s = STATUS_STYLE[appt.status];
                return (
                  <div key={appt.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${s.class}`}>{s.label}</span>
                      <span className="text-sm font-semibold text-gray-700">
                        {Number(appt.finalPrice).toLocaleString("ar")} د.ع
                      </span>
                    </div>
                    <div className="text-right min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {appt.client?.user.name ?? appt.anonUser?.nickname ?? "مجهول"}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(appt.scheduledAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-gray-300">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-sm">لا توجد مواعيد قادمة</p>
            </div>
          )}
        </div>

        {/* Profile summary */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <Link href="/consultant/profile" className="text-xs text-indigo-600 font-medium hover:underline">
              عرض الملف
            </Link>
            <h2 className="font-bold text-gray-800 text-sm">ملفي المهني</h2>
          </div>
          {profile ? (
            <div className="divide-y divide-gray-50">
              {[
                { label: "سعر الجلسة", value: `${Number(profile.sessionPrice).toLocaleString("ar")} د.ع` },
                { label: "التقييم",    value: `⭐ ${Number(profile.rating).toFixed(1)} (${profile.totalReviews} تقييم)` },
                { label: "الخبرة",     value: `${profile.yearsOfExperience} سنة` },
                { label: "المدينة",    value: profile.city ?? "—" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm font-medium text-gray-700">{item.value}</span>
                  <span className="text-xs text-gray-400">{item.label}</span>
                </div>
              ))}
              <div className="px-5 py-3">
                <p className="text-xs text-gray-400 mb-2 text-right">التخصصات</p>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {profile.specializations.map((s) => (
                    <span key={s.specializationId} className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg font-medium">
                      {s.specialization.nameAr}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 flex justify-center">
              <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
