import React, { useState, useEffect, useMemo } from 'react';
import { Play, Clock, FileText, AlertCircle } from 'lucide-react';
import {
  AdminScheduleItem,
  ExamPackage,
  ExamResultSummary,
  ParticipantProfile,
} from '../types/cbt';
import {
  ProctorParticipantRow,
  doesKelasMatch,
  isParticipantStatusActive,
  normalizeKelasCode,
  resolveParticipantRuang,
} from './ProctorDashboardView';
import { getPkgClass } from './AdminViews';
import {
  fetchVercelStorage,
  verifyExamEntryWithServer,
} from '../utils/vercelStorage';

export function cleanMapelTitle(raw?: string): string {
  return String(raw || '')
    .replace(/^Simulasi TKA\s*-\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getRealQuestions(pkg?: ExamPackage | null) {
  if (!pkg || !Array.isArray(pkg.questions)) return [];
  return pkg.questions.filter(
    (q) => !String(q?.id || '').startsWith('q_default_')
  );
}

function pickBestMatchingPkg(candidates: ExamPackage[]): ExamPackage | undefined {
  if (candidates.length === 0) return undefined;
  return candidates.reduce((best, current) =>
    getRealQuestions(current).length > getRealQuestions(best).length
      ? current
      : best
  );
}

export function resolvePackageForSchedule(
  sch: AdminScheduleItem | undefined,
  packages: ExamPackage[]
): ExamPackage | undefined {
  if (!sch || typeof sch !== 'object') return undefined;

  const safePackages = Array.isArray(packages)
    ? packages.filter((p): p is ExamPackage => Boolean(p && typeof p === 'object'))
    : [];
  const rawMapelTitle = String(sch.mapel ?? '').trim();
  const targetMapelLower = cleanMapelTitle(rawMapelTitle);
  const parsedDuration = parseInt(String(sch.durasi ?? ''), 10);
  const normKelas = normalizeKelasCode(sch.kelas) || String(sch.kelas ?? '').trim();

  let matched: ExamPackage | undefined = undefined;

  if (targetMapelLower && safePackages.length > 0) {
    // 1. Strictly match exact subject title AND matching class first
    const exactTitleAndClassMatches = safePackages.filter(
      (pkg) =>
        cleanMapelTitle(pkg.title) === targetMapelLower &&
        doesKelasMatch(getPkgClass(pkg), sch.kelas)
    );
    matched = pickBestMatchingPkg(exactTitleAndClassMatches);

    // 2. If none matched for the exact class, allow exact title match ONLY on class-agnostic ("Semua Kelas") packages
    if (!matched) {
      const exactTitleSharedClassMatches = safePackages.filter((pkg) => {
        if (cleanMapelTitle(pkg.title) !== targetMapelLower) return false;
        const rawTarget = String(pkg.targetClass ?? '').trim().toUpperCase();
        return (
          !rawTarget ||
          rawTarget === 'SEMUA' ||
          rawTarget === 'SEMUA KELAS'
        );
      });
      matched = pickBestMatchingPkg(exactTitleSharedClassMatches);
    }
  }

  // Never steal questions from another subject, another class, or built-in demo packages.
  // If no Bank Soal package matches this schedule's subject + class yet, return an empty 0-question package.
  if (!matched) {
    return {
      id: `empty_sch_${String(sch.id ?? 'default')}`,
      code: String(sch.id || 'MAPEL').toUpperCase(),
      title: rawMapelTitle || 'Mata Pelajaran Ujian',
      level: 'SMA / MA / SMK / Sederajat',
      subtest: 'Wajib Umum',
      durationMinutes:
        !isNaN(parsedDuration) && parsedDuration > 0 ? parsedDuration : 90,
      targetClass: normKelas ? `Kelas ${normKelas}` : 'Kelas X',
      questions: [],
    };
  }

  return {
    ...matched,
    title: rawMapelTitle || String(matched.title ?? 'Mata Pelajaran Ujian'),
    targetClass: normKelas ? `Kelas ${normKelas}` : matched.targetClass,
    durationMinutes:
      !isNaN(parsedDuration) && parsedDuration > 0
        ? parsedDuration
        : matched.durationMinutes,
    questions: getRealQuestions(matched),
  };
}

interface ParticipantConfirmationProps {
  initialProfile: ParticipantProfile;
  packages: ExamPackage[];
  participants?: ProctorParticipantRow[];
  resultsHistory?: ExamResultSummary[];
  activeToken: string;
  isScheduleActive: boolean;
  activeSchedules: AdminScheduleItem[];
  onRefreshToken: () => void;
  onSyncRemoteData?: (data: {
    packages?: ExamPackage[];
    schedules?: AdminScheduleItem[];
    activeToken?: string;
    tokenUpdatedAt?: number;
  }) => void;
  onSubmitProfile: (profile: ParticipantProfile) => void;
}

export const ParticipantConfirmationView: React.FC<ParticipantConfirmationProps> = ({
  initialProfile,
  packages,
  participants = [],
  resultsHistory = [],
  activeToken,
  isScheduleActive,
  activeSchedules,
  onSyncRemoteData,
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

  const studentRuang = useMemo(
    () => resolveParticipantRuang(matchedParticipant),
    [matchedParticipant]
  );

  // Strictly show only active schedules matching the student's class (never leak other classes/majors such as IPS to IPA)
  const studentActiveSchedules = useMemo(() => {
    return activeSchedules.filter((sch) =>
      doesKelasMatch(studentKelas, sch.kelas)
    );
  }, [activeSchedules, studentKelas]);

  const completedSubjectsSet = useMemo(() => {
    const cleanUser = (
      matchedParticipant?.username ||
      initialProfile.username ||
      ''
    )
      .trim()
      .toUpperCase();
    const isRowReset =
      matchedParticipant && matchedParticipant.loginState !== 'Selesai';
    if (!cleanUser) return new Set<string>();
    const titles = resultsHistory
      .filter((r) => {
        if (r?.participant?.username?.trim().toUpperCase() !== cleanUser) {
          return false;
        }
        // Only treat past results as active blocks when student has not been unlocked via Reset Login for retake,
        // or when multiple schedules are active and another mapel was already submitted
        return !isRowReset || studentActiveSchedules.length > 1;
      })
      .map((r) => cleanMapelTitle(r.packageTitle))
      .filter(Boolean);
    return new Set(titles);
  }, [
    initialProfile.username,
    matchedParticipant,
    resultsHistory,
    studentActiveSchedules.length,
  ]);

  const isScheduleCompleted = useMemo(
    () => (sch?: AdminScheduleItem) =>
      Boolean(sch && completedSubjectsSet.has(cleanMapelTitle(sch.mapel))),
    [completedSubjectsSet]
  );

  const uncompletedStudentSchedules = useMemo(
    () => studentActiveSchedules.filter((s) => !isScheduleCompleted(s)),
    [studentActiveSchedules, isScheduleCompleted]
  );

  const allActiveSchedulesCompleted =
    studentActiveSchedules.length > 0 && uncompletedStudentSchedules.length === 0;

  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(
    uncompletedStudentSchedules[0]?.id || studentActiveSchedules[0]?.id || ''
  );

  useEffect(() => {
    if (studentActiveSchedules.length === 0) {
      setSelectedScheduleId('');
      return;
    }
    const currentSelected = studentActiveSchedules.find(
      (s) => s.id === selectedScheduleId
    );
    if (
      !currentSelected ||
      (isScheduleCompleted(currentSelected) &&
        uncompletedStudentSchedules.length > 0)
    ) {
      setSelectedScheduleId(
        uncompletedStudentSchedules[0]?.id || studentActiveSchedules[0].id
      );
    }
  }, [
    studentActiveSchedules,
    uncompletedStudentSchedules,
    selectedScheduleId,
    isScheduleCompleted,
  ]);

  const selectedSchedule = useMemo(
    () =>
      studentActiveSchedules.find((s) => s.id === selectedScheduleId) ||
      uncompletedStudentSchedules[0] ||
      studentActiveSchedules[0],
    [studentActiveSchedules, uncompletedStudentSchedules, selectedScheduleId]
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
    () =>
      selectedSchedule
        ? resolvePackageForSchedule(selectedSchedule, availablePackages)
        : undefined,
    [selectedSchedule, availablePackages]
  );

  const [enteredToken, setEnteredToken] = useState('');
  const [error, setError] = useState('');
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);

  const isStudentDeactivated = Boolean(
    matchedParticipant && !isParticipantStatusActive(matchedParticipant.status)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = enteredToken
      .replace(/[\s\u200B-\u200D\uFEFF]+/g, '')
      .toUpperCase();
    if (!cleanInput) {
      setError('Silakan masukkan Token ujian terlebih dahulu.');
      return;
    }

    if (isStudentDeactivated) {
      setError(
        'Akses Ditolak: Status peserta Anda sedang Non Active pada menu Kelompok Tes. Silakan hubungi Proktor atau Administrator untuk mengaktifkan status peserta.'
      );
      return;
    }

    if (allActiveSchedulesCompleted || isScheduleCompleted(selectedSchedule)) {
      setError(
        'Anda sudah menyelesaikan mata pelajaran ini. Hubungi Proktor/Administrator jika membutuhkan Reset Login atau pilih jadwal ujian lain yang belum dikerjakan.'
      );
      return;
    }

    const cleanActiveProp = (activeToken || '').replace(/\s+/g, '').toUpperCase();
    let storedLocalToken = '';
    try {
      storedLocalToken = (
        localStorage.getItem('pusmendik_cbt_token_v1') || ''
      )
        .replace(/\s+/g, '')
        .toUpperCase();
    } catch {
      // ignore
    }

    let isTokenValid =
      (cleanActiveProp.length > 0 && cleanInput === cleanActiveProp) ||
      (storedLocalToken.length > 0 && cleanInput === storedLocalToken);

    let remoteActiveSchedule: AdminScheduleItem | undefined = selectedSchedule;
    let resolvedPkg: ExamPackage | undefined = activePackage;
    const cleanStudentUser = (
      matchedParticipant?.username ||
      initialProfile.username ||
      ''
    )
      .trim()
      .toUpperCase();

    let serverSessionUnauthorized = false;

    // Always verify live server status (catches Non Active deactivation in Kelompok Tes) + server token + latest questions
    setIsVerifyingToken(true);
    try {
      const verifyRes = await verifyExamEntryWithServer({
        username: cleanStudentUser,
        enteredToken: cleanInput,
        selectedScheduleId: selectedSchedule?.id,
      });

      if (verifyRes.ok) {
        isTokenValid = true;
        if (verifyRes.schedule) {
          remoteActiveSchedule = verifyRes.schedule;
        }
      } else if (
        !verifyRes.networkError &&
        verifyRes.reason === 'unauthorized'
      ) {
        serverSessionUnauthorized = true;
      } else if (
        !verifyRes.networkError &&
        verifyRes.reason
      ) {
        setError(
          verifyRes.error ||
            'Verifikasi ujian ditolak oleh server. Pastikan status peserta Active dan token sesuai.'
        );
        return;
      }

      // Refresh latest schedules & packages from server so newly uploaded Bank Soal is picked up immediately
      const res = await fetchVercelStorage({ force: true });
      if (res.ok && res.data) {
        onSyncRemoteData?.({
          packages: res.data.packages,
          schedules: res.data.schedules,
          activeToken: res.data.activeToken,
          tokenUpdatedAt: res.data.tokenUpdatedAt,
        });

        // Double-check live participant status from server list
        if (Array.isArray(res.data.participants) && cleanStudentUser) {
          const liveRow = res.data.participants.find(
            (p) => p?.username?.trim().toUpperCase() === cleanStudentUser
          );
          if (liveRow && !isParticipantStatusActive(liveRow.status)) {
            setError(
              'Akses Ditolak: Status peserta Anda telah dinonaktifkan (Non Active) pada menu Kelompok Tes. Silakan hubungi Proktor atau Administrator.'
            );
            return;
          }
        }

        const serverToken = String(res.data.activeToken || '')
          .replace(/\s+/g, '')
          .toUpperCase();
        if (serverToken && cleanInput === serverToken) {
          isTokenValid = true;
        }

        if (Array.isArray(res.data.schedules) && res.data.schedules.length > 0) {
          const remoteActiveList = res.data.schedules.filter((s) => s.isActive);
          const exactRemote = remoteActiveList.filter((s) =>
            doesKelasMatch(studentKelas, s.kelas)
          );
          const matchingSelected = (remoteActiveSchedule || selectedSchedule)
            ? exactRemote.find(
                (s) => s.id === (remoteActiveSchedule || selectedSchedule)?.id
              )
            : undefined;
          const firstUncompletedRemote = exactRemote.find(
            (s) => !isScheduleCompleted(s)
          );
          remoteActiveSchedule =
            matchingSelected ||
            firstUncompletedRemote ||
            exactRemote[0] ||
            undefined;
        }
        if (
          remoteActiveSchedule &&
          Array.isArray(res.data.packages) &&
          res.data.packages.length > 0
        ) {
          resolvedPkg = resolvePackageForSchedule(
            remoteActiveSchedule,
            res.data.packages
          );
        }
      }
    } catch {
      // ignore network error and rely on local state
    } finally {
      setIsVerifyingToken(false);
    }

    if (!remoteActiveSchedule) {
      setError(
        `Jadwal ujian untuk Kelas ${studentKelas} belum diaktifkan oleh Administrator. Mata pelajaran dan sesi ujian untuk kelas Anda belum tersedia saat ini.`
      );
      return;
    }

    if (!isTokenValid) {
      setError(
        serverSessionUnauthorized
          ? 'Sesi login peserta belum terverifikasi atau telah berakhir di server. Silakan klik Keluar lalu login kembali.'
          : 'Token yang Anda masukkan tidak sesuai dengan token ujian aktif saat ini. Pastikan token sesuai dengan yang tampil di Beranda Proktor/Administrator.'
      );
      return;
    }

    setError('');
    const resolvedSubjectTitle =
      remoteActiveSchedule?.mapel ||
      resolvedPkg?.title ||
      initialProfile.activeSubjectTitle ||
      'Ujian SAS';

    onSubmitProfile({
      ...initialProfile,
      fullName: resolvedFullName,
      kelas: studentKelas,
      activeSubjectTitle: resolvedSubjectTitle,
      selectedPackageId: resolvedPkg?.id || '',
      enteredToken: cleanInput,
    });
  };

  const hasActiveSchedule =
    Boolean(isScheduleActive) &&
    studentActiveSchedules.length > 0 &&
    Boolean(selectedSchedule);

  const activeSubjectLabel =
    hasActiveSchedule && selectedSchedule?.mapel
      ? selectedSchedule.mapel
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

          {/* Nama Peserta (Tidak dapat diedit oleh siswa) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:items-center py-1.5 border-b border-slate-100">
            <label className="text-xs font-semibold text-slate-500">
              Nama Peserta
            </label>
            <div className="sm:col-span-2 text-sm font-bold text-slate-900">
              {resolvedFullName}
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

          {/* Ruang Ujian */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:items-center py-1.5 border-b border-slate-100">
            <label className="text-xs font-semibold text-slate-500">
              Ruang Ujian
            </label>
            <div className="sm:col-span-2 text-sm font-bold text-slate-900">
              {studentRuang}
            </div>
          </div>

          {/* Mata Pelajaran */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:items-center py-1.5 border-b border-slate-100">
            <label className="text-xs font-semibold text-slate-500">
              Mata Pelajaran
            </label>
            <div className="sm:col-span-2">
              {hasActiveSchedule && studentActiveSchedules.length > 1 ? (
                <select
                  value={selectedSchedule?.id || ''}
                  onChange={(e) => {
                    setSelectedScheduleId(e.target.value);
                    setError('');
                  }}
                  className="w-full px-3.5 py-2 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                >
                  {studentActiveSchedules.map((sch) => {
                    const done = isScheduleCompleted(sch);
                    return (
                      <option key={sch.id} value={sch.id} disabled={done}>
                        {sch.mapel}
                        {done ? ' (Sudah Selesai)' : ''}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
                  <span>{activeSubjectLabel}</span>
                  {hasActiveSchedule && selectedSchedule && isScheduleCompleted(selectedSchedule) && (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[11px] font-bold">
                      Sudah Selesai
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Token Input (Selalu aktif agar siswa dapat langsung mengetikkan token) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:items-center py-1.5">
            <label htmlFor="tokenInput" className="text-xs font-semibold text-slate-600">
              Token
            </label>
            <div className="sm:col-span-2">
              <input
                id="tokenInput"
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={enteredToken}
                onChange={(e) => {
                  setEnteredToken(e.target.value.toUpperCase());
                  setError('');
                }}
                placeholder="Ketikkan token ujian di sini"
                className="w-full px-3.5 py-2 font-mono text-sm font-bold tracking-widest uppercase border rounded-lg text-slate-900 bg-slate-50 border-slate-300 focus:border-blue-600 focus:bg-white focus:outline-none transition-colors"
              />
            </div>
          </div>

          {isStudentDeactivated && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800">
              Status peserta Anda saat ini <strong>Non Active</strong> pada menu Kelompok Tes. Silakan hubungi Proktor atau Administrator untuk mengaktifkan status peserta.
            </div>
          )}

          {!hasActiveSchedule && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800">
              Belum ada jadwal mata pelajaran yang aktif untuk <strong>Kelas {studentKelas}</strong> saat ini. Silakan tunggu hingga Administrator/Proktor mengaktifkan jadwal ujian kelas Anda.
            </div>
          )}

          {allActiveSchedulesCompleted && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
              Seluruh mata pelajaran ujian yang aktif untuk kelas Anda telah selesai dikerjakan. Hubungi Proktor/Administrator jika Anda perlu Reset Login untuk mengulang.
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={isVerifyingToken || allActiveSchedulesCompleted || isStudentDeactivated}
              className="w-full py-2.5 px-6 rounded-full text-sm font-semibold transition-all bg-[#0066ff] hover:bg-[#0052cc] text-white shadow-[0_6px_16px_rgba(0,102,255,0.28)] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isVerifyingToken ? 'Memverifikasi Token...' : 'Submit'}
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

  const questionCount = getRealQuestions(examPackage).length;
  const hasQuestions = questionCount > 0;

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
                {examPackage?.title || 'Belum Ada Mata Pelajaran'}
              </span>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-semibold text-slate-500">Subtes</span>
              <span className="text-sm font-medium text-slate-700">
                {examPackage?.subtest || 'Wajib Umum'}
              </span>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-semibold text-slate-500">Status Tes</span>
              {hasQuestions ? (
                <span className="text-sm font-semibold text-emerald-700">
                  Tes Baru (Siap Dikerjakan)
                </span>
              ) : (
                <span className="text-sm font-semibold text-amber-700">
                  Soal Belum Diunggah
                </span>
              )}
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
                {hasQuestions
                  ? `${examPackage?.durationMinutes || 90} Menit (${questionCount} Butir Soal)`
                  : `${examPackage?.durationMinutes || 90} Menit (Belum ada butir soal)`}
              </span>
            </div>
          </div>

          {!hasQuestions && (
            <div className="mt-5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs font-medium text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Bank soal untuk mata pelajaran <strong>{examPackage?.title || 'ini'}</strong> belum diunggah oleh Administrator. Anda belum dapat memulai ujian hingga soal tersedia.
              </span>
            </div>
          )}

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
              disabled={!hasQuestions}
              className="w-full flex-1 py-2.5 px-6 rounded-full bg-[#0066ff] hover:bg-[#0052cc] text-white text-sm font-semibold shadow-[0_6px_16px_rgba(0,102,255,0.28)] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
