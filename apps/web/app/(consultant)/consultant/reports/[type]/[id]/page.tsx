"use client";

import { use, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { RichEditor } from "@/components/ui/rich-editor";

function formatDate(d: string | Date) {
  const date = new Date(d);
  const day   = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year  = date.getFullYear();
  return `${day}/${month}/${year}`;
}
function formatTime(d: string | Date) {
  const date = new Date(d);
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export default function ClientReportsPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = use(params);
  const clientType = (type === "client" ? "client" : "anon") as "client" | "anon";

  const { data: reports, isLoading, refetch } = trpc.sessionReport.listByClient.useQuery({
    clientType, clientId: id,
  });

  const [editing, setEditing] = useState<{ appointmentId: string; content: string } | null>(null);
  const upsert = trpc.sessionReport.upsert.useMutation({
    onSuccess: () => { refetch(); setEditing(null); },
  });

  const clientName = reports?.[0]?.appointment.client?.user.name
    ?? reports?.[0]?.appointment.anonUser?.nickname
    ?? "—";
  const clientAvatar = reports?.[0]?.appointment.client?.user.avatar;

  return (
    <div dir="rtl" className="max-w-4xl">
      {/* Back link */}
      <Link href="/consultant/reports"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5">
        <span>→</span> العودة للتقارير
      </Link>

      {/* Client header */}
      {reports && reports.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-lg font-bold text-indigo-600 overflow-hidden ring-2 ring-white flex-shrink-0">
            {clientAvatar ? (
              <img src={clientAvatar} alt="" className="w-full h-full object-cover" />
            ) : (clientName[0] ?? "؟")}
          </div>
          <div className="text-right flex-1">
            <h1 className="text-xl font-extrabold text-gray-900">{clientName}</h1>
            <p className="text-sm text-gray-400 mt-1">
              {reports.length} {reports.length === 1 ? "تقرير" : "تقارير"} · جلسات سابقة
            </p>
          </div>
          <div className="flex items-center gap-2 text-gray-300 flex-shrink-0">
            <span className="text-xl">🔒</span>
          </div>
        </div>
      )}

      {/* Reports list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : !reports?.length ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-20 text-center">
          <p className="text-5xl mb-3">📝</p>
          <p className="text-sm text-gray-400">لا توجد تقارير لهذا العميل</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => {
            const isEditing = editing?.appointmentId === r.appointmentId;
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Session header */}
                <div className="px-5 py-3 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setEditing(isEditing ? null : {
                      appointmentId: r.appointmentId,
                      content: r.content,
                    })}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {isEditing ? "إلغاء" : "✎ تعديل"}
                  </button>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">جلسة بتاريخ</p>
                    <p className="text-sm font-bold text-gray-900">
                      {formatDate(r.appointment.scheduledAt)} — {formatTime(r.appointment.scheduledAt)}
                    </p>
                  </div>
                </div>

                {/* Content */}
                {isEditing ? (
                  <div className="p-5">
                    <RichEditor
                      value={editing.content}
                      onChange={(v) => setEditing({ ...editing, content: v })}
                      autoFocus
                      minHeight={280}
                    />
                    <div className="flex gap-2 pt-4 mt-4 border-t border-gray-100">
                      <button
                        onClick={() => upsert.mutate({ appointmentId: r.appointmentId, content: editing.content })}
                        disabled={!editing.content.replace(/<[^>]*>/g, "").trim() || upsert.isPending}
                        className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40"
                      >
                        {upsert.isPending ? "..." : "حفظ التعديلات"}
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl"
                      >إلغاء</button>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-4">
                    <div
                      className="prose prose-sm max-w-none text-right text-gray-800 leading-relaxed"
                      dir="rtl"
                      dangerouslySetInnerHTML={{ __html: r.content }}
                    />
                    <p className="text-[10px] text-gray-300 mt-3 pt-3 border-t border-gray-50 text-right">
                      آخر تحديث: {formatDate(r.updatedAt)} — {formatTime(r.updatedAt)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

