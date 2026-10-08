import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary.
 * Prevents a single failing page from blanking the whole console.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('AgentDB frontend error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950 p-6">
        <div className="panel w-full max-w-lg p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-status-danger/30 bg-status-danger/10">
              <AlertOctagon className="h-4 w-4 text-status-danger" aria-hidden />
            </span>
            <h1 className="text-sm font-semibold text-base-50">The dashboard hit an error</h1>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-base-300">
            {error.message}
          </p>
          <pre className="mt-3 max-h-40 overflow-auto rounded border border-base-700/70 bg-base-950/70 p-2.5 font-mono text-2xs leading-relaxed text-base-300">
            {error.stack ?? 'No stack trace available.'}
          </pre>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload dashboard
            </Button>
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
