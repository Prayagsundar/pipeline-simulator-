import React from 'react';
import { SimulationState } from '../../simulator/types';

interface CycleTimelineProps {
  state: SimulationState | null;
  selectedInstructionId: number | null;
  onSelectInstruction: (id: number | null) => void;
}

const STAGE_CELL_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  IF: { bg: 'bg-blue-950/60', text: 'text-blue-300', border: 'border-blue-700/50' },
  ID: { bg: 'bg-purple-950/60', text: 'text-purple-300', border: 'border-purple-700/50' },
  EX: { bg: 'bg-cyan-950/60', text: 'text-cyan-300', border: 'border-cyan-700/50' },
  MEM: { bg: 'bg-emerald-950/60', text: 'text-emerald-300', border: 'border-emerald-700/50' },
  WB: { bg: 'bg-amber-950/60', text: 'text-amber-300', border: 'border-amber-700/50' },
  STALL: { bg: 'bg-amber-900/40', text: 'text-amber-400 font-bold', border: 'border-amber-600/70' },
  FLUSH: { bg: 'bg-rose-950/60', text: 'text-rose-400 line-through', border: 'border-rose-700/60' },
  BUBBLE: { bg: 'bg-slate-900/40', text: 'text-slate-600', border: 'border-slate-800' },
};

export const CycleTimeline: React.FC<CycleTimelineProps> = ({
  state,
  selectedInstructionId,
  onSelectInstruction,
}) => {
  if (!state || state.program.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        No simulation state available. Load or assemble a program to view the pipeline timeline.
      </div>
    );
  }

  const currentCycle = state.cycle;
  const maxCycle = Math.max(currentCycle, 1);
  const cycleNumbers = Array.from({ length: maxCycle }, (_, i) => i + 1);

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-xs overflow-hidden">
      {/* Legend & Stats Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">Space-Time Diagram</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400 text-[11px]">Instructions vs Clock Cycles</span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2.5 text-[10px]">
          {['IF', 'ID', 'EX', 'MEM', 'WB', 'STALL', 'FLUSH'].map((key) => {
            const style = STAGE_CELL_STYLES[key];
            return (
              <div key={key} className="flex items-center gap-1">
                <span
                  className={`px-1.5 py-0.5 rounded border text-[9px] font-mono ${style.bg} ${style.text} ${style.border}`}
                >
                  {key}
                </span>
                <span className="text-slate-400">{key === 'STALL' ? 'Stall Bubble' : key === 'FLUSH' ? 'Flushed' : key}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid Container (Scrollable) */}
      <div className="flex-1 overflow-auto p-4">
        <table className="border-collapse text-left w-full">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-slate-400 border-b border-r border-slate-800 whitespace-nowrap min-w-[200px]">
                Instruction
              </th>
              {cycleNumbers.map((c) => (
                <th
                  key={c}
                  className={`px-2 py-2 text-center text-[10px] font-mono border-b border-slate-800 min-w-[42px] ${
                    c === currentCycle ? 'bg-cyan-950/40 text-cyan-300 font-bold border-cyan-800/50' : 'text-slate-400'
                  }`}
                >
                  C{c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.program.map((inst) => {
              const isSelected = selectedInstructionId === inst.id;
              const rowTimeline = state.timeline[inst.id] || {};

              return (
                <tr
                  key={inst.id}
                  onClick={() => onSelectInstruction(isSelected ? null : inst.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-cyan-950/20' : 'hover:bg-slate-900/40'
                  }`}
                >
                  {/* Sticky Instruction Column */}
                  <td className="sticky left-0 z-10 bg-slate-950 px-3 py-2 border-b border-r border-slate-800 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500 text-[10px]">#{inst.id + 1}</span>
                      <span className="font-semibold text-slate-200">{inst.raw}</span>
                    </div>
                  </td>

                  {/* Cycles */}
                  {cycleNumbers.map((c) => {
                    const stageKey = rowTimeline[c];
                    const style = stageKey ? STAGE_CELL_STYLES[stageKey] || STAGE_CELL_STYLES.BUBBLE : null;
                    const isCurrent = c === currentCycle;

                    return (
                      <td
                        key={c}
                        className={`p-1 text-center border-b border-slate-800/60 ${
                          isCurrent ? 'bg-cyan-950/10' : ''
                        }`}
                      >
                        {stageKey ? (
                          <div
                            className={`w-full py-1 rounded text-[10px] font-mono border ${style?.bg} ${style?.text} ${style?.border}`}
                          >
                            {stageKey}
                          </div>
                        ) : (
                          <span className="text-slate-800 text-[10px]">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
