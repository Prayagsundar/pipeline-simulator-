from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any

@dataclass
class Instruction:
    id: int
    raw: str
    pc: int
    opcode: str
    rd: Optional[int] = None
    rs: Optional[int] = None
    rt: Optional[int] = None
    immediate: Optional[int] = None
    label: Optional[str] = None
    target_pc: Optional[int] = None
    source_line: int = 1

@dataclass
class StageState:
    stage: str
    instruction: Optional[Instruction] = None
    status: str = 'empty' # active, stalled, flushed, bubble, empty
    cycle_entered: int = 0
    details: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SimulationMetrics:
    total_cycles: int = 0
    instructions_completed: int = 0
    cpi: float = 0.0
    ipc: float = 0.0
    ideal_cycles: int = 0
    data_hazards_count: int = 0
    load_use_hazards_count: int = 0
    control_hazards_count: int = 0
    stalls_count: int = 0
    flushes_count: int = 0
    forwarding_events_count: int = 0
    pipeline_utilization: float = 0.0
