import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <section className="wireframe-card" style={{ maxWidth: "500px", margin: "2rem auto" }}>
          <div>
            <span className="wireframe-icon">[icon: error]</span>
            <h1>System Malfunction</h1>
          </div>
          <p>
            A critical error occurred in this module. The flight computer has halted execution to
            prevent data corruption.
          </p>
          {this.state.error && (
            <div className="wireframe-box" style={{ overflow: "auto" }}>
              <code>{this.state.error.message}</code>
            </div>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ width: "100%", marginTop: "1rem" }}
          >
            [icon: refresh] Reboot System
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}
