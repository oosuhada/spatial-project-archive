import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Memory Museum boundary caught an error', error, info);
    this.props.onError?.(error);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return this.props.fallback ?? (
      <div className="fatal-fallback" role="alert">
        <strong>The spatial view could not be opened.</strong>
        <p>Your archive data is safe. Switch to the 2D gallery and continue working.</p>
      </div>
    );
  }
}

