import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ValidateResponse } from '../services/api';
import { EXAMPLE_PROGRAMS, ExampleProgram } from '../simulator/examples';
import { SimulationConfig, SimulationState, StageName } from '../simulator/types';

export type WorkspaceTab = 'pipeline' | 'timeline' | 'registers' | 'memory' | 'metrics' | 'events';

export interface UseSimulatorReturn {
  sessionId: string | null;
  state: SimulationState | null;
  code: string;
  config: SimulationConfig;
  isRunning: boolean;
  executionSpeedMs: number;
  viewMode: '3d' | '2d';
  activeTab: WorkspaceTab;
  selectedStage: StageName | null;
  selectedInstructionId: number | null;
  validation: ValidateResponse | null;
  isLoading: boolean;
  error: string | null;
  examples: ExampleProgram[];
  activeExampleId: string;
  autoPlayTimer: number | null;

  // Actions
  setCode: (code: string) => void;
  loadExample: (id: string) => Promise<void>;
  initSimulation: () => Promise<void>;
  step: () => Promise<void>;
  togglePlay: () => void;
  runToCompletion: () => Promise<void>;
  reset: () => Promise<void>;
  setForwarding: (enabled: boolean) => Promise<void>;
  setBranchPrediction: (predictTaken: boolean) => Promise<void>;
  setViewMode: (mode: '3d' | '2d') => void;
  setActiveTab: (tab: WorkspaceTab) => void;
  setSelectedStage: (stage: StageName | null) => void;
  setSelectedInstructionId: (id: number | null) => void;
  setExecutionSpeedMs: (ms: number) => void;
}

export function useSimulator() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<SimulationState | null>(null);
  const [code, setCodeState] = useState<string>(EXAMPLE_PROGRAMS[1].code);
  const [config, setConfigState] = useState<SimulationConfig>({
    forwardingEnabled: true,
    branchPredictTaken: false,
    memorySize: 4096,
    maxCycles: 1000,
  });
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [executionSpeedMs, setExecutionSpeedMs] = useState<number>(600);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('pipeline');
  const [selectedStage, setSelectedStage] = useState<StageName | null>(null);
  const [selectedInstructionId, setSelectedInstructionId] = useState<number | null>(null);
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeExampleId, setActiveExampleId] = useState<string>(EXAMPLE_PROGRAMS[1].id);

  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const executionSpeedRef = useRef(executionSpeedMs);
  executionSpeedRef.current = executionSpeedMs;

  // Validate on code change
  useEffect(() => {
    let cancel = false;
    const timer = setTimeout(async () => {
      try {
        const val = await api.validateProgram(code);
        if (!cancel) setValidation(val);
      } catch (err: any) {
        if (!cancel) {
          setValidation({
            valid: false,
            errors: [err.message || 'Validation failed'],
            instructionCount: 0,
            labels: {},
            instructions: [],
          });
        }
      }
    }, 250);

    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [code]);

  const initSimulation = useCallback(
    async (overrideCode?: string, initialMem: Record<number, number> = {}) => {
      setIsLoading(true);
      setError(null);
      try {
        const programCode = overrideCode ?? code;
        const res = await api.createSimulation(programCode, config, initialMem);
        setSessionId(res.id);
        setState(res.state);
        setIsRunning(false);
      } catch (err: any) {
        setError(err.message || 'Failed to initialize simulation');
      } finally {
        setIsLoading(false);
      }
    },
    [code, config]
  );

  // Initialize on mount
  useEffect(() => {
    const defaultEx = EXAMPLE_PROGRAMS[1];
    initSimulation(defaultEx.code, defaultEx.initialMemory || {});
  }, []);

  const loadExample = useCallback(
    async (id: string) => {
      const ex = EXAMPLE_PROGRAMS.find((p) => p.id === id);
      if (!ex) return;
      setActiveExampleId(id);
      setCodeState(ex.code);
      await initSimulation(ex.code, ex.initialMemory || {});
    },
    [initSimulation]
  );

  const step = useCallback(async () => {
    if (!sessionIdRef.current) return;
    try {
      const nextState = await api.stepSimulation(sessionIdRef.current);
      setState(nextState);
      if (nextState.isHalted) {
        setIsRunning(false);
      }
    } catch (err: any) {
      setError(err.message || 'Step failed');
      setIsRunning(false);
    }
  }, []);

  // Continuous execution loop
  useEffect(() => {
    if (!isRunning) return;

    let timeoutId: number;
    const runNext = async () => {
      if (!isRunningRef.current || !sessionIdRef.current) return;
      try {
        const nextState = await api.stepSimulation(sessionIdRef.current);
        setState(nextState);
        if (nextState.isHalted) {
          setIsRunning(false);
          return;
        }
        timeoutId = window.setTimeout(runNext, executionSpeedRef.current);
      } catch {
        setIsRunning(false);
      }
    };

    timeoutId = window.setTimeout(runNext, executionSpeedRef.current);
    return () => clearTimeout(timeoutId);
  }, [isRunning]);

  const togglePlay = useCallback(() => {
    if (state?.isHalted) {
      // If completed, resetting first
      return;
    }
    setIsRunning((prev) => !prev);
  }, [state?.isHalted]);

  const runToCompletion = useCallback(async () => {
    if (!sessionIdRef.current) return;
    setIsLoading(true);
    try {
      const nextState = await api.runSimulation(sessionIdRef.current, 200);
      setState(nextState);
      setIsRunning(false);
    } catch (err: any) {
      setError(err.message || 'Run failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(async () => {
    if (!sessionIdRef.current) return;
    setIsRunning(false);
    try {
      const nextState = await api.resetSimulation(sessionIdRef.current);
      setState(nextState);
    } catch (err: any) {
      setError(err.message || 'Reset failed');
    }
  }, []);

  const setForwarding = useCallback(
    async (enabled: boolean) => {
      setConfigState((prev) => ({ ...prev, forwardingEnabled: enabled }));
      if (sessionIdRef.current) {
        try {
          const nextState = await api.updateConfig(sessionIdRef.current, { forwardingEnabled: enabled });
          setState(nextState);
        } catch {
          // ignore
        }
      }
    },
    []
  );

  const setBranchPrediction = useCallback(
    async (predictTaken: boolean) => {
      setConfigState((prev) => ({ ...prev, branchPredictTaken: predictTaken }));
      if (sessionIdRef.current) {
        try {
          const nextState = await api.updateConfig(sessionIdRef.current, { branchPredictTaken: predictTaken });
          setState(nextState);
        } catch {
          // ignore
        }
      }
    },
    []
  );

  return {
    sessionId,
    state,
    code,
    config,
    isRunning,
    executionSpeedMs,
    viewMode,
    activeTab,
    selectedStage,
    selectedInstructionId,
    validation,
    isLoading,
    error,
    examples: EXAMPLE_PROGRAMS,
    activeExampleId,
    autoPlayTimer: null,
    setCode: setCodeState,
    loadExample,
    initSimulation,
    step,
    togglePlay,
    runToCompletion,
    reset,
    setForwarding,
    setBranchPrediction,
    setViewMode,
    setActiveTab,
    setSelectedStage,
    setSelectedInstructionId,
    setExecutionSpeedMs,
  };
}
