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
  cleanupAgentRuntimes({ now, ttlMs });

  const current = runtimes.get(runtimeId);
  if (current && current.model === model) {
    current.lastActiveAt = now;
    return current;
  }

  if (current) {
    current.session.dispose();
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
  current.session.dispose({ disposeSandbox: false });
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

export function disposeAgentRuntime(runtimeId: AgentRuntimeId): void {
  const entry = runtimes.get(runtimeId);
  if (!entry) return;
  entry.session.dispose();
  runtimes.delete(runtimeId);
}

export function cleanupAgentRuntimes({
  now = Date.now(),
  ttlMs = DEFAULT_RUNTIME_TTL_MS,
}: { now?: number; ttlMs?: number } = {}): void {
  for (const [runtimeId, entry] of runtimes) {
    if (now - entry.lastActiveAt > ttlMs) {
      entry.session.dispose();
      runtimes.delete(runtimeId);
    }
  }
}

export function resetAgentRuntimesForTests(): void {
  for (const entry of runtimes.values()) {
    entry.session.dispose();
  }
  runtimes.clear();
}
