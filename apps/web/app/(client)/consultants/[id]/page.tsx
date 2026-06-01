"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

export default function ConsultantProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: consultant, isLoading } = trpc.consultant.getById.useQuery({ id });

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    scheduledAt: "",
    notes: "",
    couponCode: "",
  });
  const [couponApplied, setCouponApplied] = useState<{ discount: number; code: string } | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const validateCoupon = trpc.coupon.validate.useQuery(
    { code: bookingForm.couponCode, consultantId: id },
    { enabled: bookingForm.couponCode.length >= 3 },
  );

  const createBooking = trpc.appointment.create.useMutation({
    onSuccess: () => {
      setBookingSuccess(true);
      setTimeout(() => { setBookingOpen(false); setBookingSuccess(false); }, 2000);
    },
  });

  const sessionPrice = Number(consultant?.sessionPrice ?? 0);
  const discount = couponApplied?.discount ?? 0;
  const finalPrice = Math.max(0, sessionPrice - discount);

  const applyCoupon = () => {
    if (!validateCoupon.data?.valid || !validateCoupon.data.coupon) return;
    const c = validateCoupon.data.coupon;
    let d = 0;
    if (c.discountType === "PERCENTAGE") {
      d = (sessionPrice * Number(c.discountValue)) / 100;
      if (c.maxDiscount) d = Math.min(d, Number(c.maxDiscount));
    } else {
      d = Math.min(Number(c.discountValue), sessionPrice);
    }
    setCouponApplied({ discount: d, code: bookingForm.couponCode });
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-gray-400">جاري التحميل...</div>;
  if (!consultant) return <div className="min-h-screen flex items-center justify-center text-gray-400">المستشار غير موجود</div>;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Back */}
        <a href="/consultants" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 mb-6">
          ← العودة للمستشارين
        </a>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — Profile */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex gap-5">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-4xl font-bold text-indigo-600 flex-shrink-0">
                  {consultant.user.name?.[0] ?? "؟"}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{consultant.user.name}</h1>
                  <p className="text-gray-500 text-sm mt-1">{consultant.city}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-amber-400">⭐</span>
                    <span className="font-medium">{Number(consultant.rating).toFixed(1)}</span>
                    <span className="text-gray-400 text-sm">({consultant._count.reviews} تقييم)</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-500 text-sm">{consultant.yearsOfExperience} سنة خبرة</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {consultant.specializations.map((s) => (
                      <Badge key={s.specializationId} variant="info">{s.specialization.nameAr}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bio */}
            {consultant.bio && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-3">نبذة تعريفية</h2>
                <p className="text-gray-600 leading-relaxed">{consultant.bio}</p>
              </div>
            )}

            {/* Qualifications */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4">المؤهلات والشهادات</h2>
              {consultant.academicQualification && (
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-indigo-500">🎓</span>
                  <p className="text-gray-700">{consultant.academicQualification}</p>
                </div>
              )}
              {consultant.certifications.length > 0 && (
                <div className="space-y-2">
                  {consultant.certifications.map((cert, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-emerald-500">✅</span>
                      <p className="text-gray-700 text-sm">{cert}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reviews */}
            {consultant.reviews && consultant.reviews.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-4">التقييمات</h2>
                <div className="space-y-4">
                  {consultant.reviews.map((r) => (
                    <div key={r.id} className="border-b border-gray-50 pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-700 text-sm">{r.client.user.name}</span>
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <span key={i} className={i < r.rating ? "text-amber-400" : "text-gray-200"}>⭐</span>
                          ))}
                        </div>
                      </div>
                      {r.comment && <p className="text-sm text-gray-500">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — Booking card */}
          <div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm sticky top-6">
              <p className="text-gray-500 text-sm mb-1">سعر الجلسة</p>
              <p className="text-3xl font-bold text-indigo-600 mb-4">{Number(consultant.sessionPrice)} ر.س</p>

              <div className="space-y-2 text-sm text-gray-600 mb-6">
                <div className="flex items-center gap-2"><span>📅</span> جلسة مدتها 60 دقيقة</div>
                <div className="flex items-center gap-2"><span>🔒</span> جلسة سرية وآمنة</div>
                <div className="flex items-center gap-2"><span>⭐</span> {consultant._count.appointments} جلسة مكتملة</div>
              </div>

              <Button className="w-full" onClick={() => setBookingOpen(true)}>احجز جلسة الآن</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <Modal open={bookingOpen} onClose={() => setBookingOpen(false)} title="حجز جلسة" size="md">
        {bookingSuccess ? (
          <div className="text-center py-8">
            <p className="text-5xl mb-4">✅</p>
            <p className="text-xl font-bold text-gray-900 mb-2">تم الحجز بنجاح!</p>
            <p className="text-gray-500">سيتواصل معك المستشار لتأكيد الموعد</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="تاريخ ووقت الجلسة"
              type="datetime-local"
              value={bookingForm.scheduledAt}
              onChange={(e) => setBookingForm((f) => ({ ...f, scheduledAt: e.target.value }))}
            />
            <Textarea
              label="ملاحظات (اختياري)"
              placeholder="اذكر ما تريد مناقشته..."
              value={bookingForm.notes}
              onChange={(e) => setBookingForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />

            {/* Coupon */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">كوبون الخصم (اختياري)</label>
              <div className="flex gap-2">
                <input
                  value={bookingForm.couponCode}
                  onChange={(e) => { setBookingForm((f) => ({ ...f, couponCode: e.target.value.toUpperCase() })); setCouponApplied(null); }}
                  placeholder="أدخل الكود"
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 font-mono"
                />
                <Button size="sm" variant="secondary" onClick={applyCoupon} disabled={!validateCoupon.data?.valid}>تطبيق</Button>
              </div>
              {bookingForm.couponCode && validateCoupon.data?.valid === false && (
                <p className="text-xs text-rose-500 mt-1">الكوبون غير صالح</p>
              )}
              {couponApplied && (
                <p className="text-xs text-emerald-600 mt-1">✅ خصم {couponApplied.discount} ر.س مطبّق</p>
              )}
            </div>

            {/* Price summary */}
            <div className="bg-gray-50 rounded-xl p-4 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">سعر الجلسة</span>
                <span>{sessionPrice} ر.س</span>
              </div>
              {couponApplied && (
                <div className="flex justify-between mb-1 text-emerald-600">
                  <span>خصم الكوبون</span>
                  <span>-{discount} ر.س</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-100">
                <span>الإجمالي</span>
                <span className="text-indigo-600">{finalPrice} ر.س</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="secondary" onClick={() => setBookingOpen(false)}>إلغاء</Button>
              <Button
                onClick={() => createBooking.mutate({ consultantId: id, scheduledAt: new Date(bookingForm.scheduledAt).toISOString(), notes: bookingForm.notes, couponCode: couponApplied?.code })}
                loading={createBooking.isPending}
                disabled={!bookingForm.scheduledAt}
              >
                تأكيد الحجز ({finalPrice} ر.س)
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
