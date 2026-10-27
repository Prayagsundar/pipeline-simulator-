import React from 'react';
import { SimulationState, StageName } from '../../simulator/types';
import { Zap, AlertTriangle, ArrowRight } from 'lucide-react';

interface Pipeline2DViewProps {
  state: SimulationState | null;
  selectedStage: StageName | null;
  onSelectStage: (stage: StageName | null) => void;
}

export const Pipeline2DView: React.FC<Pipeline2DViewProps> = ({
  state,
  selectedStage,
  onSelectStage,
}) => {
  const pRegs = state?.pipelineRegisters;

  const stages: { name: StageName; title: string; desc: string; color: string }[] = [
    { name: 'IF', title: 'Instruction Fetch', desc: 'Read instruction at PC & compute PC + 4', color: 'border-blue-500/50 text-blue-400' },
    { name: 'ID', title: 'Instruction Decode', desc: 'Read registers Rs/Rt & detect hazards', color: 'border-purple-500/50 text-purple-400' },
    { name: 'EX', title: 'Execute / ALU', desc: 'Arithmetic, address calc & branch evaluate', color: 'border-cyan-500/50 text-cyan-400' },
    { name: 'MEM', title: 'Memory Access', desc: 'Read/write Data RAM for LW/SW', color: 'border-emerald-500/50 text-emerald-400' },
    { name: 'WB', title: 'Write Back', desc: 'Commit result to Register File (Rd/Rt)', color: 'border-amber-500/50 text-amber-400' },
  ];

  const hasForwarding = (state?.activeForwardings.length ?? 0) > 0;
  const hasStall = state?.isStalled;

  return (
    <div className="w-full h-full min-h-[460px] bg-slate-950 p-6 flex flex-col justify-between overflow-x-auto text-xs">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-100">2D Architectural Datapath Schematic</h2>
          <p className="text-slate-400 text-[11px]">Classic 5-stage RISC processor microarchitecture with pipeline registers</p>
        </div>
        <div className="flex items-center gap-2">
          {hasForwarding && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-400 text-[11px]">
              <Zap className="w-3.5 h-3.5" />
              <span>Forwarding Active</span>
            </span>
          )}
          {hasStall && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-950/60 border border-amber-800 text-amber-400 text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Pipeline Stalled</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Datapath Flow */}
      <div className="relative flex items-stretch gap-4 my-auto min-w-[880px]">
        {stages.map((stg, idx) => {
          const stageState = state?.stages[stg.name];
          const inst = stageState?.instruction;
          const isSelected = selectedStage === stg.name;

          return (
            <React.Fragment key={stg.name}>
              {/* Stage Block */}
              <div
                onClick={() => onSelectStage(isSelected ? null : stg.name)}
                className={`flex-1 rounded-xl p-4 border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-cyan-400 bg-cyan-950/20 shadow-lg shadow-cyan-950/50'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                {/* Stage Header */}
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                  <span className={`font-bold tracking-wider ${stg.color}`}>{stg.name}</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      stageState?.status === 'stalled'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800/80'
                        : stageState?.status === 'flushed'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800/80'
                        : inst
                        ? 'bg-slate-800 text-cyan-300'
                        : 'text-slate-600'
                    }`}
                  >
                    {stageState?.status.toUpperCase() || 'EMPTY'}
                  </span>
                </div>

                <div className="font-medium text-slate-200 text-xs mb-1">{stg.title}</div>
                <div className="text-slate-400 text-[11px] mb-4">{stg.desc}</div>

                {/* Occupying Instruction */}
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 mb-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Instruction</div>
                  <div className="font-mono text-xs font-semibold text-slate-100 truncate">
                    {inst ? inst.raw : <span className="text-slate-600 italic">No instruction</span>}
                  </div>
                </div>

                {/* Sub-components list */}
                <div className="space-y-1.5 text-[11px]">
                  {stg.name === 'IF' && (
                    <>
                      <div className="flex justify-between text-slate-400">
                        <span>PC Value:</span>
                        <span className="font-mono text-cyan-400">0x{(state?.pc ?? 0).toString(16).padStart(4, '0')}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Adder:</span>
                        <span className="font-mono text-slate-300">PC + 4</span>
                      </div>
                    </>
                  )}
                  {stg.name === 'ID' && (
                    <>
                      <div className="flex justify-between text-slate-400">
                        <span>Rs / Rt:</span>
                        <span className="font-mono text-slate-300">R{inst?.rs ?? '-'} / R{inst?.rt ?? '-'}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Hazard Unit:</span>
                        <span className="text-slate-300 font-mono">{hasStall ? 'STALL DETECT' : 'CLEAR'}</span>
                      </div>
                    </>
                  )}
                  {stg.name === 'EX' && (
                    <>
                      <div className="flex justify-between text-slate-400">
                        <span>ALU Operation:</span>
                        <span className="font-mono text-cyan-400">{inst?.opcode || 'NOP'}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Forwarding Mux:</span>
                        <span className="text-slate-300 font-mono">{hasForwarding ? 'ACTIVE' : 'DIRECT'}</span>
                      </div>
                    </>
                  )}
                  {stg.name === 'MEM' && (
                    <>
                      <div className="flex justify-between text-slate-400">
                        <span>Memory Action:</span>
                        <span className="font-mono text-emerald-400">
                          {pRegs?.EX_MEM.memRead ? 'READ (LW)' : pRegs?.EX_MEM.memWrite ? 'WRITE (SW)' : 'NONE'}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Word Address:</span>
                        <span className="font-mono text-slate-300">
                          {pRegs?.EX_MEM.valid ? `0x${pRegs.EX_MEM.aluResult.toString(16)}` : '—'}
                        </span>
                      </div>
                    </>
                  )}
                  {stg.name === 'WB' && (
                    <>
                      <div className="flex justify-between text-slate-400">
                        <span>Reg Write:</span>
                        <span className="font-mono text-amber-400">{pRegs?.MEM_WB.regWrite ? 'ENABLE' : 'DISABLE'}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Target Dest:</span>
                        <span className="font-mono text-slate-300">{pRegs?.MEM_WB.valid ? `R${pRegs.MEM_WB.destReg}` : '—'}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Inter-stage Pipeline Register Barrier */}
              {idx < stages.length - 1 && (
                <div className="flex flex-col items-center justify-center gap-1 shrink-0 px-1">
                  <div className="h-full w-3 bg-slate-800 rounded-sm border border-slate-700 flex flex-col justify-around py-4 items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 whitespace-nowrap">
                    {stages[idx].name}/{stages[idx + 1].name}
                  </span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Bypass / Feedback Lines Footer Explanation */}
      <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-800/80">
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900/40 border border-slate-800/60">
          <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-200">Data Forwarding Bypasses (EX/MEM & MEM/WB &rarr; EX)</div>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Allows ALU operands to be grabbed directly from prior stage registers without waiting for the WB stage to write to the register file.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900/40 border border-slate-800/60">
          <ArrowRight className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-200">Branch Resolution Feedback (EX &rarr; IF)</div>
            <p className="text-slate-400 text-[11px] mt-0.5">
              When BEQ/BNE evaluates to Taken in the EX stage, the target PC is loaded and the speculative instructions in IF and ID are flushed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
