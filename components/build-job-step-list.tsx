'use client';

import React from 'react';

import type { BuildJobStepItem, BuildJobStepKey } from '@/lib/types';

type BuildJobStepListProps = {
  steps: BuildJobStepItem[];
  selectedStepKey: BuildJobStepKey | null;
  onSelect: (stepKey: BuildJobStepKey) => void;
};

function getStepItemClass(status: string, selected: boolean) {
  const selectedClass = selected ? ' is-selected' : '';

  switch (status) {
    case 'success':
      return `task-step-item is-success${selectedClass}`;
    case 'running':
      return `task-step-item is-active${selectedClass}`;
    case 'failed':
      return `task-step-item is-error${selectedClass}`;
    default:
      return `task-step-item${selectedClass}`;
  }
}

export function BuildJobStepList({ steps, selectedStepKey, onSelect }: BuildJobStepListProps) {
  return (
    <div className="task-steps">
      {steps.map((step) => (
        <button
          key={step.key}
          type="button"
          className={getStepItemClass(step.status, step.key === selectedStepKey)}
          onClick={() => onSelect(step.key)}
        >
          <div className="task-step-icon" />
          <div>
            <p className="task-step-title">{step.label}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
