"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { useAnonymousIdentity } from "@/lib/hooks/useAnonymousIdentity";

const PROGRESS_KEY = (anonUserId: string, assessmentId: string) =>
  `misahuh_progress_${anonUserId}_${assessmentId}`;

interface SavedProgress {
  answers: Record<string, { optionId: string; score: number }>;
  currentStep: number;
}

export default function AssessmentWizard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const anonUserId = searchParams.get("anonUserId") ?? "";
  const assessmentId = searchParams.get("assessmentId") ?? "";
  const { markAssessmentCompleted } = useAnonymousIdentity();

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { optionId: string; score: number }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [resultData, setResultData] = useState<{ categoryLabel: string | null; recommendation: string | null; totalScore: number } | null>(null);

  const { data: assessment, isLoading } = trpc.assessment.getById.useQuery(
    { id: assessmentId },
    { enabled: !!assessmentId }
  );

  const submitAssessment = trpc.anonymous.submitAssessment.useMutation();

  // Restore saved progress
  useEffect(() => {
    if (!anonUserId || !assessmentId) return;
    const key = PROGRESS_KEY(anonUserId, assessmentId);
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed: SavedProgress = JSON.parse(saved);
        setAnswers(parsed.answers);
        setCurrentStep(parsed.currentStep);
      } catch {
        // ignore
      }
    }
  }, [anonUserId, assessmentId]);

  // Save progress on change
  useEffect(() => {
    if (!anonUserId || !assessmentId || Object.keys(answers).length === 0) return;
    const key = PROGRESS_KEY(anonUserId, assessmentId);
    const progress: SavedProgress = { answers, currentStep };
    localStorage.setItem(key, JSON.stringify(progress));
  }, [answers, currentStep, anonUserId, assessmentId]);

  if (!anonUserId || !assessmentId) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-gray-500 mb-4">رابط غير صالح</p>
          <a href="/" className="text-indigo-600 underline">العودة للرئيسية</a>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🧠</div>
          <p className="text-gray-500">جارٍ تحميل الأسئلة...</p>
        </div>
      </div>
    );
  }

  if (!assessment || assessment.questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-gray-500 mb-4">لا توجد أسئلة في هذا التقييم حالياً</p>
          <a href="/consultants" className="text-indigo-600 underline">تصفح المستشارين</a>
        </div>
      </div>
    );
  }

  const questions = assessment.questions;
  const totalSteps = questions.length;
  const progress = Math.round((currentStep / totalSteps) * 100);
  const currentQuestion = questions[currentStep];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  // Show result screen
  if (resultData) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-lg w-full">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">اكتملت نتيجتك</h2>
            <p className="text-gray-400 text-sm mb-6">استناداً إلى إجاباتك</p>

            {resultData.categoryLabel && (
              <div className="bg-indigo-50 rounded-2xl p-4 mb-4">
                <p className="text-sm text-indigo-500 mb-1">التصنيف</p>
                <p className="text-xl font-bold text-indigo-700">{resultData.categoryLabel}</p>
              </div>
            )}

            {resultData.recommendation && (
              <div className="bg-amber-50 rounded-2xl p-4 mb-6 text-right">
                <p className="text-sm text-amber-600 mb-1 font-medium">التوصية</p>
                <p className="text-gray-700 text-sm leading-relaxed">{resultData.recommendation}</p>
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-3 mb-6">
              <p className="text-xs text-gray-400">المجموع: <span className="font-bold text-gray-700">{resultData.totalScore} نقطة</span></p>
            </div>

            <button
              onClick={() => router.push("/consultants")}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              ابحث عن مستشار مناسب ←
            </button>
          </div>
        </div>
      </main>
    );
  }

  function selectOption(questionId: string, optionId: string, score: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: { optionId, score } }));
  }

  async function handleNext() {
    if (!currentAnswer) return;

    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      // Submit
      setSubmitting(true);
      try {
        const payload = questions.map((q) => ({
          questionId: q.id,
          optionId: answers[q.id]?.optionId ?? "",
          score: answers[q.id]?.score ?? 0,
        }));

        const result = await submitAssessment.mutateAsync({
          anonUserId,
          assessmentId,
          answers: payload,
        });

        // Clear saved progress
        localStorage.removeItem(PROGRESS_KEY(anonUserId, assessmentId));

        markAssessmentCompleted(result.id);
        setResultData({
          categoryLabel: result.categoryLabel ?? null,
          recommendation: result.recommendation ?? null,
          totalScore: result.totalScore,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setSubmitting(false);
      }
    }
  }

  function handleBack() {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col" dir="rtl">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between max-w-2xl mx-auto w-full">
        <button onClick={() => router.push("/")} className="text-gray-400 hover:text-gray-600 text-sm">
          ← خروج
        </button>
        <h1 className="text-lg font-bold text-indigo-600">مساحة بوح</h1>
        <span className="text-sm text-gray-400">{currentStep + 1} / {totalSteps}</span>
      </div>

      {/* Progress bar */}
      <div className="px-6 max-w-2xl mx-auto w-full mb-6">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1 text-center">{progress}% مكتمل</p>
      </div>

      {/* Question */}
      <div className="flex-1 flex items-start justify-center px-6 pb-12">
        <div className="max-w-2xl w-full">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            {/* Assessment title */}
            <p className="text-xs text-indigo-400 font-medium mb-4 text-center">
              {assessment.titleAr}
            </p>

            {/* Question text */}
            <h2 className="text-xl font-bold text-gray-800 text-center mb-8 leading-relaxed">
              {currentQuestion?.textAr}
            </h2>

            {/* Options */}
            <div className="space-y-3 mb-8">
              {currentQuestion?.options.map((option) => {
                const isSelected = currentAnswer?.optionId === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => selectOption(currentQuestion.id, option.id, option.score)}
                    className={`w-full text-right px-5 py-4 rounded-2xl border-2 transition-all font-medium text-sm ${
                      isSelected
                        ? "bg-indigo-50 border-indigo-400 text-indigo-700"
                        : "bg-gray-50 border-gray-200 text-gray-700 hover:border-indigo-200 hover:bg-indigo-50/50"
                    }`}
                  >
                    <span className={`inline-flex items-center gap-2`}>
                      <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                        isSelected ? "border-indigo-500 bg-indigo-500" : "border-gray-300"
                      }`} />
                      {option.textAr}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  → السابق
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!currentAnswer || submitting}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting
                  ? "جارٍ الحفظ..."
                  : currentStep === totalSteps - 1
                  ? "إنهاء التقييم ✓"
                  : "التالي ←"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
