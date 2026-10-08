export type ActivityType =
  | 'OBSERVATION'
  | 'ANALYSIS'
  | 'EXPERT_INVOKED'
  | 'RECOMMENDATION'
  | 'VALIDATION'
  | 'APPROVAL'
  | 'REJECTION'
  | 'EXECUTION'
  | 'BENCHMARK'
  | 'LEARNING'
  | 'SYSTEM';

export type ActivityLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export interface ActivityEvent {
  id: string;
  /** ISO timestamp. */
  timestamp: string;
  type: ActivityType;
  level: ActivityLevel;
  message: string;
  detail?: string;
  /** Source actor: "agent", "operator", "validator", an expert id, etc. */
  actor: string;
  /** ID of a related optimization / experience / benchmark, when applicable. */
  relatedId?: string;
  /** Short human label for the related entity. */
  relatedLabel?: string;
}
