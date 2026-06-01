"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui/page-header";
import { appointmentStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/data-table";

export default function MyAppointmentsPage() {
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [cancelId, setCancelId] = useState<string | null>(null);

  const { data, refetch } = trpc.appointment.myBookings.useQuery({
    status: tab === "upcoming" ? "CONFIRMED" : undefined,
    page,
    limit: 10,
  });

  const updateStatus = trpc.appointment.updateStatus.useMutation({
    onSuccess: () => { refetch(); setCancelId(null); },
  });

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-indigo-600">مساحة بوح</Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <PageHeader title="مواعيدي" />

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
          {(["upcoming", "past"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setPage(1); }}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {t === "upcoming" ? "القادمة" : "السابقة"}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {data?.data.map((appt) => (
            <div key={appt.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold flex-shrink-0">
                    {appt.consultant.user.name?.[0] ?? "؟"}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{appt.consultant.user.name}</h3>
                    <p className="text-sm text-gray-500">{new Date(appt.scheduledAt).toLocaleString("ar-SA")}</p>
                    <p className="text-sm text-gray-500">مدة الجلسة: {appt.duration} دقيقة</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {appointmentStatusBadge(appt.status)}
                  <p className="font-bold text-indigo-600">{Number(appt.finalPrice)} ر.س</p>
                </div>
              </div>

              {appt.notes && (
                <p className="text-sm text-gray-400 mt-3 bg-gray-50 rounded-xl px-4 py-2">{appt.notes}</p>
              )}

              {["PENDING", "CONFIRMED"].includes(appt.status) && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                  <Button size="sm" variant="danger" onClick={() => setCancelId(appt.id)}>إلغاء الموعد</Button>
                </div>
              )}
            </div>
          ))}

          {data?.data.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
              <p className="text-5xl mb-3">📅</p>
              <p className="text-gray-500">لا توجد مواعيد {tab === "upcoming" ? "قادمة" : "سابقة"}</p>
              <Link href="/consultants" className="inline-block mt-4 text-indigo-600 hover:underline text-sm">
                تصفح المستشارين
              </Link>
            </div>
          )}
        </div>

        <div className="mt-4">
          <Pagination page={page} total={data?.total ?? 0} limit={10} onChange={setPage} />
        </div>
      </div>

      <Modal open={!!cancelId} onClose={() => setCancelId(null)} title="إلغاء الموعد" size="sm">
        <p className="text-gray-600 mb-6">هل أنت متأكد من إلغاء هذا الموعد؟</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setCancelId(null)}>لا، أبقِه</Button>
          <Button variant="danger" loading={updateStatus.isPending}
            onClick={() => cancelId && updateStatus.mutate({ id: cancelId, status: "CANCELLED" })}>
            نعم، ألغِه
          </Button>
        </div>
      </Modal>
    </div>
  );
}
