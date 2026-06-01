"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OptionDraft {
  textAr: string;
  textEn: string;
  score: number;
  order: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssessmentsPage() {
  const { data: assessments, refetch } = trpc.assessment.list.useQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questionModal, setQuestionModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);

  const { data: detail, refetch: refetchDetail } = trpc.assessment.getById.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId },
  );

  // ── Assessment form ──
  const [assessmentForm, setAssessmentForm] = useState({
    titleAr: "", titleEn: "", description: "",
    categories: [{ labelAr: "", labelEn: "", minScore: 0, maxScore: 20, description: "", recommendation: "" }],
  });
  // titleEn and labelEn are auto-filled from Arabic for schema compatibility

  // ── Question form ──
  const [qTextAr, setQTextAr] = useState("");
  const [qTextEn, setQTextEn] = useState("");
  const [qOrder, setQOrder] = useState(1);
  const [options, setOptions] = useState<OptionDraft[]>([
    { textAr: "نعم", textEn: "Yes", score: 1, order: 0 },
    { textAr: "لا", textEn: "No", score: 0, order: 1 },
  ]);
  const [newOptionText, setNewOptionText] = useState("");
  const [newOptionScore, setNewOptionScore] = useState(0);

  // ── Mutations ──
  const createAssessment = trpc.assessment.create.useMutation({
    onSuccess: () => { refetch(); setCreateModal(false); },
  });
  const addQuestion = trpc.assessment.addQuestion.useMutation({
    onSuccess: () => { refetch(); refetchDetail(); resetQuestionForm(); setQuestionModal(false); },
  });
  const deleteQuestion = trpc.assessment.deleteQuestion.useMutation({
    onSuccess: () => { refetch(); refetchDetail(); },
  });
  const toggleQuestion = trpc.assessment.toggleQuestion.useMutation({
    onSuccess: () => { refetch(); refetchDetail(); },
  });

  function resetQuestionForm() {
    setQTextAr(""); setQTextEn(""); setQOrder((detail?.questions.length ?? 0) + 1);
    setOptions([
      { textAr: "نعم", textEn: "Yes", score: 1, order: 0 },
      { textAr: "لا", textEn: "No", score: 0, order: 1 },
    ]);
    setNewOptionText(""); setNewOptionScore(0);
  }

  function openQuestionModal() {
    resetQuestionForm();
    setQOrder((detail?.questions.length ?? 0) + 1);
    setQuestionModal(true);
  }

  function addNewOption() {
    if (!newOptionText.trim()) return;
    setOptions((prev) => [
      ...prev,
      { textAr: newOptionText.trim(), textEn: newOptionText.trim(), score: newOptionScore, order: prev.length },
    ]);
    setNewOptionText("");
    setNewOptionScore(0);
  }

  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i).map((o, idx) => ({ ...o, order: idx })));
  }

  function updateOptionField(i: number, field: keyof OptionDraft, value: string | number) {
    setOptions((prev) => { const copy = [...prev]; copy[i] = { ...copy[i], [field]: value }; return copy; });
  }

  const addCategory = () =>
    setAssessmentForm((f) => ({
      ...f,
      categories: [...f.categories, { labelAr: "", labelEn: "", minScore: 0, maxScore: 0, description: "", recommendation: "" }],
    }));

  const removeCategory = (i: number) =>
    setAssessmentForm((f) => ({ ...f, categories: f.categories.filter((_, idx) => idx !== i) }));

  return (
    <div dir="rtl">
      <PageHeader
        title="الاختبارات النفسية"
        action={<Button onClick={() => setCreateModal(true)}>+ اختبار جديد</Button>}
      />

      {/* Assessment list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {assessments?.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelectedId(a.id === selectedId ? null : a.id)}
            className={`text-right bg-white rounded-2xl border p-5 shadow-sm transition-all ${
              a.id === selectedId
                ? "border-indigo-400 ring-1 ring-indigo-200"
                : "border-gray-100 hover:border-indigo-200"
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold text-gray-800">{a.titleAr}</h3>
                <p className="text-xs text-gray-400">{a.titleEn}</p>
              </div>
              <Badge variant="info">{a._count.questions} سؤال</Badge>
            </div>
            {a.description && <p className="text-sm text-gray-500">{a.description}</p>}
          </button>
        ))}
      </div>

      {/* ── Question list ───────────────────────────────────── */}
      {detail && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-800">
              إدارة أسئلة التقييم النفسي
              <span className="text-sm font-normal text-gray-400 mr-2">— {detail.titleAr}</span>
            </h2>
            <button
              onClick={openQuestionModal}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <span className="text-lg leading-none">+</span> سؤال جديد
            </button>
          </div>

          {/* Questions */}
          <div className="divide-y divide-gray-50">
            {detail.questions.length === 0 && (
              <div className="py-14 text-center text-gray-400">
                <p className="text-4xl mb-3">🧠</p>
                <p className="text-sm">لا توجد أسئلة بعد — أضف أول سؤال</p>
              </div>
            )}

            {detail.questions.map((q, qi) => (
              <div key={q.id} className={`px-6 py-5 flex gap-4 ${!q.isActive ? "opacity-50" : ""}`}>
                {/* Number */}
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm mt-0.5">
                  {qi + 1}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Question text */}
                  <p className="font-semibold text-gray-800 mb-3 leading-relaxed">{q.textAr}</p>

                  {/* Options as chips */}
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt) => (
                      <div
                        key={opt.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700"
                      >
                        <span>{opt.textAr}</span>
                        <span className="text-indigo-500 font-medium text-xs">({opt.score})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-start gap-2">
                  <button
                    onClick={() => toggleQuestion.mutate({ id: q.id })}
                    title={q.isActive ? "تعطيل" : "تفعيل"}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-amber-50 hover:text-amber-500 transition-colors"
                  >
                    {q.isActive ? "⏸" : "▶"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("حذف هذا السؤال؟")) deleteQuestion.mutate({ id: q.id });
                    }}
                    title="حذف"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Result categories */}
          {detail.categories.length > 0 && (
            <div className="border-t border-gray-100 px-6 py-5">
              <p className="text-sm font-semibold text-gray-600 mb-3">فئات النتائج</p>
              <div className="flex flex-wrap gap-3">
                {detail.categories.map((cat) => (
                  <div key={cat.id} className="bg-indigo-50 rounded-xl px-4 py-2.5 text-sm">
                    <span className="font-semibold text-indigo-700">{cat.labelAr}</span>
                    <span className="text-indigo-400 text-xs mr-2">{cat.minScore}–{cat.maxScore} نقطة</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Create Assessment Modal ───────────────────────── */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="اختبار نفسي جديد" size="md">
        <div className="space-y-4">
          <Input
            label="عنوان الاختبار"
            placeholder="مثال: تقييم الصحة النفسية العامة"
            value={assessmentForm.titleAr}
            onChange={(e) => setAssessmentForm((f) => ({ ...f, titleAr: e.target.value, titleEn: e.target.value }))}
          />

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium text-gray-700 text-sm">فئات النتائج</h4>
              <Button size="sm" variant="secondary" onClick={addCategory}>+ إضافة فئة</Button>
            </div>
            {assessmentForm.categories.map((cat, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <Input
                  placeholder={`الفئة ${i + 1} (مثال: خفيف)`}
                  value={cat.labelAr}
                  onChange={(e) => setAssessmentForm((f) => {
                    const cats = [...f.categories];
                    cats[i] = { ...cats[i], labelAr: e.target.value, labelEn: e.target.value };
                    return { ...f, categories: cats };
                  })}
                />
                <button
                  onClick={() => removeCategory(i)}
                  className="flex-shrink-0 text-gray-400 hover:text-red-400 text-sm px-2"
                >✕</button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setCreateModal(false)}>إلغاء</Button>
            <Button onClick={() => createAssessment.mutate(assessmentForm)} loading={createAssessment.isPending}>
              إنشاء الاختبار
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Add Question Modal ────────────────────────────── */}
      <Modal open={questionModal} onClose={() => setQuestionModal(false)} title="إضافة سؤال جديد" size="md">
        <div className="space-y-5">
          {/* Question text + order */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">نص السؤال</label>
            <input
              value={qTextAr}
              onChange={(e) => { setQTextAr(e.target.value); setQTextEn(e.target.value); }}
              placeholder="اكتب السؤال هنا..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition text-right"
              dir="rtl"
            />
          </div>

          {/* Order */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">رقم السؤال (الترتيب)</label>
            <input
              type="number"
              min={1}
              value={qOrder}
              onChange={(e) => setQOrder(+e.target.value)}
              className="w-24 px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition text-center font-semibold"
            />
            <p className="text-xs text-gray-400 mt-1">١ = أول سؤال، ٢ = ثاني، وهكذا</p>
          </div>

          {/* Options */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">الخيارات:</p>

            {/* Existing options as chips */}
            <div className="flex flex-wrap gap-2 mb-3 min-h-[40px]">
              {options.map((opt, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-2 pl-2 pr-3 py-1.5 bg-gray-100 rounded-lg border border-gray-200"
                >
                  {/* Editable text */}
                  <input
                    value={opt.textAr}
                    onChange={(e) => updateOptionField(i, "textAr", e.target.value)}
                    className="bg-transparent text-sm text-gray-700 w-16 outline-none text-right"
                    dir="rtl"
                  />
                  {/* Score badge */}
                  <input
                    type="number"
                    value={opt.score}
                    onChange={(e) => updateOptionField(i, "score", +e.target.value)}
                    className="bg-indigo-50 text-indigo-600 text-xs font-medium w-8 text-center rounded px-1 outline-none border-none"
                    title="النقاط"
                  />
                  {/* Remove */}
                  <button
                    onClick={() => removeOption(i)}
                    className="text-gray-400 hover:text-red-500 text-xs font-bold leading-none transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Add new option */}
            <div className="flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-3 py-2.5">
              <button
                onClick={addNewOption}
                className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg leading-none hover:bg-indigo-700 transition-colors flex-shrink-0"
              >
                +
              </button>
              <input
                value={newOptionText}
                onChange={(e) => setNewOptionText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNewOption()}
                placeholder="إضافة خيار جديد"
                className="flex-1 bg-transparent text-sm text-gray-600 outline-none placeholder:text-gray-400 text-right"
                dir="rtl"
              />
              <input
                type="number"
                value={newOptionScore}
                onChange={(e) => setNewOptionScore(+e.target.value)}
                placeholder="نقاط"
                className="w-14 text-center text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-300"
                title="النقاط"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5 pr-1">اضغط + أو Enter لإضافة الخيار</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1 border-t">
            <button
              onClick={() => { setQuestionModal(false); resetQuestionForm(); }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={() => {
                if (!selectedId || !qTextAr.trim() || options.length === 0) return;
                addQuestion.mutate({
                  assessmentId: selectedId,
                  textAr: qTextAr,
                  textEn: qTextEn || qTextAr,
                  order: qOrder,
                  options,
                });
              }}
              disabled={addQuestion.isPending || !qTextAr.trim() || options.length === 0}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {addQuestion.isPending ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
