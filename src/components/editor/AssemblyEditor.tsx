import React from 'react';
import { ExampleProgram } from '../../simulator/examples';
import { ValidateResponse } from '../../services/api';
import { Play, RotateCcw, Check, AlertCircle, BookOpen, Code2 } from 'lucide-react';

interface AssemblyEditorProps {
  code: string;
  onChangeCode: (code: string) => void;
  onAssemble: () => void;
  examples: ExampleProgram[];
  activeExampleId: string;
  onSelectExample: (id: string) => void;
  validation: ValidateResponse | null;
  currentPc: number;
  isLoading: boolean;
}

export const AssemblyEditor: React.FC<AssemblyEditorProps> = ({
  code,
  onChangeCode,
  onAssemble,
  examples,
  activeExampleId,
  onSelectExample,
  validation,
  currentPc,
  isLoading,
}) => {
  const lineCount = code.split('\n').length;
  const currentInstIndex = Math.floor(currentPc / 4);

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-xs border-r border-slate-800">
      {/* Top Program Selector Bar */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-200">Assembly Program</span>
        </div>

        {/* Example Selector Dropdown */}
        <select
          value={activeExampleId}
          onChange={(e) => onSelectExample(e.target.value)}
          className="bg-slate-950 border border-slate-700/80 rounded px-2.5 py-1 text-slate-300 text-xs focus:outline-none focus:border-cyan-500"
        >
          {examples.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>

      {/* Editor Main Textarea with Line Numbers */}
      <div className="flex-1 flex overflow-hidden relative font-mono text-[13px] leading-6">
        {/* Line Numbers Column */}
        <div className="w-10 bg-slate-950/80 border-r border-slate-800/80 py-3 text-right pr-2.5 select-none text-slate-600">
          {Array.from({ length: Math.max(lineCount, 12) }, (_, i) => {
            const lineNo = i + 1;
            const isPcLine = i === currentInstIndex;
            return (
              <div
                key={lineNo}
                className={`h-6 ${isPcLine ? 'text-cyan-400 font-bold' : ''}`}
              >
                {lineNo}
              </div>
            );
          })}
        </div>

        {/* Textarea */}
        <textarea
          value={code}
          onChange={(e) => onChangeCode(e.target.value)}
          spellCheck={false}
          className="flex-1 bg-transparent p-3 text-slate-100 resize-none focus:outline-none whitespace-pre overflow-auto font-mono selection:bg-cyan-900/50"
          placeholder="# Enter RISC assembly instructions here..."
        />
      </div>

      {/* Validation Status / Error Banner */}
      {validation && !validation.valid && (
        <div className="p-2.5 bg-rose-950/50 border-t border-rose-900/80 text-rose-300 text-[11px] max-h-24 overflow-y-auto">
          <div className="flex items-center gap-1.5 font-semibold mb-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Syntax Errors:</span>
          </div>
          <ul className="list-disc pl-4 space-y-0.5">
            {validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-slate-800 bg-slate-900/40">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          {validation?.valid ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              <span>{validation.instructionCount} instructions ready</span>
            </span>
          ) : (
            <span className="text-amber-400">Check syntax</span>
          )}
        </div>

        <button
          onClick={onAssemble}
          disabled={isLoading || (validation !== null && !validation.valid)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-xs shadow transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Assemble & Load</span>
        </button>
      </div>
    </div>
  );
};
