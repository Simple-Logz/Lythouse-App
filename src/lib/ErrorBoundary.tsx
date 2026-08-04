// @ts-nocheck
import { Component } from 'react';

// App-wide error boundary: catches render/runtime errors so users see a
// friendly recovery screen instead of a blank white page. Reports to an
// optional error-tracking hook (e.g. Sentry) if one is registered on
// window.__errorReporter — see reportError() below.
export function reportError(error, info) {
  try {
    // eslint-disable-next-line no-console
    console.error('[LytHouse] Uncaught error:', error, info);
    if (typeof window !== 'undefined' && typeof window.__errorReporter === 'function') {
      window.__errorReporter(error, info);
    }
  } catch { /* never let reporting crash the app */ }
}

export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { reportError(error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full rounded-2xl border border-[#18181b] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-[#dc2626] text-xl font-bold">!</div>
            <h1 className="text-lg font-bold text-navy-900">Something went wrong</h1>
            <p className="mt-1.5 text-sm text-gray-500">The page hit an unexpected error. Reloading usually fixes it. If it keeps happening, let us know.</p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <button onClick={() => window.location.reload()} className="btn-primary text-sm">Reload</button>
              <button onClick={() => { window.location.href = '/'; }} className="btn-secondary text-sm">Go home</button>
            </div>
            {this.state.error?.message && <p className="mt-4 text-[11px] text-gray-400 break-words">{String(this.state.error.message)}</p>}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
export default ErrorBoundary;
