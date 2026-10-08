import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { AgentDbServices } from './contracts';
import { createServices } from './createServices';

interface ServicesContextValue {
  services: AgentDbServices;
  /** Increments whenever the underlying data changes. */
  revision: number;
}

const ServicesContext = createContext<ServicesContextValue | null>(null);

interface ServiceProviderProps {
  children: ReactNode;
  /** Inject a specific container (used by tests). Defaults to the factory. */
  services?: AgentDbServices;
}

/**
 * Provides the service container to the whole application and exposes a
 * revision counter that views subscribe to. Mutating a mock service bumps the
 * revision, which is how an approval on one page instantly updates the pending
 * count, the history and the activity feed everywhere else.
 */
export function ServiceProvider({ children, services: injected }: ServiceProviderProps) {
  const [services] = useState<AgentDbServices>(() => injected ?? createServices());
  const revision = useSyncExternalStore(
    services.subscribe,
    services.getRevision,
    services.getRevision,
  );

  const value = useMemo<ServicesContextValue>(
    () => ({ services, revision }),
    [services, revision],
  );

  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useServicesContext(): ServicesContextValue {
  const context = useContext(ServicesContext);
  if (context === null) {
    throw new Error('useServicesContext must be used inside <ServiceProvider>.');
  }
  return context;
}

export function useServices(): AgentDbServices {
  return useServicesContext().services;
}

export function useDataRevision(): number {
  return useServicesContext().revision;
}
