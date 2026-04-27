import type { Edge, Node } from '@xyflow/react';

export interface FlowHistoryState {
  nodes: Node[];
  edges: Edge[];
}

export function cloneFlowState(nodes: Node[], edges: Edge[]): FlowHistoryState {
  return {
    nodes: clone(nodes),
    edges: clone(edges),
  };
}

export function cloneNodes<T>(nodes: T[]): T[] {
  return clone(nodes);
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
