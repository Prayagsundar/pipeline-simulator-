import React from 'react';
import { ExecutionEventLog } from '../../simulator/types';
import { Terminal, Zap, AlertTriangle, ArrowRight, CheckCircle2, Info } from 'lucide-react';

interface EventLogPanelProps {
  events: ExecutionEventLog[];
}

export const EventLogPanel: React.FC<EventLogPanelProps> = ({ events }) => {
  if (events.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        No execution events logged yet. Step or run the pipeline to observe architectural events.
      </div>
    );
  }

  const getCategoryIcon = (category: ExecutionEventLog['category']) => {
    switch (category) {
      case 'forwarding':
        return <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'hazard':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'branch':
        return <ArrowRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case 'writeback':
      case 'complete':
        return <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
      default:
        return <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-xs overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-200">Execution & Hazard Event Feed</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400 text-[11px]">{events.length} events logged</span>
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[11px]">
        {events.map((evt) => {
          const isWarning = evt.severity === 'warning';
          const isSuccess = evt.severity === 'success';

          return (
            <div
              key={evt.id}
              className={`p-2.5 rounded-lg border flex items-start gap-3 transition-colors ${
                isWarning
                  ? 'border-amber-900/50 bg-amber-950/20 text-amber-200'
                  : isSuccess
                  ? 'border-emerald-900/50 bg-emerald-950/20 text-emerald-200'
                  : 'border-slate-800/80 bg-slate-900/30 text-slate-300'
              }`}
            >
              <div className="mt-0.5">{getCategoryIcon(evt.category)}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    C{evt.cycle} · {evt.category}
                  </span>
                </div>
                <div>{evt.message}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
