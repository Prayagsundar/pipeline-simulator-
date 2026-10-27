export interface ExampleProgram {
  id: string;
  name: string;
  category: 'Arithmetic' | 'Hazards & Forwarding' | 'Memory' | 'Control Flow' | 'Comprehensive';
  description: string;
  expectedObservations: string[];
  code: string;
  initialMemory?: Record<number, number>;
}

export const EXAMPLE_PROGRAMS: ExampleProgram[] = [
  {
    id: 'basic_arithmetic',
    name: '1. Basic Arithmetic (Independent)',
    category: 'Arithmetic',
    description: 'A series of independent arithmetic and logical instructions with no data dependencies.',
    expectedObservations: [
      'Each instruction progresses through IF -> ID -> EX -> MEM -> WB without any stalls or bubbles.',
      'CPI is close to 1.0 after the initial 4-cycle pipeline fill phase.',
      'Registers R1, R2, R3, R4 receive updated values upon reaching the WB stage.',
      'Ideal cycles equals actual cycles (5 instructions complete in 9 cycles with 0 stalls).',
    ],
    code: `# Basic Arithmetic & Logic (No Hazards)
ADDI R1, R0, 10      # R1 = 10
ADDI R2, R0, 20      # R2 = 20
ADD  R3, R0, R0      # R3 = 0
ADDI R4, R0, 5       # R4 = 5
OR   R5, R1, R2      # R5 = 10 | 20
`,
  },
  {
    id: 'data_hazard_forwarding',
    name: '2. RAW Data Dependency & Forwarding',
    category: 'Hazards & Forwarding',
    description: 'Demonstrates Read-After-Write (RAW) data dependencies where subsequent instructions consume the result of prior instructions.',
    expectedObservations: [
      'With Forwarding ENABLED: Zero stalls! The ALU result from R1 is bypassed directly from EX/MEM to EX stage for R2, and from MEM/WB to EX for R3.',
      'Watch the green Forwarding arcs light up in the 3D pipeline view when EX stage executes.',
      'Try toggling "Forwarding: OFF" in the top bar to observe pipeline stalls and bubbles inserted to resolve the hazards.',
    ],
    code: `# RAW Data Hazard & Forwarding Demo
ADDI R1, R0, 15      # R1 = 15
ADD  R2, R1, R1      # R2 = R1 + R1 = 30 (Forwarding from EX/MEM -> EX)
SUB  R3, R2, R1      # R3 = R2 - R1 = 15 (Forwarding from EX/MEM -> EX)
AND  R4, R3, R2      # R4 = R3 & R2
`,
  },
  {
    id: 'load_use_hazard',
    name: '3. Load-Use Hazard (Unavoidable Stall)',
    category: 'Hazards & Forwarding',
    description: 'Demonstrates a Load-Use data hazard where an instruction immediately reads the register loaded by LW.',
    expectedObservations: [
      'Memory read data from LW is not available until the end of the MEM stage.',
      'Even with forwarding hardware active, the processor must stall for 1 clock cycle.',
      'Observe the amber STALL indicator in ID and IF stages, and a NOP bubble injected into the EX stage.',
      'After the 1-cycle bubble, data is forwarded directly from MEM/WB to EX.',
    ],
    initialMemory: {
      0: 42,
      4: 100,
      8: 255,
    },
    code: `# Load-Use Data Hazard
# Memory address 0 contains initial value 42
ADDI R1, R0, 0       # R1 = 0 (base address)
LW   R2, 0(R1)       # R2 = Mem[0] = 42
ADD  R3, R2, R1      # R3 = R2 + R1 (Load-Use Hazard! Stalls 1 cycle)
ADDI R4, R3, 10      # R4 = R3 + 10 = 52
`,
  },
  {
    id: 'branch_taken_flush',
    name: '4. Branch Taken & 2-Cycle Flush',
    category: 'Control Flow',
    description: 'Demonstrates branch resolution in the EX stage and pipeline flushing when a branch is taken.',
    expectedObservations: [
      'The processor predicts branches as NOT-TAKEN and fetches instructions sequentially.',
      'When BEQ evaluates in the EX stage and evaluates to TRUE (taken):',
      'The 2 instructions fetched speculatively into IF and ID are immediately FLUSHED.',
      'Observe the red FLUSH markers in the cycle timeline.',
      'PC redirects to the branch target label, and execution resumes on the correct path.',
    ],
    code: `# Branch Taken & Pipeline Flush
ADDI R1, R0, 5       # R1 = 5
ADDI R2, R0, 5       # R2 = 5
BEQ  R1, R2, target  # Branch Taken (R1 == R2)!
ADDI R3, R0, 999     # Flushed! (Speculatively fetched, never writes R3)
ADDI R4, R0, 888     # Flushed! (Speculatively fetched, never writes R4)
target:
ADDI R5, R0, 100     # Target reached: R5 = 100
ADD  R6, R5, R1      # R6 = 100 + 5 = 105
`,
  },
  {
    id: 'memory_store_reload',
    name: '5. Memory Store & Reload (Array Processing)',
    category: 'Memory',
    description: 'Performs arithmetic, stores the computed result into Data RAM, and reloads it back to verify persistence.',
    expectedObservations: [
      'In MEM stage of SW, Data Memory at address 0x0008 is updated with R3 value.',
      'Check the Data Memory Inspector panel to observe the cell value update in real time.',
      'LW reloads from the exact memory cell into R4.',
      'Forwarding handles both address calculations and store data correctly.',
    ],
    initialMemory: {
      0: 10,
      4: 20,
    },
    code: `# Store and Reload
LW   R1, 0(R0)       # R1 = Mem[0] = 10
LW   R2, 4(R0)       # R2 = Mem[4] = 20
ADD  R3, R1, R2      # R3 = 10 + 20 = 30
SW   R3, 8(R0)       # Mem[8] = R3 = 30
LW   R4, 8(R0)       # R4 = Mem[8] = 30
ADDI R5, R4, 1       # R5 = 31
`,
  },
  {
    id: 'loop_accumulator',
    name: '6. Loop Accumulator (Sum 1 to 4)',
    category: 'Comprehensive',
    description: 'A loop that counts down from 4 to 0, accumulating the sum in R2. Demonstrates repeated branch iterations, loop hazard handling, and final termination.',
    expectedObservations: [
      'R1 acts as loop counter, R2 acts as sum accumulator.',
      'Each loop iteration evaluates BNE: Taken for iterations 4, 3, 2, 1, and Not-Taken on 0.',
      'Watch register R2 accumulate: 4 -> 7 -> 9 -> 10.',
      'Shows how dynamic branch prediction penalty impacts total CPI over multiple loop cycles.',
    ],
    code: `# Loop Accumulator: Sum(4, 3, 2, 1) = 10
ADDI R1, R0, 4       # R1 = counter = 4
ADDI R2, R0, 0       # R2 = sum = 0
loop:
ADD  R2, R2, R1      # sum += counter
ADDI R1, R1, -1      # counter--
BNE  R1, R0, loop    # if counter != 0 goto loop
SW   R2, 0(R0)       # Store final sum (10) into Mem[0]
`,
  },
];
