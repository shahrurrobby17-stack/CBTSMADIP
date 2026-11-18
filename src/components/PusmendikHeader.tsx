import React, { useState } from 'react';
import {
  Download,
  LogOut,
  MonitorDown,
  Power,
  ShieldCheck,
  User,
  UserCog,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PusmendikHeaderProps {
  participantName?: string;
  participantCode?: string;
  onLogout?: () => void;
  onOpenProctorModal?: () => void;
  onOpenAdminLogin?: () => void;
  onExitApp?: () => void;
  compact?: boolean;
}

export const TutWuriLogo: React.FC<{ className?: string }> = ({
  className = 'w-14 h-14',
}) => (
  <img
    src="/logo-kemendikbud.svg"
    alt="Logo Kementerian Pendidikan (Tut Wuri Handayani)"
    className={`${className} object-contain select-none`}
  />
);

export const PusmendikHeader: React.FC<PusmendikHeaderProps> = ({
  participantName,
  participantCode,
  onLogout,
  onOpenProctorModal,
  onOpenAdminLogin,
  onExitApp,
  compact = false,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showInstallGuideModal, setShowInstallGuideModal] = useState(false);

  const handleInstallAppClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setShowInstallGuideModal(true);
  };

  const isInIframe =
    typeof window !== 'undefined' && window.self !== window.top;

  return (
    <>
      <header
        className={`relative w-full overflow-hidden bg-[#2b6496] text-white select-none ${
          compact ? 'h-28 md:h-28' : 'min-h-40 md:min-h-[172px] pb-3'
        } transition-all duration-200`}
      >
        {/* Geometric Polygonal Banner Background matching screenshot */}
        <svg
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          viewBox="0 0 1440 200"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="bgBase" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e62a0" />
              <stop offset="45%" stopColor="#286498" />
              <stop offset="100%" stopColor="#2d6392" />
            </linearGradient>
            <linearGradient id="poly1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1470c2" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#1d65a6" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="poly2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1976d2" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#26649b" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="poly3" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#155a96" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#2b6496" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="1440" height="200" fill="url(#bgBase)" />
          {/* Left geometric angular facets exactly like Pusmendik banner */}
          <polygon points="0,0 380,0 240,200 0,200" fill="url(#poly1)" />
          <polygon points="0,75 215,10 315,200 0,200" fill="url(#poly2)" />
          <polygon
            points="0,125 185,200 0,200"
            fill="#13538a"
            fillOpacity="0.55"
          />
          <polygon points="215,10 470,0 315,200" fill="url(#poly3)" />
          <polygon
            points="315,200 470,0 680,200"
            fill="#235b8c"
            fillOpacity="0.35"
          />
        </svg>

        {/* Top Bar Content (pt-10 on mobile so logo & title sit comfortably below the phone front camera) */}
        <div className="relative z-10 max-w-[1400px] mx-auto px-3.5 sm:px-6 md:px-10 pt-10 sm:pt-8 md:pt-3.5 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left Brand Zone: Logo + CBT SMA ISLAM DIPONEGORO WAGIR / APLIKASI SUMATIF AKHIR SEMESTER */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <TutWuriLogo className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 shrink-0 drop-shadow-sm" />
            <div className="leading-tight min-w-0">
              <div className="text-[11.5px] min-[375px]:text-[12.5px] sm:text-[14px] md:text-base font-extrabold tracking-tight sm:tracking-wide text-white uppercase whitespace-nowrap">
                CBT SMA ISLAM DIPONEGORO WAGIR
              </div>
              <div className="text-[10px] min-[375px]:text-[11px] sm:text-xs md:text-[13px] font-normal tracking-tight sm:tracking-wide text-white/95 uppercase mt-0.5 whitespace-nowrap">
                APLIKASI SUMATIF AKHIR SEMESTER
              </div>
            </div>
          </div>

          {/* Right Zone: Login Administrator above Login Proktor + Unduh Aplikasi (Laptop) + Participant Info */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {(onOpenAdminLogin || onOpenProctorModal || onExitApp) && (
              <div className="hidden md:flex flex-col items-stretch gap-1.5">
                {onOpenAdminLogin && (
                  <button
                    type="button"
                    onClick={onOpenAdminLogin}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap"
                    title="Halaman Login Administrator"
                  >
                    <UserCog className="w-3.5 h-3.5 text-amber-200" />
                    <span>Login Administrator</span>
                  </button>
                )}

                {onOpenProctorModal && (
                  <button
                    type="button"
                    onClick={onOpenProctorModal}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
                    title="Halaman Login Proktor"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-200" />
                    <span>Login Proktor</span>
                  </button>
                )}

                {onOpenProctorModal && !isInstalled && (
                  <button
                    type="button"
                    onClick={handleInstallAppClick}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-300/45 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                    title="Unduh / Pasang Aplikasi CBT di Laptop"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-200" />
                    <span>Unduh Aplikasi</span>
                  </button>
                )}

                {onExitApp && (
                  <button
                    type="button"
                    onClick={onExitApp}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-700 border border-rose-400/40 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                    title="Tutup / Keluar dari Aplikasi CBT"
                  >
                    <Power className="w-3.5 h-3.5 text-rose-200" />
                    <span>Keluar CBT</span>
                  </button>
                )}
              </div>
            )}

            {participantName && (
              <div className="flex items-center gap-1.5 sm:gap-3 bg-[#1b4b75]/80 border border-white/15 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg">
                <div className="hidden sm:flex flex-col text-right leading-tight">
                  <span className="text-xs font-bold text-white truncate max-w-[180px]">
                    {participantName}
                  </span>
                  {participantCode && (
                    <span className="text-[11px] font-mono text-sky-200">
                      {participantCode}
                    </span>
                  )}
                </div>
                <div className="hidden sm:flex w-8 h-8 rounded-full bg-sky-500/30 border border-sky-300/40 items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    title="Keluar / Logout"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Logout</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modal Panduan Unduh / Pasang Aplikasi CBT di Laptop (Fallback saat browser belum memicu beforeinstallprompt) */}
      {showInstallGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-800 animate-cbt-slide-up">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2b6496] shrink-0">
                  <MonitorDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Unduh / Pasang Aplikasi CBT di Laptop
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    CBT SMA Islam Diponegoro Wagir
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallGuideModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="font-bold text-slate-800">
                  Google Chrome / Microsoft Edge (Windows &amp; Laptop):
                </div>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>
                    Klik ikon <strong>Install / Pasang Aplikasi</strong> di ujung kanan kotak alamat URL browser, atau
                  </li>
                  <li>
                    Buka menu browser (<strong>⋮</strong> atau <strong>⋯</strong>) di pojok kanan atas → pilih <strong>Apps / Aplikasi</strong> → <strong>Install CBT SMA ISLAM DIPONEGORO WAGIR</strong>.
                  </li>
                </ol>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="font-bold text-slate-800">
                  Safari (MacBook / macOS):
                </div>
                <p>
                  Klik menu <strong>File</strong> di bilah atas macOS → pilih{' '}
                  <strong>Add to Dock</strong>.
                </p>
              </div>

              {isInIframe && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
                  Catatan: Aplikasi sedang dibuka di dalam pratinjau. Untuk memasang sebagai aplikasi desktop langsung, buka alamat CBT di tab browser Chrome/Edge secara langsung lalu klik <strong>Unduh Aplikasi</strong>.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowInstallGuideModal(false)}
                className="px-4 py-2 rounded-lg bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
