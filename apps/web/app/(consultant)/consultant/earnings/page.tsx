"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui/page-header";
import { StatsCard } from "@/components/ui/stats-card";
import { DataTable, Pagination } from "@/components/ui/data-table";

export default function EarningsPage() {
  const [page, setPage] = useState(1);
  const { data } = trpc.earning.myEarnings.useQuery({ page, limit: 15 });

  type Row = NonNullable<typeof data>["data"][number];

  const columns = [
    { key: "client", header: "العميل", render: (r: Row) => r.appointment.client?.user.name ?? r.appointment.anonUser?.nickname ?? "مجهول" },
    { key: "date", header: "تاريخ الجلسة", render: (r: Row) => new Date(r.appointment.scheduledAt).toLocaleDateString("ar-SA") },
    { key: "gross", header: "السعر الكامل", render: (r: Row) => `${Number(r.grossAmount)} د.ع` },
    { key: "commission", header: "عمولة المنصة", render: (r: Row) => <span className="text-rose-600">-{Number(r.commissionAmount)} د.ع</span> },
    { key: "net", header: "صافي الربح", render: (r: Row) => <span className="text-emerald-600 font-semibold">{Number(r.netAmount)} د.ع</span> },
    { key: "paid", header: "الحالة", render: (r: Row) => r.isPaid ? <span className="text-emerald-600 text-xs font-medium">✅ محوّل</span> : <span className="text-amber-600 text-xs font-medium">⏳ معلّق</span> },
  ];

  return (
    <div>
      <PageHeader title="الأرباح والعمولات" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="إجمالي الجلسات" value={data?.totals.sessions ?? 0} icon="📅" color="indigo" />
        <StatsCard title="إجمالي الإيرادات" value={`${(data?.totals.gross ?? 0).toLocaleString("ar")} د.ع`} icon="💰" color="amber" />
        <StatsCard title="عمولة المنصة" value={`${(data?.totals.commission ?? 0).toLocaleString("ar")} د.ع`} icon="📤" color="rose" />
        <StatsCard title="صافي أرباحك" value={`${(data?.totals.net ?? 0).toLocaleString("ar")} د.ع`} icon="✅" color="emerald" />
      </div>

      <DataTable
        data={(data?.data ?? []) as Record<string, unknown>[]}
        columns={columns as never}
        emptyMessage="لا توجد أرباح بعد"
      />
      <Pagination page={page} total={data?.total ?? 0} limit={15} onChange={setPage} />
    </div>
  );
}
