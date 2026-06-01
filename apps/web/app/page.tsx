import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="text-center max-w-2xl px-6">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">مساحة بوح</h1>
        <p className="text-xl text-gray-600 mb-10">مساحتك الآمنة للتعبير والمشاركة</p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/sign-in"
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            تسجيل الدخول
          </Link>
          <Link
            href="/sign-up"
            className="px-6 py-3 bg-white text-indigo-600 border border-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-colors"
          >
            إنشاء حساب
          </Link>
        </div>
      </div>
    </main>
  );
}
