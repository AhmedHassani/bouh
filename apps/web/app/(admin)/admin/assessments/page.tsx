"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";

interface DraftOption { text: string }
interface EditState { questionId: string; text: string; options: DraftOption[] }

export default function AssessmentsPage() {
  const { data: assessments, refetch } = trpc.assessment.listAll.useQuery();
  const activeAssessment = assessments?.find((a) => a.isActive) ?? assessments?.[0];

  const { data: detail, refetch: refetchDetail } = trpc.assessment.getById.useQuery(
    { id: activeAssessment?.id ?? "" },
    { enabled: !!activeAssessment?.id },
  );

  const [adding, setAdding]   = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);

  const addQuestion = trpc.assessment.addQuestion.useMutation({
    onSuccess: () => { refetch(); refetchDetail(); setAdding(false); },
    onError:   (e) => alert(`فشل الحفظ: ${e.message}`),
  });
  const deleteQuestion = trpc.assessment.deleteQuestion.useMutation({
    onSuccess: () => { refetch(); refetchDetail(); },
    onError:   (e) => alert(`فشل الحذف: ${e.message}`),
  });

  function startEdit(q: NonNullable<typeof detail>["questions"][0]) {
    setEditing({ questionId: q.id, text: q.textAr, options: q.options.map((o) => ({ text: o.textAr })) });
    setAdding(false);
  }

  function saveEdit() {
    if (!activeAssessment?.id || !editing?.text.trim()) return;
    const validOpts = editing.options.filter((o) => o.text.trim());
    if (validOpts.length < 2) return;
    const q = detail?.questions.find((q) => q.id === editing.questionId);
    deleteQuestion.mutate({ id: editing.questionId });
    addQuestion.mutate({
      assessmentId: activeAssessment.id,
      textAr: editing.text.trim(), textEn: editing.text.trim(),
      order: q?.order ?? 99,
      options: validOpts.map((o, i) => ({ textAr: o.text, textEn: o.text, score: 0, order: i })),
    });
    setEditing(null);
  }

  return (
    <div dir="rtl">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => { setEditing(null); setAdding(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <span className="text-lg leading-none">+</span> إضافة سؤال
        </button>
        <div className="text-right">
          <h1 className="text-xl font-bold text-gray-900">الاختبار النفسي</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            <span className="text-indigo-500 font-semibold">{detail?.questions.length ?? 0}</span> سؤال
          </p>
        </div>
      </div>

      {/* ── Add Question Form ── */}
      {adding && (
        <div className="mb-4">
          <QuestionForm
            qText=""
            options={[{ text: "" }, { text: "" }]}
            onSave={(text, opts) => {
              if (!activeAssessment?.id) return;
              addQuestion.mutate({
                assessmentId: activeAssessment.id,
                textAr: text, textEn: text,
                order: (detail?.questions.length ?? 0) + 1,
                options: opts.map((o, i) => ({ textAr: o.text, textEn: o.text, score: 0, order: i })),
              });
            }}
            onCancel={() => setAdding(false)}
            saving={addQuestion.isPending}
          />
        </div>
      )}

      {/* ── Questions ── */}
      {!detail ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : detail.questions.length === 0 && !adding ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-20 text-center">
          <p className="text-4xl mb-3">🧠</p>
          <p className="text-sm text-gray-400">لا توجد أسئلة — اضغط "إضافة سؤال"</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
          {detail.questions.map((q, qi) => (
            <div key={q.id}>
              {editing?.questionId === q.id ? (
                <div className="p-5 bg-indigo-50/40">
                  <QuestionForm
                    qText={editing.text}
                    options={editing.options}
                    onSave={(text, opts) => {
                      setEditing({ ...editing, text, options: opts });
                      saveEdit();
                    }}
                    onCancel={() => setEditing(null)}
                    saving={addQuestion.isPending || deleteQuestion.isPending}
                    controlled
                    onTextChange={(v) => setEditing((e) => e ? { ...e, text: v } : null)}
                    onOptionsChange={(opts) => setEditing((e) => e ? { ...e, options: opts } : null)}
                  />
                </div>
              ) : (
                <div className="group flex items-start gap-4 px-6 py-5 hover:bg-gray-50/60 transition-colors">
                  {/* Number */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-indigo-50 text-indigo-500 text-sm font-bold flex items-center justify-center mt-0.5">
                    {qi + 1}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-[15px] leading-snug mb-3">
                      {q.textAr}
                    </p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                      {q.options.map((opt) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200 flex-shrink-0" />
                          <span className="text-sm text-gray-500 truncate">{opt.textAr}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions — visible on hover */}
                  <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(q)}
                      className="px-3 py-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => deleteQuestion.mutate({ id: q.id })}
                      className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Reusable question form ────────────────────────────────────────────────────
function QuestionForm({
  qText: initialText,
  options: initialOptions,
  onSave, onCancel, saving,
  controlled, onTextChange, onOptionsChange,
}: {
  qText: string;
  options: DraftOption[];
  onSave: (text: string, opts: DraftOption[]) => void;
  onCancel: () => void;
  saving: boolean;
  controlled?: boolean;
  onTextChange?: (v: string) => void;
  onOptionsChange?: (o: DraftOption[]) => void;
}) {
  const [localText, setLocalText]       = useState(initialText);
  const [localOptions, setLocalOptions] = useState<DraftOption[]>(initialOptions);
  const [newOpt, setNewOpt]             = useState("");

  const text    = controlled ? initialText    : localText;
  const options = controlled ? initialOptions : localOptions;

  function setText(v: string) { if (controlled) onTextChange?.(v); else setLocalText(v); }
  function setOptions(o: DraftOption[]) { if (controlled) onOptionsChange?.(o); else setLocalOptions(o); }

  function addOpt() {
    if (!newOpt.trim()) return;
    setOptions([...options, { text: newOpt.trim() }]);
    setNewOpt("");
  }

  const canSave = text.trim() && options.filter((o) => o.text.trim()).length >= 2;

  return (
    <div className="space-y-4">
      {/* Question */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="اكتب نص السؤال..."
        rows={2}
        autoFocus
        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 resize-none text-right placeholder:font-normal placeholder:text-gray-300 transition"
      />

      {/* Options */}
      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-3">
            <button
              onClick={() => options.length > 2 && setOptions(options.filter((_, idx) => idx !== i))}
              className={`text-gray-300 hover:text-red-400 text-sm transition-colors flex-shrink-0 w-4 ${options.length <= 2 ? "invisible" : ""}`}
            >×</button>
            <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200 flex-shrink-0" />
            <input
              value={opt.text}
              onChange={(e) => {
                const c = [...options]; c[i] = { text: e.target.value }; setOptions(c);
              }}
              placeholder={`الخيار ${i + 1}`}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-100 bg-white text-sm text-right outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-50 transition placeholder:text-gray-300"
            />
          </div>
        ))}

        {/* Add option */}
        <div className="flex items-center gap-3">
          <span className="w-4 flex-shrink-0" />
          <div className="w-3.5 h-3.5 rounded-full border-2 border-dashed border-gray-200 flex-shrink-0" />
          <input
            value={newOpt}
            onChange={(e) => setNewOpt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addOpt()}
            placeholder="إضافة خيار..."
            className="flex-1 px-3 py-2 text-sm text-right outline-none text-gray-400 placeholder:text-gray-300 bg-transparent"
          />
          {newOpt.trim() && (
            <button onClick={addOpt} className="text-xs text-indigo-500 font-medium hover:text-indigo-700 flex-shrink-0">
              إضافة
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onSave(text, options.filter((o) => o.text.trim()))}
          disabled={!canSave || saving}
          className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          {saving ? "جارٍ الحفظ..." : "حفظ"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          إلغاء
        </button>
      </div>
    </div>
  );
}
