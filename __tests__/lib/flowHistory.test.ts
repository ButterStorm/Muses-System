import { cloneFlowState } from '@/lib/flowHistory';

describe('cloneFlowState', () => {
  it('deep clones node and edge state without sharing nested data', () => {
    const nodes = [
      { id: 'n1', type: 'textInputNode', position: { x: 1, y: 2 }, data: { text: 'hello' } },
    ];
    const edges = [
      { id: 'e1', source: 'n1', target: 'n2', data: { weight: 1 } },
    ];

    const cloned = cloneFlowState(nodes as never, edges as never);

    expect(cloned.nodes).toEqual(nodes);
    expect(cloned.edges).toEqual(edges);
    expect(cloned.nodes).not.toBe(nodes);
    expect(cloned.nodes[0].data).not.toBe(nodes[0].data);
    expect(cloned.edges[0].data).not.toBe(edges[0].data);
  });
});
