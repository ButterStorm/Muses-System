import {
  createBashToolDefinition,
  createEditToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  type ToolDefinition,
} from '@mariozechner/pi-coding-agent';
import type { AgentSandboxRuntime } from './types';

export function buildSandboxedCoreTools(runtime: AgentSandboxRuntime): ToolDefinition[] {
  return [
    createReadToolDefinition(runtime.cwd, {
      operations: {
        readFile: (absolutePath) => runtime.readFile(absolutePath),
        access: (absolutePath) => runtime.access(absolutePath),
      },
    }) as ToolDefinition,
    createBashToolDefinition(runtime.cwd, {
      operations: {
        exec: (command, cwd, options) => runtime.exec(command, cwd, options),
      },
    }) as ToolDefinition,
    createWriteToolDefinition(runtime.cwd, {
      operations: {
        writeFile: (absolutePath, content) => runtime.writeFile(absolutePath, content),
        mkdir: (dir) => runtime.mkdir(dir),
      },
    }) as ToolDefinition,
    createEditToolDefinition(runtime.cwd, {
      operations: {
        readFile: (absolutePath) => runtime.readFile(absolutePath),
        writeFile: (absolutePath, content) => runtime.writeFile(absolutePath, content),
        access: (absolutePath) => runtime.access(absolutePath),
      },
    }) as ToolDefinition,
  ];
}

export function isE2BSandboxEnabled(): boolean {
  const provider = process.env.AGENT_SANDBOX_PROVIDER?.trim().toLowerCase();
  if (provider) return provider === 'e2b';
  return Boolean(process.env.E2B_API_KEY?.trim());
}
