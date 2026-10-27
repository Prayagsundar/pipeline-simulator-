import { ExampleProgram } from '../simulator/examples';
import { ParsedInstruction, SimulationConfig, SimulationMetrics, SimulationState } from '../simulator/types';

export interface ValidateResponse {
  valid: boolean;
  errors: string[];
  instructionCount: number;
  labels: Record<string, number>;
  instructions: ParsedInstruction[];
}

export const api = {
  async getExamples(): Promise<ExampleProgram[]> {
    const res = await fetch('/api/programs/examples');
    if (!res.ok) throw new Error('Failed to fetch examples');
    return res.json();
  },

  async validateProgram(code: string): Promise<ValidateResponse> {
    const res = await fetch('/api/programs/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error('Validation failed');
    return res.json();
  },

  async createSimulation(
    code: string,
    config: Partial<SimulationConfig> = {},
    initialMemory: Record<number, number> = {}
  ): Promise<{ id: string; state: SimulationState }> {
    const res = await fetch('/api/simulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, config, initialMemory }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.details?.join(', ') || 'Failed to create simulation');
    }
    return res.json();
  },

  async getSimulation(id: string): Promise<SimulationState> {
    const res = await fetch(`/api/simulations/${id}`);
    if (!res.ok) throw new Error('Failed to get simulation state');
    return res.json();
  },

  async stepSimulation(id: string): Promise<SimulationState> {
    const res = await fetch(`/api/simulations/${id}/step`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to step simulation');
    return res.json();
  },

  async runSimulation(id: string, cycleLimit: number = 100): Promise<SimulationState> {
    const res = await fetch(`/api/simulations/${id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleLimit }),
    });
    if (!res.ok) throw new Error('Failed to run simulation');
    return res.json();
  },

  async resetSimulation(id: string): Promise<SimulationState> {
    const res = await fetch(`/api/simulations/${id}/reset`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to reset simulation');
    return res.json();
  },

  async updateConfig(
    id: string,
    config: { forwardingEnabled?: boolean; branchPredictTaken?: boolean }
  ): Promise<SimulationState> {
    const res = await fetch(`/api/simulations/${id}/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to update config');
    return res.json();
  },

  async getMetrics(id: string): Promise<SimulationMetrics> {
    const res = await fetch(`/api/simulations/${id}/metrics`);
    if (!res.ok) throw new Error('Failed to fetch metrics');
    return res.json();
  },
};
