import { useCallback, useState, type ReactNode } from 'react';
import type { Optimization } from '@/types';
import { useMutation } from '@/hooks';
import { useServices } from '@/services';
import { useToast } from '@/components/ui/Toast';
import { ApproveDialog, RejectDialog } from './DecisionDialogs';

export interface OptimizationDecisions {
  /** Opens the approval confirmation for a recommendation. */
  requestApprove: (optimization: Optimization) => void;
  /** Opens the rejection dialog for a recommendation. */
  requestReject: (optimization: Optimization) => void;
  approvePending: boolean;
  rejectPending: boolean;
  /** Render this once; it hosts both modal dialogs. */
  dialogs: ReactNode;
}

/**
 * Encapsulates the approve / reject workflow.
 *
 * The mutation goes through the service container, so the same code will drive
 * `ApiOptimizationService` once the backend exists. Because every mock mutation
 * notifies the runtime, the recommendation list, pending count, history and
 * activity feed all refresh automatically — no manual cache invalidation.
 */
export function useOptimizationDecisions(onDecided?: () => void): OptimizationDecisions {
  const services = useServices();
  const toast = useToast();

  const [approveTarget, setApproveTarget] = useState<Optimization | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Optimization | null>(null);

  const approveMutation = useMutation((id: string, note: string) =>
    services.optimizations.approve({ id, note, reviewer: 'operator' }),
  );
  const rejectMutation = useMutation((id: string, reason: string) =>
    services.optimizations.reject({ id, reason, reviewer: 'operator' }),
  );

  const requestApprove = useCallback((optimization: Optimization) => {
    setApproveTarget(optimization);
  }, []);

  const requestReject = useCallback((optimization: Optimization) => {
    setRejectTarget(optimization);
  }, []);

  const confirmApprove = useCallback(
    async (note: string) => {
      if (!approveTarget) return;
      try {
        await approveMutation.run(approveTarget.id, note);
        toast.push({
          tone: 'success',
          title: 'Optimization approved',
          description: `${approveTarget.title} was recorded in the optimization history and added to the activity log.`,
        });
        setApproveTarget(null);
        onDecided?.();
      } catch (error) {
        toast.push({
          tone: 'error',
          title: 'Approval failed',
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
    [approveMutation, approveTarget, onDecided, toast],
  );

  const confirmReject = useCallback(
    async (reason: string) => {
      if (!rejectTarget) return;
      try {
        await rejectMutation.run(rejectTarget.id, reason);
        toast.push({
          tone: 'warning',
          title: 'Optimization rejected',
          description: `${rejectTarget.title} was recorded with your reason.`,
        });
        setRejectTarget(null);
        onDecided?.();
      } catch (error) {
        toast.push({
          tone: 'error',
          title: 'Rejection failed',
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
    [onDecided, rejectMutation, rejectTarget, toast],
  );

  const dialogs = (
    <>
      <ApproveDialog
        optimization={approveTarget}
        pending={approveMutation.pending}
        onConfirm={confirmApprove}
        onClose={() => setApproveTarget(null)}
      />
      <RejectDialog
        optimization={rejectTarget}
        pending={rejectMutation.pending}
        error={rejectMutation.error}
        onConfirm={confirmReject}
        onClose={() => {
          rejectMutation.reset();
          setRejectTarget(null);
        }}
      />
    </>
  );

  return {
    requestApprove,
    requestReject,
    approvePending: approveMutation.pending,
    rejectPending: rejectMutation.pending,
    dialogs,
  };
}
