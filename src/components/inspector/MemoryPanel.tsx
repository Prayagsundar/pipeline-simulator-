import React, { useState } from 'react';
import { SimulationState } from '../../simulator/types';

interface MemoryPanelProps {
  state: SimulationState | null;
}

export const MemoryPanel: React.FC<MemoryPanelProps> = ({ state }) => {
  const [displayMode, setDisplayMode] = useState<'dec' | 'hex'>('dec');
  const memory = state?.memory || {};
  const currentCycle = state?.cycle || 0;

  // Render a range of word addresses e.g. 0x0000 to 0x0040 (and any populated addresses)
  const populatedAddrs = Object.keys(memory).map(Number);
  const defaultAddrs = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60];
  const allAddrs = Array.from(new Set([...defaultAddrs, ...populatedAddrs])).sort((a, b) => a - b);

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-xs">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">Data Memory</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400 text-[11px]">Word-Aligned (4-Byte Units)</span>
        </div>

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

      {/* Memory Table */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {allAddrs.map((addr) => {
            const val = memory[addr] ?? 0;
            const modifiedCycle = state?.memoryModifiedCycles[addr];
            const isRecent = modifiedCycle !== undefined && currentCycle - modifiedCycle <= 1;

            const formattedVal =
              displayMode === 'hex'
                ? `0x${(val >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
                : val.toString();

            return (
              <div
                key={addr}
                className={`p-2.5 rounded-lg border transition-all ${
                  isRecent
                    ? 'border-emerald-500 bg-emerald-950/30'
                    : val !== 0
                    ? 'border-slate-700 bg-slate-900/50'
                    : 'border-slate-800/80 bg-slate-900/20'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-mono text-cyan-400 font-semibold">
                    0x{addr.toString(16).toUpperCase().padStart(4, '0')}
                  </span>
                  <span className="text-slate-500 text-[10px]">[{addr}]</span>
                </div>
                <div
                  className={`font-mono text-xs tabular-nums truncate ${
                    val !== 0 ? (isRecent ? 'text-emerald-300 font-bold' : 'text-slate-100') : 'text-slate-600'
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
