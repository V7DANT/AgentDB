export type ConfigCategory =
  | 'MEMORY'
  | 'CONNECTIONS'
  | 'PLANNER'
  | 'PARALLELISM'
  | 'MAINTENANCE'
  | 'WAL';

export type ConfigStatus = 'DEFAULT' | 'TUNED' | 'SUBOPTIMAL' | 'WARNING';

export interface PgParameter {
  name: string;
  /** Raw value as returned by `SHOW <param>`. */
  currentValue: string;
  /** Numeric byte value when the parameter is a size, for comparison/formatting. */
  bytesValue?: number;
  unit?: string;
  category: ConfigCategory;
  description: string;
  status: ConfigStatus;
  /** Whether the setting requires a restart to take effect. */
  requiresRestart: boolean;
  /** Present when the Configuration Expert has a proposal for this parameter. */
  recommendation?: ParameterRecommendation;
}

export interface ParameterRecommendation {
  currentValue: string;
  recommendedValue: string;
  expectedImprovement: number;
  confidence: number;
  rationale: string;
  source: 'SIMULATED';
}
