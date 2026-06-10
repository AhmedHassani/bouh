"use client";

import { trpc } from "@/lib/trpc/client";

export default function ConsultantProfilePage() {
  const { data: profile } = trpc.consultant.getMyProfile.useQuery();

  if (!profile) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs text-gray-400">للتعديل تواصل مع الإدارة</p>
        <h1 className="text-xl font-bold text-gray-900">ملفي الشخصي</h1>
      </div>

      {/* Avatar + name */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-2xl font-bold text-indigo-600 flex-shrink-0">
          {profile.user?.name?.[0] ?? "؟"}
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{profile.user?.name}</h2>
          <p className="text-sm text-gray-400">{profile.user?.email}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-amber-400 text-sm">★</span>
            <span className="text-sm font-semibold text-gray-700">{Number(profile.rating).toFixed(1)}</span>
            <span className="text-xs text-gray-400">({profile.totalReviews} تقييم)</span>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 mb-4">
        {[
          { label: "سعر الجلسة", value: `${Number(profile.sessionPrice).toLocaleString("ar")} د.ع` },
          { label: "المدينة", value: profile.city ?? "—" },
          { label: "سنوات الخبرة", value: `${profile.yearsOfExperience} سنة` },
          { label: "المؤهل الأكاديمي", value: profile.academicQualification ?? "—" },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm text-gray-800 font-medium">{item.value}</span>
            <span className="text-sm text-gray-400">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Bio */}
      {profile.bio && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <p className="text-sm font-semibold text-gray-400 mb-2 text-right">النبذة التعريفية</p>
          <p className="text-sm text-gray-700 leading-relaxed text-right">{profile.bio}</p>
        </div>
      )}

      {/* Specializations */}
      {profile.specializations.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <p className="text-sm font-semibold text-gray-400 mb-3 text-right">التخصصات</p>
          <div className="flex flex-wrap gap-2 justify-end">
            {profile.specializations.map((s) => (
              <span key={s.specializationId} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium">
                {s.specialization.nameAr}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
      {profile.certifications.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-400 mb-3 text-right">الشهادات والدورات</p>
          <div className="space-y-2">
            {profile.certifications.map((c, i) => (
              <div key={i} className="flex items-center gap-2 justify-end">
                <span className="text-sm text-gray-700">{c}</span>
                <span className="text-indigo-400">🏅</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
