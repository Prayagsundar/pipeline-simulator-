import React from 'react';
import { SimulationState } from '../../simulator/types';

interface PipelineRegistersInspectorProps {
  state: SimulationState | null;
}

export const PipelineRegistersInspector: React.FC<PipelineRegistersInspectorProps> = ({ state }) => {
  const regs = state?.pipelineRegisters;

  if (!regs) {
    return (
      <div className="p-6 text-center text-slate-500 text-xs">
        No active pipeline register data available.
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-xs overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h3 className="font-bold text-slate-200">Pipeline Registers & Control Signals</h3>
          <p className="text-slate-400 text-[11px]">Inter-stage latches synchronizing pipelined execution</p>
        </div>
        <span className="font-mono text-cyan-400 text-[11px]">Cycle {state?.cycle ?? 0}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* 1. IF/ID Register */}
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
            <span className="font-bold text-blue-400">IF / ID Register</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${regs.IF_ID.valid ? 'bg-blue-950 text-blue-300' : 'text-slate-600'}`}>
              {regs.IF_ID.valid ? 'VALID' : 'BUBBLE'}
            </span>
          </div>
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Instruction:</span>
              <span className="text-slate-200 font-semibold">{regs.IF_ID.instruction?.raw || '—'}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>PC:</span>
              <span className="text-cyan-400">0x{regs.IF_ID.pc.toString(16).padStart(4, '0')}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>PC + 4:</span>
              <span className="text-slate-300">0x{regs.IF_ID.pcNext.toString(16).padStart(4, '0')}</span>
            </div>
          </div>
        </div>

        {/* 2. ID/EX Register */}
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
            <span className="font-bold text-purple-400">ID / EX Register</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${regs.ID_EX.valid ? 'bg-purple-950 text-purple-300' : 'text-slate-600'}`}>
              {regs.ID_EX.valid ? 'VALID' : 'BUBBLE'}
            </span>
          </div>
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Instruction:</span>
              <span className="text-slate-200 font-semibold">{regs.ID_EX.instruction?.raw || '—'}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Val(Rs) / Val(Rt):</span>
              <span className="text-slate-200">{regs.ID_EX.valRs} / {regs.ID_EX.valRt}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Immediate:</span>
              <span className="text-cyan-400">{regs.ID_EX.immediate}</span>
            </div>
            <div className="pt-2 border-t border-slate-800/60 flex flex-wrap gap-1 text-[10px]">
              <span className={`px-1.5 py-0.5 rounded ${regs.ID_EX.regWrite ? 'bg-amber-950 text-amber-300' : 'text-slate-600'}`}>RegWrite</span>
              <span className={`px-1.5 py-0.5 rounded ${regs.ID_EX.memRead ? 'bg-emerald-950 text-emerald-300' : 'text-slate-600'}`}>MemRead</span>
              <span className={`px-1.5 py-0.5 rounded ${regs.ID_EX.memWrite ? 'bg-emerald-950 text-emerald-300' : 'text-slate-600'}`}>MemWrite</span>
              <span className={`px-1.5 py-0.5 rounded ${regs.ID_EX.branch ? 'bg-rose-950 text-rose-300' : 'text-slate-600'}`}>Branch</span>
              <span className={`px-1.5 py-0.5 rounded ${regs.ID_EX.aluSrc ? 'bg-blue-950 text-blue-300' : 'text-slate-600'}`}>ALUSrc</span>
            </div>
          </div>
        </div>

        {/* 3. EX/MEM Register */}
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
            <span className="font-bold text-cyan-400">EX / MEM Register</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${regs.EX_MEM.valid ? 'bg-cyan-950 text-cyan-300' : 'text-slate-600'}`}>
              {regs.EX_MEM.valid ? 'VALID' : 'BUBBLE'}
            </span>
          </div>
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Instruction:</span>
              <span className="text-slate-200 font-semibold">{regs.EX_MEM.instruction?.raw || '—'}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>ALU Result:</span>
              <span className="text-cyan-300 font-bold">{regs.EX_MEM.aluResult}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Dest Reg:</span>
              <span className="text-slate-200">R{regs.EX_MEM.destReg}</span>
            </div>
            <div className="pt-2 border-t border-slate-800/60 flex flex-wrap gap-1 text-[10px]">
              <span className={`px-1.5 py-0.5 rounded ${regs.EX_MEM.regWrite ? 'bg-amber-950 text-amber-300' : 'text-slate-600'}`}>RegWrite</span>
              <span className={`px-1.5 py-0.5 rounded ${regs.EX_MEM.memRead ? 'bg-emerald-950 text-emerald-300' : 'text-slate-600'}`}>MemRead</span>
              <span className={`px-1.5 py-0.5 rounded ${regs.EX_MEM.memWrite ? 'bg-emerald-950 text-emerald-300' : 'text-slate-600'}`}>MemWrite</span>
            </div>
          </div>
        </div>

        {/* 4. MEM/WB Register */}
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
            <span className="font-bold text-amber-400">MEM / WB Register</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${regs.MEM_WB.valid ? 'bg-amber-950 text-amber-300' : 'text-slate-600'}`}>
              {regs.MEM_WB.valid ? 'VALID' : 'BUBBLE'}
            </span>
          </div>
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Instruction:</span>
              <span className="text-slate-200 font-semibold">{regs.MEM_WB.instruction?.raw || '—'}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Mem Data / ALU Res:</span>
              <span className="text-slate-200">{regs.MEM_WB.memData} / {regs.MEM_WB.aluResult}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Writeback Target:</span>
              <span className="text-amber-300 font-bold">R{regs.MEM_WB.destReg}</span>
            </div>
            <div className="pt-2 border-t border-slate-800/60 flex flex-wrap gap-1 text-[10px]">
              <span className={`px-1.5 py-0.5 rounded ${regs.MEM_WB.regWrite ? 'bg-amber-950 text-amber-300' : 'text-slate-600'}`}>RegWrite</span>
              <span className={`px-1.5 py-0.5 rounded ${regs.MEM_WB.memToReg ? 'bg-cyan-950 text-cyan-300' : 'text-slate-600'}`}>MemToReg</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
