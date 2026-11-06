import React, { useState, useEffect, useMemo } from 'react';
import { Play, Clock, FileText, AlertCircle } from 'lucide-react';
import { AdminScheduleItem, ExamPackage, ParticipantProfile } from '../types/cbt';
import {
  ProctorParticipantRow,
  doesKelasMatch,
  normalizeKelasCode,
} from './ProctorDashboardView';
import { getPkgClass } from './AdminViews';

export function resolvePackageForSchedule(
  sch: AdminScheduleItem | undefined,
  packages: ExamPackage[]
): ExamPackage | undefined {
  if (packages.length === 0) return undefined;
  if (!sch) return packages[0];

  const targetMapelLower = (sch.mapel || '').trim().toLowerCase();
  const parsedDuration = parseInt(String(sch.durasi || ''), 10);

  // 1. Exact title + class match
  let matched = packages.find(
    (pkg) =>
      pkg.title.trim().toLowerCase() === targetMapelLower &&
      doesKelasMatch(getPkgClass(pkg), sch.kelas)
  );

  // 2. Exact title match
  if (!matched && targetMapelLower) {
    matched = packages.find(
      (pkg) => pkg.title.trim().toLowerCase() === targetMapelLower
    );
  }

  // 3. Partial title + class match
  if (!matched && targetMapelLower) {
    matched = packages.find(
      (pkg) =>
        doesKelasMatch(getPkgClass(pkg), sch.kelas) &&
        (pkg.title.trim().toLowerCase().includes(targetMapelLower) ||
          targetMapelLower.includes(pkg.title.trim().toLowerCase()))
    );
  }

  // 4. Class match
  if (!matched && sch.kelas) {
    matched = packages.find((pkg) =>
      doesKelasMatch(getPkgClass(pkg), sch.kelas)
    );
  }

  const basePkg = matched || packages[0];
  const normKelas = normalizeKelasCode(sch.kelas) || sch.kelas;

  return {
    ...basePkg,
    title: sch.mapel.trim() || basePkg.title,
    targetClass: normKelas ? `Kelas ${normKelas}` : basePkg.targetClass,
    durationMinutes:
      !isNaN(parsedDuration) && parsedDuration > 0
        ? parsedDuration
        : basePkg.durationMinutes,
  };
}

interface ParticipantConfirmationProps {
  initialProfile: ParticipantProfile;
  packages: ExamPackage[];
  participants?: ProctorParticipantRow[];
  activeToken: string;
  isScheduleActive: boolean;
  activeSchedules: AdminScheduleItem[];
  onRefreshToken: () => void;
  onSubmitProfile: (profile: ParticipantProfile) => void;
}

