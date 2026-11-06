import React from 'react';
import {
  LogOut,
  Award,
  Clock,
} from 'lucide-react';
import { ExamPackage, ParticipantProfile, StudentAnswer } from '../types/cbt';

interface ExamResultViewProps {
  profile: ParticipantProfile;
  examPackage: ExamPackage;
  answers: Record<string, StudentAnswer>;
  timeUsedSeconds: number;
  onRetakeOrChangePackage: () => void;
  onLogout: () => void;
}

export const ExamResultView: React.FC<ExamResultViewProps> = ({
  profile,
  examPackage,
  timeUsedSeconds,
  onLogout,
}) => {
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m} menit ${s} detik`;
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
            {examPackage.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>Peserta: <strong>{profile.fullName}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Kode: <strong className="font-mono">{profile.username}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Sekolah: <strong>{profile.schoolName}</strong></span>
          </div>
        </div>

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
            <div className="mt-1 text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              <span>Selesai & Jawaban Tersimpan</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={onLogout}
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

