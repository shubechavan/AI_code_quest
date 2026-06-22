import { useMemo } from 'react';
import ReactFlow, { Background, Controls, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';

import { fmtCurrency } from '../../lib/format.js';

/**
 * Transaction-network visualization.
 *
 * Renders the local subgraph around the focus account using a deterministic columnar
 * layout (sources on the left, focus in the centre, destinations on the right). Node
 * styling encodes role — focus, sanctioned, and ordinary counterparties are visually
 * distinct — so the structural story (funnel → sanctioned) reads immediately. A columnar
 * layout is clearer for a funnel than a force-directed cloud, and the subgraphs are small.
 */
function AccountNode({ data }) {
  const styles = {
    focus: 'border-accent-500/60 bg-accent-500/15 text-accent-300',
    sanctioned: 'border-rose-500/60 bg-rose-500/15 text-rose-300',
    normal: 'border-line bg-elevated text-muted',
  };
  return (
    <div className={`min-w-[124px] rounded-lg border px-3 py-2 text-center ${styles[data.role]}`}>
      <Handle type="target" position={Position.Left} className="!bg-faint" />
      <div className="font-mono text-xs font-medium">{data.label}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-70">{data.role}</div>
      <Handle type="source" position={Position.Right} className="!bg-faint" />
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

    const sources = new Set(edges.filter((e) => e.target === focusAccount).map((e) => e.source));
    const role = (a) =>
      a === focusAccount ? 'focus' : sanctionedSet.has(a) ? 'sanctioned' : 'normal';
    const column = (a) => (a === focusAccount ? 1 : sources.has(a) ? 0 : 2);

    const byColumn = { 0: [], 1: [], 2: [] };
    [...accounts].forEach((a) => byColumn[column(a)].push(a));

    const nodes = [];
    Object.entries(byColumn).forEach(([col, accts]) => {
      accts.forEach((a, i) => {
        nodes.push({
          id: a,
          type: 'account',
          position: { x: Number(col) * 260, y: i * 92 + 20 },
          data: { label: a, role: role(a) },
        });
      });
    });

    const flowEdges = edges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      label: fmtCurrency(e.amount),
      animated: e.target === focusAccount || sanctionedSet.has(e.target),
      style: { stroke: sanctionedSet.has(e.target) ? '#f43f5e' : 'rgb(var(--faint))', strokeWidth: 1.5 },
      labelStyle: { fontSize: 10, fill: 'rgb(var(--muted))' },
      labelBgStyle: { fill: 'rgb(var(--surface))' },
      labelBgPadding: [4, 2],
    }));

    return { nodes, flowEdges };
  }, [edges, focusAccount, sanctioned]);

  return (
    <div className="ds-flow h-[340px] w-full overflow-hidden rounded-lg border border-line bg-base">
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
        <Background color="rgb(var(--line))" gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
