import React, { useState } from 'react';
import { useSimulator } from './store/useSimulatorStore';
import { TopBar } from './components/layout/TopBar';
import { Pipeline3DView } from './components/pipeline3d/Pipeline3DView';
import { Pipeline2DView } from './components/pipeline2d/Pipeline2DView';
import { CycleTimeline } from './components/timeline/CycleTimeline';
import { AssemblyEditor } from './components/editor/AssemblyEditor';
import { RegisterPanel } from './components/inspector/RegisterPanel';
import { MemoryPanel } from './components/inspector/MemoryPanel';
import { PipelineRegistersInspector } from './components/inspector/PipelineRegistersInspector';
import { MetricsPanel } from './components/metrics/MetricsPanel';
import { EventLogPanel } from './components/events/EventLogPanel';
import { GuidedObservationModal } from './components/guided/GuidedObservationModal';
import { GitHubPushModal } from './components/github/GitHubPushModal';
import { PanelLeftClose, PanelLeftOpen, Cpu, X } from 'lucide-react';

export default function App() {
  const {
    state,
    code,
    isRunning,
    executionSpeedMs,
    viewMode,
    activeTab,
    selectedStage,
    selectedInstructionId,
    validation,
    isLoading,
    error,
    examples,
    activeExampleId,
    setCode,
    loadExample,
    initSimulation,
    step,
    togglePlay,
    runToCompletion,
    reset,
    setForwarding,
    setViewMode,
    setActiveTab,
    setSelectedStage,
    setSelectedInstructionId,
    setExecutionSpeedMs,
  } = useSimulator();

  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isPushOpen, setIsPushOpen] = useState(false);

  const currentExample =
    examples.find((e) => e.id === activeExampleId) || examples[0];

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Navigation & Controls Ribbon */}
      <TopBar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        isRunning={isRunning}
        onTogglePlay={togglePlay}
        onStep={step}
        onRunToCompletion={runToCompletion}
        onReset={reset}
        forwardingEnabled={state?.config.forwardingEnabled ?? true}
        onToggleForwarding={setForwarding}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        executionSpeedMs={executionSpeedMs}
        onChangeSpeed={setExecutionSpeedMs}
        currentCycle={state?.cycle ?? 0}
        isHalted={state?.isHalted ?? false}
        isStalled={state?.isStalled ?? false}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenPushModal={() => setIsPushOpen(true)}
        isLoading={isLoading}
      />

      {/* Main Split Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side: Assembly Editor Panel */}
        <div
          className={`transition-all duration-300 ease-in-out border-r border-slate-800 flex flex-col shrink-0 ${
            editorCollapsed ? 'w-0 overflow-hidden border-none' : 'w-80 lg:w-96'
          }`}
        >
          <AssemblyEditor
            code={code}
            onChangeCode={setCode}
            onAssemble={() => initSimulation(code, currentExample.initialMemory || {})}
            examples={examples}
            activeExampleId={activeExampleId}
            onSelectExample={(id) => {
              loadExample(id);
              setIsGuideOpen(true);
            }}
            validation={validation}
            currentPc={state?.pc ?? 0}
            isLoading={isLoading}
          />
        </div>

        {/* Editor Collapse Toggle Tab */}
        <button
          onClick={() => setEditorCollapsed((prev) => !prev)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-30 p-1.5 bg-slate-900 border border-slate-700/80 text-slate-400 hover:text-slate-100 rounded-r-lg shadow-lg transition-colors"
          style={{ left: editorCollapsed ? '0px' : undefined }}
          title={editorCollapsed ? 'Expand Code Editor' : 'Collapse Code Editor'}
        >
          {editorCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        {/* Right Side: Main Visualization & Inspection Canvas */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
          {/* Active Tab View */}
          <div className="flex-1 relative overflow-hidden">
            {activeTab === 'pipeline' && (
              <div className="w-full h-full relative">
                {viewMode === '3d' ? (
                  <Pipeline3DView
                    state={state}
                    selectedStage={selectedStage}
                    onSelectStage={setSelectedStage}
                    onSelectInstruction={setSelectedInstructionId}
                  />
                ) : (
                  <Pipeline2DView
                    state={state}
                    selectedStage={selectedStage}
                    onSelectStage={setSelectedStage}
                  />
                )}
              </div>
            )}

            {activeTab === 'timeline' && (
              <CycleTimeline
                state={state}
                selectedInstructionId={selectedInstructionId}
                onSelectInstruction={setSelectedInstructionId}
              />
            )}

            {activeTab === 'registers' && <RegisterPanel state={state} />}

            {activeTab === 'memory' && <MemoryPanel state={state} />}

            {activeTab === 'metrics' && (
              <MetricsPanel
                state={state}
                onToggleForwarding={setForwarding}
              />
            )}

            {activeTab === 'events' && (
              <EventLogPanel events={state?.events || []} />
            )}
          </div>

          {/* Collapsible Stage Details Drawer when a stage is selected */}
          {selectedStage && (
            <div className="h-64 border-t border-slate-800 bg-slate-950/95 shadow-2xl flex flex-col z-20">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-slate-200">
                    Selected Stage: {selectedStage}
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-[11px] text-slate-400">
                    {state?.stages[selectedStage]?.instruction?.raw || 'Idle / Empty'}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedStage(null)}
                  className="p-1 text-slate-400 hover:text-slate-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <PipelineRegistersInspector state={state} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Guided Educational Observations Modal */}
      <GuidedObservationModal
        example={currentExample}
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* GitHub Push Modal */}
      <GitHubPushModal
        isOpen={isPushOpen}
        onClose={() => setIsPushOpen(false)}
        defaultUsername="Prayagsundar"
      />

      {/* Error Toast if any */}
      {error && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-rose-950 border border-rose-800 rounded-xl shadow-2xl text-rose-200 text-xs flex items-center gap-3 max-w-md">
          <div className="flex-1">{error}</div>
          <button
            onClick={() => {}}
            className="text-rose-400 hover:text-rose-100 font-bold"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
