import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", id, ...props }: InputProps) {
  const inputId = id ?? label;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors
          ${error ? "border-rose-400 focus:border-rose-500 bg-rose-50" : "border-gray-200 focus:border-indigo-400 bg-white"}
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, error, options, placeholder, className = "", id, ...props }: SelectProps) {
  const inputId = id ?? label;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors bg-white
          ${error ? "border-rose-400" : "border-gray-200 focus:border-indigo-400"}
          ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = "", id, ...props }: TextareaProps) {
  const inputId = id ?? label;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={4}
        className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors resize-none
          ${error ? "border-rose-400 bg-rose-50" : "border-gray-200 focus:border-indigo-400 bg-white"}
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const btnVariants = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
  secondary: "bg-gray-100 text-gray-800 hover:bg-gray-200",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  ghost: "text-gray-600 hover:bg-gray-100",
};

const btnSizes = { sm: "px-3 py-1.5 text-xs", md: "px-5 py-2.5 text-sm", lg: "px-6 py-3 text-base" };

export function Button({ variant = "primary", size = "md", loading, children, className = "", disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors
        ${btnVariants[variant]} ${btnSizes[size]} ${className}`}
      disabled={disabled ?? loading}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
