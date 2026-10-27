import {
  CycleTimelineEntry,
  ExecutionEventLog,
  ForwardingEvent,
  HazardEvent,
  ParsedInstruction,
  PipelineRegisters,
  PipelineStageState,
  SimulationConfig,
  SimulationMetrics,
  SimulationState,
  StageName,
} from './types';

export class PipelineSimulator {
  private id: string;
  private config: SimulationConfig;
  private program: ParsedInstruction[];
  private registers: number[] = new Array(32).fill(0);
  private registerModifiedCycles: Record<number, number> = {};
  private memory: Record<number, number> = {};
  private memoryModifiedCycles: Record<number, number> = {};

  private pc: number = 0;
  private cycle: number = 0;
  private isHalted: boolean = false;
  private isStalled: boolean = false;

  private stages: {
    IF: PipelineStageState;
    ID: PipelineStageState;
    EX: PipelineStageState;
    MEM: PipelineStageState;
    WB: PipelineStageState;
  };

  private pipelineRegisters: PipelineRegisters;

  // Space-time timeline: instructionId -> { cycle -> stageStr }
  private timeline: Record<number, Record<number, string>> = {};

  // Metrics tracking
  private completedInstructionsCount: number = 0;
  private dataHazardsCount: number = 0;
  private loadUseHazardsCount: number = 0;
  private controlHazardsCount: number = 0;
  private stallsCount: number = 0;
  private flushesCount: number = 0;
  private forwardingEventsCount: number = 0;
  private busyStageCycles: number = 0;

  private activeHazards: HazardEvent[] = [];
  private activeForwardings: ForwardingEvent[] = [];
  private eventLogs: ExecutionEventLog[] = [];

  constructor(
    program: ParsedInstruction[],
    config: Partial<SimulationConfig> = {},
    initialMemory: Record<number, number> = {},
    id: string = 'sim_default'
  ) {
    this.id = id;
    this.program = program;
    this.config = {
      forwardingEnabled: config.forwardingEnabled ?? true,
      branchPredictTaken: config.branchPredictTaken ?? false,
      memorySize: config.memorySize ?? 4096,
      maxCycles: config.maxCycles ?? 1000,
    };

    // Initialize initial memory
    for (const [addr, val] of Object.entries(initialMemory)) {
      this.memory[Number(addr)] = val | 0;
    }

    this.stages = {
      IF: { stage: 'IF', instruction: null, status: 'empty', cycleEntered: 0 },
      ID: { stage: 'ID', instruction: null, status: 'empty', cycleEntered: 0 },
      EX: { stage: 'EX', instruction: null, status: 'empty', cycleEntered: 0 },
      MEM: { stage: 'MEM', instruction: null, status: 'empty', cycleEntered: 0 },
      WB: { stage: 'WB', instruction: null, status: 'empty', cycleEntered: 0 },
    };

    this.pipelineRegisters = this.createEmptyPipelineRegisters();
  }

  private createEmptyPipelineRegisters(): PipelineRegisters {
    return {
      IF_ID: {
        instruction: null,
        pc: 0,
        pcNext: 0,
        valid: false,
      },
      ID_EX: {
        instruction: null,
        pc: 0,
        rs: 0,
        rt: 0,
        rd: 0,
        valRs: 0,
        valRt: 0,
        immediate: 0,
        regWrite: false,
        memRead: false,
        memWrite: false,
        branch: false,
        aluSrc: false,
        memToReg: false,
        valid: false,
      },
      EX_MEM: {
        instruction: null,
        pc: 0,
        aluResult: 0,
        valRt: 0,
        destReg: 0,
        regWrite: false,
        memRead: false,
        memWrite: false,
        valid: false,
      },
      MEM_WB: {
        instruction: null,
        pc: 0,
        aluResult: 0,
        memData: 0,
        destReg: 0,
        regWrite: false,
        memToReg: false,
        valid: false,
      },
    };
  }

