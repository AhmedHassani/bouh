import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50" dir="rtl">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-indigo-600">مساحة بوح</h1>
        <div className="flex gap-3">
          <Link href="/sign-in" className="px-4 py-2 text-gray-600 hover:text-indigo-600 text-sm font-medium">تسجيل الدخول</Link>
          <Link href="/sign-up" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">إنشاء حساب</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-sm font-medium mb-8">
          <span>🧠</span> منصة الاستشارات النفسية الأولى بالعربية
        </div>
        <h2 className="text-5xl font-extrabold text-gray-900 leading-tight mb-6">
          مساحتك الآمنة <br />
          <span className="text-indigo-600">للتعبير والشفاء</span>
        </h2>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          تواصل مع مستشارين نفسيين معتمدين، واحجز جلستك في دقائق معدودة بكل سرية وأمان.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/consultants" className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-semibold hover:bg-indigo-700 transition-colors text-lg">
            ابحث عن مستشار
          </Link>
          <Link href="/assessment" className="px-8 py-4 bg-white text-indigo-600 border-2 border-indigo-200 rounded-2xl font-semibold hover:bg-indigo-50 transition-colors text-lg">
            اختبر حالتك النفسية
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: "🔒", title: "سرية تامة", desc: "جلساتك خاصة بك ومحمية بالكامل" },
            { icon: "⭐", title: "مستشارون معتمدون", desc: "فريق من المتخصصين النفسيين المرخصين" },
            { icon: "📅", title: "احجز في أي وقت", desc: "مواعيد مرنة تناسب جدولك اليومي" },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center">
              <span className="text-4xl block mb-4">{f.icon}</span>
              <h3 className="font-bold text-gray-900 text-lg mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Portals Quick Access */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="bg-gradient-to-l from-indigo-600 to-purple-600 rounded-3xl p-8 text-white text-center">
          <h3 className="text-2xl font-bold mb-2">هل أنت مستشار نفسي؟</h3>
          <p className="text-indigo-100 mb-6">انضم لمنصة مساحة بوح وابدأ في تقديم استشاراتك</p>
          <Link href="/consultant/dashboard" className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-colors">
            بوابة المستشار
          </Link>
          <span className="mx-3 text-indigo-300">|</span>
          <Link href="/admin" className="px-6 py-3 bg-white/20 text-white border border-white/30 rounded-xl font-semibold hover:bg-white/30 transition-colors">
            بوابة الإدارة
          </Link>
        </div>
      </section>
    </main>
  );
}