export const ParticipantConfirmationView: React.FC<ParticipantConfirmationProps> = ({
  initialProfile,
  packages,
  participants = [],
  activeToken,
  activeSchedules,
  onSubmitProfile,
}) => {
  // Resolve the logged-in student's registered name and class (read-only)
  const matchedParticipant = useMemo(() => {
    const cleanUsername = initialProfile.username.trim().toUpperCase();
    return participants.find(
      (p) =>
        p.username.trim().toUpperCase() === cleanUsername ||
        p.namaPeserta.trim().toUpperCase() === cleanUsername
    );
  }, [initialProfile.username, participants]);

  const resolvedFullName =
    matchedParticipant?.namaPeserta ||
    initialProfile.fullName ||
    initialProfile.username;

  const studentKelas = useMemo(() => {
    const rawKelas =
      matchedParticipant?.kelas || initialProfile.kelas || 'X';
    return normalizeKelasCode(rawKelas) || 'X';
  }, [initialProfile.kelas, matchedParticipant]);

  // Filter active schedules strictly to those matching the student's class
  const studentActiveSchedules = useMemo(
    () =>
      activeSchedules.filter((sch) => doesKelasMatch(studentKelas, sch.kelas)),
    [activeSchedules, studentKelas]
  );

  const isStudentScheduleActive = studentActiveSchedules.length > 0;

  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(
    studentActiveSchedules[0]?.id || ''
  );

  useEffect(() => {
    if (studentActiveSchedules.length === 0) {
      setSelectedScheduleId('');
      return;
    }
    const stillExists = studentActiveSchedules.some(
      (s) => s.id === selectedScheduleId
    );
    if (!stillExists) {
      setSelectedScheduleId(studentActiveSchedules[0].id);
    }
  }, [studentActiveSchedules, selectedScheduleId]);

  const selectedSchedule = useMemo(
    () =>
      studentActiveSchedules.find((s) => s.id === selectedScheduleId) ||
      studentActiveSchedules[0],
    [studentActiveSchedules, selectedScheduleId]
  );

  const nonTkaPackages = useMemo(
    () =>
      packages.filter(
        (pkg) =>
          !pkg.title.toLowerCase().includes('simulasi tka') &&
          !pkg.code.toUpperCase().startsWith('TKA-')
      ),
    [packages]
  );
  const availablePackages = nonTkaPackages.length > 0 ? nonTkaPackages : packages;

  const activePackage = useMemo(
    () => resolvePackageForSchedule(selectedSchedule, availablePackages),
    [selectedSchedule, availablePackages]
  );

  const [enteredToken, setEnteredToken] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isStudentScheduleActive) {
      setEnteredToken('');
    }
  }, [isStudentScheduleActive]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStudentScheduleActive || !selectedSchedule) {
      setError(
        `Anda belum dapat mengerjakan ujian. Mata pelajaran untuk Kelas ${studentKelas} pada menu Jadwal belum diaktifkan oleh Administrator.`
      );
      return;
    }
    if (!enteredToken.trim()) {
      setError('Silakan masukkan Token ujian terlebih dahulu.');
      return;
    }
    if (enteredToken.trim().toUpperCase() !== activeToken.toUpperCase()) {
      setError('Token yang Anda masukkan tidak sesuai dengan token ujian aktif saat ini.');
      return;
    }
    setError('');
    onSubmitProfile({
      ...initialProfile,
      fullName: resolvedFullName,
      kelas: studentKelas,
      activeSubjectTitle: selectedSchedule.mapel,
      selectedPackageId:
        activePackage?.id ||
        initialProfile.selectedPackageId ||
        availablePackages[0]?.id ||
        '',
      enteredToken: enteredToken.trim().toUpperCase(),
    });
  };

  const activeSubjectLabel =
    isStudentScheduleActive && selectedSchedule
      ? selectedSchedule.mapel || activePackage?.title || '-'
      : '-';

  return (
    <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-8 py-8">
      {/* Main Confirmation Card */}
      <div className="max-w-[680px] mx-auto bg-white rounded-[14px] px-7 sm:px-10 py-8 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.14)] border border-slate-100">
        <h1 className="text-xl font-bold text-slate-800">
          Konfirmasi Data Peserta
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Pastikan identitas peserta, kelas, dan mata pelajaran di bawah ini sudah sesuai, lalu masukkan token untuk memulai ujian.
        </p>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs font-medium text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Satuan Pendidikan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:items-center py-1.5 border-b border-slate-100">
            <label className="text-xs font-semibold text-slate-500">
              Satuan Pendidikan
            </label>
            <div className="sm:col-span-2 text-sm font-medium text-slate-900">
              {initialProfile.schoolName}
            </div>
          </div>

          {/* Kelas Peserta (Warna Hitam) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:items-center py-1.5 border-b border-slate-100">
            <label className="text-xs font-semibold text-slate-500">
              Kelas Peserta
            </label>
            <div className="sm:col-span-2 text-sm font-bold text-slate-900">
              Kelas {studentKelas}
            </div>
          </div>

          {/* Mata Pelajaran (Hanya menampilkan mata pelajaran yang aktif sesuai kelas siswa) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:items-center py-1.5 border-b border-slate-100">
            <label className="text-xs font-semibold text-slate-500">
              Mata Pelajaran
            </label>
            <div className="sm:col-span-2">
              {studentActiveSchedules.length > 1 ? (
                <select
                  value={selectedSchedule?.id || ''}
                  onChange={(e) => setSelectedScheduleId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                >
                  {studentActiveSchedules.map((sch) => (
                    <option key={sch.id} value={sch.id}>
                      {sch.mapel}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-sm font-bold text-slate-900">
                  {activeSubjectLabel}
                </div>
              )}
            </div>
          </div>

          {/* Nama Peserta (Tidak dapat diedit oleh siswa) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:items-center py-1.5 border-b border-slate-100">
            <label className="text-xs font-semibold text-slate-500">
              Nama Peserta
            </label>
            <div className="sm:col-span-2 text-sm font-bold text-slate-900">
              {resolvedFullName}
            </div>
          </div>

          {/* Token Input (Satu-satunya kolom yang diisi oleh siswa) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:items-center py-1.5">
            <label htmlFor="tokenInput" className="text-xs font-semibold text-slate-600">
              Token
            </label>
            <div className="sm:col-span-2">
              <input
                id="tokenInput"
                type="text"
                disabled={!isStudentScheduleActive}
                value={enteredToken}
                onChange={(e) => {
                  setEnteredToken(e.target.value.toUpperCase());
                  setError('');
                }}
                placeholder={
                  isStudentScheduleActive
                    ? 'Ketikkan token di sini'
                    : `Token belum keluar (Mapel Kelas ${studentKelas} belum aktif)`
                }
                className={`w-full px-3.5 py-2 font-mono text-sm font-bold tracking-widest uppercase border rounded-lg focus:outline-none transition-colors ${
                  isStudentScheduleActive
                    ? 'text-slate-900 bg-slate-50 border-slate-200 focus:border-blue-600 focus:bg-white'
                    : 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed'
                }`}
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={!isStudentScheduleActive}
              className={`w-full py-2.5 px-6 rounded-full text-sm font-semibold transition-all ${
                isStudentScheduleActive
                  ? 'bg-[#0066ff] hover:bg-[#0052cc] text-white shadow-[0_6px_16px_rgba(0,102,255,0.28)] cursor-pointer'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isStudentScheduleActive
                ? 'Submit'
                : `Tidak Dapat Mengerjakan (Mapel Kelas ${studentKelas} Belum Diaktifkan)`}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};

interface TestConfirmationViewProps {
  profile: ParticipantProfile;
  examPackage: ExamPackage;
  onStartExam: () => void;
  onBackToProfile: () => void;
}

export const TestConfirmationView: React.FC<TestConfirmationViewProps> = ({
  profile,
  examPackage,
  onStartExam,
  onBackToProfile,
}) => {
  const nowStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="flex-1 max-w-[1050px] w-full mx-auto px-4 sm:px-8 py-10 flex items-center justify-center">
      <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Right/Main Card: Konfirmasi Tes */}
        <div className="md:col-span-8 bg-white rounded-[14px] px-7 sm:px-10 py-8 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.14)] border border-slate-100">
          <h1 className="text-xl font-bold text-slate-800">Konfirmasi Tes</h1>
          <p className="text-xs text-slate-500 mt-1">
            Periksa rincian mata uji di bawah ini. Tekan tombol Mulai untuk membuka lembar soal.
          </p>

          <div className="mt-6 divide-y divide-slate-100">
            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-semibold text-slate-500">Nama Peserta</span>
              <span className="text-sm font-bold text-slate-900">
                {profile.fullName}
              </span>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-semibold text-slate-500">Nama Tes</span>
              <span className="text-sm font-semibold text-slate-800">
                {examPackage.title}
              </span>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-semibold text-slate-500">Subtes</span>
              <span className="text-sm font-medium text-slate-700">
                {examPackage.subtest}
              </span>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-semibold text-slate-500">Status Tes</span>
              <span className="text-sm font-semibold text-emerald-700">
                Tes Baru (Siap Dikerjakan)
              </span>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-semibold text-slate-500">Waktu Pelaksanaan</span>
              <span className="text-sm text-slate-700">{nowStr}</span>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-semibold text-slate-500">
                Alokasi Waktu Tes
              </span>
              <span className="text-sm font-mono font-bold text-slate-800">
                {examPackage.durationMinutes} Menit ({examPackage.questions.length} Butir Soal)
              </span>
            </div>
          </div>

          <div className="mt-7 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={onBackToProfile}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              Ubah Data Peserta
            </button>
            <button
              type="button"
              onClick={onStartExam}
              className="w-full flex-1 py-2.5 px-6 rounded-full bg-[#0066ff] hover:bg-[#0052cc] text-white text-sm font-semibold shadow-[0_6px_16px_rgba(0,102,255,0.28)] flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Mulai</span>
            </button>
          </div>
        </div>

        {/* Side Instruction Panel */}
        <div className="md:col-span-4 bg-white rounded-[14px] p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2.5 text-slate-800 font-bold text-sm">
            <FileText className="w-4 h-4 text-[#0066ff]" />
            <span>Petunjuk Pengerjaan</span>
          </div>
          <ul className="space-y-2.5 text-xs leading-relaxed text-slate-600 list-disc pl-4">
            <li>
              Gunakan tombol <strong>Soal Berikutnya</strong> dan{' '}
              <strong>Soal Sebelumnya</strong> di bagian bawah untuk berpindah nomor soal.
            </li>
            <li>
              Tekan tombol kuning <strong>Ragu-Ragu</strong> apabila Anda belum yakin dengan jawaban yang dipilih.
            </li>
            <li>
              Klik tombol <strong>Daftar Soal</strong> di pojok kanan atas untuk melihat ringkasan seluruh nomor soal.
            </li>
            <li>
              Perhatikan <strong>Sisa Waktu</strong> yang berjalan mundur di bagian kanan atas layar.
            </li>
          </ul>
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Jawaban tersimpan secara otomatis setiap kali Anda berpindah soal.</span>
          </div>
        </div>
      </div>
    </main>
  );
};
