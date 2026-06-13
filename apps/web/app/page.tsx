"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAnonymousIdentity } from "@/lib/hooks/useAnonymousIdentity";

type Step = "name" | "credentials" | "register";

export default function HomePage() {
  const router = useRouter();
  const { loginWithPhone, registerWithPhone } = useAnonymousIdentity();

  const [step, setStep]     = useState<Step>("name");
  const [name, setName]     = useState("");
  const [phone, setPhone]   = useState("");
  const [password, setPwd]  = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  function continueFromName() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("يجب أن يكون الاسم حرفين على الأقل");
      return;
    }
    setError("");
    setStep("credentials");
  }

  async function handleLogin() {
    if (phone.trim().length < 6 || password.length < 4) {
      setError("يرجى إدخال رقم الهاتف وكلمة المرور");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await loginWithPhone(name.trim(), phone.trim(), password);
      router.push("/consultants");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "حدث خطأ";
      // Backend sends a generic "الحساب غير موجود..." for both not-found / wrong-password.
      setError(msg);
      setStep("register");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    setError("");
    setLoading(true);
    try {
      await registerWithPhone(name.trim(), phone.trim(), password);
      router.push("/consultants");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "حدث خطأ";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12" dir="rtl">
      {/* Logo */}
      <div className="mb-6">
        <Image src="/app_logo.png" alt="مساحة بوح" width={100} height={100} className="rounded-full object-cover" priority />
      </div>

      {/* Title */}
      <h1 className="text-4xl font-extrabold text-gray-900 mb-2 text-center">مرحباً بك في مساحة بوح</h1>
      <p className="text-gray-400 text-base mb-10 text-center">رفيقك لرحلة نفسية أفضل</p>

      {/* Card */}
      <div className="w-full max-w-sm bg-gray-50 border border-gray-200 rounded-3xl px-8 py-8 shadow-sm">

        {/* ── Step 1: name ── */}
        {step === "name" && (
          <>
            <p className="text-center font-semibold text-gray-700 text-lg mb-5">أدخل اسمك للبدء</p>
            <div className="relative mb-4">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">👤</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && continueFromName()}
                placeholder="الاسم كاملاً"
                maxLength={30}
                autoFocus
                className="w-full pr-11 pl-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-800 text-sm placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition text-right"
              />
            </div>
            {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}
            <button
              onClick={continueFromName}
              disabled={name.trim().length < 2}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              متابعة ←
            </button>
          </>
        )}

        {/* ── Step 2: phone + password (login attempt) ── */}
        {step === "credentials" && (
          <>
            <p className="text-center font-semibold text-gray-700 text-lg mb-2">مرحباً، {name}</p>
            <p className="text-center text-xs text-gray-400 mb-5">أدخل رقم الهاتف وكلمة المرور</p>

            <div className="relative mb-3">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">📱</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="رقم الهاتف"
                dir="ltr"
                autoFocus
                className="w-full pr-11 pl-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-800 text-sm placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition text-left"
              />
            </div>

            <div className="relative mb-4">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔒</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPwd(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="كلمة المرور"
                dir="ltr"
                className="w-full pr-11 pl-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-800 text-sm placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition"
              />
            </div>

            {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}

            <button
              onClick={handleLogin}
              disabled={loading || phone.trim().length < 6 || password.length < 4}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "جارٍ الدخول..." : "دخول"}
            </button>

            <button
              onClick={() => { setStep("name"); setError(""); }}
              className="block mx-auto mt-4 text-xs text-gray-400 hover:text-gray-600"
            >
              ← تغيير الاسم
            </button>
          </>
        )}

        {/* ── Step 3: register prompt ── */}
        {step === "register" && (
          <>
            <p className="text-center font-semibold text-gray-700 text-lg mb-2">الحساب غير موجود</p>
            <p className="text-center text-sm text-gray-500 mb-5">
              يبدو أن لا حساب بهذا الاسم/الرقم. أنشئ حساباً جديداً بهذه البيانات؟
            </p>

            <div className="bg-white rounded-2xl p-4 mb-5 border border-gray-200 text-sm space-y-1.5 text-right">
              <p><span className="text-gray-400">الاسم:</span> <span className="font-semibold">{name}</span></p>
              <p dir="ltr" className="text-right"><span className="text-gray-400">الهاتف: </span><span className="font-semibold">{phone}</span></p>
            </div>

            {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}

            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "جارٍ الإنشاء..." : "إنشاء حساب جديد"}
            </button>

            <button
              onClick={() => { setStep("credentials"); setError(""); }}
              className="block mx-auto mt-4 text-xs text-gray-400 hover:text-gray-600"
            >
              ← تعديل البيانات
            </button>
          </>
        )}

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
