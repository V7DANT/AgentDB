import {
  Activity,
  BarChart3,
  Database,
  GitBranch,
  LayoutDashboard,
  Settings2,
  Sigma,
  Sparkles,
  Table2,
  Terminal,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Shows the pending-recommendation counter next to the item. */
  badge?: 'pending';
  end?: boolean;
  description?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Sidebar information architecture.
 *
 * Only pages that are backed by data available from PostgreSQL today (or from
 * the committed benchmark result files) appear here:
 *
 *   Observe  → Dashboard, Queries, Execution Plans
 *   Inspect  → Tables, Indexes, Configuration
 *   Act      → Recommendations
 *   Measure  → Agent Activity, History
 *   Experiment → Benchmarks
 */
export const NAVIGATION: NavSection[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Dashboard',
        to: '/',
        icon: LayoutDashboard,
        end: true,
        description: 'Database state and recent activity',
      },
    ],
  },
  {
    label: 'Workload',
    items: [
      {
        label: 'Queries',
        to: '/queries',
        icon: Terminal,
        description: 'pg_stat_statements workload',
      },
      {
        label: 'Execution Plans',
        to: '/plans',
        icon: GitBranch,
        description: 'EXPLAIN plan trees',
      },
    ],
  },
  {
    label: 'Database',
    items: [
      { label: 'Tables', to: '/tables', icon: Table2, description: 'Table statistics' },
      { label: 'Indexes', to: '/indexes', icon: Sigma, description: 'Index inventory and usage' },
      {
        label: 'Configuration',
        to: '/configuration',
        icon: Settings2,
        description: 'PostgreSQL parameters',
      },
    ],
  },
  {
    label: 'Optimization',
    items: [
      {
        label: 'Recommendations',
        to: '/recommendations',
        icon: Sparkles,
        badge: 'pending',
        description: 'Detected problems and proposed changes',
      },
      {
        label: 'Agent Activity',
        to: '/agent/activity',
        icon: Activity,
        description: 'Decision cycle event log',
      },
      {
        label: 'History',
        to: '/history',
        icon: Workflow,
        description: 'Applied changes and measured results',
      },
    ],
  },
  {
    label: 'Experiments',
    items: [
      {
        label: 'Benchmarks',
        to: '/benchmarks',
        icon: BarChart3,
        description: 'Sysbench S1/S2 results',
      },
    ],
  },
];

export { Database };
