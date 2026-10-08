import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Cpu, Filter } from 'lucide-react';
import type { ExecutionPlan, PlanNode } from '@/types';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';
import { formatCompactNumber, formatFixed, formatMs } from '@/utils/format';

const NODE_TONE: Record<string, 'accent' | 'ok' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  'Seq Scan': 'danger',
  'Index Scan': 'ok',
  'Index Only Scan': 'ok',
  'Bitmap Index Scan': 'info',
  'Bitmap Heap Scan': 'warn',
  'Hash Join': 'accent',
  'Nested Loop': 'accent',
  'Merge Join': 'accent',
  Sort: 'warn',
  Aggregate: 'info',
  HashAggregate: 'info',
  GroupAggregate: 'info',
  Limit: 'neutral',
  Hash: 'accent',
};

function toneFor(nodeType: string) {
  return NODE_TONE[nodeType] ?? 'neutral';
}

/**
 * Renders an EXPLAIN plan tree.
 *
 * The layout is a nested list with explicit connector lines rather than an
 * absolutely-positioned graph, so it stays readable at any depth and remains
 * accessible to screen readers.
 */
export function PlanTree({ plan }: { plan: ExecutionPlan }) {
  const [selectedId, setSelectedId] = useState<string>(plan.root.id);
  const nodes = flatten(plan.root);
  const selected = nodes.find((node) => node.id === selectedId) ?? plan.root;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="panel overflow-hidden">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Plan tree</h2>
            <p className="mt-0.5 text-xs text-base-300">
              Select a node to inspect its estimates and measurements.
            </p>
          </div>
          <div className="flex items-center gap-2 text-2xs text-base-400">
            <span>planning {formatMs(plan.planningTimeMs, 3)}</span>
            <span>·</span>
            <span>execution {formatMs(plan.executionTimeMs)}</span>
          </div>
        </div>
        <div className="overflow-x-auto p-3">
          <PlanTreeBranch
            node={plan.root}
            depth={0}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isLast
          />
        </div>
      </div>

      <PlanNodeInspector node={selected} />
    </div>
  );
}

