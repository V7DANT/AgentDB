import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/app/App';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';
import { ServiceProvider } from '@/services';
import './index.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Root container #root was not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <ServiceProvider>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </ServiceProvider>
    </ErrorBoundary>
  </StrictMode>,
);