  public reset(): void {
    this.registers = new Array(32).fill(0);
    this.registerModifiedCycles = {};
    this.memory = {};
    this.memoryModifiedCycles = {};
    this.pc = 0;
    this.cycle = 0;
    this.isHalted = false;
    this.isStalled = false;
    this.completedInstructionsCount = 0;
    this.dataHazardsCount = 0;
    this.loadUseHazardsCount = 0;
    this.controlHazardsCount = 0;
    this.stallsCount = 0;
    this.flushesCount = 0;
    this.forwardingEventsCount = 0;
    this.busyStageCycles = 0;
    this.timeline = {};
    this.activeHazards = [];
    this.activeForwardings = [];
    this.eventLogs = [];
    this.stages = {
      IF: { stage: 'IF', instruction: null, status: 'empty', cycleEntered: 0 },
      ID: { stage: 'ID', instruction: null, status: 'empty', cycleEntered: 0 },
      EX: { stage: 'EX', instruction: null, status: 'empty', cycleEntered: 0 },
      MEM: { stage: 'MEM', instruction: null, status: 'empty', cycleEntered: 0 },
      WB: { stage: 'WB', instruction: null, status: 'empty', cycleEntered: 0 },
    };
    this.pipelineRegisters = this.createEmptyPipelineRegisters();
  }

  public setConfig(newConfig: Partial<SimulationConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
  }

  private getInstructionAtPc(targetPc: number): ParsedInstruction | null {
    const inst = this.program.find((p) => p.pc === targetPc);
    return inst || null;
  }

  private recordTimeline(instructionId: number, stageName: string): void {
    if (!this.timeline[instructionId]) {
      this.timeline[instructionId] = {};
    }
    this.timeline[instructionId][this.cycle] = stageName;
  }

  private addLog(
    category: ExecutionEventLog['category'],
    message: string,
    severity: ExecutionEventLog['severity'] = 'info'
  ): void {
    this.eventLogs.unshift({
      id: `evt_${this.cycle}_${Math.random().toString(36).substring(2, 7)}`,
      cycle: this.cycle,
      category,
      message,
      severity,
    });
    // Cap event logs to 100 entries to prevent memory leaks
    if (this.eventLogs.length > 100) {
      this.eventLogs.pop();
    }
  }

