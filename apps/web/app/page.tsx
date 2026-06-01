"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAnonymousIdentity } from "@/lib/hooks/useAnonymousIdentity";
import { trpc } from "@/lib/trpc/client";

export default function HomePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { initIdentity } = useAnonymousIdentity();
  const utils = trpc.useUtils();

  // Get active assessment
  const { data: assessments } = trpc.assessment.list.useQuery();
  const activeAssessment = assessments?.[0];

  async function handleStart() {
    const name = nickname.trim();
    if (name.length < 2) {
      setError("يجب أن يكون الاسم المستعار حرفين على الأقل");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const identity = await initIdentity(name);

      if (!activeAssessment || !identity.anonUserId) {
        router.push("/consultants");
        return;
      }

      // Check if this identity already completed the assessment
      const status = await utils.anonymous.checkCompleted.fetch({
        anonUserId: identity.anonUserId,
        assessmentId: activeAssessment.id,
      });

      if (status.completed) {
        router.push("/consultants");
      } else {
        router.push(`/assessment?anonUserId=${identity.anonUserId}&assessmentId=${activeAssessment.id}`);
      }
    } catch {
      setError("حدث خطأ، يرجى المحاولة مجدداً");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col" dir="rtl">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-indigo-600">مساحة بوح</h1>
        <div className="flex gap-3">
          <a href="/consultant/dashboard" className="px-4 py-2 text-gray-500 hover:text-indigo-600 text-sm font-medium transition-colors">
            بوابة المستشار
          </a>
          <a href="/admin" className="px-4 py-2 text-gray-500 hover:text-indigo-600 text-sm font-medium transition-colors">
            الإدارة
          </a>
        </div>
      </nav>

      {/* Hero + Entry */}
      <section className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-lg w-full text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-sm font-medium mb-8">
            <span>🧠</span> منصة الاستشارات النفسية الأولى بالعربية
          </div>

          {/* Headline */}
          <h2 className="text-4xl font-extrabold text-gray-900 leading-tight mb-4">
            مساحتك الآمنة
            <br />
            <span className="text-indigo-600">للتعبير والشفاء</span>
          </h2>
          <p className="text-gray-500 mb-10 text-base leading-relaxed">
            لا يلزم إنشاء حساب. أدخل اسمًا مستعارًا وابدأ رحلتك.
          </p>

          {/* Nickname card */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-8">
            <div className="text-4xl mb-4">🌿</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">كيف تودّ أن ننادي عليك؟</h3>
            <p className="text-gray-400 text-sm mb-6">اسم مستعار فقط — هويتك تبقى مجهولة تمامًا</p>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                placeholder="مثال: أمل، نور، سليم..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
                maxLength={30}
                autoFocus
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleStart}
                disabled={loading || nickname.trim().length < 2}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "جارٍ التحميل..." : "ابدأ الآن ←"}
              </button>
            </div>
          </div>

          {/* Features row */}
          <div className="grid grid-cols-3 gap-4 mt-8">
            {[
              { icon: "🔒", label: "سرية تامة" },
              { icon: "⭐", label: "مستشارون معتمدون" },
              { icon: "📅", label: "مواعيد مرنة" },
            ].map((f) => (
              <div key={f.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
                <span className="text-2xl block mb-1">{f.icon}</span>
                <p className="text-xs font-medium text-gray-600">{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
