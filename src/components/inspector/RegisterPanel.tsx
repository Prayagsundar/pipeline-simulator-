import React, { useState } from 'react';
import { SimulationState } from '../../simulator/types';

interface RegisterPanelProps {
  state: SimulationState | null;
}

const REG_NAMES: string[] = [
  '$zero', '$at', '$v0', '$v1', '$a0', '$a1', '$a2', '$a3',
  '$t0', '$t1', '$t2', '$t3', '$t4', '$t5', '$t6', '$t7',
  '$s0', '$s1', '$s2', '$s3', '$s4', '$s5', '$s6', '$s7',
  '$t8', '$t9', '$k0', '$k1', '$gp', '$sp', '$fp', '$ra',
];

export const RegisterPanel: React.FC<RegisterPanelProps> = ({ state }) => {
  const [displayMode, setDisplayMode] = useState<'dec' | 'hex'>('dec');
  const registers = state?.registers || new Array(32).fill(0);
  const currentCycle = state?.cycle || 0;

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-xs">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">Register File</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400 text-[11px]">32 General-Purpose Registers</span>
        </div>

        {/* Display Format Toggle */}
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
          <button
            onClick={() => setDisplayMode('dec')}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
              displayMode === 'dec' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DEC
          </button>
          <button
            onClick={() => setDisplayMode('hex')}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
              displayMode === 'hex' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            HEX
          </button>
        </div>
      </div>

      {/* 32 Registers Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-2">
          {registers.map((val, idx) => {
            const modifiedCycle = state?.registerModifiedCycles[idx];
            const isRecent = modifiedCycle !== undefined && currentCycle - modifiedCycle <= 1;
            const alias = REG_NAMES[idx];

            const formattedVal =
              displayMode === 'hex'
                ? `0x${(val >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
                : val.toString();

            return (
              <div
                key={idx}
                className={`p-2.5 rounded-lg border transition-all ${
                  isRecent
                    ? 'border-emerald-500 bg-emerald-950/30 shadow-sm'
                    : 'border-slate-800/80 bg-slate-900/40'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-bold text-slate-200">R{idx}</span>
                  <span className="text-slate-400 font-mono text-[10px]">{alias}</span>
                </div>
                <div
                  className={`font-mono text-xs tabular-nums truncate ${
                    val !== 0 ? (isRecent ? 'text-emerald-300 font-bold' : 'text-cyan-300') : 'text-slate-600'
                  }`}
                >
                  {formattedVal}
                </div>
                {isRecent && (
                  <div className="text-[9px] text-emerald-400 font-mono mt-1">
                    Written C{modifiedCycle}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
