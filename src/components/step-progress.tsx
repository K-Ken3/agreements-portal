import { Fragment } from "react";

const STEPS = ["Details", "Parties", "Review"] as const;

export function StepProgress({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="step-progress" aria-label={`Step ${current} of ${STEPS.length}`}>
      {STEPS.map((label, index) => {
        const step = index + 1;
        const state =
          step < current
            ? "step-progress-done"
            : step === current
              ? "step-progress-active"
              : "";
        return (
          <Fragment key={label}>
            {index > 0 && <i />}
            <span
              className={state}
              aria-current={step === current ? "step" : undefined}
            >
              {step < current ? "✓" : `0${step}`} <span>{label}</span>
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}
