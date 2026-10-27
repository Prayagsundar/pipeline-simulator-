import React from 'react';
import { WorkspaceTab } from '../../store/useSimulatorStore';
import {
  Play,
  Pause,
  SkipForward,
  FastForward,
  RotateCcw,
  Zap,
  Box,
  Layout,
  BookOpen,
} from 'lucide-react';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onChangeTab: (tab: WorkspaceTab) => void;
  isRunning: boolean;
  onTogglePlay: () => void;
  onStep: () => void;
  onRunToCompletion: () => void;
  onReset: () => void;
  forwardingEnabled: boolean;
  onToggleForwarding: (enabled: boolean) => void;
  viewMode: '3d' | '2d';
  onToggleViewMode: (mode: '3d' | '2d') => void;
  executionSpeedMs: number;
  onChangeSpeed: (ms: number) => void;
  currentCycle: number;
  isHalted: boolean;
  isStalled: boolean;
  onOpenGuide: () => void;
  onOpenPushModal: () => void;
  isLoading: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onChangeTab,
  isRunning,
  onTogglePlay,
  onStep,
  onRunToCompletion,
  onReset,
  forwardingEnabled,
  onToggleForwarding,
  viewMode,
  onToggleViewMode,
  executionSpeedMs,
  onChangeSpeed,
  currentCycle,
  isHalted,
  isStalled,
  onOpenGuide,
  onOpenPushModal,
  isLoading,
}) => {
  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: 'pipeline', label: 'Pipeline View' },
    { id: 'timeline', label: 'Cycle Timeline' },
    { id: 'registers', label: 'Registers' },
    { id: 'memory', label: 'Data RAM' },
    { id: 'metrics', label: 'Analytics' },
    { id: 'events', label: 'Event Feed' },
  ];

  return (
    <header className="w-full bg-slate-950 border-b border-slate-800 select-none">
      {/* Zone 1, 2, 3 Main Top Bar */}
      <div className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-850">
        {/* Zone 1: Single Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center font-bold text-white shadow-md shadow-cyan-900/40 font-mono text-sm">
            3D
          </div>
          <span className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
            Pipeline3D Studio
          </span>
        </div>

        {/* Zone 2: Navigation Links / Workspace Tabs */}
        <nav className="hidden lg:flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-slate-100 font-semibold shadow-sm'
                  : 'hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Guide</span>
          </button>

          <button
            onClick={onOpenPushModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors whitespace-nowrap shadow-sm shadow-cyan-900/30"
          >
            <span>Push to GitHub</span>
          </button>
        </div>
      </div>

      {/* Execution Control Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 bg-slate-900/40 text-xs">
        {/* Left: Execution Controls */}
        <div className="flex items-center gap-2">
          {/* Play / Pause */}
          <button
            onClick={onTogglePlay}
            disabled={isHalted || isLoading}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all shadow-sm ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40'
            }`}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isRunning ? 'Pause' : 'Run'}</span>
          </button>

          {/* Single Step */}
          <button
            onClick={onStep}
            disabled={isRunning || isHalted || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-medium transition-colors border border-slate-700/60"
            title="Advance 1 Cycle"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>Step Cycle</span>
          </button>

          {/* Run to Completion */}
          <button
            onClick={onRunToCompletion}
            disabled={isRunning || isHalted || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-medium transition-colors border border-slate-700/60"
            title="Execute until program drains"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Run All</span>
          </button>

          {/* Reset */}
          <button
            onClick={onReset}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors border border-slate-700/60"
            title="Reset Simulation to Cycle 0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Center: Cycle & Status Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400">Clock Cycle:</span>
            <span className="font-mono font-bold text-cyan-400 tabular-nums">{currentCycle}</span>
          </div>

          <div className="flex items-center gap-2">
            {isHalted && (
              <span className="px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold border border-slate-700 text-[11px]">
                COMPLETED
              </span>
            )}
            {isStalled && (
              <span className="px-2.5 py-0.5 rounded bg-amber-950 text-amber-300 font-semibold border border-amber-800 text-[11px]">
                STALL DETECTED
              </span>
            )}
          </div>
        </div>

        {/* Right: Hardware Settings & Viewport Toggles */}
        <div className="flex items-center gap-3">
          {/* Forwarding Toggle */}
          <button
            onClick={() => onToggleForwarding(!forwardingEnabled)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
              forwardingEnabled
                ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <Zap className="w-3 h-3 text-emerald-400" />
            <span>Forwarding: {forwardingEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* 3D vs 2D View Switch */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => onToggleViewMode('3d')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                viewMode === '3d'
                  ? 'bg-slate-800 text-cyan-300 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="w-3 h-3" />
              <span>3D</span>
            </button>
            <button
              onClick={() => onToggleViewMode('2d')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                viewMode === '2d'
                  ? 'bg-slate-800 text-cyan-300 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layout className="w-3 h-3" />
              <span>2D</span>
            </button>
          </div>

          {/* Speed Slider */}
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-800 text-[11px] text-slate-400">
            <span>Speed:</span>
            <input
              type="range"
              min="100"
              max="1200"
              step="50"
              value={1300 - executionSpeedMs}
              onChange={(e) => onChangeSpeed(1300 - Number(e.target.value))}
              className="w-16 accent-cyan-500 cursor-pointer"
              title="Execution Speed"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
