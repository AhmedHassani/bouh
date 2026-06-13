"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAnonymousIdentity } from "@/lib/hooks/useAnonymousIdentity";

export default function HomePage() {
  const router = useRouter();
  const { loginWithPhone, registerWithPhone } = useAnonymousIdentity();

  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [password, setPwd]    = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false); // after a failed login, offer register

  // Iraqi phone format: starts with 07, total 11 digits
  const phoneOk = /^07\d{9}$/.test(phone.trim());
  const valid =
    name.trim().length >= 2 &&
    phoneOk &&
    password.length >= 4;

  function onPhoneChange(v: string) {
    // Keep digits only, max 11
    const digits = v.replace(/\D/g, "").slice(0, 11);
    setPhone(digits);
    if (notFound) { setNotFound(false); setError(""); }
  }

  async function handleSubmit() {
    if (!valid) {
      setError("يرجى تعبئة كل الحقول");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await loginWithPhone(name.trim(), phone.trim(), password);
      router.push("/consultants");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "حدث خطأ";
      setError(msg);
      setNotFound(true);
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

  // Reset the "not found" state if the user edits fields after a failed login
  function onFieldChange<T extends (v: string) => void>(setter: T) {
    return (v: string) => { setter(v); if (notFound) { setNotFound(false); setError(""); } };
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12" dir="rtl">
      {/* Logo */}
      <div className="mb-6">
        <Image src="/app_logo.png" alt="مساحة بوح" width={100} height={100} className="rounded-full object-cover" priority />
      </div>

      <h1 className="text-4xl font-extrabold text-gray-900 mb-2 text-center">مرحباً بك في مساحة بوح</h1>
      <p className="text-gray-400 text-base mb-10 text-center">رفيقك لرحلة نفسية أفضل</p>

      <div className="w-full max-w-sm bg-gray-50 border border-gray-200 rounded-3xl px-8 py-8 shadow-sm">
        <p className="text-center font-semibold text-gray-700 text-lg mb-5">
          سجّل دخول أو أنشئ حساب
        </p>

        {/* Name */}
        <div className="mb-3">
          <input
            type="text"
            value={name}
            onChange={(e) => onFieldChange(setName)(e.target.value)}
            placeholder="الاسم كاملاً"
            maxLength={30}
            autoFocus
            dir="rtl"
            className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-800 text-sm placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition text-right"
          />
        </div>

        {/* Phone — Iraqi format 07XXXXXXXXX */}
        <div className="mb-3">
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="رقم الهاتف (07XXXXXXXXX)"
            maxLength={11}
            dir="rtl"
            className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-800 text-sm placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition text-right"
          />
          {phone.length > 0 && !phoneOk && (
            <p className="text-xs text-amber-600 mt-1.5 text-right">يجب أن يبدأ بـ 07 ويتكون من 11 رقم</p>
          )}
        </div>

        {/* Password */}
        <div className="mb-4">
          <input
            type="password"
            value={password}
            onChange={(e) => onFieldChange(setPwd)(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (notFound ? handleRegister() : handleSubmit())}
            placeholder="كلمة المرور"
            dir="rtl"
            className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-800 text-sm placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition text-right"
          />
        </div>

        {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}

        {!notFound ? (
          <button
            onClick={handleSubmit}
            disabled={loading || !valid}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "جارٍ الدخول..." : "دخول"}
          </button>
        ) : (
          <button
            onClick={handleRegister}
            disabled={loading || !valid}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "جارٍ الإنشاء..." : "إنشاء حساب جديد"}
          </button>
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
