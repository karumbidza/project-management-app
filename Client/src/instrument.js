// FOLLO PERF-2
// IMPORTANT: This file must be the very first import in main.jsx
// Sentry must instrument the runtime before React or any other module loads.

import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,

  // Only active in production builds with a DSN configured
  enabled: !!import.meta.env.VITE_SENTRY_DSN && import.meta.env.PROD,

  environment: import.meta.env.MODE,
  release:     import.meta.env.VITE_APP_VERSION,

  sendDefaultPii: true,

  integrations: [
    // React Router v7 tracing — hooks variant (using <BrowserRouter> + <Routes>)
    Sentry.reactRouterV6BrowserTracingIntegration({
      useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
    Sentry.replayIntegration({
      maskAllText:   true,  // privacy-compliant: mask all text in replays
      blockAllMedia: false,
    }),
  ],

  // Tracing
  tracesSampleRate:        0.1,  // 10% of transactions in production
  tracePropagationTargets: ['localhost', /^https:\/\/follo\.app/],

  // Session Replay
  replaysSessionSampleRate: 0.05, // 5% of all sessions
  replaysOnErrorSampleRate: 1.0,  // 100% of sessions with errors

  // Structured logging via Sentry.logger.*
  enableLogs: true,
});
