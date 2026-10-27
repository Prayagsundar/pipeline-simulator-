# Pipeline3D — Interactive 3D CPU Pipeline Simulator

A production-grade, interactive computer architecture workstation and CPU Pipeline Simulator. Features a real, deterministic 5-stage RISC pipeline execution engine, real-time hazard detection, data forwarding, branch resolution & flushing, space-time cycle timeline diagram, register/memory inspection, empirical performance analytics, and an interactive 3D WebGL processor visualization.

---

## 1. Architecture Overview

Pipeline3D is designed with clean separation of concerns:

- **Frontend (`src/`)**:
  - **Framework**: React 19 with TypeScript, Vite 8, and Tailwind CSS.
  - **3D Visualization (`src/components/pipeline3d/`)**: Procedural 3D datapath models with Three.js (r186), dynamic forwarding bypass arcs, animated instruction token capsules, studio lighting rig, camera presets (Perspective, Top-Down Datapath, Stage Zoom), and raycasting click/hover inspection.
  - **2D Schematic Fallback (`src/components/pipeline2d/`)**: Block diagram datapath with pipeline registers and control signals.
  - **Space-Time Diagram (`src/components/timeline/`)**: Instruction $\times$ Clock Cycle matrix tracking stage progression, stalls, bubbles, and flushes.
  - **Assembly Editor (`src/components/editor/`)**: Line-numbered assembly editor with live syntax validation, PC pointers, and example loaders.
  - **State Store (`src/store/`)**: Synchronous execution controller and REST API client.
- **Backend API & Simulator (`server.ts` & `src/simulator/`)**:
  - Express REST API hosting simulation sessions, step-by-step cycle execution, program validation, and metric calculation.
  - Integrates Vite dev server middleware in development (`npm run dev`) and serves production bundle in production.
- **Python Architecture & Verification Suite (`backend/`)**:
  - Independent Python simulation engine (`backend/simulator/`) implementing the identical pipeline semantics.
  - Comprehensive automated test suite (`backend/tests/test_pipeline.py`) verifying arithmetic, forwarding, load-use stalls, and branch flushing.

---

## 2. Pipeline Model & Architectural Assumptions

Pipeline3D implements a classic 5-stage in-order RISC microarchitecture:

### Stages
1. **IF (Instruction Fetch)**: Reads the 32-bit instruction at the Program Counter (`PC`) from Instruction Memory and computes sequential `PC_next = PC + 4`.
2. **ID (Instruction Decode / Register Read)**: Decodes opcode, identifies source registers (`Rs`, `Rt`) and destination (`Rd`), reads operand values from the 32-register file, sign-extends immediate constants, and performs hazard detection.
3. **EX (Execute / ALU / Branch)**: Performs ALU operations, evaluates memory addresses (`Rs + immediate`), evaluates branch conditions (`BEQ`, `BNE`), and selects forwarded operands via forwarding multiplexers.
4. **MEM (Memory Access)**: Reads (`LW`) or writes (`SW`) 32-bit words in word-aligned Data RAM.
5. **WB (Write Back)**: Commits calculated ALU results or loaded memory data into the Register File (`Rd` or `Rt`). Register `R0` (`$zero`) is hardwired to 0.

### Hazard & Forwarding Rules
- **RAW Data Hazards**:
  - **With Forwarding ENABLED**: Data is forwarded directly from `EX/MEM` or `MEM/WB` pipeline registers to the `EX` stage ALU inputs with **0 stall cycles** for arithmetic dependencies.
  - **With Forwarding DISABLED**: Instructions stall in `ID` until dependent prior instructions reach the `WB` stage.
- **Load-Use Hazards**:
  - When an instruction in `EX` is `LW` and the instruction in `ID` consumes its destination register, a **1-cycle stall** is mandatory because memory data is only available at the end of `MEM`. A bubble (NOP) is injected into `ID/EX`.
- **Control Hazards & Branch Resolution**:
  - Evaluated in the `EX` stage.
  - Policy: **Predict Not-Taken**.
  - When a branch is taken, the 2 speculatively fetched instructions in `IF` and `ID` are **flushed** (2-cycle branch penalty), and `PC` is redirected to the branch target.
- **Memory Addressing**:
  - Word-aligned 4-byte addressing (`0x0000`, `0x0004`, `0x0008`...).

---

## 3. Supported Instruction Set

| Opcode | Format | Semantics |
| :--- | :--- | :--- |
| `ADD` | `ADD Rd, Rs, Rt` | `Rd = Rs + Rt` |
| `SUB` | `SUB Rd, Rs, Rt` | `Rd = Rs - Rt` |
| `ADDI`| `ADDI Rt, Rs, imm` | `Rt = Rs + imm` |
| `AND` | `AND Rd, Rs, Rt` | `Rd = Rs & Rt` |
| `OR`  | `OR Rd, Rs, Rt` | `Rd = Rs \| Rt` |
| `XOR` | `XOR Rd, Rs, Rt` | `Rd = Rs ^ Rt` |
| `LW`  | `LW Rt, offset(Rs)` | `Rt = Mem[Rs + offset]` |
| `SW`  | `SW Rt, offset(Rs)` | `Mem[Rs + offset] = Rt` |
| `BEQ` | `BEQ Rs, Rt, target` | `if (Rs == Rt) PC = target` |
| `BNE` | `BNE Rs, Rt, target` | `if (Rs != Rt) PC = target` |
| `NOP` | `NOP` | No operation (`0x00000000`) |

---

## 4. REST API Specification

- `POST /api/programs/validate`: Validates assembly code, checks labels and registers.
- `GET /api/programs/examples`: Returns curated educational example programs.
- `POST /api/simulations`: Creates a new isolated simulation session with program, config, and initial memory.
- `GET /api/simulations/:id`: Retrieves current simulation state, registers, memory, and pipeline registers.
- `POST /api/simulations/:id/step`: Advances the simulation by exactly one clock cycle.
- `POST /api/simulations/:id/run`: Advances simulation up to a specified cycle limit.
- `POST /api/simulations/:id/reset`: Restores cycle 0 initial state.
- `PATCH /api/simulations/:id/config`: Updates simulation flags (`forwardingEnabled`, `branchPredictTaken`).
- `GET /api/simulations/:id/history`: Returns full cycle history matrix.
- `GET /api/simulations/:id/metrics`: Returns measured CPI, IPC, ideal cycles, and hazard counts.

---

## 5. Local Setup & Startup Commands

### Prerequisites
- Node.js $\ge$ 18 (Node.js 22 recommended)
- Python 3.10+ (for backend test suite)

### Installation
```bash
# Install Node dependencies
npm install
```

### Running the Full-Stack Application
```bash
# Starts Express server + Vite development environment on http://localhost:3000
npm run dev
```

### Building for Production
```bash
npm run build
npm run start
```

### Running Automated Verification Tests
```bash
# Run TypeScript compilation and linter
npm run lint

# Run Python pipeline unit & integration test suite
python3 -m unittest backend/tests/test_pipeline.py
```
