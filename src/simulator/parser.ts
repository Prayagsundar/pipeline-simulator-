import { Opcode, ParsedInstruction } from './types';

const REGISTER_MAP: Record<string, number> = {
  // Standard numbered registers
  r0: 0, r1: 1, r2: 2, r3: 3, r4: 4, r5: 5, r6: 6, r7: 7,
  r8: 8, r9: 9, r10: 10, r11: 11, r12: 12, r13: 13, r14: 14, r15: 15,
  r16: 16, r17: 17, r18: 18, r19: 19, r20: 20, r21: 21, r22: 22, r23: 23,
  r24: 24, r25: 25, r26: 26, r27: 27, r28: 28, r29: 29, r30: 30, r31: 31,
  // MIPS-style named registers
  '$zero': 0, '$at': 1, '$v0': 2, '$v1': 3,
  '$a0': 4, '$a1': 5, '$a2': 6, '$a3': 7,
  '$t0': 8, '$t1': 9, '$t2': 10, '$t3': 11, '$t4': 12, '$t5': 13, '$t6': 14, '$t7': 15,
  '$s0': 16, '$s1': 17, '$s2': 18, '$s3': 19, '$s4': 20, '$s5': 21, '$s6': 22, '$s7': 23,
  '$t8': 24, '$t9': 25, '$k0': 26, '$k1': 27,
  '$gp': 28, '$sp': 29, '$fp': 30, '$ra': 31,
};

export interface ParseResult {
  instructions: ParsedInstruction[];
  errors: string[];
  labels: Record<string, number>; // label -> PC
}

export function parseRegister(token: string): number | null {
  const clean = token.trim().toLowerCase().replace(/,$/, '');
  if (clean in REGISTER_MAP) {
    return REGISTER_MAP[clean];
  }
  // Try bare integer index e.g. "1" or "$1"
  const bareInt = clean.startsWith('$') ? clean.substring(1) : clean;
  const num = parseInt(bareInt, 10);
  if (!isNaN(num) && num >= 0 && num <= 31) {
    return num;
  }
  return null;
}

export function parseImmediate(token: string): number | null {
  const clean = token.trim().replace(/,$/, '');
  let val: number;
  if (clean.startsWith('0x') || clean.startsWith('0X')) {
    val = parseInt(clean, 16);
  } else if (clean.startsWith('0b') || clean.startsWith('0B')) {
    val = parseInt(clean.substring(2), 2);
  } else {
    val = parseInt(clean, 10);
  }
  return isNaN(val) ? null : val;
}

