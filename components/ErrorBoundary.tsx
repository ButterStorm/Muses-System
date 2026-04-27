'use client';

import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error.name, error.message);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm rounded-lg border border-red-100 bg-white p-5 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-500" />
          <h2 className="text-sm font-semibold text-gray-900">
            {this.props.fallbackTitle || '画布暂时无法显示'}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            当前视图遇到异常，可以刷新后继续操作。
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-black"
          >
            <RefreshCcw size={15} />
            刷新页面
          </button>
        </div>
      </div>
    );
  }
}
