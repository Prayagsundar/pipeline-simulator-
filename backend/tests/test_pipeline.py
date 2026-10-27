import unittest
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from simulator.parser import parse_assembly
from simulator.pipeline import PythonPipelineSimulator

class TestPipelineSimulator(unittest.TestCase):
    def test_basic_arithmetic(self):
        code = """
        ADDI R1, R0, 10
        ADDI R2, R0, 20
        ADD  R3, R1, R2
        SUB  R4, R2, R1
        """
        instructions, errors = parse_assembly(code)
        self.assertEqual(len(errors), 0, f"Parse errors: {errors}")
        self.assertEqual(len(instructions), 4)

        sim = PythonPipelineSimulator(instructions, forwarding_enabled=True)
        sim.run_all(max_cycles=30)

        self.assertEqual(sim.registers[1], 10)
        self.assertEqual(sim.registers[2], 20)
        self.assertEqual(sim.registers[3], 30)
        self.assertEqual(sim.registers[4], 10)
        self.assertEqual(sim.completed_count, 4)

    def test_forwarding_vs_no_forwarding(self):
        code = """
        ADDI R1, R0, 5
        ADD  R2, R1, R1
        ADD  R3, R2, R1
        """
        instructions, _ = parse_assembly(code)

        # Run with forwarding
        sim_fwd = PythonPipelineSimulator(instructions, forwarding_enabled=True)
        sim_fwd.run_all(30)
        cycles_fwd = sim_fwd.cycle
        self.assertEqual(sim_fwd.registers[2], 10)
        self.assertEqual(sim_fwd.registers[3], 15)
        self.assertEqual(sim_fwd.stalls_count, 0)

        # Run without forwarding
        sim_no_fwd = PythonPipelineSimulator(instructions, forwarding_enabled=False)
        sim_no_fwd.run_all(30)
        cycles_no_fwd = sim_no_fwd.cycle
        self.assertEqual(sim_no_fwd.registers[2], 10)
        self.assertEqual(sim_no_fwd.registers[3], 15)
        self.assertGreater(sim_no_fwd.stalls_count, 0)
        self.assertGreater(cycles_no_fwd, cycles_fwd)

    def test_load_use_hazard_stall(self):
        code = """
        ADDI R1, R0, 0
        LW   R2, 0(R1)
        ADD  R3, R2, R1
        """
        instructions, _ = parse_assembly(code)
        sim = PythonPipelineSimulator(instructions, forwarding_enabled=True, initial_memory={0: 99})
        sim.run_all(30)

        self.assertEqual(sim.registers[2], 99)
        self.assertEqual(sim.registers[3], 99)
        self.assertEqual(sim.load_use_count, 1)
        self.assertEqual(sim.stalls_count, 1)

    def test_branch_taken_and_flushing(self):
        code = """
        ADDI R1, R0, 7
        ADDI R2, R0, 7
        BEQ  R1, R2, skip
        ADDI R3, R0, 999
        skip:
        ADDI R4, R0, 42
        """
        instructions, _ = parse_assembly(code)
        sim = PythonPipelineSimulator(instructions, forwarding_enabled=True)
        sim.run_all(30)

        self.assertEqual(sim.registers[1], 7)
        self.assertEqual(sim.registers[2], 7)
        self.assertEqual(sim.registers[3], 0) # R3 must remain 0 because it was flushed!
        self.assertEqual(sim.registers[4], 42)
        self.assertEqual(sim.control_hazards_count, 1)
        self.assertEqual(sim.flushes_count, 2)

    def test_memory_store_and_reload(self):
        code = """
        ADDI R1, R0, 123
        SW   R1, 8(R0)
        LW   R2, 8(R0)
        """
        instructions, _ = parse_assembly(code)
        sim = PythonPipelineSimulator(instructions, forwarding_enabled=True)
        sim.run_all(30)

        self.assertEqual(sim.memory[8], 123)
        self.assertEqual(sim.registers[2], 123)

if __name__ == '__main__':
    unittest.main()
