import { Component, ErrorInfo, ReactNode } from 'react';
/* eslint-disable @typescript-eslint/no-unused-vars */
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-gray-50 rounded-xl border border-gray-200">
                    <div className="bg-red-100 p-4 rounded-full mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
                    <p className="text-gray-600 mb-6 max-w-md">
                        We encountered an unexpected error while loading this section.
                        {this.state.error && (
                            <span className="block mt-2 text-xs font-mono bg-gray-100 p-2 rounded text-left overflow-auto max-h-32">
                                {this.state.error.message}
                            </span>
                        )}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
