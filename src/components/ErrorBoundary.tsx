import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : 'Terjadi kesalahan saat menampilkan halaman.';
    return {
      hasError: true,
      errorMessage: message,
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('CBT UI ErrorBoundary caught error:', error, info);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleResetCacheAndReload = async (): Promise<void> => {
    try {
      const keysToClear = [
        'cbt_admin_settings',
        'pusmendik_cbt_packages_v1',
        'pusmendik_cbt_schedules_v1',
        'pusmendik_cbt_participants_v1',
        'pusmendik_cbt_proctors_v1',
        'pusmendik_cbt_history_v1',
      ];
      keysToClear.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {
          // ignore
        }
      });
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      }
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n).catch(() => false)));
      }
    } catch {
      // ignore cleanup error
    }
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#eef1f6] flex items-center justify-center p-4 text-slate-800">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">
                Tampilan Mengalami Kendala
              </h1>
              <p className="text-xs text-slate-500">
                Sistem mencegah layar kosong dan siap dipulihkan.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-mono break-words">
            {this.state.errorMessage || 'Kesalahan render tidak terduga.'}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={this.handleReload}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#001a6e] hover:bg-[#001455] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat Ulang Halaman</span>
            </button>
            <button
              type="button"
              onClick={this.handleResetCacheAndReload}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Bersihkan Cache</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
