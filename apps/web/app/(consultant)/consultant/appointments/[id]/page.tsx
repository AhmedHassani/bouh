"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc/client";
import { appointmentStatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export default function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: appointment, isLoading } = trpc.appointment.getById.useQuery({ id });
  const { data: assessmentResult, isLoading: resultLoading } = trpc.anonymous.getAssessmentForAppointment.useQuery(
    { appointmentId: id },
    { enabled: !!appointment }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        جارٍ التحميل...
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        الموعد غير موجود
      </div>
    );
  }

  const clientName = appointment.client?.user.name ?? appointment.anonUser?.nickname ?? "عميل مجهول";
  const isAnon = !appointment.client && !!appointment.anonUser;

  return (
    <div dir="rtl">
      <PageHeader
        title={`موعد مع ${clientName}`}
        subtitle={new Date(appointment.scheduledAt).toLocaleString("ar-SA", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        })}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appointment info */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">تفاصيل الموعد</h3>
            <div className="space-y-3">
              <Row label="الحالة" value={appointmentStatusBadge(appointment.status)} />
              <Row label="العميل" value={
                <span className="flex items-center gap-2">
                  {clientName}
                  {isAnon && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">مجهول</span>}
                </span>
              } />
              <Row label="المدة" value={`${appointment.duration} دقيقة`} />
              <Row label="طريقة الدفع" value={
                appointment.paymentMethod === "ELECTRONIC" ? "💳 إلكتروني" :
                appointment.paymentMethod === "REPRESENTATIVE" ? "🤝 عبر الممثل" : "—"
              } />
              <Row label="حالة الدفع" value={
                appointment.paymentStatus === "PAID" ? "✅ مدفوع" :
                appointment.paymentStatus === "PENDING" ? "⏳ قيد الانتظار" :
                appointment.paymentStatus === "REFUNDED" ? "↩️ مسترجع" : "❌ فشل"
              } />
              <Row label="السعر الأصلي" value={`${Number(appointment.originalPrice)} د.ع`} />
              {Number(appointment.discountAmount) > 0 && (
                <Row label="الخصم" value={`-${Number(appointment.discountAmount)} د.ع`} />
              )}
              <Row label="الإجمالي" value={
                <span className="font-bold text-indigo-600">{Number(appointment.finalPrice)} د.ع</span>
              } />
              {appointment.meetingLink && (
                <Row label="رابط الجلسة" value={
                  <a href={appointment.meetingLink} target="_blank" rel="noreferrer"
                    className="text-indigo-600 underline text-sm">فتح الرابط</a>
                } />
              )}
              {appointment.notes && (
                <div className="pt-2 border-t border-gray-50">
                  <p className="text-xs text-gray-400 mb-1">ملاحظات العميل</p>
                  <p className="text-sm text-gray-600">{appointment.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Assessment result */}
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">🧠 نتيجة التقييم النفسي</h3>

            {resultLoading ? (
              <p className="text-sm text-gray-400 animate-pulse">جارٍ التحميل...</p>
            ) : !assessmentResult ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm text-gray-400">لم يُجرِ هذا العميل تقييمًا نفسيًا</p>
              </div>
            ) : (
              <div>
                <div className="bg-indigo-50 rounded-xl p-4 mb-4">
                  <p className="text-xs text-indigo-400 mb-1">التصنيف</p>
                  <p className="text-lg font-bold text-indigo-700">{assessmentResult.categoryLabel ?? "غير محدد"}</p>
                  <p className="text-xs text-gray-400 mt-1">المجموع: {assessmentResult.totalScore} نقطة</p>
                </div>

                {assessmentResult.recommendation && (
                  <div className="bg-amber-50 rounded-xl p-4 mb-4">
                    <p className="text-xs text-amber-600 mb-1 font-medium">التوصية</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{assessmentResult.recommendation}</p>
                  </div>
                )}

                {assessmentResult.answers && assessmentResult.answers.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-3">تفاصيل الإجابات</p>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {[...assessmentResult.answers]
                        .sort((a, b) => a.question.order - b.question.order)
                        .map((ans) => (
                          <div key={ans.id} className="text-xs border border-gray-100 rounded-lg p-2.5">
                            <p className="text-gray-600 mb-1">{ans.question.textAr}</p>
                            <p className="text-indigo-600 font-medium">{ans.option.textAr}
                              <span className="text-gray-400 mr-1">({ans.score} نقطة)</span>
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}
