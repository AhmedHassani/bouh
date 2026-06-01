"use client";

import { trpc } from "@/lib/trpc/client";
import { StatsCard } from "@/components/ui/stats-card";
import { PageHeader } from "@/components/ui/page-header";
import { appointmentStatusBadge } from "@/components/ui/badge";

export default function ConsultantDashboard() {
  const { data: earnings } = trpc.earning.myEarnings.useQuery();
  const { data: upcoming } = trpc.appointment.myAppointments.useQuery({ status: "CONFIRMED", limit: 5 });
  const { data: profile } = trpc.consultant.getMyProfile.useQuery();

  return (
    <div>
      <PageHeader title={`مرحباً، ${profile?.user?.name ?? "المستشار"}`} subtitle="نظرة عامة على نشاطك" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="إجمالي الجلسات" value={earnings?.totals.sessions ?? 0} icon="📅" color="indigo" />
        <StatsCard title="إجمالي الإيرادات" value={`${(earnings?.totals.gross ?? 0).toLocaleString("ar")} ر.س`} icon="💰" color="amber" />
        <StatsCard title="عمولة المنصة" value={`${(earnings?.totals.commission ?? 0).toLocaleString("ar")} ر.س`} icon="📈" color="rose" />
        <StatsCard title="صافي الأرباح" value={`${(earnings?.totals.net ?? 0).toLocaleString("ar")} ر.س`} icon="✅" color="emerald" />
      </div>

      {/* Profile info */}
      {profile && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">ملفي المهني</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">سعر الجلسة</span>
                <span className="font-medium">{Number(profile.sessionPrice)} ر.س</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">التقييم</span>
                <span className="font-medium">⭐ {Number(profile.rating).toFixed(1)} ({profile.totalReviews} تقييم)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">سنوات الخبرة</span>
                <span className="font-medium">{profile.yearsOfExperience} سنة</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">المدينة</span>
                <span className="font-medium">{profile.city ?? "-"}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">التخصصات</h3>
            <div className="flex flex-wrap gap-2">
              {profile.specializations.map((s) => (
                <span key={s.specializationId} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium">
                  {s.specialization.nameAr}
                </span>
              ))}
              {profile.specializations.length === 0 && <p className="text-sm text-gray-400">لا توجد تخصصات</p>}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming appointments */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">المواعيد القادمة</h3>
        {upcoming?.data && upcoming.data.length > 0 ? (
          <div className="space-y-3">
            {upcoming.data.map((appt) => (
              <div key={appt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-800 text-sm">{appt.client?.user.name ?? appt.anonUser?.nickname ?? "مجهول"}</p>
                  <p className="text-xs text-gray-400">{new Date(appt.scheduledAt).toLocaleString("ar-SA")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">{Number(appt.finalPrice)} ر.س</span>
                  {appointmentStatusBadge(appt.status)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">لا توجد مواعيد قادمة</p>
        )}
      </div>
    </div>
  );
}
