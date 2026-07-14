import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** When this changes (e.g. route path), a caught error is cleared so
   *  navigating away from a crashed screen recovers without a reload. */
  resetKey?: string;
  /** Center the panel in the full viewport (for the app-root boundary). */
  fullScreen?: boolean;
}

export class ErrorBoundary extends Component<Props, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      const panel = (
        <div className="card p-10 text-center max-w-md mx-auto my-12">
          <div className="font-display text-lg text-ink">Something went wrong</div>
          <div className="text-sm text-muted mt-1">
            This screen hit an unexpected error. Reloading usually fixes it.
          </div>
          <button className="btn-primary mt-5" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      );
      return this.props.fullScreen ? (
        <div className="min-h-screen bg-cream flex items-center justify-center p-6">{panel}</div>
      ) : (
        panel
      );
    }
    return this.props.children;
  }
}
