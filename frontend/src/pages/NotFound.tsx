import { Link } from 'react-router-dom';
import { Compass, Search } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { LinkButton } from '@/components/ui/Button';
import { NAVIGATION } from '@/app/navigation';

/** 404 page — offers the full route map rather than a dead end. */
export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 py-8">
      <div className="text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-base-700/70 bg-base-850">
          <Compass className="h-4 w-4 text-base-300" aria-hidden />
        </span>
        <h1 className="mt-3 text-lg font-semibold text-base-50">Page not found</h1>
        <p className="mt-1 text-sm text-base-300">
          The route you requested does not exist in the AgentDB console.
        </p>
      </div>

      <Panel>
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-base-400" aria-hidden />
          <h2 className="panel-title">Available pages</h2>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NAVIGATION.map((section) => (
            <div key={section.label}>
              <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-base-500">
                {section.label}
              </p>
              <ul className="mt-2 space-y-1">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="flex items-center gap-2 rounded px-2 py-1 text-xs text-base-200 transition-colors hover:bg-base-850/70 hover:text-base-50"
                    >
                      <item.icon className="h-3.5 w-3.5 text-base-400" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      <div className="flex justify-center">
        <LinkButton to="/" variant="primary">
          Back to dashboard
        </LinkButton>
      </div>
    </div>
  );
}
