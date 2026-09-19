import { Component, ErrorInfo, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/ui/app-icon";

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
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--surface-pink)]">
          <Card
            variant="default"
            className="max-w-md w-full p-8 text-center rounded-3xl shadow-lg border border-[var(--border)]"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--error-soft)] text-[var(--error)] flex items-center justify-center">
              <AppIcon name="close" size={32} />
            </div>
            <h1 className="text-2xl font-extrabold text-[var(--ink)]">System Malfunction</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
              A critical error occurred in this module. The application halted execution to prevent
              data inconsistency.
            </p>
            {this.state.error && (
              <div className="mt-4 p-3 rounded-xl bg-[var(--surface-soft)] border border-[var(--border)] text-left overflow-auto max-h-32 text-xs font-mono text-[var(--error)]">
                <code>{this.state.error.message}</code>
              </div>
            )}
            <Button
              variant="primary"
              onClick={() => window.location.reload()}
              className="w-full justify-center mt-6 font-bold"
            >
              <AppIcon name="recall" size={16} />
              Reboot Application
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
