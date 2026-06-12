"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ClaimInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const deviceId   = params.get("d");
    const nickname   = params.get("n");
    const anonUserId = params.get("u");
    if (!deviceId || !nickname || !anonUserId) {
      router.replace("/");
      return;
    }
    try {
      localStorage.setItem("misahuh_device_id", deviceId);
      localStorage.setItem(
        "misahuh_anon",
        JSON.stringify({
          deviceId,
          nickname,
          anonUserId,
          assessmentCompleted: false,
          assessmentResultId: null,
        }),
      );
    } catch {}
    router.replace("/consultants");
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center" dir="rtl">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-300">جارٍ تسجيل دخولك...</p>
      </div>
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={null}>
      <ClaimInner />
    </Suspense>
  );
}
