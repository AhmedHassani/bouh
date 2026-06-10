"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/form";

const STATUSES = [
  { value: "", label: "الكل" },
  { value: "PENDING",   label: "معلّق",    dot: "bg-amber-400"   },
  { value: "CONFIRMED", label: "مؤكد",     dot: "bg-emerald-400" },
  { value: "COMPLETED", label: "مكتمل",    dot: "bg-gray-400"    },
  { value: "CANCELLED", label: "ملغي",     dot: "bg-red-400"     },
  { value: "NO_SHOW",   label: "لم يحضر",  dot: "bg-orange-400"  },
];

const STATUS_STYLE: Record<string, string> = {
  PENDING:   "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-gray-50 text-gray-500",
  CANCELLED: "bg-red-50 text-red-500",
  NO_SHOW:   "bg-orange-50 text-orange-600",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "معلّق", CONFIRMED: "مؤكد", COMPLETED: "مكتمل", CANCELLED: "ملغي", NO_SHOW: "لم يحضر",
};

function formatDate(d: string | Date) {
  return new Intl.DateTimeFormat("ar-IQ", {
    weekday: "short", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

export default function ConsultantAppointmentsPage() {
  const [page, setPage]       = useState(1);
  const [status, setStatus]   = useState("");
  const [actionModal, setActionModal] = useState<{ id: string; action: string; label: string } | null>(null);

  const { data, refetch } = trpc.appointment.myAppointments.useQuery({
    status: (status || undefined) as never,
    page, limit: 15,
  });

  const updateStatus = trpc.appointment.updateStatus.useMutation({
    onSuccess: () => { refetch(); setActionModal(null); },
  });

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm text-gray-400">{data?.total ?? 0} موعد</span>
        <h1 className="text-xl font-bold text-gray-900">المواعيد</h1>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => { setStatus(s.value); setPage(1); }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
              status === s.value
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-gray-500 border border-gray-100 hover:border-indigo-200 hover:text-indigo-600"
            }`}
          >
            {s.dot && <span className={`w-2 h-2 rounded-full ${status === s.value ? "bg-white/70" : s.dot}`} />}
            {s.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      {!data?.data.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-gray-300">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-sm">لا توجد مواعيد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.data.map((appt) => {
            const isPast = new Date(appt.scheduledAt) < new Date();
            return (
              <div key={appt.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 hover:border-indigo-100 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {appt.status === "PENDING" && (
                      <button onClick={() => setActionModal({ id: appt.id, action: "CONFIRMED", label: "تأكيد الموعد" })}
                        className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">
                        تأكيد
                      </button>
                    )}
                    {appt.status === "CONFIRMED" && (
                      <button onClick={() => setActionModal({ id: appt.id, action: "COMPLETED", label: "إنهاء الجلسة" })}
                        className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                        اكتمل
                      </button>
                    )}
                    {["PENDING", "CONFIRMED"].includes(appt.status) && (
                      <button onClick={() => setActionModal({ id: appt.id, action: "CANCELLED", label: "إلغاء الموعد" })}
                        className="text-xs px-3 py-1.5 bg-red-50 text-red-500 rounded-lg font-medium hover:bg-red-100 transition-colors">
                        إلغاء
                      </button>
                    )}
                    {appt.status === "CONFIRMED" && !isPast && (
                      <button onClick={() => setActionModal({ id: appt.id, action: "NO_SHOW", label: "تسجيل غياب" })}
                        className="text-xs px-3 py-1.5 bg-orange-50 text-orange-500 rounded-lg font-medium hover:bg-orange-100 transition-colors">
                        غياب
                      </button>
                    )}
                    {appt.meetingLink && appt.status === "CONFIRMED" && (
                      <>
                        <a href={appt.meetingLink} target="_blank" rel="noreferrer"
                          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-center flex items-center gap-1.5 justify-center">
                          <span>📹</span> ابدأ الجلسة
                        </a>
                        <button
                          onClick={() => navigator.clipboard.writeText(appt.meetingLink!)}
                          className="text-xs px-3 py-1.5 bg-gray-50 text-gray-500 rounded-lg font-medium hover:bg-gray-100 transition-colors text-center">
                          📋 نسخ الرابط
                        </button>
                      </>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-right min-w-0">
                    {/* Meeting link banner */}
                    {appt.meetingLink && appt.status === "CONFIRMED" && (
                      <div className="flex items-center justify-end gap-2 mb-2 bg-blue-50 rounded-xl px-3 py-2">
                        <a href={appt.meetingLink} target="_blank" rel="noreferrer"
                          className="text-xs text-blue-600 font-medium hover:underline truncate max-w-48 dir-ltr text-left">
                          {appt.meetingLink}
                        </a>
                        <span className="text-xs text-blue-400">🔗 رابط الجلسة</span>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2 mb-2">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg ${STATUS_STYLE[appt.status]}`}>
                        {STATUS_LABEL[appt.status]}
                      </span>
                      <p className="font-bold text-gray-900">
                        {appt.client?.user.name ?? appt.anonUser?.nickname ?? "مجهول"}
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-4 text-sm text-gray-500">
                      <span>⏱ {appt.duration} د</span>
                      <span>💰 {Number(appt.finalPrice).toLocaleString("ar")} د.ع</span>
                      <span>📅 {formatDate(appt.scheduledAt)}</span>
                    </div>
                    {appt.client?.user.email && (
                      <p className="text-xs text-gray-300 mt-1">{appt.client.user.email}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {(data?.total ?? 0) > 15 && (
        <div className="flex justify-center gap-2 mt-5">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm disabled:opacity-40 hover:border-indigo-300 transition-colors">
            ← السابق
          </button>
          <span className="px-4 py-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-xl">{page}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={(data?.data.length ?? 0) < 15}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm disabled:opacity-40 hover:border-indigo-300 transition-colors">
            التالي →
          </button>
        </div>
      )}

      {/* Confirm modal */}
      <Modal open={!!actionModal} onClose={() => setActionModal(null)} title={actionModal?.label ?? ""} size="sm">
        <p className="text-gray-600 mb-6 text-right text-sm">هل تريد {actionModal?.label}؟</p>
        <div className="flex gap-3 justify-start">
          <Button variant="secondary" onClick={() => setActionModal(null)}>إلغاء</Button>
          <Button
            variant={actionModal?.action === "CANCELLED" ? "danger" : "primary"}
            loading={updateStatus.isPending}
            onClick={() => actionModal && updateStatus.mutate({ id: actionModal.id, status: actionModal.action as never })}
          >
            تأكيد
          </Button>
        </div>
      </Modal>
    </div>
  );
}
