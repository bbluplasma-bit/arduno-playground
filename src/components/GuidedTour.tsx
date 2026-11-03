import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Check } from 'lucide-react';

export interface TourStep {
  targetSelector: string;
  title: string;
  content: string;
}

interface GuidedTourProps {
  steps: TourStep[];
  onFinish: () => void;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({ steps, onFinish }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetElement, setTargetElement] = useState<Element | null>(null);

  useEffect(() => {
    const step = steps[currentStepIndex];
    const element = document.querySelector(step.targetSelector);
    setTargetElement(element);
    
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStepIndex, steps]);

  if (steps.length === 0) return null;

  const currentStep = steps[currentStepIndex];

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Dimmed Background */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" />

      {/* Target Highlight */}
      {targetElement && (
        <div
          className="absolute border-4 border-amber-400 rounded-lg shadow-[0_0_20px_rgba(251,191,36,0.5)] transition-all duration-300"
          style={{
            top: targetElement.getBoundingClientRect().top - 4,
            left: targetElement.getBoundingClientRect().left - 4,
            width: targetElement.getBoundingClientRect().width + 8,
            height: targetElement.getBoundingClientRect().height + 8,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="absolute z-[101] bg-[#111625] border-2 border-amber-400 p-5 rounded-2xl shadow-2xl max-w-xs pointer-events-auto"
        style={{
          top: targetElement ? targetElement.getBoundingClientRect().bottom + 20 : '50%',
          left: targetElement ? targetElement.getBoundingClientRect().left : '50%',
        }}
      >
        <div className="flex items-center justify-between mb-3 border-b border-[#27324c] pb-2">
          <h3 className="font-bold text-amber-300 text-sm">{currentStep.title}</h3>
          <button onClick={onFinish} className="text-slate-400 hover:text-white"><X className="w-4 h-4"/></button>
        </div>
        <p className="text-xs text-slate-200 mb-4">{currentStep.content}</p>
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500 font-mono">Step {currentStepIndex + 1} / {steps.length}</span>
          <div className="flex gap-2">
            {currentStepIndex > 0 && (
              <button onClick={() => setCurrentStepIndex(i => i - 1)} className="px-2 py-1 bg-[#181f33] rounded text-slate-300"><ArrowLeft className="w-4 h-4"/></button>
            )}
            {currentStepIndex < steps.length - 1 ? (
              <button onClick={() => setCurrentStepIndex(i => i + 1)} className="px-2 py-1 bg-amber-500 text-slate-950 rounded font-bold"><ArrowRight className="w-4 h-4"/></button>
            ) : (
              <button onClick={onFinish} className="px-3 py-1 bg-emerald-500 text-white rounded font-bold flex items-center gap-1"><Check className="w-4 h-4"/> Done!</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
