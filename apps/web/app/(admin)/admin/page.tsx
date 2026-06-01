"use client";

import { trpc } from "@/lib/trpc/client";
import { StatsCard } from "@/components/ui/stats-card";
import { PageHeader } from "@/components/ui/page-header";
import { appointmentStatusBadge } from "@/components/ui/badge";

export default function AdminDashboard() {
  const { data, isLoading } = trpc.admin.dashboard.useQuery();

  if (isLoading) {
    return (
      <div>
        <PageHeader title="لوحة التحكم" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 bg-white rounded-2xl border border-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  const s = data?.stats;

  return (
    <div>
      <PageHeader title="لوحة التحكم" subtitle="نظرة عامة على منصة مساحة بوح" />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatsCard title="إجمالي العملاء" value={s?.totalClients ?? 0} icon="👥" color="indigo" />
        <StatsCard title="المستشارون" value={s?.totalConsultants ?? 0} icon="👩‍⚕️" color="purple" />
        <StatsCard title="إجمالي الجلسات" value={s?.totalAppointments ?? 0} icon="📅" color="emerald" />
        <StatsCard title="الجلسات المكتملة" value={s?.completedAppointments ?? 0} icon="✅" color="emerald" />
        <StatsCard
          title="إجمالي الإيرادات"
          value={`${(s?.totalRevenue ?? 0).toLocaleString("ar")} ر.س`}
          icon="💰"
          color="amber"
        />
        <StatsCard
          title="إجمالي العمولات"
          value={`${(s?.totalCommissions ?? 0).toLocaleString("ar")} ر.س`}
          icon="📈"
          color="rose"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appointments by Status */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">الجلسات حسب الحالة</h3>
          <div className="space-y-3">
            {data?.appointmentsByStatus &&
              Object.entries(data.appointmentsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  {appointmentStatusBadge(status)}
                  <span className="font-semibold text-gray-700">{count as number}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Top Consultants */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">أبرز المستشارين</h3>
          <div className="space-y-3">
            {data?.topConsultants?.map((c) => (
              <div key={c.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                    {c.user.name?.[0] ?? "؟"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.user.name}</p>
                    <p className="text-xs text-gray-400">⭐ {Number(c.rating).toFixed(1)}</p>
                  </div>
                </div>
                <span className="text-sm text-gray-500">{c._count.appointments} جلسة</span>
              </div>
            ))}
            {(!data?.topConsultants || data.topConsultants.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-4">لا يوجد مستشارون بعد</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Appointments */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">آخر الجلسات</h3>
        {data?.recentAppointments && data.recentAppointments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-gray-500 border-b border-gray-50">
                  <th className="pb-3 font-medium">العميل</th>
                  <th className="pb-3 font-medium">المستشار</th>
                  <th className="pb-3 font-medium">التاريخ</th>
                  <th className="pb-3 font-medium">السعر</th>
                  <th className="pb-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAppointments.map((appt) => (
                  <tr key={appt.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 text-gray-700">{appt.client?.user.name ?? appt.client?.user.email ?? appt.anonUser?.nickname ?? "مجهول"}</td>
                    <td className="py-3 text-gray-700">{appt.consultant.user.name}</td>
                    <td className="py-3 text-gray-500">
                      {new Date(appt.scheduledAt).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="py-3 text-gray-700">{Number(appt.finalPrice).toLocaleString("ar")} ر.س</td>
                    <td className="py-3">{appointmentStatusBadge(appt.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">لا توجد جلسات بعد</p>
        )}
      </div>
    </div>
  );
}
