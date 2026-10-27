from typing import List, Dict, Optional, Tuple, Any
from .models import Instruction, StageState, SimulationMetrics

class PythonPipelineSimulator:
    def __init__(self, instructions: List[Instruction], forwarding_enabled: bool = True, initial_memory: Optional[Dict[int, int]] = None):
        self.instructions = instructions
        self.forwarding_enabled = forwarding_enabled
        self.registers = [0] * 32
        self.memory = dict(initial_memory or {})
        self.pc = 0
        self.cycle = 0
        self.is_halted = False

        self.if_id = None
        self.id_ex = None
        self.ex_mem = None
        self.mem_wb = None

        self.timeline: Dict[int, Dict[int, str]] = {}
        self.completed_count = 0
        self.data_hazards_count = 0
        self.load_use_count = 0
        self.control_hazards_count = 0
        self.stalls_count = 0
        self.flushes_count = 0
        self.forwarding_count = 0

    def step(self):
        if self.is_halted:
            return

        self.cycle += 1
        stall_if = False
        stall_id = False
        flush_if = False
        flush_id = False
        branch_redirect_pc = None

        # 1. WB Stage
        wb_inst = None
        if self.mem_wb and self.mem_wb.get('valid') and self.mem_wb.get('inst'):
            wb_inst = self.mem_wb['inst']
            reg_write = self.mem_wb.get('reg_write', False)
            dest_reg = self.mem_wb.get('dest_reg', 0)
            if reg_write and dest_reg != 0:
                val = self.mem_wb['mem_data'] if self.mem_wb.get('mem_to_reg') else self.mem_wb['alu_result']
                self.registers[dest_reg] = val
            self.completed_count += 1
            self._record(wb_inst.id, "WB")

        # 2. MEM Stage
        next_mem_wb = {'valid': False}
        if self.ex_mem and self.ex_mem.get('valid') and self.ex_mem.get('inst'):
            mem_inst = self.ex_mem['inst']
            addr = self.ex_mem['alu_result']
            mem_read = self.ex_mem.get('mem_read', False)
            mem_write = self.ex_mem.get('mem_write', False)
            read_data = 0

            if mem_write:
                store_data = self.ex_mem['val_rt']
                # MEM forwarding from WB
                if (self.forwarding_enabled and self.mem_wb and self.mem_wb.get('valid') and
                    self.mem_wb.get('reg_write') and self.mem_wb.get('dest_reg') == mem_inst.rt and self.mem_wb.get('dest_reg') != 0):
                    store_data = self.mem_wb['mem_data'] if self.mem_wb.get('mem_to_reg') else self.mem_wb['alu_result']
                    self.forwarding_count += 1
                aligned_addr = addr & ~3
                self.memory[aligned_addr] = store_data

            if mem_read:
                aligned_addr = addr & ~3
                read_data = self.memory.get(aligned_addr, 0)

            next_mem_wb = {
                'valid': True,
                'inst': mem_inst,
                'alu_result': addr,
                'mem_data': read_data,
                'dest_reg': self.ex_mem.get('dest_reg', 0),
                'reg_write': self.ex_mem.get('reg_write', False),
                'mem_to_reg': mem_read,
            }
            self._record(mem_inst.id, "MEM")

        # 3. EX Stage
        next_ex_mem = {'valid': False}
        if self.id_ex and self.id_ex.get('valid') and self.id_ex.get('inst'):
            ex_inst = self.id_ex['inst']
            alu_in1 = self.id_ex['val_rs']

            # Forwarding for Rs
            if self.forwarding_enabled:
                if (self.ex_mem and self.ex_mem.get('valid') and self.ex_mem.get('reg_write') and
                    self.ex_mem.get('dest_reg') != 0 and self.ex_mem.get('dest_reg') == self.id_ex.get('rs')):
                    alu_in1 = self.ex_mem['alu_result']
                    self.forwarding_count += 1
                elif (self.mem_wb and self.mem_wb.get('valid') and self.mem_wb.get('reg_write') and
                      self.mem_wb.get('dest_reg') != 0 and self.mem_wb.get('dest_reg') == self.id_ex.get('rs')):
                    alu_in1 = self.mem_wb['mem_data'] if self.mem_wb.get('mem_to_reg') else self.mem_wb['alu_result']
                    self.forwarding_count += 1

            # Forwarding for Rt
            forwarded_rt = self.id_ex['val_rt']
            if self.forwarding_enabled:
                if (self.ex_mem and self.ex_mem.get('valid') and self.ex_mem.get('reg_write') and
                    self.ex_mem.get('dest_reg') != 0 and self.ex_mem.get('dest_reg') == self.id_ex.get('rt')):
                    forwarded_rt = self.ex_mem['alu_result']
                    self.forwarding_count += 1
                elif (self.mem_wb and self.mem_wb.get('valid') and self.mem_wb.get('reg_write') and
                      self.mem_wb.get('dest_reg') != 0 and self.mem_wb.get('dest_reg') == self.id_ex.get('rt')):
                    forwarded_rt = self.mem_wb['mem_data'] if self.mem_wb.get('mem_to_reg') else self.mem_wb['alu_result']
                    self.forwarding_count += 1

            alu_in2 = self.id_ex['immediate'] if self.id_ex.get('alu_src') else forwarded_rt
            alu_res = 0
            op = ex_inst.opcode
            if op in ('ADD', 'ADDI'):
                alu_res = (alu_in1 + alu_in2) & 0xFFFFFFFF
                if alu_res >= 0x80000000: alu_res -= 0x100000000
            elif op == 'SUB':
                alu_res = (alu_in1 - alu_in2) & 0xFFFFFFFF
                if alu_res >= 0x80000000: alu_res -= 0x100000000
            elif op == 'AND':
                alu_res = alu_in1 & alu_in2
            elif op == 'OR':
                alu_res = alu_in1 | alu_in2
            elif op == 'XOR':
                alu_res = alu_in1 ^ alu_in2
            elif op in ('LW', 'SW'):
                alu_res = alu_in1 + self.id_ex['immediate']

            # Branch check
            if self.id_ex.get('branch'):
                taken = False
                if op == 'BEQ': taken = (alu_in1 == alu_in2)
                elif op == 'BNE': taken = (alu_in1 != alu_in2)
                if taken:
                    self.control_hazards_count += 1
                    self.flushes_count += 2
                    flush_if = True
                    flush_id = True
                    branch_redirect_pc = ex_inst.target_pc or (self.id_ex['pc'] + 4)

            next_ex_mem = {
                'valid': True,
                'inst': ex_inst,
                'alu_result': alu_res,
                'val_rt': forwarded_rt,
                'dest_reg': self.id_ex.get('rd', 0),
                'reg_write': self.id_ex.get('reg_write', False),
                'mem_read': self.id_ex.get('mem_read', False),
                'mem_write': self.id_ex.get('mem_write', False),
            }
            self._record(ex_inst.id, "EX")

        # 4. ID Stage
        next_id_ex = {'valid': False}
        if self.if_id and self.if_id.get('valid') and self.if_id.get('inst'):
            id_inst = self.if_id['inst']

            # Check Load-Use Hazard
            ex_is_load = (self.id_ex and self.id_ex.get('valid') and self.id_ex.get('mem_read') and self.id_ex.get('rd', 0) != 0)
            is_load_use = False
            if ex_is_load:
                ex_dest = self.id_ex['rd']
                if id_inst.rs == ex_dest: is_load_use = True
                if id_inst.rt == ex_dest and id_inst.opcode not in ('ADDI', 'LW'): is_load_use = True

            # RAW hazard if forwarding disabled
            is_raw_no_fwd = False
            if not self.forwarding_enabled:
                for stage_reg in (self.id_ex, self.ex_mem):
                    if stage_reg and stage_reg.get('valid') and stage_reg.get('reg_write'):
                        dest = stage_reg.get('dest_reg') or stage_reg.get('rd')
                        if dest and dest != 0:
                            if id_inst.rs == dest or (id_inst.rt == dest and id_inst.opcode not in ('ADDI', 'LW')):
                                is_raw_no_fwd = True

            if is_load_use:
                self.load_use_count += 1
                self.stalls_count += 1
                stall_if = True
                stall_id = True
                self._record(id_inst.id, "STALL")
            elif is_raw_no_fwd:
                self.data_hazards_count += 1
                self.stalls_count += 1
                stall_if = True
                stall_id = True
                self._record(id_inst.id, "STALL")
            elif flush_id:
                self._record(id_inst.id, "FLUSH")
            else:
                # Normal decode
                val_rs = self.registers[id_inst.rs or 0]
                val_rt = self.registers[id_inst.rt or 0]
                # Internal WB forwarding
                if self.mem_wb and self.mem_wb.get('valid') and self.mem_wb.get('reg_write'):
                    wb_dest = self.mem_wb.get('dest_reg', 0)
                    if wb_dest != 0:
                        wb_val = self.mem_wb['mem_data'] if self.mem_wb.get('mem_to_reg') else self.mem_wb['alu_result']
                        if id_inst.rs == wb_dest: val_rs = wb_val
                        if id_inst.rt == wb_dest: val_rt = wb_val

                op = id_inst.opcode
                is_rtype = op in ('ADD', 'SUB', 'AND', 'OR', 'XOR')
                is_branch = op in ('BEQ', 'BNE')
                is_load = op == 'LW'
                is_store = op == 'SW'
                is_addi = op == 'ADDI'
                dest_reg = (id_inst.rd if is_rtype else id_inst.rt) or 0

                next_id_ex = {
                    'valid': True,
                    'inst': id_inst,
                    'pc': self.if_id['pc'],
                    'rs': id_inst.rs or 0,
                    'rt': id_inst.rt or 0,
                    'rd': dest_reg,
                    'val_rs': val_rs,
                    'val_rt': val_rt,
                    'immediate': id_inst.immediate or 0,
                    'reg_write': is_rtype or is_addi or is_load,
                    'mem_read': is_load,
                    'mem_write': is_store,
                    'branch': is_branch,
                    'alu_src': is_addi or is_load or is_store,
                    'mem_to_reg': is_load,
                }
                self._record(id_inst.id, "ID")

        # 5. IF Stage
        next_if_id = {'valid': False}
        if branch_redirect_pc is not None:
            self.pc = branch_redirect_pc
        elif stall_if:
            next_if_id = dict(self.if_id or {'valid': False})
        else:
            fetched = next((inst for inst in self.instructions if inst.pc == self.pc), None)
            if fetched:
                next_if_id = {
                    'valid': True,
                    'inst': fetched,
                    'pc': self.pc,
                }
                self._record(fetched.id, "IF")
                self.pc += 4

        self.mem_wb = next_mem_wb
        self.ex_mem = next_ex_mem
        self.id_ex = next_id_ex
        self.if_id = next_if_id

        # Check halt
        if (not self.if_id.get('valid') and not self.id_ex.get('valid') and
            not self.ex_mem.get('valid') and not self.mem_wb.get('valid') and
            self.pc >= len(self.instructions) * 4 and self.cycle > 0):
            self.is_halted = True

    def run_all(self, max_cycles: int = 200):
        while not self.is_halted and self.cycle < max_cycles:
            self.step()

    def _record(self, inst_id: int, stage: str):
        if inst_id not in self.timeline:
            self.timeline[inst_id] = {}
        self.timeline[inst_id][self.cycle] = stage
