import React, { Component, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary with debug/production differentiation.
 *
 * - Debug mode (import.meta.env.DEV): Shows full stack trace for developers.
 * - Production mode: Shows a clean "Something went wrong" card with a Restart button.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = '/';
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDebug = (() => {
      try {
        return import.meta.env.DEV;
      } catch {
        return false;
      }
    })();

    if (isDebug) {
      // ── Debug Mode: Full error details ──
      return (
        <div style={{
          padding: '24px',
          margin: '16px',
          background: '#1a0000',
          border: '2px solid #7f1d1d',
          borderRadius: '12px',
          color: '#fca5a5',
          zIndex: 9999,
          position: 'relative',
          fontFamily: 'monospace',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, color: '#f87171', fontSize: '18px' }}>
              ⚠ Render Error (Debug Mode)
            </h2>
            <button
              onClick={this.handleRestart}
              style={{
                background: '#7f1d1d',
                color: '#fca5a5',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Restart App
            </button>
          </div>
          <p style={{ color: '#ef4444', fontSize: '14px', fontWeight: 600, margin: '0 0 12px 0' }}>
            {this.state.error?.toString()}
          </p>
          <pre style={{
            background: 'rgba(0,0,0,0.4)',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '11px',
            lineHeight: '1.5',
            overflow: 'auto',
            maxHeight: '400px',
            color: '#94a3b8',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }

    // ── Production Mode: Clean user-facing card ──
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#faf8ff',
        fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
      }}>
        <div style={{
          textAlign: 'center',
          padding: '48px',
          maxWidth: '420px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😔</div>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#191b23',
            margin: '0 0 8px 0',
          }}>
            Something went wrong
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#737685',
            margin: '0 0 24px 0',
            lineHeight: '1.5',
          }}>
            An unexpected error occurred. Your data is safe — restarting the app should fix this.
          </p>
          <button
            onClick={this.handleRestart}
            style={{
              background: '#003594',
              color: '#ffffff',
              border: '2px solid #191b23',
              borderRadius: '10px',
              padding: '12px 28px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '2px 2px 0px 0px #191b23',
            }}
          >
            Restart App
          </button>
        </div>
      </div>
    );
  }
}
