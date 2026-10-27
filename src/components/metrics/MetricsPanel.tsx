import React from 'react';
import { SimulationMetrics, SimulationState } from '../../simulator/types';
import { Zap, AlertTriangle, ArrowRight, Gauge, CheckCircle2, TrendingUp } from 'lucide-react';

interface MetricsPanelProps {
  state: SimulationState | null;
  onToggleForwarding: (enabled: boolean) => void;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ state, onToggleForwarding }) => {
  const metrics: SimulationMetrics = state?.metrics || {
    totalCycles: 0,
    instructionsCompleted: 0,
    cpi: 0,
    ipc: 0,
    idealCycles: 0,
    dataHazardsCount: 0,
    loadUseHazardsCount: 0,
    controlHazardsCount: 0,
    stallsCount: 0,
    flushesCount: 0,
    forwardingEventsCount: 0,
    pipelineUtilization: 0,
    speedupVsSingleCycle: 1,
    speedupVsMultiCycle: 1,
  };

  const forwardingEnabled = state?.config.forwardingEnabled ?? true;

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-xs overflow-y-auto p-4 space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="font-bold text-slate-100 text-sm">Empirical Performance Analytics</h3>
          <p className="text-slate-400 text-[11px]">Computed directly from the hardware cycle execution history</p>
        </div>

        {/* Forwarding Toggle Quick Switch */}
        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
          <span className="text-[11px] text-slate-400">Forwarding Unit:</span>
          <button
            onClick={() => onToggleForwarding(!forwardingEnabled)}
            className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
              forwardingEnabled
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : 'bg-amber-950 text-amber-300 border border-amber-800'
            }`}
          >
            {forwardingEnabled ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Cycles */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="text-[11px] text-slate-400 uppercase font-semibold">Total Cycles</div>
          <div className="text-2xl font-bold font-mono text-cyan-400 tabular-nums mt-1">
            {metrics.totalCycles}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Clock ticks elapsed</div>
        </div>

        {/* Instructions Retired */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="text-[11px] text-slate-400 uppercase font-semibold">Instructions Retired</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums mt-1">
            {metrics.instructionsCompleted}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Completed through WB</div>
        </div>

        {/* CPI (Cycles Per Instruction) */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="text-[11px] text-slate-400 uppercase font-semibold">Measured CPI</div>
          <div className="text-2xl font-bold font-mono text-slate-100 tabular-nums mt-1">
            {metrics.cpi > 0 ? metrics.cpi.toFixed(2) : '—'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            IPC: {metrics.ipc > 0 ? metrics.ipc.toFixed(2) : '—'}
          </div>
        </div>

        {/* Pipeline Utilization */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="text-[11px] text-slate-400 uppercase font-semibold">Pipeline Utilization</div>
          <div className="text-2xl font-bold font-mono text-purple-400 tabular-nums mt-1">
            {metrics.pipelineUtilization}%
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Active stage-cycles / total</div>
        </div>
      </div>

      {/* Execution Diagnostics & Hazards Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hazards & Stalls Detail */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 space-y-3">
          <div className="font-semibold text-slate-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Hazard & Stall Breakdown</span>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Total Stall Cycles:</span>
              <span className="font-mono font-bold text-amber-400">{metrics.stallsCount}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">RAW Data Hazards (No Forwarding):</span>
              <span className="font-mono text-slate-200">{metrics.dataHazardsCount}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Load-Use Stalls:</span>
              <span className="font-mono text-slate-200">{metrics.loadUseHazardsCount}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Branch Flushes (Taken Penalty):</span>
              <span className="font-mono text-rose-400">{metrics.flushesCount} instructions</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">Bypass Forwarding Events:</span>
              <span className="font-mono text-emerald-400 font-bold">{metrics.forwardingEventsCount}</span>
            </div>
          </div>
        </div>

        {/* Theoretical vs Measured Comparison */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 space-y-3">
          <div className="font-semibold text-slate-200 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span>Architectural Baseline Comparison</span>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Ideal Pipelined Cycles (0 Hazards):</span>
              <span className="font-mono text-cyan-300 font-semibold">{metrics.idealCycles}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Actual Pipelined Cycles:</span>
              <span className="font-mono text-slate-200">{metrics.totalCycles}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Speedup vs Single-Cycle CPU:</span>
              <span className="font-mono text-emerald-400 font-semibold">{metrics.speedupVsSingleCycle}x</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Speedup vs Multi-Cycle CPU (CPI ~4.2):</span>
              <span className="font-mono text-emerald-400 font-semibold">{metrics.speedupVsMultiCycle}x</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">Stall Penalty Overhead:</span>
              <span className="font-mono text-slate-300">
                {metrics.totalCycles > 0 && metrics.idealCycles > 0
                  ? `${Math.max(0, metrics.totalCycles - metrics.idealCycles)} extra cycles`
                  : '0'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Definitions & Notes */}
      <div className="p-3.5 rounded-lg bg-slate-900/20 border border-slate-800/60 text-[11px] text-slate-400 space-y-1">
        <span className="font-semibold text-slate-300">Metric Definitions:</span>
        <p>• <strong className="text-slate-300">CPI</strong> = Total Cycles / Instructions Retired. In an ideal pipeline with zero stalls, steady-state CPI approaches 1.0.</p>
        <p>• <strong className="text-slate-300">Ideal Cycles</strong> = Instructions + 4 (fills 5 pipeline stages, then retires 1 instruction per cycle).</p>
        <p>• <strong className="text-slate-300">Load-Use Hazard</strong> = Even with full forwarding, LW data is ready at end of MEM stage, requiring 1 stall cycle if used immediately.</p>
      </div>
    </div>
  );
};
