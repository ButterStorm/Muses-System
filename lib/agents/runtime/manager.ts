import type { AgentSandboxRuntime } from '@/lib/agents/sandbox/types';
import type { AgentRuntimeEntry, AgentRuntimeId, AgentRuntimeSession } from './types';

const DEFAULT_RUNTIME_TTL_MS = 30 * 60_000;
const runtimes = new Map<AgentRuntimeId, AgentRuntimeEntry>();

interface GetOrCreateRuntimeOptions {
  runtimeId: AgentRuntimeId;
  model: string;
  createSession: (model: string, sandboxRuntime?: AgentSandboxRuntime) => Promise<AgentRuntimeSession>;
  now?: number;
  ttlMs?: number;
}

export async function getOrCreateAgentRuntime({
  runtimeId,
  model,
  createSession,
  now = Date.now(),
  ttlMs = DEFAULT_RUNTIME_TTL_MS,
}: GetOrCreateRuntimeOptions): Promise<AgentRuntimeEntry> {
  await cleanupAgentRuntimes({ now, ttlMs });

  const current = runtimes.get(runtimeId);
  if (current && current.model === model) {
    current.lastActiveAt = now;
    return current;
  }

  if (current) {
    await current.session.dispose();
    runtimes.delete(runtimeId);
  }

  const session = await createSession(model);
  const entry: AgentRuntimeEntry = {
    runtimeId,
    model,
    session,
    createdAt: now,
    lastActiveAt: now,
    isStreaming: false,
  };
  runtimes.set(runtimeId, entry);
  return entry;
}

export function acquireRuntimeLock(runtimeId: AgentRuntimeId): () => void {
  const entry = runtimes.get(runtimeId);
  if (!entry) {
    throw new Error(`AGENT_RUNTIME_NOT_FOUND:${runtimeId}`);
  }

  if (entry.isStreaming) {
    throw new Error('AGENT_RUNTIME_BUSY');
  }

  entry.isStreaming = true;
  return () => {
    const current = runtimes.get(runtimeId);
    if (current) {
      current.isStreaming = false;
      current.lastActiveAt = Date.now();
    }
  };
}

export function hasMatchingAgentRuntime(runtimeId: AgentRuntimeId, model: string): boolean {
  const entry = runtimes.get(runtimeId);
  return Boolean(entry && entry.model === model);
}

export function getAgentRuntime(runtimeId: AgentRuntimeId): AgentRuntimeEntry | undefined {
  const entry = runtimes.get(runtimeId);
  if (entry) {
    entry.lastActiveAt = Date.now();
  }
  return entry;
}

export async function getRequiredSandboxRuntime(runtimeId: AgentRuntimeId): Promise<AgentSandboxRuntime> {
  const entry = getAgentRuntime(runtimeId);
  if (!entry) {
    throw new Error(`AGENT_RUNTIME_NOT_FOUND:${runtimeId}`);
  }

  const sandboxRuntime = entry.session.sandboxRuntime;
  if (!sandboxRuntime || (sandboxRuntime.isStarted && !sandboxRuntime.isStarted())) {
    throw new Error(`AGENT_SANDBOX_NOT_STARTED:${runtimeId}`);
  }

  return sandboxRuntime;
}

export async function resetAgentRuntimeContext({
  runtimeId,
  model,
  createSession,
  now = Date.now(),
}: {
  runtimeId: AgentRuntimeId;
  model: string;
  createSession: (model: string, sandboxRuntime?: AgentSandboxRuntime) => Promise<AgentRuntimeSession>;
  now?: number;
}): Promise<boolean> {
  const current = runtimes.get(runtimeId);
  if (!current) return false;
  if (current.isStreaming) {
    throw new Error('AGENT_RUNTIME_BUSY');
  }

  const sandboxRuntime = current.session.sandboxRuntime;
  await current.session.dispose({ disposeSandbox: false });
  const session = await createSession(model, sandboxRuntime);
  runtimes.set(runtimeId, {
    runtimeId,
    model,
    session,
    createdAt: now,
    lastActiveAt: now,
    isStreaming: false,
  });
  return true;
}

export async function disposeAgentRuntime(runtimeId: AgentRuntimeId): Promise<void> {
  const entry = runtimes.get(runtimeId);
  if (!entry) return;
  try {
    await entry.session.dispose();
  } finally {
    runtimes.delete(runtimeId);
  }
}

export async function cleanupAgentRuntimes({
  now = Date.now(),
  ttlMs = DEFAULT_RUNTIME_TTL_MS,
}: { now?: number; ttlMs?: number } = {}): Promise<void> {
  for (const [runtimeId, entry] of runtimes) {
    if (now - entry.lastActiveAt > ttlMs) {
      try {
        await entry.session.dispose();
      } catch (error) {
        console.error('[Agent Runtime] Failed to dispose expired runtime:', error);
      } finally {
        runtimes.delete(runtimeId);
      }
    }
  }
}

export async function resetAgentRuntimesForTests(): Promise<void> {
  await Promise.allSettled(
    [...runtimes.values()].map((entry) => entry.session.dispose())
  );
  runtimes.clear();
}
