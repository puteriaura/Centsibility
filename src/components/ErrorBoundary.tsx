import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card } from "./AppShell";
import { WarningCircle, ArrowsClockwise } from "@phosphor-icons/react";

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
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-4">
          <Card className="max-w-md w-full glass-panel border-nova-red/30 p-6 flex flex-col items-center text-center shadow-[0_0_30px_rgba(255,42,85,0.1)]">
            <WarningCircle weight="duotone" className="w-16 h-16 text-nova-red mb-4" />
            <h1 className="font-kid text-xl font-bold text-starlight mb-2 uppercase tracking-wider">
              System Malfunction
            </h1>
            <p className="font-body text-sm text-starlight/70 mb-6">
              A critical error occurred in this module. The flight computer has halted execution to
              prevent data corruption.
            </p>
            {this.state.error && (
              <div className="w-full bg-void/80 border border-nova-red/20 rounded-xl p-3 mb-6 overflow-auto text-left">
                <code className="text-nova-red text-[10px] font-mono whitespace-pre-wrap">
                  {this.state.error.message}
                </code>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full btn-press rounded-xl bg-nova-red/20 border border-nova-red/30 py-3 flex items-center justify-center gap-2 font-kid text-sm font-bold text-nova-red uppercase tracking-wider hover:bg-nova-red hover:text-white transition"
            >
              <ArrowsClockwise weight="bold" className="w-5 h-5" /> Reboot System
            </button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