function PlanTreeBranch({
  node,
  depth,
  selectedId,
  onSelect,
  isLast,
}: {
  node: PlanNode;
  depth: number;
  selectedId: string;
  onSelect: (id: string) => void;
  isLast: boolean;
}) {
  const hasWarning = (node.warnings?.length ?? 0) > 0;

  return (
    <div className="relative">
      <div className={cn('flex items-stretch', depth > 0 && 'pl-5')}>
        {/* Connector */}
        {depth > 0 ? (
          <div className="relative mr-2 w-4 shrink-0">
            <span className="absolute left-0 top-[1.05rem] h-px w-3 bg-base-600" />
            {!isLast ? (
              <span className="absolute left-0 top-0 h-full w-px bg-base-600" />
            ) : (
              <span className="absolute left-0 top-0 h-[1.05rem] w-px bg-base-600" />
            )}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className={cn(
            'mb-1.5 flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors',
            selectedId === node.id
              ? 'border-accent-500/60 bg-accent-500/[0.06]'
              : 'border-base-700/70 bg-base-900/60 hover:border-base-600',
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Badge tone={toneFor(node.nodeType)}>{node.nodeType}</Badge>
            {node.relation ? (
              <span className="truncate font-mono text-xs text-base-100">
                {node.relation}
                {node.alias && node.alias !== node.relation ? (
                  <span className="text-base-400"> {node.alias}</span>
                ) : null}
              </span>
            ) : null}
            {hasWarning ? (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-status-warn" aria-label="Warning" />
            ) : null}
          </span>

          <span className="hidden shrink-0 items-center gap-4 text-2xs text-base-400 sm:flex">
            <span>
              cost{' '}
              <span className="mono-num text-base-200">{formatFixed(node.totalCost, 0)}</span>
            </span>
            <span>
              rows{' '}
              <span className="mono-num text-base-200">
                {formatCompactNumber(node.actualRows ?? node.estimatedRows)}
              </span>
            </span>
            <span>
              time{' '}
              <span className="mono-num text-base-200">
                {node.actualTimeMs != null ? `${node.actualTimeMs.toFixed(2)} ms` : '—'}
              </span>
            </span>
          </span>
        </button>
      </div>

      {node.children.length > 0 ? (
        <div>
          {node.children.map((child, index) => (
            <PlanTreeBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              isLast={index === node.children.length - 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PlanNodeInspector({ node }: { node: PlanNode }) {
  const rowEstimateError =
    node.actualRows != null && node.actualRows > 0 && node.estimatedRows > 0
      ? node.actualRows / node.estimatedRows
      : null;

  return (
    <div className="panel h-fit p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-base-50">Node inspector</h3>
        <Badge tone={toneFor(node.nodeType)}>{node.nodeType}</Badge>
      </div>

      <dl className="mt-3 divide-y divide-base-800/70">
        <Row label="Relation" value={node.relation ?? '—'} mono />
        <Row label="Estimated cost" value={formatFixed(node.totalCost, 2)} mono />
        <Row label="Estimated rows" value={formatCompactNumber(node.estimatedRows)} mono />
        <Row label="Actual rows" value={node.actualRows != null ? formatCompactNumber(node.actualRows) : '—'} mono />
        <Row label="Actual time" value={node.actualTimeMs != null ? formatMs(node.actualTimeMs) : '—'} mono />
        <Row label="Loops" value={formatCompactNumber(node.loops)} mono />
        <Row
          label="Rows removed"
          value={node.rowsRemovedByFilter != null ? formatCompactNumber(node.rowsRemovedByFilter) : '—'}
          mono
        />
        {rowEstimateError !== null ? (
          <Row
            label="Estimate error"
            value={`×${rowEstimateError.toFixed(2)}`}
            mono
            tone={rowEstimateError > 5 || rowEstimateError < 0.2 ? 'warn' : undefined}
          />
        ) : null}
      </dl>

      {node.conditions && node.conditions.length > 0 ? (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-base-400">
            <Filter className="h-3 w-3" aria-hidden />
            Conditions
          </p>
          <ul className="mt-1.5 space-y-1">
            {node.conditions.map((condition) => (
              <li
                key={condition}
                className="rounded border border-base-700/60 bg-base-950/50 px-2 py-1 font-mono text-2xs text-base-200"
              >
                {condition}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {node.warnings && node.warnings.length > 0 ? (
        <div className="mt-3 space-y-2">
          {node.warnings.map((warning) => (
            <div
              key={warning.message}
              className="rounded-md border border-status-warn/25 bg-status-warn/[0.06] px-2.5 py-2"
            >
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-status-warn" aria-hidden />
                <SeverityBadge severity={warning.severity} />
              </div>
              <p className="mt-1 text-2xs leading-relaxed text-base-200">{warning.message}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-2xs text-base-400">
          <Cpu className="h-3 w-3" aria-hidden />
          No bottleneck flagged on this node.
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'warn';
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="text-xs text-base-300">{label}</dt>
      <dd
        className={cn(
          'text-xs',
          mono && 'font-mono tabular-nums',
          tone === 'warn' ? 'text-status-warn' : 'text-base-50',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function flatten(node: PlanNode): PlanNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

/** Compact list of the flagged bottlenecks, used above the tree. */
export function BottleneckList({ plan }: { plan: ExecutionPlan }) {
  if (plan.bottlenecks.length === 0) {
    return (
      <div className="rounded-md border border-status-ok/25 bg-status-ok/[0.06] px-3 py-2.5 text-xs text-status-ok">
        No bottleneck above the configured threshold was detected in this plan.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {plan.bottlenecks.map((bottleneck) => (
        <div
          key={bottleneck.nodeId}
          className={cn(
            'flex items-start gap-2.5 rounded-md border px-3 py-2.5',
            bottleneck.severity === 'HIGH'
              ? 'border-status-danger/25 bg-status-danger/[0.06]'
              : 'border-status-warn/25 bg-status-warn/[0.06]',
          )}
        >
          <AlertTriangle
            className={cn(
              'mt-px h-3.5 w-3.5 shrink-0',
              bottleneck.severity === 'HIGH' ? 'text-status-danger' : 'text-status-warn',
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={bottleneck.severity} />
              <span className="text-xs font-medium text-base-50">
                {bottleneck.nodeType}
                {bottleneck.relation ? ` on ${bottleneck.relation}` : ''}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-base-200">{bottleneck.message}</p>
            <p className="mt-0.5 font-mono text-2xs text-base-400">
              {formatCompactNumber(bottleneck.rowsExamined)} rows examined
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
