import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Top-level React error boundary. Catches in-render exceptions that escape
 * TanStack Router's route-level errorComponent (e.g. provider-level throws)
 * so users see a readable message instead of a blank page.
 */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("RootErrorBoundary caught:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    const { error } = this.state;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            The app couldn't render
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An unexpected error occurred. Try refreshing the page.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-left text-xs text-muted-foreground">
              {error.message}
            </pre>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => {
                this.reset();
                if (typeof window !== "undefined") window.location.reload();
              }}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Refresh
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
