"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useAnonymousIdentity } from "@/lib/hooks/useAnonymousIdentity";
import { useRouter } from "next/navigation";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
}

function formatDateAr(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ar-SA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function hoursUntil(iso: string) {
  return (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60);
}

// Generate next 14 days
function getNextDays(n = 14) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().slice(0, 10);
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConsultantProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { identity } = useAnonymousIdentity();

  const { data: consultant, isLoading } = trpc.consultant.getById.useQuery({ id });

  // Booking state
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"REPRESENTATIVE" | "ELECTRONIC" | "PACKAGE" | "">("");
  const [selectedPkgId, setSelectedPkgId] = useState<string>("");

  // Fetch user's active packages with remaining sessions
  const { data: myPackages } = trpc.package.myPackages.useQuery(
    { anonUserId: identity?.anonUserId ?? "" },
    { enabled: !!identity?.anonUserId },
  );
  const availablePackages = myPackages?.filter((p) => p.totalSessions - p.usedSessions > 0) ?? [];
  const [notes, setNotes] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ discount: number; code: string } | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState("");

  const { data: slotsData, isLoading: slotsLoading } = trpc.anonymous.getTimeSlots.useQuery(
    { consultantId: id, date: selectedDate },
    { enabled: !!selectedDate }
  );

  const validateCoupon = trpc.coupon.validate.useQuery(
    { code: couponCode, consultantId: id },
    { enabled: couponCode.length >= 3 }
  );

  const startZainCash = trpc.anonymous.startZainCashPayment.useMutation({
    onSuccess: (data) => {
      // Redirect to ZainCash payment page
      window.location.href = data.paymentUrl;
    },
    onError: (err) => {
      setBookingError(`فشل بدء الدفع: ${err.message}`);
    },
  });

  const createBooking = trpc.anonymous.createAppointment.useMutation({
    onSuccess: (appt) => {
      // If electronic payment, immediately redirect to ZainCash
      if (paymentMethod === "ELECTRONIC" && identity?.anonUserId) {
        startZainCash.mutate({ appointmentId: appt.id, anonUserId: identity.anonUserId });
        return;
      }
      setBookingSuccess(true);
    },
    onError: (err) => {
      setBookingError(err.message);
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
    setCouponApplied({ discount: d, code: couponCode });
  };

  // 48h warning
  const repWarning =
    selectedSlot && paymentMethod === "REPRESENTATIVE" && hoursUntil(selectedSlot) < 48;

  const canBook =
    !!selectedSlot &&
    !!paymentMethod &&
    !(paymentMethod === "REPRESENTATIVE" && hoursUntil(selectedSlot) < 48);

  function resetBooking() {
    setBookingOpen(false);
    setBookingSuccess(false);
    setBookingError("");
    setSelectedDate("");
    setSelectedSlot("");
    setPaymentMethod("");
    setNotes("");
    setCouponCode("");
    setCouponApplied(null);
  }

  async function handleBook() {
    if (!identity?.anonUserId || !canBook) return;
    if (paymentMethod === "PACKAGE" && !selectedPkgId) {
      setBookingError("اختر باقة من القائمة");
      return;
    }
    setBookingError("");
    createBooking.mutate({
      anonUserId: identity.anonUserId,
      consultantId: id,
      scheduledAt: selectedSlot,
      paymentMethod: paymentMethod as "REPRESENTATIVE" | "ELECTRONIC" | "PACKAGE",
      userPackageId: paymentMethod === "PACKAGE" ? selectedPkgId : undefined,
      notes: notes || undefined,
      couponCode: couponApplied?.code,
      assessmentResultId: identity.assessmentResultId ?? undefined,
    });
  }

  if (isLoading)
    return <div className="min-h-screen flex items-center justify-center text-gray-400">جاري التحميل...</div>;
  if (!consultant)
    return <div className="min-h-screen flex items-center justify-center text-gray-400">المستشار غير موجود</div>;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Top nav */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a href="/" className="text-xl font-bold text-indigo-600">مساحة بوح</a>
          {identity && (
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              مرحباً، {identity.nickname}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <a href="/consultants" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 mb-6">
          → العودة للمستشارين
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
              <p className="text-3xl font-bold text-indigo-600 mb-4">{Number(consultant.sessionPrice)} د.ع</p>
              <div className="space-y-2 text-sm text-gray-600 mb-6">
                <div className="flex items-center gap-2"><span>📅</span> جلسة مدتها 60 دقيقة</div>
                <div className="flex items-center gap-2"><span>🔒</span> جلسة سرية وآمنة</div>
                <div className="flex items-center gap-2"><span>⭐</span> {consultant._count.appointments} جلسة مكتملة</div>
              </div>

              {!identity ? (
                <div>
                  <p className="text-sm text-amber-600 bg-amber-50 rounded-xl p-3 mb-3">
                    يجب العودة للصفحة الرئيسية وإدخال اسمك المستعار أولاً
                  </p>
                  <Button className="w-full" variant="secondary" onClick={() => router.push("/")}>
                    العودة للرئيسية
                  </Button>
                </div>
              ) : (
                <Button className="w-full" onClick={() => setBookingOpen(true)}>
                  احجز جلسة الآن
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <Modal open={bookingOpen} onClose={resetBooking} title="حجز جلسة" size="lg">
        {bookingSuccess ? (
          <div className="text-center py-8">
            <p className="text-6xl mb-4">✅</p>
            <p className="text-xl font-bold text-gray-900 mb-2">تم الحجز بنجاح!</p>
            <p className="text-gray-500 mb-1">سيتواصل معك المستشار لتأكيد الموعد</p>
            {selectedSlot && (
              <p className="text-indigo-600 font-medium mt-2">{formatDateAr(selectedSlot)} — {formatTime(selectedSlot)}</p>
            )}
            <Button className="mt-6" onClick={resetBooking}>إغلاق</Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Step 1: Date */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">📅 اختر التاريخ</p>
              <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
                {getNextDays().map((d) => {
                  const dayLabel = new Date(d).toLocaleDateString("ar-SA", { weekday: "short", day: "numeric", month: "short" });
                  return (
                    <button
                      key={d}
                      onClick={() => { setSelectedDate(d); setSelectedSlot(""); }}
                      className={`flex-shrink-0 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                        selectedDate === d
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300"
                      }`}
                    >
                      {dayLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Time slots */}
            {selectedDate && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">🕐 اختر الوقت</p>
                {slotsLoading ? (
                  <p className="text-sm text-gray-400">جارٍ تحميل المواعيد...</p>
                ) : !slotsData?.slots.length ? (
                  <p className="text-sm text-amber-600 bg-amber-50 rounded-xl p-3">
                    لا توجد مواعيد متاحة في هذا اليوم
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slotsData.slots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 rounded-xl border text-sm font-medium transition-all ${
                          selectedSlot === slot
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-300"
                        }`}
                      >
                        {formatTime(slot)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Payment method */}
            {selectedSlot && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">💳 طريقة الدفع</p>
                <div className="space-y-2 mb-3">
                  {/* PACKAGE option — only if user has active packages */}
                  {availablePackages.length > 0 && (
                    <div className={`rounded-2xl border-2 transition-all ${
                      paymentMethod === "PACKAGE" ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:border-emerald-200"
                    }`}>
                      <button
                        onClick={() => { setPaymentMethod("PACKAGE"); if (!selectedPkgId) setSelectedPkgId(availablePackages[0].id); }}
                        className="w-full p-4 text-right"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-emerald-600 font-bold bg-emerald-100 rounded-lg px-2 py-0.5">مجاناً</span>
                          <div>
                            <p className="font-semibold text-gray-800 text-sm flex items-center gap-1.5 justify-end">
                              <span>استخدم باقة</span> <span className="text-xl">💎</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{availablePackages.length} باقة نشطة</p>
                          </div>
                        </div>
                      </button>
                      {paymentMethod === "PACKAGE" && (
                        <div className="border-t border-emerald-100 p-3 space-y-1.5">
                          {availablePackages.map((p) => {
                            const remaining = p.totalSessions - p.usedSessions;
                            return (
                              <button key={p.id} onClick={() => setSelectedPkgId(p.id)}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-right transition-colors ${
                                  selectedPkgId === p.id ? "bg-emerald-100" : "bg-white hover:bg-emerald-50"
                                }`}>
                                <span className="text-xs text-emerald-700 font-bold">{remaining} متبقي</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-800">{p.package.nameAr}</span>
                                  <span className="text-base">{p.package.icon ?? "📦"}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod("ELECTRONIC")}
                    className={`p-4 rounded-2xl border-2 text-right transition-all ${
                      paymentMethod === "ELECTRONIC"
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-indigo-200"
                    }`}
                  >
                    <p className="text-xl mb-1">💳</p>
                    <p className="font-semibold text-gray-800 text-sm">دفع إلكتروني</p>
                    <p className="text-xs text-gray-400 mt-0.5">فوري عبر الإنترنت</p>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("REPRESENTATIVE")}
                    className={`p-4 rounded-2xl border-2 text-right transition-all ${
                      paymentMethod === "REPRESENTATIVE"
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-indigo-200"
                    }`}
                  >
                    <p className="text-xl mb-1">🤝</p>
                    <p className="font-semibold text-gray-800 text-sm">عبر الممثل</p>
                    <p className="text-xs text-gray-400 mt-0.5">يتطلب ٤٨ ساعة مسبقاً</p>
                  </button>
                </div>
                {repWarning && (
                  <p className="text-xs text-red-500 bg-red-50 rounded-xl p-2 mt-2">
                    ⚠️ الدفع عبر الممثل يتطلب الحجز قبل 48 ساعة على الأقل من موعد الجلسة
                  </p>
                )}
              </div>
            )}

            {/* Optional: notes & coupon */}
            {paymentMethod && !repWarning && (
              <>
                <Textarea
                  label="ملاحظات (اختياري)"
                  placeholder="اذكر ما تريد مناقشته أو أي معلومات مفيدة..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">كوبون الخصم (اختياري)</label>
                  <div className="flex gap-2">
                    <input
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponApplied(null); }}
                      placeholder="أدخل الكود"
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 font-mono"
                    />
                    <Button size="sm" variant="secondary" onClick={applyCoupon} disabled={!validateCoupon.data?.valid}>
                      تطبيق
                    </Button>
                  </div>
                  {couponCode && validateCoupon.data?.valid === false && (
                    <p className="text-xs text-rose-500 mt-1">الكوبون غير صالح أو منتهي</p>
                  )}
                  {couponApplied && (
                    <p className="text-xs text-emerald-600 mt-1">✅ خصم {couponApplied.discount} د.ع مطبّق</p>
                  )}
                </div>

                {/* Price summary */}
                <div className="bg-gray-50 rounded-xl p-4 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">سعر الجلسة</span>
                    <span>{sessionPrice} د.ع</span>
                  </div>
                  {couponApplied && (
                    <div className="flex justify-between mb-1 text-emerald-600">
                      <span>خصم الكوبون</span>
                      <span>-{discount} د.ع</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-100">
                    <span>الإجمالي</span>
                    <span className="text-indigo-600">{finalPrice} د.ع</span>
                  </div>
                </div>
              </>
            )}

            {bookingError && (
              <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3">{bookingError}</p>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <Button variant="secondary" onClick={resetBooking}>إلغاء</Button>
              <Button
                onClick={handleBook}
                loading={createBooking.isPending}
                disabled={!canBook}
              >
                تأكيد الحجز ({finalPrice} د.ع)
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
