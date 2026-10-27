import React from 'react';
import { ExampleProgram } from '../../simulator/examples';
import { BookOpen, X, CheckCircle, Lightbulb } from 'lucide-react';

interface GuidedObservationModalProps {
  example: ExampleProgram;
  isOpen: boolean;
  onClose: () => void;
}

export const GuidedObservationModal: React.FC<GuidedObservationModalProps> = ({
  example,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-slate-100 text-sm">{example.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400 mb-1">
              Program Objective
            </div>
            <p className="text-slate-200 text-xs leading-relaxed">{example.description}</p>
          </div>

          <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/40 space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-cyan-300 text-xs">
              <Lightbulb className="w-4 h-4 shrink-0" />
              <span>What You Should Observe in the Simulation:</span>
            </div>
            <ul className="space-y-2 text-slate-300 text-[11px]">
              {example.expectedObservations.map((obs, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{obs}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition-colors"
          >
            Got it, Let's Simulate
          </button>
        </div>
      </div>
    </div>
  );
};
