import React from "react";
import type { Stage } from "../hooks/useTtsJob";

type Props = {
  stage: Stage;
};

export default function StageSteps({ stage }: Props) {
  const steps = [
    { key: "processing", label: "Processing" },
    { key: "saving", label: "Saving" },
    { key: "done", label: "Done" }
  ];

  const currentIndex =
    stage === "idle" || stage === "error"
      ? -1
      : stage === "processing"
        ? 0
        : stage === "saving"
          ? 1
          : 2;

  return (
    <div className="grid grid-cols-3 gap-3">
      {steps.map((item, index) => {
        const active = index <= currentIndex;

        return (
          <div
            key={item.key}
            className={[
              "rounded-xl border px-3 py-2 text-sm font-semibold transition-all",
              active
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-slate-50 text-slate-400"
            ].join(" ")}
          >
            {index + 1}. {item.label}
          </div>
        );
      })}
    </div>
  );
}
