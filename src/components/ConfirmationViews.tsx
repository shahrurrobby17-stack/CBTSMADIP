import React, { useState, useEffect } from 'react';
import { Copy, Play, RefreshCw, CheckCircle2, Clock, FileText, AlertCircle, Lock } from 'lucide-react';
import { AdminScheduleItem, ExamPackage, ParticipantProfile } from '../types/cbt';

interface ParticipantConfirmationProps {
  initialProfile: ParticipantProfile;
  packages: ExamPackage[];
  activeToken: string;
  isScheduleActive: boolean;
  activeSchedules: AdminScheduleItem[];
  onRefreshToken: () => void;
  onSubmitProfile: (profile: ParticipantProfile) => void;
}

const MONTHS = [
  { value: '01', label: 'Januari' },
  { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mei' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
];

export const ParticipantConfirmationView: React.FC<ParticipantConfirmationProps> = ({
  initialProfile,
  packages,
  activeToken,
  isScheduleActive,
  activeSchedules,
  onRefreshToken,
  onSubmitProfile,
}) => {
  const [fullName, setFullName] = useState(initialProfile.fullName);
  const [gender, setGender] = useState<'Laki-Laki' | 'Perempuan'>(initialProfile.gender);
  const nonTkaPackages = packages.filter(
    (pkg) =>
      !pkg.title.toLowerCase().includes('simulasi tka') &&
      !pkg.code.toUpperCase().startsWith('TKA-')
  );
  const availablePackages = nonTkaPackages.length > 0 ? nonTkaPackages : packages;

  const resolveActivePackage = (): ExamPackage | undefined => {
    if (activeSchedules.length > 0) {
      for (const sch of activeSchedules) {
        const matched = availablePackages.find(
          (pkg) =>
            pkg.title.trim().toLowerCase() === sch.mapel.trim().toLowerCase()
        );
        if (matched) return matched;
      }
    }
    return (
      availablePackages.find((pkg) => pkg.id === initialProfile.selectedPackageId) ||
      availablePackages[0]
    );
  };

  const activePackage = resolveActivePackage();
  const [selectedPackageId, setSelectedPackageId] = useState(
    activePackage?.id || initialProfile.selectedPackageId || availablePackages[0]?.id || ''
  );
  const [birthDay, setBirthDay] = useState(initialProfile.birthDay);
  const [birthMonth, setBirthMonth] = useState(initialProfile.birthMonth);
  const [birthYear, setBirthYear] = useState(initialProfile.birthYear);
  const [enteredToken, setEnteredToken] = useState(
    isScheduleActive ? activeToken : ''
  );
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const resolved = resolveActivePackage();
    if (resolved && resolved.id !== selectedPackageId) {
      setSelectedPackageId(resolved.id);
    }
  }, [activeSchedules, packages]);

  useEffect(() => {
    if (!isScheduleActive) {
      setEnteredToken('');
    }
  }, [isScheduleActive]);

  const handleCopyAndFillToken = () => {
    if (!isScheduleActive) {
      setError(
        'Token ujian belum keluar karena mata pelajaran pada menu Jadwal belum diaktifkan oleh Administrator.'
      );
      return;
    }
    setEnteredToken(activeToken);
    setCopied(true);
    setError('');
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isScheduleActive) {
      setError(
        'Anda belum dapat mengerjakan ujian. Mata pelajaran pada menu Jadwal belum diaktifkan oleh Administrator sehingga token belum keluar.'
      );
      return;
    }
    if (!fullName.trim()) {
      setError('Silakan ketikkan Nama Peserta terlebih dahulu.');
      return;
    }
    if (enteredToken.trim().toUpperCase() !== activeToken.toUpperCase()) {
      setError(`Token tidak sesuai. Token aktif saat ini adalah: ${activeToken}`);
      return;
    }
    setError('');
    onSubmitProfile({
      ...initialProfile,
      fullName: fullName.trim(),
      gender,
      selectedPackageId: activePackage?.id || selectedPackageId,
      birthDay,
      birthMonth,
      birthYear,
      enteredToken: enteredToken.trim().toUpperCase(),
    });
  };

  const activeSubjectLabel =
    isScheduleActive && activeSchedules.length > 0
      ? activeSchedules[0].mapel || activePackage?.title || '-'
      : '-';

  return (
    <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-8 py-8">
      {/* Main Confirmation Card */}
      <div className="max-w-[680px] mx-auto bg-white rounded-[14px] px-7 sm:px-10 py-8 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.14)] border border-slate-100">
        <h1 className="text-xl font-bold text-slate-800">
          Konfirmasi Data Peserta
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Pastikan identitas peserta dan mata pelajaran di bawah ini sudah sesuai sebelum memulai ujian.
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
            <div className="sm:col-span-2 text-sm font-medium text-slate-800">
              {initialProfile.schoolName}
            </div>
          </div>

          {/* Mata Pelajaran (Otomatis sesuai jadwal aktif tanpa dropdown Simulasi TKA) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:items-center py-1.5 border-b border-slate-100">
            <label className="text-xs font-semibold text-slate-500">
              Mata Pelajaran
            </label>
            <div className="sm:col-span-2 text-sm font-bold text-slate-800">
              {activeSubjectLabel}
            </div>
          </div>

          {/* Jenis Kelamin */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:items-center py-1.5">
            <label htmlFor="genderSelect" className="text-xs font-semibold text-slate-600">
              Jenis Kelamin
            </label>
            <div className="sm:col-span-2">
              <select
                id="genderSelect"
                value={gender}
                onChange={(e) => setGender(e.target.value as 'Laki-Laki' | 'Perempuan')}
                className="w-full px-3.5 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              >
                <option value="Laki-Laki">Laki-Laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
          </div>

          {/* Ketikkan Nama Peserta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:items-center py-1.5">
            <label htmlFor="participantName" className="text-xs font-semibold text-slate-600">
              Nama Peserta
            </label>
            <div className="sm:col-span-2">
              <input
                id="participantName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ketikkan Nama Peserta"
                className="w-full px-3.5 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Token Input */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:items-center py-1.5">
            <label htmlFor="tokenInput" className="text-xs font-semibold text-slate-600">
              Token
            </label>
            <div className="sm:col-span-2">
              <input
                id="tokenInput"
                type="text"
                disabled={!isScheduleActive}
                value={enteredToken}
                onChange={(e) => setEnteredToken(e.target.value.toUpperCase())}
                placeholder={
                  isScheduleActive
                    ? 'Ketikkan token di sini'
                    : 'Token belum keluar (Mapel belum aktif)'
                }
                className={`w-full px-3.5 py-2 font-mono text-sm font-bold tracking-widest uppercase border rounded-lg focus:outline-none transition-colors ${
                  isScheduleActive
                    ? 'text-slate-800 bg-slate-50 border-slate-200 focus:border-blue-600 focus:bg-white'
                    : 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed'
                }`}
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={!isScheduleActive}
              className={`w-full py-2.5 px-6 rounded-full text-sm font-semibold transition-all ${
                isScheduleActive
                  ? 'bg-[#0066ff] hover:bg-[#0052cc] text-white shadow-[0_6px_16px_rgba(0,102,255,0.28)] cursor-pointer'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isScheduleActive
                ? 'Submit'
                : 'Tidak Dapat Mengerjakan (Mapel Belum Diaktifkan Admin)'}
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
              <span className="text-sm font-bold text-slate-800">
                {profile.fullName} ({profile.gender})
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
