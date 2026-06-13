"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { trpc } from "@/lib/trpc/client";
import { useAuthStore } from "@/lib/stores/authStore";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { setAuth, isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated() && user) {
      router.replace(user.role === "CONSULTANT" ? "/consultant/dashboard" : "/admin");
    }
  }, [isAuthenticated, user, router]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setAuth(
        data.user as Parameters<typeof setAuth>[0],
        data.accessToken,
        data.refreshToken
      );

      const stored = localStorage.getItem("misahuh_auth");
      const parsed = stored ? JSON.parse(stored) : { state: {} };
      parsed.state = { ...parsed.state, accessToken: data.accessToken };
      localStorage.setItem("misahuh_auth", JSON.stringify(parsed));

      // Cookie matches refresh-token lifetime (7d). The middleware just checks
      // for presence; the actual access token is refreshed every 13 min by
      // useTokenRefresh inside the admin/consultant layouts.
      document.cookie = `misahuh_access_token=${data.accessToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict`;

      if (data.user.role === "CONSULTANT") {
        router.push("/consultant/dashboard");
      } else {
        router.push(redirect);
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  function handleSubmit() {
    if (!email || !password) return;
    setError("");
    loginMutation.mutate({ email, password });
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
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
        مساحة بوح
      </h1>
      <p className="text-gray-400 text-base mb-10 text-center">تسجيل الدخول للمستشارين والمديرين</p>

      {/* Card */}
      <div className="w-full max-w-sm bg-gray-50 border border-gray-200 rounded-3xl px-8 py-8 shadow-sm">
        <p className="text-center font-semibold text-gray-700 text-lg mb-5">أدخل بياناتك للدخول</p>

        <div className="space-y-4">
          {/* Email */}
          <div className="relative">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">✉️</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="البريد الإلكتروني"
              dir="ltr"
              autoComplete="email"
              className="w-full pr-11 pl-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-800 text-sm placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition text-left"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔒</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="كلمة المرور"
              dir="ltr"
              autoComplete="current-password"
              className="w-full pr-11 pl-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-800 text-sm placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition"
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          {/* CTA */}
          <button
            onClick={handleSubmit}
            disabled={loginMutation.isPending || !email || !password}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loginMutation.isPending ? "جارٍ الدخول..." : "دخول"}
          </button>
        </div>

        {/* Client link */}
        <p className="text-center text-sm text-gray-400 mt-5">
          هل أنت عميل؟{" "}
          <a href="/" className="text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
            ادخل بدون حساب
          </a>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
