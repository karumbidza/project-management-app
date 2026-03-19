// FOLLO PERF-2
/**
 * Inngest middleware for structured logging of all function runs.
 */

export const loggingMiddleware = {
  name: 'follo-logging',
  init() {
    return {
      onFunctionRun({ ctx, fn }) {
        const start = Date.now();
        console.info(JSON.stringify({
          level:    'info',
          event:    'inngest.function.start',
          function: fn.name,
          eventId:  ctx.event?.id,
          timestamp: new Date().toISOString(),
        }));
        return {
          afterMemoization() {},
          afterExecution()   {},
          beforeResponse() {
            console.info(JSON.stringify({
              level:    'info',
              event:    'inngest.function.complete',
              function: fn.name,
              duration: `${Date.now() - start}ms`,
              eventId:  ctx.event?.id,
              timestamp: new Date().toISOString(),
            }));
          },
        };
      },
    };
  },
};
