"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

export default function AssessmentsPage() {
  const { data: assessments, refetch } = trpc.assessment.list.useQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questionModal, setQuestionModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);

  const { data: detail } = trpc.assessment.getById.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId },
  );

  const [assessmentForm, setAssessmentForm] = useState({
    titleAr: "", titleEn: "", description: "",
    categories: [{ labelAr: "", labelEn: "", minScore: 0, maxScore: 20, description: "", recommendation: "" }],
  });

  const [questionForm, setQuestionForm] = useState({
    textAr: "", textEn: "", order: 0,
    options: [
      { textAr: "", textEn: "", score: 0, order: 0 },
      { textAr: "", textEn: "", score: 1, order: 1 },
    ],
  });

  const createAssessment = trpc.assessment.create.useMutation({ onSuccess: () => { refetch(); setCreateModal(false); } });
  const addQuestion = trpc.assessment.addQuestion.useMutation({ onSuccess: () => { refetch(); setQuestionModal(false); } });
  const deleteQuestion = trpc.assessment.deleteQuestion.useMutation({ onSuccess: () => refetch() });
  const toggleQuestion = trpc.assessment.toggleQuestion.useMutation({ onSuccess: () => refetch() });

  const addCategory = () =>
    setAssessmentForm((f) => ({ ...f, categories: [...f.categories, { labelAr: "", labelEn: "", minScore: 0, maxScore: 0, description: "", recommendation: "" }] }));

  const addOption = () =>
    setQuestionForm((f) => ({ ...f, options: [...f.options, { textAr: "", textEn: "", score: f.options.length, order: f.options.length }] }));

  return (
    <div>
      <PageHeader
        title="الاختبارات النفسية"
        action={<Button onClick={() => setCreateModal(true)}>+ اختبار جديد</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {assessments?.map((a) => (
          <button key={a.id} onClick={() => setSelectedId(a.id === selectedId ? null : a.id)}
            className={`text-right bg-white rounded-2xl border p-5 shadow-sm transition-all ${a.id === selectedId ? "border-indigo-400 ring-1 ring-indigo-200" : "border-gray-100 hover:border-indigo-200"}`}>
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

      {/* Selected Assessment Detail */}
      {detail && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-800">{detail.titleAr}</h2>
            <Button size="sm" onClick={() => setQuestionModal(true)}>+ إضافة سؤال</Button>
          </div>

          <div className="space-y-4">
            {detail.questions.map((q, qi) => (
              <div key={q.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs text-gray-400 ml-2">س {qi + 1}</span>
                    <span className="text-sm font-medium text-gray-800">{q.textAr}</span>
                    {!q.isActive && <Badge variant="neutral" >مُعطَّل</Badge>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant={q.isActive ? "secondary" : "ghost"}
                      onClick={() => toggleQuestion.mutate({ id: q.id })} loading={toggleQuestion.isPending}>
                      {q.isActive ? "تعطيل" : "تفعيل"}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => deleteQuestion.mutate({ id: q.id })} loading={deleteQuestion.isPending}>حذف</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {q.options.map((opt) => (
                    <div key={opt.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                      <span className="text-gray-700">{opt.textAr}</span>
                      <span className="text-indigo-600 font-medium">{opt.score} نقطة</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {detail.questions.length === 0 && <p className="text-center text-gray-400 py-6">لا توجد أسئلة بعد</p>}
          </div>

          {/* Categories */}
          <div className="mt-6 border-t pt-5">
            <h3 className="font-semibold text-gray-700 mb-3">فئات النتائج</h3>
            <div className="grid grid-cols-2 gap-3">
              {detail.categories.map((cat) => (
                <div key={cat.id} className="bg-indigo-50 rounded-xl p-3">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-indigo-800 text-sm">{cat.labelAr}</span>
                    <span className="text-xs text-indigo-500">{cat.minScore}–{cat.maxScore}</span>
                  </div>
                  {cat.description && <p className="text-xs text-indigo-600">{cat.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Assessment Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="اختبار نفسي جديد" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="العنوان بالعربي" value={assessmentForm.titleAr} onChange={(e) => setAssessmentForm((f) => ({ ...f, titleAr: e.target.value }))} />
            <Input label="العنوان بالإنجليزي" value={assessmentForm.titleEn} onChange={(e) => setAssessmentForm((f) => ({ ...f, titleEn: e.target.value }))} />
          </div>
          <Textarea label="الوصف" value={assessmentForm.description} onChange={(e) => setAssessmentForm((f) => ({ ...f, description: e.target.value }))} />

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium text-gray-700">فئات النتائج</h4>
              <Button size="sm" variant="secondary" onClick={addCategory}>+ إضافة فئة</Button>
            </div>
            {assessmentForm.categories.map((cat, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 mb-3 p-3 bg-gray-50 rounded-xl">
                <Input placeholder="الاسم عربي" value={cat.labelAr} onChange={(e) => setAssessmentForm((f) => { const cats = [...f.categories]; cats[i] = { ...cats[i], labelAr: e.target.value }; return { ...f, categories: cats }; })} />
                <Input placeholder="الاسم إنجليزي" value={cat.labelEn} onChange={(e) => setAssessmentForm((f) => { const cats = [...f.categories]; cats[i] = { ...cats[i], labelEn: e.target.value }; return { ...f, categories: cats }; })} />
                <Input type="number" placeholder="من" value={cat.minScore} onChange={(e) => setAssessmentForm((f) => { const cats = [...f.categories]; cats[i] = { ...cats[i], minScore: +e.target.value }; return { ...f, categories: cats }; })} />
                <Input type="number" placeholder="إلى" value={cat.maxScore} onChange={(e) => setAssessmentForm((f) => { const cats = [...f.categories]; cats[i] = { ...cats[i], maxScore: +e.target.value }; return { ...f, categories: cats }; })} />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCreateModal(false)}>إلغاء</Button>
            <Button onClick={() => createAssessment.mutate(assessmentForm)} loading={createAssessment.isPending}>إنشاء</Button>
          </div>
        </div>
      </Modal>

      {/* Add Question Modal */}
      <Modal open={questionModal} onClose={() => setQuestionModal(false)} title="إضافة سؤال" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="السؤال بالعربي" value={questionForm.textAr} onChange={(e) => setQuestionForm((f) => ({ ...f, textAr: e.target.value }))} />
            <Input label="السؤال بالإنجليزي" value={questionForm.textEn} onChange={(e) => setQuestionForm((f) => ({ ...f, textEn: e.target.value }))} />
          </div>
          <Input label="الترتيب" type="number" value={questionForm.order} onChange={(e) => setQuestionForm((f) => ({ ...f, order: +e.target.value }))} />

          <div className="border-t pt-3">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium text-gray-700">الخيارات</h4>
              <Button size="sm" variant="secondary" onClick={addOption}>+ خيار</Button>
            </div>
            {questionForm.options.map((opt, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                <Input placeholder="عربي" value={opt.textAr} onChange={(e) => setQuestionForm((f) => { const opts = [...f.options]; opts[i] = { ...opts[i], textAr: e.target.value }; return { ...f, options: opts }; })} />
                <Input placeholder="English" value={opt.textEn} onChange={(e) => setQuestionForm((f) => { const opts = [...f.options]; opts[i] = { ...opts[i], textEn: e.target.value }; return { ...f, options: opts }; })} />
                <Input type="number" placeholder="النقاط" value={opt.score} onChange={(e) => setQuestionForm((f) => { const opts = [...f.options]; opts[i] = { ...opts[i], score: +e.target.value }; return { ...f, options: opts }; })} />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setQuestionModal(false)}>إلغاء</Button>
            <Button onClick={() => selectedId && addQuestion.mutate({ ...questionForm, assessmentId: selectedId })} loading={addQuestion.isPending}>إضافة</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