export function parseAssembly(code: string): ParseResult {
  const lines = code.split('\n');
  const errors: string[] = [];
  const rawInstructions: { lineNo: number; text: string; label?: string }[] = [];
  const labels: Record<string, number> = {};

  let currentPc = 0;

  // Pass 1: strip comments, extract labels, assign PC
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    let line = lines[i];

    // Remove comments (# or //)
    const hashIndex = line.indexOf('#');
    if (hashIndex !== -1) line = line.substring(0, hashIndex);
    const slashIndex = line.indexOf('//');
    if (slashIndex !== -1) line = line.substring(0, slashIndex);

    line = line.trim();
    if (!line) continue;

    // Check for label prefix, e.g. "loop: ADD R1, R2, R3" or just "loop:"
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1) {
      const labelName = line.substring(0, colonIndex).trim();
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(labelName)) {
        errors.push(`Line ${lineNo}: Invalid label name '${labelName}'`);
      } else {
        labels[labelName.toLowerCase()] = currentPc;
      }
      line = line.substring(colonIndex + 1).trim();
      if (!line) continue; // Label-only line
    }

    rawInstructions.push({
      lineNo,
      text: line,
    });
    currentPc += 4;
  }

  const instructions: ParsedInstruction[] = [];

  // Pass 2: parse instructions
  for (let idx = 0; idx < rawInstructions.length; idx++) {
    const item = rawInstructions[idx];
    const pc = idx * 4;
    const text = item.text;
    const lineNo = item.lineNo;

    // Split opcode and operand string
    const firstSpace = text.search(/\s/);
    const opcodeStr = (firstSpace === -1 ? text : text.substring(0, firstSpace)).toUpperCase();
    const argsStr = firstSpace === -1 ? '' : text.substring(firstSpace).trim();

    const validOpcodes: Opcode[] = [
      'ADD', 'SUB', 'ADDI', 'AND', 'OR', 'XOR', 'LW', 'SW', 'BEQ', 'BNE', 'NOP',
    ];

    if (!validOpcodes.includes(opcodeStr as Opcode)) {
      errors.push(`Line ${lineNo}: Unknown instruction opcode '${opcodeStr}'`);
      continue;
    }

    const opcode = opcodeStr as Opcode;

    if (opcode === 'NOP') {
      instructions.push({
        id: idx,
        raw: text,
        pc,
        opcode: 'NOP',
        sourceLine: lineNo,
      });
      continue;
    }

    // Split args by comma
    const args = argsStr.split(',').map((s) => s.trim()).filter(Boolean);

    if (opcode === 'ADD' || opcode === 'SUB' || opcode === 'AND' || opcode === 'OR' || opcode === 'XOR') {
      if (args.length !== 3) {
        errors.push(`Line ${lineNo}: ${opcode} requires 3 operands (Rd, Rs, Rt), got ${args.length}`);
        continue;
      }
      const rd = parseRegister(args[0]);
      const rs = parseRegister(args[1]);
      const rt = parseRegister(args[2]);

      if (rd === null) errors.push(`Line ${lineNo}: Invalid destination register '${args[0]}'`);
      if (rs === null) errors.push(`Line ${lineNo}: Invalid source register Rs '${args[1]}'`);
      if (rt === null) errors.push(`Line ${lineNo}: Invalid source register Rt '${args[2]}'`);

      if (rd !== null && rs !== null && rt !== null) {
        instructions.push({
          id: idx,
          raw: text,
          pc,
          opcode,
          rd,
          rs,
          rt,
          sourceLine: lineNo,
        });
      }
    } else if (opcode === 'ADDI') {
      if (args.length !== 3) {
        errors.push(`Line ${lineNo}: ADDI requires 3 operands (Rt, Rs, immediate), got ${args.length}`);
        continue;
      }
      const rt = parseRegister(args[0]);
      const rs = parseRegister(args[1]);
      const imm = parseImmediate(args[2]);

      if (rt === null) errors.push(`Line ${lineNo}: Invalid destination register Rt '${args[0]}'`);
      if (rs === null) errors.push(`Line ${lineNo}: Invalid source register Rs '${args[1]}'`);
      if (imm === null) errors.push(`Line ${lineNo}: Invalid immediate value '${args[2]}'`);

      if (rt !== null && rs !== null && imm !== null) {
        instructions.push({
          id: idx,
          raw: text,
          pc,
          opcode,
          rd: rt, // destination is Rt in MIPS ADDI
          rt,
          rs,
          immediate: imm,
          sourceLine: lineNo,
        });
      }
    } else if (opcode === 'LW' || opcode === 'SW') {
      // Formats:
      // LW Rt, offset(Rs)
      // LW Rt, Rs, offset
      let rtVal: number | null = null;
      let rsVal: number | null = null;
      let offsetVal: number | null = 0;

      if (args.length === 2) {
        rtVal = parseRegister(args[0]);
        // parse offset(Rs)
        const memRef = args[1].trim();
        const match = memRef.match(/^(-?\w+)?\s*\(([^)]+)\)$/);
        if (match) {
          const offStr = match[1] || '0';
          const regStr = match[2];
          offsetVal = parseImmediate(offStr);
          rsVal = parseRegister(regStr);
        } else {
          errors.push(`Line ${lineNo}: Invalid memory operand '${args[1]}'. Expected offset(Rs) e.g. 0(R2)`);
          continue;
        }
      } else if (args.length === 3) {
        rtVal = parseRegister(args[0]);
        rsVal = parseRegister(args[1]);
        offsetVal = parseImmediate(args[2]);
      } else {
        errors.push(`Line ${lineNo}: ${opcode} requires 2 operands (Rt, offset(Rs)), got ${args.length}`);
        continue;
      }

      if (rtVal === null) errors.push(`Line ${lineNo}: Invalid register Rt '${args[0]}'`);
      if (rsVal === null) errors.push(`Line ${lineNo}: Invalid base register Rs`);
      if (offsetVal === null) errors.push(`Line ${lineNo}: Invalid offset value`);

      if (rtVal !== null && rsVal !== null && offsetVal !== null) {
        instructions.push({
          id: idx,
          raw: text,
          pc,
          opcode,
          rd: opcode === 'LW' ? rtVal : undefined,
          rt: rtVal,
          rs: rsVal,
          immediate: offsetVal,
          sourceLine: lineNo,
        });
      }
    } else if (opcode === 'BEQ' || opcode === 'BNE') {
      if (args.length !== 3) {
        errors.push(`Line ${lineNo}: ${opcode} requires 3 operands (Rs, Rt, label_or_target), got ${args.length}`);
        continue;
      }
      const rs = parseRegister(args[0]);
      const rt = parseRegister(args[1]);
      const targetToken = args[2].trim();

      if (rs === null) errors.push(`Line ${lineNo}: Invalid register Rs '${args[0]}'`);
      if (rt === null) errors.push(`Line ${lineNo}: Invalid register Rt '${args[1]}'`);

      let targetPc: number | undefined;
      const lowerTarget = targetToken.toLowerCase();

      if (lowerTarget in labels) {
        targetPc = labels[lowerTarget];
      } else {
        const imm = parseImmediate(targetToken);
        if (imm !== null) {
          // Can be relative offset or absolute PC
          targetPc = pc + 4 + imm * 4;
        } else {
          errors.push(`Line ${lineNo}: Unknown branch target label '${targetToken}'`);
        }
      }

      if (rs !== null && rt !== null && targetPc !== undefined) {
        instructions.push({
          id: idx,
          raw: text,
          pc,
          opcode,
          rs,
          rt,
          label: targetToken,
          targetPc,
          sourceLine: lineNo,
        });
      }
    }
  }

  return {
    instructions,
    errors,
    labels,
  };
}
