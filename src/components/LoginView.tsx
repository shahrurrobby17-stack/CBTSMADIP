import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  ShieldCheck,
  UserCog,
  Zap,
} from 'lucide-react';
import { ProctorParticipantRow } from './ProctorDashboardView';

export interface ViolationAlertInfo {
  username: string;
  fullName: string;
  reason: string;
  timestamp: string;
}

interface LoginViewProps {
  onLoginSuccess: (username: string) => void;
  onOpenProctorModal?: () => void;
  onQuickLoginAdmin?: () => void;
  onQuickLoginProctor?: () => void;
  participants?: ProctorParticipantRow[];
  lastViolationInfo?: ViolationAlertInfo | null;
  onRequestResetLogin?: (username: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onQuickLoginAdmin,
  onQuickLoginProctor,
  participants = [],
  lastViolationInfo,
  onRequestResetLogin,
}) => {
  const [username, setUsername] = useState(
    lastViolationInfo?.username || 'P130100240'
  );
  const [password, setPassword] = useState('ANBKTKA26*');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (lastViolationInfo?.username) {
      setUsername(lastViolationInfo.username);
    }
  }, [lastViolationInfo]);

  const cleanUpperUsername = username.trim().toUpperCase();
  const matchedParticipant = participants.find(
    (p) => p.username.toUpperCase() === cleanUpperUsername
  );

  const isLockedByViolation = Boolean(
    matchedParticipant &&
      (matchedParticipant.loginState === 'Terkunci (Pelanggaran)' ||
        matchedParticipant.requestReset)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toUpperCase();
    const cleanPass = password.trim();
    if (!cleanUser || !cleanPass) {
      setErrorMsg('Username dan password wajib diisi.');
      return;
    }

    const row = participants.find(
      (p) => p.username.toUpperCase() === cleanUser
    );
    if (
      row &&
      (row.loginState === 'Terkunci (Pelanggaran)' || row.requestReset)
    ) {
      setErrorMsg(
        'Akses Login Ditolak: Akun Anda terkunci karena pelanggaran keluar dari sistem CBT. Anda wajib meminta Reset Login kepada Proktor atau Administrator.'
      );
      return;
    }

    // Opsi B: Seketika masuk mode Fullscreen saat tombol Login diklik
    try {
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
        msFullscreenElement?: Element | null;
      };
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
      };
      if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        }
      }
    } catch {
      // Ignore
    }

    setErrorMsg('');
    onLoginSuccess(cleanUser);
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 min-h-[calc(100vh-10rem)]">
      {/* Main Login Card matching Pusmendik Simulasi TKA screenshot */}
      <div className="w-full max-w-[425px] bg-white rounded-[14px] px-9 sm:px-11 py-10 sm:py-11 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.16)] border border-slate-100/80">
        <h1 className="text-[18px] font-bold text-[#1e293b] tracking-tight">
          Selamat Datang
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[#475569]">
          Silakan login dengan menggunakan username dan password yang anda miliki
        </p>

        {/* Peringatan Pelanggaran Keluar Sistem CBT */}
        {isLockedByViolation && matchedParticipant && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-xs font-extrabold uppercase tracking-wide text-rose-800">
                  Pelanggaran Terdeteksi — Sesi Login Terkunci
                </div>
                <p className="text-xs leading-relaxed text-rose-700">
                  Peserta <strong>{matchedParticipant.namaPeserta}</strong> (
                  <span className="font-mono font-bold">
                    {matchedParticipant.username}
                  </span>
                  ) terdeteksi melakukan pelanggaran keluar dari sistem CBT.
                  Untuk masuk kembali, Anda wajib meminta{' '}
                  <strong>Reset Login</strong> ke Proktor atau Administrator.
                </p>
                {matchedParticipant.violationReason && (
                  <p className="text-[11px] font-medium text-rose-600">
                    Keterangan: {matchedParticipant.violationReason}
                    {matchedParticipant.violationAt
                      ? ` (${matchedParticipant.violationAt})`
                      : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {errorMsg && !isLockedByViolation && (
          <div className="mt-4 px-3.5 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-7 space-y-6">
          {/* Username Input Row */}
          <div className="flex items-center gap-3.5">
            {/* Solid circular user icon matching screenshot */}
            <div className="shrink-0 text-[#1e293b]" aria-hidden="true">
              <svg
                className="w-[18px] h-[18px]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88a9.947 9.947 0 0 1 12.28 0C16.43 19.18 14.03 20 12 20z" />
              </svg>
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Username"
                aria-label="Username"
                autoComplete="username"
                className="w-full pb-2 pt-1 text-[14px] text-slate-800 placeholder:text-slate-400 bg-transparent border-b border-slate-200 focus:border-[#0066ff] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Password Input Row */}
          <div className="flex items-center gap-3.5">
            {/* Solid padlock icon matching screenshot */}
            <div className="shrink-0 text-[#1e293b]" aria-hidden="true">
              <svg
                className="w-[18px] h-[18px]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
            </div>
            <div className="relative flex-1 flex items-center border-b border-slate-200 focus-within:border-[#0066ff] transition-colors">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                aria-label="Password"
                autoComplete="current-password"
                className="w-full pb-2 pt-1 pr-8 text-[14px] text-slate-800 placeholder:text-slate-400 bg-transparent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-0 bottom-2 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <div className="pt-2">
            <button
              type="submit"
              className={`w-full py-2.5 px-6 rounded-full text-white text-[14px] font-semibold transition-all cursor-pointer ${
                isLockedByViolation
                  ? 'bg-slate-400 hover:bg-slate-500'
                  : 'bg-[#0066ff] hover:bg-[#0052cc] active:scale-[0.99] shadow-[0_6px_16px_rgba(0,102,255,0.28)]'
              }`}
            >
              {isLockedByViolation
                ? 'Akun Terkunci (Wajib Reset Proktor/Admin)'
                : 'Login'}
            </button>
          </div>
        </form>
      </div>

      {/* Tombol Akses Masuk Cepat Administrator & Proktor (Hanya Desktop/Tablet) */}
      <div className="hidden md:block mt-5 w-full max-w-[425px] bg-white/85 backdrop-blur-xs rounded-xl p-3.5 border border-slate-200/80 shadow-xs space-y-2.5">
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>Akses Masuk Cepat (1-Klik Tanpa Ketik)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {onQuickLoginAdmin && (
            <button
              type="button"
              onClick={onQuickLoginAdmin}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <UserCog className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Masuk Administrator</span>
            </button>
          )}
          {onQuickLoginProctor && (
            <button
              type="button"
              onClick={onQuickLoginProctor}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-sky-200 shrink-0" />
              <span>Masuk Proktor</span>
            </button>
          )}
        </div>
      </div>

      {/* Copyright Footer */}
      <div className="mt-4 flex flex-wrap items-center justify-center text-xs text-slate-500 font-medium text-center">
        Copyright © 2026. CBT SMA Islam Diponegoro Wagir
      </div>
    </main>
  );
};


