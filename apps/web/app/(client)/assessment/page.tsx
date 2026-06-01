"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/form";

export default function AssessmentPage() {
  const { data: assessments } = trpc.assessment.list.useQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; category: string | null; recommendation?: string } | null>(null);

  const { data: assessment } = trpc.assessment.getById.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId },
  );

  const submitMutation = trpc.assessment.submit.useMutation({
    onSuccess: (data) => {
      setResult({
        score: data.result.totalScore,
        category: data.category?.labelAr ?? data.result.categoryLabel,
        recommendation: data.category?.recommendation ?? undefined,
      });
    },
  });

  const answered = Object.keys(answers).length;
  const total = assessment?.questions.filter((q) => q.isActive).length ?? 0;
  const progress = total > 0 ? (answered / total) * 100 : 0;

  const submit = () => {
    if (!selectedId) return;
    submitMutation.mutate({
      assessmentId: selectedId,
      answers: Object.entries(answers).map(([questionId, optionId]) => ({ questionId, optionId })),
    });
  };

  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center" dir="rtl">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-lg w-full mx-4 text-center">
          <p className="text-5xl mb-4">🧠</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">نتيجة التقييم</h2>
          <p className="text-gray-500 mb-6">بناءً على إجاباتك</p>

          <div className="bg-indigo-50 rounded-2xl p-6 mb-6">
            <p className="text-sm text-gray-500 mb-1">مجموع النقاط</p>
            <p className="text-5xl font-bold text-indigo-600 mb-3">{result.score}</p>
            {result.category && (
              <div className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold">
                {result.category}
              </div>
            )}
          </div>

          {result.recommendation && (
            <div className="bg-emerald-50 rounded-2xl p-4 mb-6 text-right">
              <p className="text-sm font-semibold text-emerald-700 mb-1">التوصية</p>
              <p className="text-sm text-emerald-600">{result.recommendation}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => { setResult(null); setAnswers({}); setSelectedId(null); }}>
              إعادة الاختبار
            </Button>
            <Link href="/consultants" className="flex-1">
              <Button className="w-full">ابحث عن مستشار</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (assessment) {
    const activeQuestions = assessment.questions.filter((q) => q.isActive);
    return (
      <div className="min-h-screen bg-gray-50" dir="rtl">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <button onClick={() => { setSelectedId(null); setAnswers({}); }} className="text-sm text-gray-500 hover:text-indigo-600 mb-6">
            ← العودة
          </button>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{assessment.titleAr}</h1>
            {assessment.description && <p className="text-gray-500 text-sm">{assessment.description}</p>}
          </div>

          {/* Progress */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 shadow-sm">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>التقدم</span>
              <span>{answered} / {total} سؤال</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-5">
            {activeQuestions.map((q, qi) => (
              <div key={q.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="font-medium text-gray-800 mb-4">
                  <span className="text-indigo-400 text-sm ml-2">{qi + 1}.</span>
                  {q.textAr}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt) => {
                    const selected = answers[q.id] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))}
                        className={`w-full text-right px-4 py-3 rounded-xl border transition-all text-sm ${
                          selected
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-gray-50 text-gray-700 border-gray-100 hover:border-indigo-300 hover:bg-indigo-50"
                        }`}
                      >
                        {opt.textAr}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <Button
              onClick={submit}
              loading={submitMutation.isPending}
              disabled={answered < total}
              className="px-10"
            >
              {answered < total ? `أجب على ${total - answered} سؤال متبقي` : "إرسال النتائج"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-indigo-600">مساحة بوح</Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <p className="text-5xl mb-4">🧠</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">التقييم النفسي</h1>
          <p className="text-gray-500">اختر أحد الاختبارات التالية للحصول على تقييم نفسي متخصص</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {assessments?.map((a) => (
            <button key={a.id} onClick={() => setSelectedId(a.id)}
              className="text-right bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all">
              <h3 className="font-bold text-gray-900 mb-2">{a.titleAr}</h3>
              {a.description && <p className="text-sm text-gray-500 mb-4">{a.description}</p>}
              <p className="text-xs text-indigo-500">{a._count.questions} سؤال</p>
            </button>
          ))}
          {(!assessments || assessments.length === 0) && (
            <p className="col-span-2 text-center text-gray-400 py-8">لا توجد اختبارات متاحة حالياً</p>
          )}
        </div>
      </div>
    </div>
  );
}
