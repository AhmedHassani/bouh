"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAnonymousIdentity } from "@/lib/hooks/useAnonymousIdentity";
import { trpc } from "@/lib/trpc/client";

export default function HomePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { initIdentity } = useAnonymousIdentity();
  const utils = trpc.useUtils();

  const { data: assessments } = trpc.assessment.list.useQuery();
  const activeAssessment = assessments?.[0];

  async function handleStart() {
    const name = nickname.trim();
    if (name.length < 2) {
      setError("يجب أن يكون الاسم حرفين على الأقل");
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
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-white"
      dir="rtl"
    >
      {/* Logo */}
      <div className="mb-6">
        <Image
          src="/app_logo.png"
          alt="مساحة بوح"
          width={100}
          height={100}
          className="rounded-full object-cover"
          priority
        />
      </div>

      {/* Title */}
      <h1 className="text-4xl font-extrabold text-gray-900 mb-2 text-center">
        مرحباً بك في مساحة بوح
      </h1>
      <p className="text-gray-400 text-base mb-10 text-center">رفيقك لرحلة نفسية أفضل</p>

      {/* Card */}
      <div className="w-full max-w-sm bg-gray-50 border border-gray-200 rounded-3xl px-8 py-8 shadow-sm">
        <p className="text-center font-semibold text-gray-700 text-lg mb-5">أدخل اسمك للبدء</p>

        {/* Input */}
        <div className="relative mb-4">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">👤</span>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleStart()}
            placeholder="الاسم كاملاً"
            maxLength={30}
            autoFocus
            className="w-full pr-11 pl-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-800 text-sm placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition text-right"
          />
        </div>

        {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}

        {/* CTA */}
        <button
          onClick={handleStart}
          disabled={loading || nickname.trim().length < 2}
          className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "جارٍ التحميل..." : "ابدأ جلستك"}
        </button>

        {/* Staff link */}
        <p className="text-center text-sm text-gray-400 mt-5">
          هل أنت مستشار أو مدير؟{" "}
          <a href="/login" className="text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
            سجل هنا
          </a>
        </p>
      </div>
    </main>
  );
}
