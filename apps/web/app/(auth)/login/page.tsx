"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
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

  // If already logged in redirect
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

      // Store accessToken in localStorage for tRPC headers
      const stored = localStorage.getItem("misahuh_auth");
      const parsed = stored ? JSON.parse(stored) : { state: {} };
      parsed.state = { ...parsed.state, accessToken: data.accessToken };
      localStorage.setItem("misahuh_auth", JSON.stringify(parsed));

      // Set cookie for middleware route protection (httpOnly not possible client-side, so short expiry)
      document.cookie = `misahuh_access_token=${data.accessToken}; path=/; max-age=900; SameSite=Strict`;

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

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600 mb-1">مساحة بوح</h1>
          <p className="text-gray-400 text-sm">تسجيل الدخول</p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-8">
          <div className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loginMutation.mutate({ email, password })}
                placeholder="example@email.com"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition text-left"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loginMutation.mutate({ email, password })}
                placeholder="••••••••"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
            )}

            <button
              onClick={() => loginMutation.mutate({ email, password })}
              disabled={loginMutation.isPending || !email || !password}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loginMutation.isPending ? "جارٍ الدخول..." : "دخول"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          للعملاء:{" "}
          <a href="/" className="text-indigo-500 hover:underline">ادخل بدون حساب</a>
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