  /**
   * Advances the pipeline simulation by exactly one clock cycle.
   */
  public step(): SimulationState {
    if (this.isHalted) {
      return this.getState();
    }

    this.cycle += 1;
    this.activeHazards = [];
    this.activeForwardings = [];

    // Next cycle's pipeline register latches
    const nextPipelineRegisters = this.createEmptyPipelineRegisters();

    // Track stage occupancies for this cycle
    let ifInst: ParsedInstruction | null = null;
    let idInst: ParsedInstruction | null = null;
    let exInst: ParsedInstruction | null = null;
    let memInst: ParsedInstruction | null = null;
    let wbInst: ParsedInstruction | null = null;

    let stallIf = false;
    let stallId = false;
    let flushIf = false;
    let flushId = false;
    let branchRedirectPc: number | null = null;

    // ==========================================
    // 1. WB Stage (Write Back)
    // ==========================================
    const memWb = this.pipelineRegisters.MEM_WB;
    if (memWb.valid && memWb.instruction) {
      wbInst = memWb.instruction;
      this.busyStageCycles++;

      if (memWb.regWrite && memWb.destReg !== 0) {
        const writeVal = memWb.memToReg ? memWb.memData : memWb.aluResult;
        this.registers[memWb.destReg] = writeVal;
        this.registerModifiedCycles[memWb.destReg] = this.cycle;

        this.addLog(
          'writeback',
          `Cycle ${this.cycle}: WB wrote ${writeVal} (0x${(writeVal >>> 0).toString(16)}) to R${memWb.destReg} [${wbInst.raw}]`,
          'success'
        );
      }

      this.completedInstructionsCount++;
      this.recordTimeline(wbInst.id, 'WB');
      this.stages.WB = {
        stage: 'WB',
        instruction: wbInst,
        status: 'active',
        cycleEntered: this.cycle,
        details: {
          destReg: memWb.destReg,
          writtenValue: memWb.memToReg ? memWb.memData : memWb.aluResult,
        },
      };
    } else {
      this.stages.WB = { stage: 'WB', instruction: null, status: 'empty', cycleEntered: this.cycle };
    }

    // ==========================================
    // 2. MEM Stage (Memory Access)
    // ==========================================
    const exMem = this.pipelineRegisters.EX_MEM;
    if (exMem.valid && exMem.instruction) {
      memInst = exMem.instruction;
      this.busyStageCycles++;

      let memReadData = 0;
      const addr = exMem.aluResult;

      // Handle memory write (SW)
      if (exMem.memWrite) {
        // Forwarding to SW memory data from WB stage if applicable
        let storeData = exMem.valRt;
        if (
          this.config.forwardingEnabled &&
          memWb.valid &&
          memWb.regWrite &&
          memWb.destReg !== 0 &&
          memWb.destReg === (memInst.rt ?? -1)
        ) {
          storeData = memWb.memToReg ? memWb.memData : memWb.aluResult;
          this.forwardingEventsCount++;
          this.activeForwardings.push({
            id: `fwd_${this.cycle}_mem`,
            cycle: this.cycle,
            fromStage: 'MEM/WB',
            toStage: 'EX/MEM',
            operand: 'sw_data',
            registerIndex: memWb.destReg,
            value: storeData,
            description: `Forwarded R${memWb.destReg} (${storeData}) from MEM/WB to MEM for SW`,
          });
        }

        // Align address to 4-byte word boundary
        const alignedAddr = addr & ~3;
        this.memory[alignedAddr] = storeData;
        this.memoryModifiedCycles[alignedAddr] = this.cycle;

        this.addLog(
          'memory',
          `Cycle ${this.cycle}: SW wrote value ${storeData} to Mem[0x${alignedAddr.toString(16)}] [${memInst.raw}]`,
          'info'
        );
      }

      // Handle memory read (LW)
      if (exMem.memRead) {
        const alignedAddr = addr & ~3;
        memReadData = this.memory[alignedAddr] ?? 0;
        this.addLog(
          'memory',
          `Cycle ${this.cycle}: LW read value ${memReadData} from Mem[0x${alignedAddr.toString(16)}] [${memInst.raw}]`,
          'info'
        );
      }

      // Populate next MEM_WB register
      nextPipelineRegisters.MEM_WB = {
        instruction: memInst,
        pc: exMem.pc,
        aluResult: exMem.aluResult,
        memData: memReadData,
        destReg: exMem.destReg,
        regWrite: exMem.regWrite,
        memToReg: exMem.memRead,
        valid: true,
      };

      this.recordTimeline(memInst.id, 'MEM');
      this.stages.MEM = {
        stage: 'MEM',
        instruction: memInst,
        status: 'active',
        cycleEntered: this.cycle,
        details: {
          address: addr,
          memRead: exMem.memRead,
          memWrite: exMem.memWrite,
          readData: memReadData,
        },
      };
    } else {
      nextPipelineRegisters.MEM_WB = {
        instruction: null,
        pc: 0,
        aluResult: 0,
        memData: 0,
        destReg: 0,
        regWrite: false,
        memToReg: false,
        valid: false,
      };
      this.stages.MEM = { stage: 'MEM', instruction: null, status: 'empty', cycleEntered: this.cycle };
    }

    // ==========================================
    // 3. EX Stage (Execute / ALU / Branch)
    // ==========================================
    const idEx = this.pipelineRegisters.ID_EX;
    if (idEx.valid && idEx.instruction) {
      exInst = idEx.instruction;
      this.busyStageCycles++;

      // Forwarding determination for ALU Operand 1 (Rs)
      let aluIn1 = idEx.valRs;
      if (this.config.forwardingEnabled) {
        if (
          exMem.valid &&
          exMem.regWrite &&
          exMem.destReg !== 0 &&
          exMem.destReg === idEx.rs
        ) {
          // EX hazard: forward from EX/MEM
          aluIn1 = exMem.aluResult;
          this.forwardingEventsCount++;
          this.activeForwardings.push({
            id: `fwd_${this.cycle}_rs_ex`,
            cycle: this.cycle,
            fromStage: 'EX/MEM',
            toStage: 'EX',
            operand: 'rs',
            registerIndex: idEx.rs,
            value: aluIn1,
            description: `Forwarded R${idEx.rs} (${aluIn1}) from EX/MEM to EX (ALU In 1)`,
          });
        } else if (
          memWb.valid &&
          memWb.regWrite &&
          memWb.destReg !== 0 &&
          memWb.destReg === idEx.rs
        ) {
          // MEM hazard: forward from MEM/WB
          aluIn1 = memWb.memToReg ? memWb.memData : memWb.aluResult;
          this.forwardingEventsCount++;
          this.activeForwardings.push({
            id: `fwd_${this.cycle}_rs_mem`,
            cycle: this.cycle,
            fromStage: 'MEM/WB',
            toStage: 'EX',
            operand: 'rs',
            registerIndex: idEx.rs,
            value: aluIn1,
            description: `Forwarded R${idEx.rs} (${aluIn1}) from MEM/WB to EX (ALU In 1)`,
          });
        }
      }

      // Forwarding determination for ALU Operand 2 (Rt)
      let forwardedRt = idEx.valRt;
      if (this.config.forwardingEnabled) {
        if (
          exMem.valid &&
          exMem.regWrite &&
          exMem.destReg !== 0 &&
          exMem.destReg === idEx.rt
        ) {
          forwardedRt = exMem.aluResult;
          if (!idEx.aluSrc || idEx.memWrite) {
            this.forwardingEventsCount++;
            this.activeForwardings.push({
              id: `fwd_${this.cycle}_rt_ex`,
              cycle: this.cycle,
              fromStage: 'EX/MEM',
              toStage: 'EX',
              operand: 'rt',
              registerIndex: idEx.rt,
              value: forwardedRt,
              description: `Forwarded R${idEx.rt} (${forwardedRt}) from EX/MEM to EX`,
            });
          }
        } else if (
          memWb.valid &&
          memWb.regWrite &&
          memWb.destReg !== 0 &&
          memWb.destReg === idEx.rt
        ) {
          forwardedRt = memWb.memToReg ? memWb.memData : memWb.aluResult;
          if (!idEx.aluSrc || idEx.memWrite) {
            this.forwardingEventsCount++;
            this.activeForwardings.push({
              id: `fwd_${this.cycle}_rt_mem`,
              cycle: this.cycle,
              fromStage: 'MEM/WB',
              toStage: 'EX',
              operand: 'rt',
              registerIndex: idEx.rt,
              value: forwardedRt,
              description: `Forwarded R${idEx.rt} (${forwardedRt}) from MEM/WB to EX`,
            });
          }
        }
      }

      const aluIn2 = idEx.aluSrc ? idEx.immediate : forwardedRt;
      let aluResult = 0;

      switch (exInst.opcode) {
        case 'ADD':
        case 'ADDI':
          aluResult = (aluIn1 + aluIn2) | 0;
          break;
        case 'SUB':
          aluResult = (aluIn1 - aluIn2) | 0;
          break;
        case 'AND':
          aluResult = aluIn1 & aluIn2;
          break;
        case 'OR':
          aluResult = aluIn1 | aluIn2;
          break;
        case 'XOR':
          aluResult = aluIn1 ^ aluIn2;
          break;
        case 'LW':
        case 'SW':
          // Address calculation: Base register + Immediate offset
          aluResult = (aluIn1 + idEx.immediate) | 0;
          break;
        case 'BEQ':
        case 'BNE':
          aluResult = (aluIn1 - aluIn2) | 0;
          break;
        case 'NOP':
          aluResult = 0;
          break;
      }

      // Branch evaluation in EX
      if (idEx.branch) {
        let branchTaken = false;
        if (exInst.opcode === 'BEQ') {
          branchTaken = (aluIn1 === aluIn2);
        } else if (exInst.opcode === 'BNE') {
          branchTaken = (aluIn1 !== aluIn2);
        }

        const target = exInst.targetPc ?? (idEx.pc + 4);

        if (branchTaken) {
          this.controlHazardsCount++;
          this.flushesCount += 2; // Flush IF and ID stages
          flushIf = true;
          flushId = true;
          branchRedirectPc = target;

          const hazardEvt: HazardEvent = {
            id: `hzd_${this.cycle}_branch`,
            cycle: this.cycle,
            type: 'BRANCH_TAKEN',
            description: `Branch [${exInst.raw}] taken to PC 0x${target.toString(16)}. Flushing IF and ID stages (2-cycle branch penalty).`,
            sourceInstructionId: exInst.id,
            stage: 'EX',
            stalledStages: [],
            flushedStages: ['IF', 'ID'],
          };
          this.activeHazards.push(hazardEvt);

          this.addLog(
            'branch',
            `Cycle ${this.cycle}: Branch taken -> redirecting PC to 0x${target.toString(16)} (Flushing IF & ID)`,
            'warning'
          );
        } else {
          this.addLog(
            'branch',
            `Cycle ${this.cycle}: Branch [${exInst.raw}] NOT taken. Predicted path correct.`,
            'info'
          );
        }
      }

      // Populate next EX_MEM register
      nextPipelineRegisters.EX_MEM = {
        instruction: exInst,
        pc: idEx.pc,
        aluResult,
        valRt: forwardedRt, // for SW
        destReg: idEx.rd,
        regWrite: idEx.regWrite,
        memRead: idEx.memRead,
        memWrite: idEx.memWrite,
        valid: true,
      };

      this.recordTimeline(exInst.id, 'EX');
      this.stages.EX = {
        stage: 'EX',
        instruction: exInst,
        status: 'active',
        cycleEntered: this.cycle,
        details: {
          aluIn1,
          aluIn2,
          aluResult,
          destReg: idEx.rd,
        },
      };
    } else {
      nextPipelineRegisters.EX_MEM = {
        instruction: null,
        pc: 0,
        aluResult: 0,
        valRt: 0,
        destReg: 0,
        regWrite: false,
        memRead: false,
        memWrite: false,
        valid: false,
      };
      this.stages.EX = { stage: 'EX', instruction: null, status: 'empty', cycleEntered: this.cycle };
    }

    // ==========================================
    // 4. ID Stage (Instruction Decode / Hazard Check)
    // ==========================================
    const ifId = this.pipelineRegisters.IF_ID;
    if (ifId.valid && ifId.instruction) {
      idInst = ifId.instruction;
      this.busyStageCycles++;

      // Check for Hazards:
      // A. Load-Use Data Hazard
      // If instruction in EX is LW, and its destination register is used by instruction in ID
      const exIsLoad = idEx.valid && idEx.memRead && idEx.rd !== 0;
      const idUsesRs = idInst.rs !== undefined && idInst.rs !== 0;
      const idUsesRt =
        idInst.rt !== undefined &&
        idInst.rt !== 0 &&
        idInst.opcode !== 'ADDI' &&
        idInst.opcode !== 'LW'; // SW uses Rt for store data, but in standard pipeline still load-use if immediately after LW

      let isLoadUse = false;
      if (exIsLoad) {
        if (idUsesRs && idEx.rd === idInst.rs) isLoadUse = true;
        if (idUsesRt && idEx.rd === idInst.rt) isLoadUse = true;
      }

      // B. RAW Data Hazard when Forwarding is DISABLED
      let isRawHazardNoForwarding = false;
      if (!this.config.forwardingEnabled) {
        // Check EX stage dependency
        if (idEx.valid && idEx.regWrite && idEx.rd !== 0) {
          if (idUsesRs && idEx.rd === idInst.rs) isRawHazardNoForwarding = true;
          if (idUsesRt && idEx.rd === idInst.rt) isRawHazardNoForwarding = true;
        }
        // Check MEM stage dependency
        if (exMem.valid && exMem.regWrite && exMem.destReg !== 0) {
          if (idUsesRs && exMem.destReg === idInst.rs) isRawHazardNoForwarding = true;
          if (idUsesRt && exMem.destReg === idInst.rt) isRawHazardNoForwarding = true;
        }
      }

      if (isLoadUse) {
        this.loadUseHazardsCount++;
        this.stallsCount++;
        stallIf = true;
        stallId = true;

        const hazardEvt: HazardEvent = {
          id: `hzd_${this.cycle}_load_use`,
          cycle: this.cycle,
          type: 'LOAD_USE',
          description: `Load-Use hazard: [${idInst.raw}] depends on LW in EX stage (R${idEx.rd}). Stalling IF & ID, inserting bubble in EX.`,
          sourceInstructionId: idEx.instruction?.id,
          dependentInstructionId: idInst.id,
          stage: 'ID',
          stalledStages: ['IF', 'ID'],
          flushedStages: [],
        };
        this.activeHazards.push(hazardEvt);

        this.addLog(
          'hazard',
          `Cycle ${this.cycle}: Load-Use Hazard on R${idEx.rd} -> Pipeline Stalled (Bubble injected)`,
          'warning'
        );
      } else if (isRawHazardNoForwarding) {
        this.dataHazardsCount++;
        this.stallsCount++;
        stallIf = true;
        stallId = true;

        const hazardEvt: HazardEvent = {
          id: `hzd_${this.cycle}_raw_no_fwd`,
          cycle: this.cycle,
          type: 'RAW',
          description: `RAW Data Hazard (Forwarding Disabled): [${idInst.raw}] must wait for result to reach WB. Stalling.`,
          dependentInstructionId: idInst.id,
          stage: 'ID',
          stalledStages: ['IF', 'ID'],
          flushedStages: [],
        };
        this.activeHazards.push(hazardEvt);

        this.addLog(
          'hazard',
          `Cycle ${this.cycle}: RAW Hazard (Forwarding OFF) -> Pipeline Stalled`,
          'warning'
        );
      }

      if (!stallId && !flushId) {
        // Read register file
        // Internal register file forwarding (WB in 1st half of cycle, ID reads in 2nd half):
        let valRs = this.registers[idInst.rs ?? 0];
        let valRt = this.registers[idInst.rt ?? 0];

        if (memWb.valid && memWb.regWrite && memWb.destReg !== 0) {
          const wbVal = memWb.memToReg ? memWb.memData : memWb.aluResult;
          if (idInst.rs === memWb.destReg) valRs = wbVal;
          if (idInst.rt === memWb.destReg) valRt = wbVal;
        }

        // Generate control signals
        const opcode = idInst.opcode;
        const isRType = ['ADD', 'SUB', 'AND', 'OR', 'XOR'].includes(opcode);
        const isBranch = ['BEQ', 'BNE'].includes(opcode);
        const isLoad = opcode === 'LW';
        const isStore = opcode === 'SW';
        const isAddi = opcode === 'ADDI';

        const regWrite = isRType || isAddi || isLoad;
        const memRead = isLoad;
        const memWrite = isStore;
        const aluSrc = isAddi || isLoad || isStore;
        const memToReg = isLoad;
        const destReg = isRType ? (idInst.rd ?? 0) : (idInst.rt ?? 0);

        nextPipelineRegisters.ID_EX = {
          instruction: idInst,
          pc: ifId.pc,
          rs: idInst.rs ?? 0,
          rt: idInst.rt ?? 0,
          rd: destReg,
          valRs,
          valRt,
          immediate: idInst.immediate ?? 0,
          regWrite,
          memRead,
          memWrite,
          branch: isBranch,
          aluSrc,
          memToReg,
          valid: true,
        };

        this.recordTimeline(idInst.id, 'ID');
        this.stages.ID = {
          stage: 'ID',
          instruction: idInst,
          status: 'active',
          cycleEntered: this.cycle,
          details: {
            rs: idInst.rs,
            rt: idInst.rt,
            valRs,
            valRt,
            destReg,
          },
        };
      } else if (flushId) {
        // Instruction in ID is flushed by branch
        this.recordTimeline(idInst.id, 'FLUSH');
        this.stages.ID = {
          stage: 'ID',
          instruction: idInst,
          status: 'flushed',
          cycleEntered: this.cycle,
        };
        // Inject bubble into ID/EX
        nextPipelineRegisters.ID_EX = {
          instruction: null,
          pc: 0,
          rs: 0,
          rt: 0,
          rd: 0,
          valRs: 0,
          valRt: 0,
          immediate: 0,
          regWrite: false,
          memRead: false,
          memWrite: false,
          branch: false,
          aluSrc: false,
          memToReg: false,
          valid: false,
        };
      } else if (stallId) {
        // Stalled: Keep current instruction in ID, inject bubble into ID/EX
        this.recordTimeline(idInst.id, 'STALL');
        this.stages.ID = {
          stage: 'ID',
          instruction: idInst,
          status: 'stalled',
          cycleEntered: this.cycle,
        };
        nextPipelineRegisters.ID_EX = {
          instruction: null,
          pc: 0,
          rs: 0,
          rt: 0,
          rd: 0,
          valRs: 0,
          valRt: 0,
          immediate: 0,
          regWrite: false,
          memRead: false,
          memWrite: false,
          branch: false,
          aluSrc: false,
          memToReg: false,
          valid: false,
        };
        // Preserve current IF/ID register
        nextPipelineRegisters.IF_ID = { ...ifId };
      }
    } else {
      nextPipelineRegisters.ID_EX = {
        instruction: null,
        pc: 0,
        rs: 0,
        rt: 0,
        rd: 0,
        valRs: 0,
        valRt: 0,
        immediate: 0,
        regWrite: false,
        memRead: false,
        memWrite: false,
        branch: false,
        aluSrc: false,
        memToReg: false,
        valid: false,
      };
      this.stages.ID = { stage: 'ID', instruction: null, status: 'empty', cycleEntered: this.cycle };
    }

    // ==========================================
    // 5. IF Stage (Instruction Fetch)
    // ==========================================
    if (branchRedirectPc !== null) {
      // Branch redirection overrides PC
      this.pc = branchRedirectPc;
      nextPipelineRegisters.IF_ID = {
        instruction: null,
        pc: 0,
        pcNext: 0,
        valid: false,
      };
      this.stages.IF = { stage: 'IF', instruction: null, status: 'flushed', cycleEntered: this.cycle };
    } else if (stallIf) {
      // IF is stalled: PC is not updated, IF_ID keeps current value (already assigned in ID stall logic)
      if (this.stages.IF.instruction) {
        this.recordTimeline(this.stages.IF.instruction.id, 'STALL');
        this.stages.IF.status = 'stalled';
      }
    } else {
      // Normal fetch
      const fetchedInst = this.getInstructionAtPc(this.pc);
      if (fetchedInst) {
        ifInst = fetchedInst;
        this.busyStageCycles++;
        const pcNext = this.pc + 4;

        nextPipelineRegisters.IF_ID = {
          instruction: fetchedInst,
          pc: this.pc,
          pcNext,
          valid: true,
        };

        this.recordTimeline(fetchedInst.id, 'IF');
        this.stages.IF = {
          stage: 'IF',
          instruction: fetchedInst,
          status: 'active',
          cycleEntered: this.cycle,
          details: { pc: this.pc },
        };

        this.pc = pcNext;
      } else {
        // End of program instruction stream reached
        nextPipelineRegisters.IF_ID = {
          instruction: null,
          pc: this.pc,
          pcNext: this.pc + 4,
          valid: false,
        };
        this.stages.IF = { stage: 'IF', instruction: null, status: 'empty', cycleEntered: this.cycle };
      }
    }

    // Update pipeline registers atomically
    this.pipelineRegisters = nextPipelineRegisters;
    this.isStalled = stallIf || stallId;

    // Check if whole pipeline is drained (all stages empty or invalid)
    const pipelineDrained =
      !this.pipelineRegisters.IF_ID.valid &&
      !this.pipelineRegisters.ID_EX.valid &&
      !this.pipelineRegisters.EX_MEM.valid &&
      !this.pipelineRegisters.MEM_WB.valid &&
      !this.stages.IF.instruction &&
      this.getInstructionAtPc(this.pc) === null;

    if (pipelineDrained && this.cycle > 0) {
      this.isHalted = true;
      this.addLog('complete', `Execution finished. Total cycles: ${this.cycle}.`, 'success');
    }

    if (this.cycle >= this.config.maxCycles) {
      this.isHalted = true;
      this.addLog('complete', `Execution reached maximum cycle limit (${this.config.maxCycles}).`, 'warning');
    }

    return this.getState();
  }

