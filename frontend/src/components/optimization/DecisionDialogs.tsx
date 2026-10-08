import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { Optimization } from '@/types';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { ConfidenceBar, GainBar } from '@/components/ui/Progress';
import { SeverityBadge } from '@/components/ui/Badge';
import { formatPercent } from '@/utils/format';

/* ------------------------------------------------------------------ */
/* Approve                                                             */
/* ------------------------------------------------------------------ */

interface ApproveDialogProps {
  optimization: Optimization | null;
  pending: boolean;
  onConfirm: (note: string) => void;
  onClose: () => void;
}

/**
 * Approval confirmation.
 * Restates exactly what will be executed so the operator approves a statement,
 * not a label.
 */
export function ApproveDialog({
  optimization,
  pending,
  onConfirm,
  onClose,
}: ApproveDialogProps) {
  const [note, setNote] = useState('');

  if (!optimization) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Approve optimization"
      description="The statement below will be queued for the execution layer. Nothing is executed by this frontend."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="success"
            loading={pending}
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            onClick={() => onConfirm(note.trim())}
          >
            Approve &amp; apply
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={optimization.problem.severity} />
          <span className="font-mono text-2xs text-base-400">{optimization.id}</span>
          <span className="text-sm text-base-50">{optimization.title}</span>
        </div>

        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-base-700/70 bg-base-950/70 px-3 py-2.5 font-mono text-xs leading-relaxed text-base-100">
          {optimization.statement}
        </pre>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-2xs uppercase tracking-wider text-base-400">Confidence</p>
            <div className="mt-1.5">
              <ConfidenceBar value={optimization.confidence} />
            </div>
          </div>
          <div>
            <p className="text-2xs uppercase tracking-wider text-base-400">Expected improvement</p>
            <div className="mt-1.5">
              <GainBar value={optimization.expectedGain} showSign={false} />
            </div>
          </div>
        </div>

        {optimization.risks.length > 0 ? (
          <div className="rounded-md border border-status-warn/25 bg-status-warn/[0.06] px-3 py-2.5">
            <p className="text-2xs font-semibold uppercase tracking-wider text-status-warn">
              Risks to accept
            </p>
            <ul className="mt-1.5 space-y-1">
              {optimization.risks.map((risk) => (
                <li key={risk} className="text-xs leading-relaxed text-base-200">
                  • {risk}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <label className="block">
          <span className="text-2xs uppercase tracking-wider text-base-400">
            Approval note (optional)
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="e.g. approved for the maintenance window at 02:00"
            className="mt-1.5 w-full resize-y rounded-md border border-base-700/70 bg-base-950/60 px-2.5 py-2 text-xs text-base-50 placeholder:text-base-500 focus:border-accent-500/70 focus:outline-none"
          />
        </label>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Reject                                                              */
/* ------------------------------------------------------------------ */

const QUICK_REASONS = [
  'Projected improvement is within run-to-run variability',
  'Write overhead outweighs the expected read benefit',
  'Requires a maintenance window — defer to the next cycle',
  'Risk is not acceptable for the current workload',
];

interface RejectDialogProps {
  optimization: Optimization | null;
  pending: boolean;
  error: Error | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/**
 * Rejection dialog. A reason is mandatory — rejected recommendations are stored
 * as negative training signal, so the "why" matters as much as the decision.
 */
export function RejectDialog({
  optimization,
  pending,
  error,
  onConfirm,
  onClose,
}: RejectDialogProps) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  if (!optimization) return null;

  const invalid = reason.trim().length < 5;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Reject optimization"
      description="Rejected recommendations are recorded with your reason and kept as negative training signal."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={pending}
            icon={<XCircle className="h-3.5 w-3.5" />}
            onClick={() => {
              setTouched(true);
              if (!invalid) onConfirm(reason.trim());
            }}
          >
            Reject recommendation
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-2xs text-base-400">{optimization.id}</span>
          <span className="text-sm text-base-50">{optimization.title}</span>
          <span className="text-2xs text-base-400">
            (projected {formatPercent(optimization.expectedGain, 0)})
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_REASONS.map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => setReason(quick)}
              className="rounded border border-base-700/70 bg-base-850/60 px-2 py-1 text-2xs text-base-200 transition-colors hover:border-base-600 hover:text-base-50"
            >
              {quick}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-2xs uppercase tracking-wider text-base-400">
            Rejection reason <span className="text-status-danger">*</span>
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => setTouched(true)}
            rows={3}
            autoFocus
            placeholder="Explain why this optimization should not be applied."
            className="mt-1.5 w-full resize-y rounded-md border border-base-700/70 bg-base-950/60 px-2.5 py-2 text-xs leading-relaxed text-base-50 placeholder:text-base-500 focus:border-accent-500/70 focus:outline-none"
          />
        </label>

        {touched && invalid ? (
          <p className="text-2xs text-status-danger">
            Please provide a reason of at least 5 characters.
          </p>
        ) : null}
        {error ? <p className="text-2xs text-status-danger">{error.message}</p> : null}
      </div>
    </Dialog>
  );
}

export { ConfirmDialog };
