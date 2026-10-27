import re
from typing import List, Tuple, Dict, Optional
from .models import Instruction

REGISTER_MAP = {
    f"r{i}": i for i in range(32)
}
MIPS_ALIASES = {
    "$zero": 0, "$at": 1, "$v0": 2, "$v1": 3,
    "$a0": 4, "$a1": 5, "$a2": 6, "$a3": 7,
    "$t0": 8, "$t1": 9, "$t2": 10, "$t3": 11, "$t4": 12, "$t5": 13, "$t6": 14, "$t7": 15,
    "$s0": 16, "$s1": 17, "$s2": 18, "$s3": 19, "$s4": 20, "$s5": 21, "$s6": 22, "$s7": 23,
    "$t8": 24, "$t9": 25, "$k0": 26, "$k1": 27,
    "$gp": 28, "$sp": 29, "$fp": 30, "$ra": 31,
}
REGISTER_MAP.update(MIPS_ALIASES)

def parse_reg(token: str) -> Optional[int]:
    token = token.strip().lower().rstrip(',')
    if token in REGISTER_MAP:
        return REGISTER_MAP[token]
    bare = token[1:] if token.startswith('$') else token
    try:
        val = int(bare)
        if 0 <= val <= 31:
            return val
    except ValueError:
        pass
    return None

def parse_imm(token: str) -> Optional[int]:
    token = token.strip().rstrip(',')
    try:
        if token.startswith(('0x', '0X')):
            return int(token, 16)
        elif token.startswith(('0b', '0B')):
            return int(token, 2)
        return int(token, 10)
    except ValueError:
        return None

def parse_assembly(code: str) -> Tuple[List[Instruction], List[str]]:
    lines = code.split('\n')
    errors: List[str] = []
    raw_items = []
    labels: Dict[str, int] = {}
    curr_pc = 0

    # Pass 1: Comments, labels, PC assignment
    for i, line in enumerate(lines):
        line_no = i + 1
        line = re.sub(r'(#|//).*$', '', line).strip()
        if not line:
            continue
        if ':' in line:
            parts = line.split(':', 1)
            label = parts[0].strip()
            if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', label):
                errors.append(f"Line {line_no}: Invalid label '{label}'")
            else:
                labels[label.lower()] = curr_pc
            line = parts[1].strip()
            if not line:
                continue
        raw_items.append((line_no, line))
        curr_pc += 4

    instructions: List[Instruction] = []

    # Pass 2: Parsing instructions
    for idx, (line_no, line) in enumerate(raw_items):
        pc = idx * 4
        parts = line.split(None, 1)
        opcode = parts[0].upper()
        args_str = parts[1].strip() if len(parts) > 1 else ""

        if opcode == "NOP":
            instructions.append(Instruction(id=idx, raw=line, pc=pc, opcode="NOP", source_line=line_no))
            continue

        args = [a.strip() for a in args_str.split(',') if a.strip()]

        if opcode in ("ADD", "SUB", "AND", "OR", "XOR"):
            if len(args) != 3:
                errors.append(f"Line {line_no}: {opcode} expects 3 arguments (Rd, Rs, Rt)")
                continue
            rd, rs, rt = parse_reg(args[0]), parse_reg(args[1]), parse_reg(args[2])
            instructions.append(Instruction(id=idx, raw=line, pc=pc, opcode=opcode, rd=rd, rs=rs, rt=rt, source_line=line_no))
        elif opcode == "ADDI":
            if len(args) != 3:
                errors.append(f"Line {line_no}: ADDI expects 3 arguments (Rt, Rs, imm)")
                continue
            rt, rs, imm = parse_reg(args[0]), parse_reg(args[1]), parse_imm(args[2])
            instructions.append(Instruction(id=idx, raw=line, pc=pc, opcode=opcode, rd=rt, rt=rt, rs=rs, immediate=imm, source_line=line_no))
        elif opcode in ("LW", "SW"):
            if len(args) == 2:
                rt = parse_reg(args[0])
                m = re.match(r'^(-?\w+)?\s*\(([^)]+)\)$', args[1])
                if m:
                    imm = parse_imm(m.group(1) or '0')
                    rs = parse_reg(m.group(2))
                else:
                    errors.append(f"Line {line_no}: Invalid memory operand")
                    continue
            elif len(args) == 3:
                rt, rs, imm = parse_reg(args[0]), parse_reg(args[1]), parse_imm(args[2])
            else:
                errors.append(f"Line {line_no}: {opcode} expects Rt, offset(Rs)")
                continue
            rd = rt if opcode == "LW" else None
            instructions.append(Instruction(id=idx, raw=line, pc=pc, opcode=opcode, rd=rd, rt=rt, rs=rs, immediate=imm, source_line=line_no))
        elif opcode in ("BEQ", "BNE"):
            if len(args) != 3:
                errors.append(f"Line {line_no}: {opcode} expects Rs, Rt, target")
                continue
            rs, rt = parse_reg(args[0]), parse_reg(args[1])
            target_token = args[2].lower()
            target_pc = labels.get(target_token)
            if target_pc is None:
                imm = parse_imm(target_token)
                if imm is not None:
                    target_pc = pc + 4 + imm * 4
                else:
                    errors.append(f"Line {line_no}: Unknown label '{target_token}'")
                    continue
            instructions.append(Instruction(id=idx, raw=line, pc=pc, opcode=opcode, rs=rs, rt=rt, label=target_token, target_pc=target_pc, source_line=line_no))
        else:
            errors.append(f"Line {line_no}: Unknown opcode '{opcode}'")

    return instructions, errors
