"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { useEffect } from "react";

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  autoFocus?: boolean;
}

export function RichEditor({
  value,
  onChange,
  placeholder = "ابدأ بكتابة تقريرك...",
  minHeight = 240,
  autoFocus,
}: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading:    { levels: [1, 2, 3] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Underline,
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ["heading", "paragraph"], defaultAlignment: "right" }),
      Link.configure({ openOnClick: false }),
    ],
    content: value,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        dir: "rtl",
        class: "prose prose-sm max-w-none focus:outline-none text-right leading-relaxed text-gray-800",
        style: `min-height: ${minHeight}px`,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external value updates
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-50 transition-all">
      <Toolbar editor={editor} />
      <div className="px-4 py-3 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
      <Footer editor={editor} />
    </div>
  );
}

// ── Toolbar ──
function Toolbar({ editor }: { editor: Editor }) {
  const Btn = ({
    onClick, active, disabled, title, children,
  }: {
    onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${
        active
          ? "bg-indigo-100 text-indigo-700"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30"
      }`}
    >
      {children}
    </button>
  );

  const Sep = () => <div className="w-px h-5 bg-gray-200 mx-0.5" />;

  return (
    <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/60 flex items-center gap-1 flex-wrap">
      {/* Headings */}
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="عنوان رئيسي"
      ><strong className="text-xs">H1</strong></Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title="عنوان فرعي"
      ><strong className="text-xs">H2</strong></Btn>

      <Sep />

      {/* Inline formatting */}
      <Btn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="عريض"
      ><strong>B</strong></Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="مائل"
      ><em>I</em></Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        title="تسطير"
      ><span className="underline">U</span></Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="يتوسطه خط"
      ><span className="line-through">S</span></Btn>

      <Sep />

      {/* Lists */}
      <Btn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="قائمة نقطية"
      >• ▪</Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="قائمة مرقّمة"
      >1.</Btn>

      <Sep />

      {/* Quote + code */}
      <Btn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="اقتباس"
      >❝</Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
        title="كود"
      ><span className="font-mono text-xs">&lt;/&gt;</span></Btn>

      <Sep />

      {/* Alignment */}
      <Btn
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        active={editor.isActive({ textAlign: "right" })}
        title="يمين"
      >⟶</Btn>
      <Btn
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        active={editor.isActive({ textAlign: "center" })}
        title="وسط"
      >☰</Btn>
      <Btn
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        active={editor.isActive({ textAlign: "left" })}
        title="يسار"
      >⟵</Btn>

      <Sep />

      {/* HR */}
      <Btn
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="خط فاصل"
      >―</Btn>

      <div className="flex-1" />

      {/* Undo/Redo on far left */}
      <Btn
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="تراجع"
      >↶</Btn>
      <Btn
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="إعادة"
      >↷</Btn>
    </div>
  );
}

// ── Footer (word + char count) ──
function Footer({ editor }: { editor: Editor }) {
  const text   = editor.getText();
  const words  = text.trim().split(/\s+/).filter(Boolean).length;
  const chars  = text.length;
  return (
    <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between text-xs text-gray-400">
      <span className="flex items-center gap-1.5">
        <span className="text-emerald-500">●</span>
        <span>تم الحفظ تلقائياً</span>
      </span>
      <div className="flex items-center gap-3">
        <span><strong className="text-gray-600">{words}</strong> كلمة</span>
        <span className="text-gray-200">·</span>
        <span><strong className="text-gray-600">{chars}</strong> حرف</span>
      </div>
    </div>
  );
}
