"use client";

import { useState, useRef } from "react";

interface Props {
  value?: string | null;
  onChange: (base64: string | null) => void;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

const MAX_SIZE_MB = 2;
const MAX_DIMENSION = 800;

const SIZES = {
  sm: "w-16 h-16 text-xl",
  md: "w-24 h-24 text-3xl",
  lg: "w-32 h-32 text-4xl",
};

/**
 * Avatar upload — converts image to base64 and resizes client-side to keep DB small.
 */
export function AvatarUpload({ value, onChange, fallback = "؟", size = "md", disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    setError("");
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`الحجم الأقصى ${MAX_SIZE_MB} ميجابايت`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("يرجى اختيار صورة فقط");
      return;
    }

    setLoading(true);
    try {
      const dataUrl = await readAndResize(file);
      onChange(dataUrl);
    } catch {
      setError("فشل تحميل الصورة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <div className={`${SIZES[size]} rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center font-bold text-indigo-600 ring-4 ring-white shadow-md`}>
          {value ? (
            <img src={value} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span>{fallback}</span>
          )}
        </div>

        {!disabled && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="absolute bottom-0 left-0 w-7 h-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center text-sm shadow-lg ring-2 ring-white transition-colors disabled:opacity-50"
            title="تغيير الصورة"
          >
            {loading ? "..." : "📷"}
          </button>
        )}

        {!disabled && value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-0 left-0 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs shadow-lg ring-2 ring-white opacity-0 group-hover:opacity-100 transition-opacity"
            title="حذف الصورة"
          >
            ✕
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="hidden"
      />

      {error && <p className="text-xs text-red-500">{error}</p>}
      {!disabled && !value && !error && <p className="text-xs text-gray-400">اضغط لإضافة صورة</p>}
    </div>
  );
}

// Resize image to max dimensions and return base64 data URL
function readAndResize(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image load failed"));
      img.onload = () => {
        // Scale down if exceeds max dimension
        let { width, height } = img;
        const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
        width  = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("no canvas ctx")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
