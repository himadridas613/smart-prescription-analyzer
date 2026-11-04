// Hand-written runtime error reporting helper.
// Reports errors caught by the root error boundary to any telemetry hook
// registered on the window, and always logs them to the console.

type ErrorReportContext = Record<string, unknown>;

type ErrorReporter = (
  error: unknown,
  context?: ErrorReportContext,
) => void;

declare global {
  interface Window {
    __appErrorReporter?: ErrorReporter;
  }
}

export function reportError(error: unknown, context: ErrorReportContext = {}) {
  if (typeof window === "undefined") return;

  // Loaders and server fns commonly throw a raw Response; String(it) is the
  // opaque "[object Response]", so pull out the status and URL instead.
  const normalized =
    error instanceof Response
      ? new Error(`Response ${error.status}${error.url ? ` at ${error.url}` : ""}`)
      : error instanceof Error
        ? error
        : new Error(String(error));

  window.__appErrorReporter?.(normalized, {
    source: "react_error_boundary",
    route: window.location.pathname,
    ...context,
  });

  console.error(normalized);
}
