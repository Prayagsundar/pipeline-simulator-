import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseAssembly } from './src/simulator/parser';
import { PipelineSimulator } from './src/simulator/pipeline';
import { EXAMPLE_PROGRAMS } from './src/simulator/examples';
import { SimulationConfig } from './src/simulator/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

// In-memory simulation sessions store
interface SessionData {
  id: string;
  code: string;
  config: Partial<SimulationConfig>;
  initialMemory: Record<number, number>;
  simulator: PipelineSimulator;
  createdAt: number;
  lastAccessedAt: number;
}

const sessions = new Map<string, SessionData>();

// Auto-cleanup stale sessions (older than 2 hours)
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastAccessedAt > 2 * 60 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 15 * 60 * 1000);

// API Router
const api = express.Router();

// 1. Validate assembly program
api.post('/programs/validate', (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (typeof code !== 'string') {
      return res.status(400).json({ error: 'Field "code" must be a string' });
    }
    const parseResult = parseAssembly(code);
    return res.json({
      valid: parseResult.errors.length === 0,
      errors: parseResult.errors,
      instructionCount: parseResult.instructions.length,
      labels: parseResult.labels,
      instructions: parseResult.instructions,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Validation error' });
  }
});

// 2. Get list of example programs
api.get('/programs/examples', (_req: Request, res: Response) => {
  return res.json(EXAMPLE_PROGRAMS);
});

// 3. Create simulation session
api.post('/simulations', (req: Request, res: Response) => {
  try {
    const { code, config = {}, initialMemory = {} } = req.body;
    if (typeof code !== 'string') {
      return res.status(400).json({ error: 'Field "code" is required' });
    }

    const parseResult = parseAssembly(code);
    if (parseResult.errors.length > 0) {
      return res.status(422).json({
        error: 'Assembly program contains syntax errors',
        details: parseResult.errors,
      });
    }

    const sessionId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const simulator = new PipelineSimulator(
      parseResult.instructions,
      config,
      initialMemory,
      sessionId
    );

    sessions.set(sessionId, {
      id: sessionId,
      code,
      config,
      initialMemory,
      simulator,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    });

    return res.status(201).json({
      id: sessionId,
      state: simulator.getState(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create simulation' });
  }
});

// Helper to retrieve session
function getSession(req: Request, res: Response): SessionData | null {
  const { id } = req.params;
  const session = sessions.get(id);
  if (!session) {
    res.status(404).json({ error: `Simulation session '${id}' not found or expired` });
    return null;
  }
  session.lastAccessedAt = Date.now();
  return session;
}

// 4. Get simulation state
api.get('/simulations/:id', (req: Request, res: Response) => {
  const session = getSession(req, res);
  if (!session) return;
  return res.json(session.simulator.getState());
});

// 5. Step simulation by 1 cycle
api.post('/simulations/:id/step', (req: Request, res: Response) => {
  const session = getSession(req, res);
  if (!session) return;
  const state = session.simulator.step();
  return res.json(state);
});

// 6. Run simulation up to cycle limit
api.post('/simulations/:id/run', (req: Request, res: Response) => {
  const session = getSession(req, res);
  if (!session) return;
  const limit = Math.min(Math.max(1, Number(req.body.cycleLimit || 100)), 500);
  const state = session.simulator.run(limit);
  return res.json(state);
});

// 7. Reset simulation
api.post('/simulations/:id/reset', (req: Request, res: Response) => {
  const session = getSession(req, res);
  if (!session) return;
  session.simulator.reset();
  return res.json(session.simulator.getState());
});

// 8. Update configuration (e.g. toggle forwarding)
api.patch('/simulations/:id/config', (req: Request, res: Response) => {
  const session = getSession(req, res);
  if (!session) return;
  const { forwardingEnabled, branchPredictTaken } = req.body;
  session.simulator.setConfig({
    ...(typeof forwardingEnabled === 'boolean' ? { forwardingEnabled } : {}),
    ...(typeof branchPredictTaken === 'boolean' ? { branchPredictTaken } : {}),
  });
  return res.json(session.simulator.getState());
});

// 9. Get timeline history
api.get('/simulations/:id/history', (req: Request, res: Response) => {
  const session = getSession(req, res);
  if (!session) return;
  const state = session.simulator.getState();
  return res.json({
    cycle: state.cycle,
    timeline: state.timeline,
  });
});

// 11. Download full project archive
api.get('/download-archive', (_req: Request, res: Response) => {
  const archivePath = path.resolve(__dirname, 'cpu-pipeline-simulator.tar.gz');
  res.download(archivePath, 'cpu-pipeline-simulator.tar.gz');
});

// 12. Push to GitHub with Personal Access Token
api.post('/git/push', async (req: Request, res: Response) => {
  const { repoName = 'cpu-pipeline-simulator', token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'GitHub Personal Access Token is required to push to GitHub' });
  }

  try {
    const cleanRepo = repoName.replace(/^https:\/\/github\.com\//i, '').replace(/\.git$/i, '').trim();
    const targetUrl = `https://${token.trim()}@github.com/${cleanRepo}.git`;
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await execAsync(`git push --force -u "${targetUrl}" main`);
    return res.json({ success: true, message: `Pushed successfully to https://github.com/${cleanRepo}` });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Git push failed. Ensure your token has "repo" permissions and the repository exists on GitHub.',
      details: err.message,
    });
  }
});

app.use('/api', api);

// Vite middleware integration for dev mode
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Pipeline3D server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
