import React, { useState } from 'react';
import {
  LogOut,
  Award,
  Clock,
  CheckCircle2,
  WifiOff,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  ExamPackage,
  ExamResultSummary,
  ParticipantProfile,
  StudentAnswer,
} from '../types/cbt';

interface ExamResultViewProps {
  profile: ParticipantProfile;
  examPackage: ExamPackage;
  answers: Record<string, StudentAnswer>;
  timeUsedSeconds: number;
  showResultScore?: boolean;
  serverSummary?: ExamResultSummary | null;
  isSyncingResult?: boolean;
  syncStatus?: 'syncing' | 'synced' | 'offline_queued';
  syncError?: string | null;
  onRetrySubmit?: () => void;
  onRetakeOrChangePackage: () => void;
  onLogout: () => void;
}

export const ExamResultView: React.FC<ExamResultViewProps> = ({
  profile,
  examPackage,
  timeUsedSeconds,
  showResultScore = false,
  serverSummary = null,
  isSyncingResult = false,
  syncStatus,
  syncError = null,
  onRetrySubmit,
  onLogout,
}) => {
  const [confirmExitUnsynced, setConfirmExitUnsynced] = useState(false);

  const effectiveSyncStatus: 'syncing' | 'synced' | 'offline_queued' =
    syncStatus || (isSyncingResult ? 'syncing' : serverSummary ? 'synced' : 'offline_queued');

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m} menit ${s} detik`;
  };

  // Never compute scores on the client from redacted questions (which lack answer keys and always yield 0).
  const scoreStats = serverSummary
    ? {
        totalQuestions: serverSummary.totalQuestions,
        correctCount: serverSummary.correctCount,
        finalScore: serverSummary.finalScore,
      }
    : null;

  const handleClickLogout = () => {
    if (effectiveSyncStatus !== 'synced' && !confirmExitUnsynced) {
      setConfirmExitUnsynced(true);
      return;
    }
    onLogout();
  };

  return (
    <main className="flex-1 max-w-[760px] w-full mx-auto px-4 sm:px-8 py-8 space-y-6">
      {/* Summary Completion Card */}
      <div className="bg-white rounded-[14px] p-6 sm:p-8 shadow-[0_18px_45px_-12px_rgba(15,23,42,0.14)] border border-slate-200/80">
        <div className="pb-6 border-b border-slate-200">
          <div className="text-xs font-semibold text-slate-500">
            CBT SMA ISLAM DIPONEGORO WAGIR · KONFIRMASI SELESAI UJIAN SUMATIF AKHIR SEMESTER
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            {serverSummary?.packageTitle || examPackage.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>Peserta: <strong>{profile.fullName}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Kode: <strong className="font-mono">{profile.username}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Sekolah: <strong>{profile.schoolName}</strong></span>
          </div>
        </div>

        {/* Offline Queue Warning Banner */}
        {effectiveSyncStatus === 'offline_queued' && (
          <div className="mt-5 p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-3">
            <div className="flex items-start gap-2.5">
              {syncError ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <WifiOff className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 text-xs leading-relaxed text-amber-900">
                <div className="font-bold text-amber-950">
                  {syncError
                    ? 'Jawaban Tersimpan Lokal — Menunggu Penilaian Server'
                    : 'Jawaban Tersimpan Lokal — Belum Masuk ke Server'}
                </div>
                <p>
                  {syncError ? (
                    syncError
                  ) : (
                    <>
                      Koneksi internet sempat terputus saat mengirim ujian.{' '}
                      <strong>Jangan tutup atau keluar dari halaman ini terlebih dahulu</strong>{' '}
                      — sistem akan mengirim ulang otomatis saat jaringan kembali normal, atau klik tombol di bawah.
                    </>
                  )}
                </p>
              </div>
            </div>
            {onRetrySubmit && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmExitUnsynced(false);
                    onRetrySubmit();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Kirim Ulang ke Server Sekarang</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Metrics Row */}
        <div className="py-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-slate-100">
          <div>
            <div className="text-xs text-slate-500">Waktu Pengerjaan</div>
            <div className="mt-1 text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="tabular-nums">{formatDuration(timeUsedSeconds)}</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Status Sesi</div>
            <div
              className={`mt-1 text-sm font-semibold flex items-center gap-1.5 ${
                effectiveSyncStatus === 'synced'
                  ? 'text-emerald-700'
                  : effectiveSyncStatus === 'syncing'
                  ? 'text-blue-700'
                  : 'text-amber-700'
              }`}
            >
              {effectiveSyncStatus === 'offline_queued' ? (
                <WifiOff className="w-4 h-4 shrink-0" />
              ) : (
                <Award className="w-4 h-4 shrink-0" />
              )}
              <span>
                {effectiveSyncStatus === 'syncing'
                  ? 'Menyimpan & Menghitung Nilai di Server...'
                  : effectiveSyncStatus === 'synced'
                  ? 'Selesai & Jawaban Tersimpan di Server'
                  : 'Menunggu Koneksi (Tersimpan Lokal)'}
              </span>
            </div>
          </div>
        </div>

        {showResultScore && (
          <div className="py-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-slate-100">
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200">
              <div className="text-xs font-semibold text-blue-700">
                Nilai Akhir Anda
              </div>
              <div className="mt-1 font-mono text-3xl font-extrabold text-[#001a6e] tabular-nums">
                {!scoreStats ? '...' : scoreStats.finalScore}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <div className="text-xs font-semibold text-emerald-700">
                Jawaban Benar
              </div>
              <div className="mt-1 text-lg font-bold text-emerald-800 flex items-center gap-1.5 tabular-nums">
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {!scoreStats
                    ? 'Menunggu Penilaian Server...'
                    : `${scoreStats.correctCount} dari ${scoreStats.totalQuestions} Soal`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Guarded Exit Confirmation if not yet synced */}
        {confirmExitUnsynced && effectiveSyncStatus !== 'synced' && (
          <div className="mt-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-2.5">
            <div className="flex items-start gap-2 text-xs text-rose-800 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                <strong>Perhatian:</strong> Jawaban Anda belum terkirim ke server. Jika Anda keluar sekarang, pastikan Anda (atau Proktor/Admin) <strong>login kembali di perangkat ini</strong> saat internet tersambung agar jawaban otomatis terkirim.
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmExitUnsynced(false)}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Tetap di Halaman Ini
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                Tetap Keluar ke Login
              </button>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={handleClickLogout}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar ke Halaman Login</span>
          </button>
        </div>
      </div>
    </main>
  );
};