  /**
   * Run simulation up to cycleLimit or until pipeline drains.
   */
  public run(cycleLimit: number = 200): SimulationState {
    let steps = 0;
    while (!this.isHalted && steps < cycleLimit && this.cycle < this.config.maxCycles) {
      this.step();
      steps++;
    }
    return this.getState();
  }

  public getMetrics(): SimulationMetrics {
    const totalCycles = this.cycle;
    const completed = this.completedInstructionsCount;
    const cpi = completed > 0 ? Number((totalCycles / completed).toFixed(3)) : 0;
    const ipc = totalCycles > 0 ? Number((completed / totalCycles).toFixed(3)) : 0;
    const idealCycles = completed > 0 ? completed + 4 : 0;
    const maxStageCycles = totalCycles * 5;
    const pipelineUtilization =
      maxStageCycles > 0
        ? Number(((this.busyStageCycles / maxStageCycles) * 100).toFixed(1))
        : 0;

    // Baseline comparisons:
    // Single cycle CPU: CPI = 1, but clock period is ~5x longer.
    // Multi cycle CPU: CPI = ~4.0-4.5
    const speedupVsSingleCycle = cpi > 0 ? Number((5.0 / cpi).toFixed(2)) : 1.0;
    const speedupVsMultiCycle = cpi > 0 ? Number((4.2 / cpi).toFixed(2)) : 1.0;

    return {
      totalCycles,
      instructionsCompleted: completed,
      cpi,
      ipc,
      idealCycles,
      dataHazardsCount: this.dataHazardsCount,
      loadUseHazardsCount: this.loadUseHazardsCount,
      controlHazardsCount: this.controlHazardsCount,
      stallsCount: this.stallsCount,
      flushesCount: this.flushesCount,
      forwardingEventsCount: this.forwardingEventsCount,
      pipelineUtilization,
      speedupVsSingleCycle,
      speedupVsMultiCycle,
    };
  }

  public getState(): SimulationState {
    return {
      id: this.id,
      cycle: this.cycle,
      pc: this.pc,
      isHalted: this.isHalted,
      isStalled: this.isStalled,
      config: { ...this.config },
      program: this.program,
      registers: [...this.registers],
      registerModifiedCycles: { ...this.registerModifiedCycles },
      memory: { ...this.memory },
      memoryModifiedCycles: { ...this.memoryModifiedCycles },
      stages: { ...this.stages },
      pipelineRegisters: JSON.parse(JSON.stringify(this.pipelineRegisters)),
      timeline: JSON.parse(JSON.stringify(this.timeline)),
      activeHazards: [...this.activeHazards],
      activeForwardings: [...this.activeForwardings],
      events: [...this.eventLogs],
      metrics: this.getMetrics(),
    };
  }
}
