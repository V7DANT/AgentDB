import type { OptimizationRecord } from '@/types';
import { OptimizationStatusBadge, ValidationBadge } from '@/components/ui/Badge';
import { GainBar } from '@/components/ui/Progress';

/** Compact status + result cell shared by the dashboard and history tables. */
export function RecordStatusCell({ record }: { record: OptimizationRecord }) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      <OptimizationStatusBadge status={record.status} />
      {record.actualGain !== undefined ? (
        <GainBar value={record.actualGain} />
      ) : (
        <ValidationBadge status={record.validationStatus} />
      )}
    </span>
  );
}

/** Full validation summary used on the record detail page. */
export function RecordValidationCell({ record }: { record: OptimizationRecord }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <OptimizationStatusBadge status={record.status} />
      <ValidationBadge status={record.validationStatus} />
    </span>
  );
}
