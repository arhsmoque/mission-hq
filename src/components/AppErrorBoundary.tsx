import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App render failed:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-bg p-6 text-text">
        <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-red">
              Mission Room hit a problem
            </p>
            <h1 className="mt-2 font-display text-2xl font-black text-primary">
              Your work is not gone
            </h1>
            <p className="mt-3 text-sm text-text-2">
              The app crashed while showing this screen. Reload to recover, or go back home and open the mission again.
            </p>
            <pre className="mt-4 max-h-32 overflow-auto rounded-xl bg-bg-2 p-3 text-xs text-text-3">
              {this.state.error.message}
            </pre>
            <div className="mt-5 flex gap-3">
              <button
                className="flex-1 rounded-xl bg-accent px-4 py-3 font-bold text-white"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
              <button
                className="rounded-xl bg-bg-2 px-4 py-3 font-semibold text-text-2"
                onClick={() => window.location.assign('/')}
              >
                Home
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }
}
