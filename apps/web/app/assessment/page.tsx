"use client";

import { Suspense } from "react";
import AssessmentWizard from "./wizard";

export default function AssessmentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center ">
        <div className="text-center">
          <div className="text-4xl mb-4">🧠</div>
          <p className="text-gray-500">جارٍ التحميل...</p>
        </div>
      </div>
    }>
      <AssessmentWizard />
    </Suspense>
  );
}
