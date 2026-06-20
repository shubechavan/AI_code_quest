import { useMemo } from 'react';
import ReactFlow, { Background, Controls, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';

import { fmtCurrency } from '../../lib/format.js';

/**
 * Transaction-network visualization.
 *
 * Renders the local subgraph around the focus account using a simple deterministic layout
 * (sources on the left, focus in the centre, destinations on the right). Node styling
 * encodes role: the focus account, sanctioned entities, and ordinary counterparties are
 * visually distinct so the structural story (funnel → sanctioned) reads immediately.
 *
 * We compute layout ourselves rather than pulling a layout engine — the subgraphs are
 * small and a columnar layout is clearer for a funnel than a force-directed cloud.
 */
function AccountNode({ data }) {
  const styles = {
    focus: 'border-accent-500 bg-accent-50 text-accent-800',
    sanctioned: 'border-red-400 bg-red-50 text-red-800',
    normal: 'border-neutral-300 bg-white text-neutral-700',
  };
  return (
    <div
      className={`min-w-[120px] rounded-md border px-3 py-2 text-center shadow-card ${styles[data.role]}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-neutral-400" />
      <div className="font-mono text-xs font-medium">{data.label}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-60">{data.role}</div>
      <Handle type="source" position={Position.Right} className="!bg-neutral-400" />
    </div>
  );
}

const nodeTypes = { account: AccountNode };

export function NetworkGraph({ edges, focusAccount, sanctioned = [] }) {
  const { nodes, flowEdges } = useMemo(() => {
    const sanctionedSet = new Set(sanctioned);
    const accounts = new Set();
    edges.forEach((e) => {
      accounts.add(e.source);
      accounts.add(e.target);
    });

    // Column assignment: predecessors of focus = left, focus = centre, rest = right.
    const sources = new Set(edges.filter((e) => e.target === focusAccount).map((e) => e.source));
    const role = (acct) =>
      acct === focusAccount ? 'focus' : sanctionedSet.has(acct) ? 'sanctioned' : 'normal';
    const column = (acct) =>
      acct === focusAccount ? 1 : sources.has(acct) ? 0 : 2;

    const byColumn = { 0: [], 1: [], 2: [] };
    [...accounts].forEach((a) => byColumn[column(a)].push(a));

    const nodes = [];
    Object.entries(byColumn).forEach(([col, accts]) => {
      accts.forEach((acct, i) => {
        nodes.push({
          id: acct,
          type: 'account',
          position: { x: Number(col) * 260, y: i * 90 + 20 },
          data: { label: acct, role: role(acct) },
        });
      });
    });

    const flowEdges = edges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      label: fmtCurrency(e.amount),
      animated: e.target === focusAccount || sanctionedSet.has(e.target),
      style: { stroke: sanctionedSet.has(e.target) ? '#dc2626' : '#94a3b8' },
      labelStyle: { fontSize: 10, fill: '#64748b' },
      labelBgStyle: { fill: '#fff' },
    }));

    return { nodes, flowEdges };
  }, [edges, focusAccount, sanctioned]);

  return (
    <div className="h-[340px] w-full rounded-md border border-neutral-200 bg-neutral-50">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background color="#e5e5e5" gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
