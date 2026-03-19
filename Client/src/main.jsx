// FOLLO PERF-2
import './instrument.js'; // MUST be first — Sentry init before all other modules

import { createRoot } from 'react-dom/client';
import { reactErrorHandler } from '@sentry/react'; // React 19 error handler
import './index.css';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';
import { store } from './app/store.js';
import { Provider } from 'react-redux';
import { ClerkProvider } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key');
}

// FOLLO NOTIFY — Register service worker for push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[SW] Registration failed:', err);
    });
  });
}

// React 19: pass reactErrorHandler to all three createRoot error hooks
createRoot(document.getElementById('root'), {
  onUncaughtError:   reactErrorHandler(),
  onCaughtError:     reactErrorHandler(),
  onRecoverableError: reactErrorHandler(),
}).render(
  <BrowserRouter>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <Provider store={store}>
        <App />
      </Provider>
    </ClerkProvider>
  </BrowserRouter>,
);
