export type RegisterName =
  | 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7'
  | 'R8' | 'R9' | 'R10' | 'R11' | 'R12' | 'R13' | 'R14' | 'R15'
  | 'R16' | 'R17' | 'R18' | 'R19' | 'R20' | 'R21' | 'R22' | 'R23'
  | 'R24' | 'R25' | 'R26' | 'R27' | 'R28' | 'R29' | 'R30' | 'R31'
  | '$zero' | '$at' | '$v0' | '$v1' | '$a0' | '$a1' | '$a2' | '$a3'
  | '$t0' | '$t1' | '$t2' | '$t3' | '$t4' | '$t5' | '$t6' | '$t7'
  | '$s0' | '$s1' | '$s2' | '$s3' | '$s4' | '$s5' | '$s6' | '$s7'
  | '$t8' | '$t9' | '$k0' | '$k1' | '$gp' | '$sp' | '$fp' | '$ra';

export type Opcode =
  | 'ADD'
  | 'SUB'
  | 'ADDI'
  | 'AND'
  | 'OR'
  | 'XOR'
  | 'LW'
  | 'SW'
  | 'BEQ'
  | 'BNE'
  | 'NOP';

export interface ParsedInstruction {
  id: number; // Unique sequence index
  raw: string;
  pc: number;
  opcode: Opcode;
  rd?: number; // 0-31
  rs?: number; // 0-31
  rt?: number; // 0-31
  immediate?: number;
  label?: string; // Target label for branches
  targetPc?: number; // Resolved branch target PC
  sourceLine: number;
}

export type StageName = 'IF' | 'ID' | 'EX' | 'MEM' | 'WB';

export interface PipelineStageState {
  stage: StageName;
  instruction: ParsedInstruction | null;
  status: 'active' | 'stalled' | 'bubble' | 'flushed' | 'empty';
  cycleEntered: number;
  details?: Record<string, any>;
}

export interface PipelineRegisters {
  IF_ID: {
    instruction: ParsedInstruction | null;
    pc: number;
    pcNext: number;
    valid: boolean;
  };
  ID_EX: {
    instruction: ParsedInstruction | null;
    pc: number;
    rs: number;
    rt: number;
    rd: number;
    valRs: number;
    valRt: number;
    immediate: number;
    regWrite: boolean;
    memRead: boolean;
    memWrite: boolean;
    branch: boolean;
    aluSrc: boolean;
    memToReg: boolean;
    valid: boolean;
  };
  EX_MEM: {
    instruction: ParsedInstruction | null;
    pc: number;
    aluResult: number;
    valRt: number;
    destReg: number;
    regWrite: boolean;
    memRead: boolean;
    memWrite: boolean;
    valid: boolean;
  };
  MEM_WB: {
    instruction: ParsedInstruction | null;
    pc: number;
    aluResult: number;
    memData: number;
    destReg: number;
    regWrite: boolean;
    memToReg: boolean;
    valid: boolean;
  };
}

export interface HazardEvent {
  id: string;
  cycle: number;
  type: 'RAW' | 'LOAD_USE' | 'BRANCH_TAKEN' | 'STRUCTURAL';
  description: string;
  sourceInstructionId?: number;
  dependentInstructionId?: number;
  stage: StageName;
  stalledStages: StageName[];
  flushedStages: StageName[];
}

export interface ForwardingEvent {
  id: string;
  cycle: number;
  fromStage: 'EX/MEM' | 'MEM/WB';
  toStage: 'ID/EX' | 'EX' | 'EX/MEM' | 'MEM';
  operand: 'rs' | 'rt' | 'sw_data';
  registerIndex: number;
  value: number;
  description: string;
}

export interface SimulationConfig {
  forwardingEnabled: boolean;
  branchPredictTaken: boolean; // default: false (predict not-taken)
  memorySize: number; // default 4096 bytes
  maxCycles: number; // default 1000
}

export interface CycleTimelineEntry {
  cycle: number;
  instructionId: number;
  stage: StageName | 'STALL' | 'FLUSH' | 'BUBBLE';
  status: 'active' | 'stalled' | 'flushed' | 'bubble';
}

export interface SimulationMetrics {
  totalCycles: number;
  instructionsCompleted: number;
  cpi: number;
  ipc: number;
  idealCycles: number;
  dataHazardsCount: number;
  loadUseHazardsCount: number;
  controlHazardsCount: number;
  stallsCount: number;
  flushesCount: number;
  forwardingEventsCount: number;
  pipelineUtilization: number; // 0-100%
  speedupVsSingleCycle: number;
  speedupVsMultiCycle: number;
}

export interface ExecutionEventLog {
  id: string;
  cycle: number;
  category: 'fetch' | 'decode' | 'execute' | 'memory' | 'writeback' | 'hazard' | 'forwarding' | 'branch' | 'complete';
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
}

export interface SimulationState {
  id: string;
  cycle: number;
  pc: number;
  isHalted: boolean;
  isStalled: boolean;
  config: SimulationConfig;
  program: ParsedInstruction[];
  registers: number[]; // 32 registers
  registerModifiedCycles: Record<number, number>; // reg -> cycle last modified
  memory: Record<number, number>; // word address -> 32-bit int
  memoryModifiedCycles: Record<number, number>; // addr -> cycle last modified
  stages: {
    IF: PipelineStageState;
    ID: PipelineStageState;
    EX: PipelineStageState;
    MEM: PipelineStageState;
    WB: PipelineStageState;
  };
  pipelineRegisters: PipelineRegisters;
  timeline: Record<number, Record<number, string>>; // instructionId -> { cycle -> stageStr }
  activeHazards: HazardEvent[];
  activeForwardings: ForwardingEvent[];
  events: ExecutionEventLog[];
  metrics: SimulationMetrics;
}
