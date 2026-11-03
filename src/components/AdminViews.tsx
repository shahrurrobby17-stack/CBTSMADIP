import React, { useState, useMemo, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  ShieldAlert,
  Lock,
  UserCog,
  ArrowLeft,
  Home,
  ClipboardList,
  User,
  ClipboardCheck,
  RotateCcw,
  UserCheck,
  Users,
  FileCheck2,
  ChevronsLeft,
  ChevronsRight,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  LogOut,
  CheckCircle2,
  ArrowUpDown,
  KeyRound,
  BookOpen,
  Printer,
  Calendar,
  Clock,
} from 'lucide-react';
import { TutWuriLogo } from './PusmendikHeader';
import {
  AdminScheduleItem,
  ExamPackage,
  ExamResultSummary,
  Question,
} from '../types/cbt';
import { getQuestionTypeLabel } from '../data/cbtData';
import { ProctorParticipantRow } from './ProctorDashboardView';
import { generateProctorCardsPDF } from '../utils/pdfProctorCard';

interface AdminLoginViewProps {
  onAdminLoginSuccess: (adminUsername: string) => void;
  onBackToStudentLogin: () => void;
  onGoToProctorLogin: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  onAdminLoginSuccess,
  onBackToStudentLogin,
  onGoToProctorLogin,
}) => {
  const [adminUsername, setAdminUsername] = useState('K05060108-KB6K');
  const [password, setPassword] = useState('ADMIN2026*');
  const [tenant, setTenant] = useState('GLDTKASMA');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = adminUsername.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMsg('ID Administrator dan Password wajib diisi.');
      return;
    }

    setErrorMsg('');
    onAdminLoginSuccess(cleanUser.toUpperCase());
  };

  const handleFillDefaultAdmin = () => {
    setAdminUsername('K05060108-KB6K');
    setPassword('ADMIN2026*');
    setTenant('GLDTKASMA');
    setErrorMsg('');
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 min-h-[calc(100vh-10rem)]">
      <div className="w-full max-w-[440px] bg-white rounded-[14px] px-9 sm:px-11 py-10 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.16)] border border-slate-100/80">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-[18px] font-bold text-[#1e293b] tracking-tight">
            Login Administrator
          </h1>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0066ff]">
            <ShieldAlert className="w-4 h-4" />
            <span>Admin Server</span>
          </span>
        </div>

        <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[#475569]">
          Masukkan ID Administrator dan kata sandi Anda untuk mengakses dashboard pengelolaan ujian.
        </p>

        {errorMsg && (
          <div className="mt-4 px-3.5 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          {/* ID Administrator */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600">
              ID Administrator
            </label>
            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-slate-200 focus-within:border-[#0066ff] bg-slate-50/50">
              <UserCog className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="Masukkan ID Administrator"
                aria-label="ID Administrator"
                className="w-full text-sm text-slate-800 placeholder:text-slate-400 bg-transparent focus:outline-none"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600">
              Password
            </label>
            <div className="relative flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-slate-200 focus-within:border-[#0066ff] bg-slate-50/50">
              <Lock className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                aria-label="Password"
                className="w-full pr-7 text-sm text-slate-800 placeholder:text-slate-400 bg-transparent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
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

          {/* Tenant */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600">
              Tenant :
            </label>
            <input
              type="text"
              value={tenant}
              onChange={(e) => setTenant(e.target.value.toUpperCase())}
              placeholder="Kode Tenant (misal: GLDTKASMA)"
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 focus:border-[#0066ff] bg-slate-50/50 text-xs font-mono font-semibold text-slate-700 focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              className="w-full py-2.5 px-6 rounded-lg bg-[#0088ff] hover:bg-[#006fd6] active:scale-[0.99] text-white text-[14px] font-semibold shadow-[0_6px_16px_rgba(0,136,255,0.28)] transition-all cursor-pointer"
            >
              Sign-In Administrator
            </button>

            <button
              type="button"
              onClick={onGoToProctorLogin}
              className="w-full py-2 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Beralih ke Login Proktor
            </button>

            <button
              type="button"
              onClick={onBackToStudentLogin}
              className="w-full py-2 px-4 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Halaman Login Peserta</span>
            </button>
          </div>
        </form>
      </div>

      <div className="mt-5 w-full max-w-[440px] bg-white/85 backdrop-blur-xs rounded-xl p-3.5 border border-slate-200/80 shadow-xs space-y-2.5">
        <div className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Akses Masuk Cepat (Langsung Masuk Dashboard)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onAdminLoginSuccess('K05060108-KB6K')}
            className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            ⚡ Masuk Cepat Administrator
          </button>
          <button
            type="button"
            onClick={handleFillDefaultAdmin}
            className="py-2 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#0066ff] border border-blue-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Isi Kolom Otomatis
          </button>
        </div>
      </div>
    </main>
  );
};

const KELAS_OPTIONS = ['X', 'XI IPA', 'XI IPS', 'XII IPA', 'XII IPS'] as const;

export const INITIAL_ADMIN_PARTICIPANTS: ProctorParticipantRow[] = [
  {
    id: 'ap1',
    selected: true,
    status: 'Non Active',
    kodeTes: 'GLDTKA25MAH2',
    username: 'TK0506010801547',
    password: 'SMADIP1547*',
    namaPeserta: 'ANDRIAN FAJARICO PRASETYA',
    kelompok: '1',
    kelas: 'X',
    loginState: 'Belum Login',
  },
  {
    id: 'ap2',
    selected: true,
    status: 'Non Active',
    kodeTes: 'GLDTKA25MAH2',
    username: 'TK0506010801556',
    password: 'SMADIP1556*',
    namaPeserta: 'AHMAD RIZKI NOVANSYAH',
    kelompok: '1',
    kelas: 'XI IPA',
    loginState: 'Belum Login',
  },
  {
    id: 'ap3',
    selected: true,
    status: 'Non Active',
    kodeTes: 'GLDTKA25MAH2',
    username: 'TK0506010801565',
    password: 'SMADIP1565*',
    namaPeserta: 'ARYA RESTU KUSUMA',
    kelompok: '1',
    kelas: 'XI IPS',
    loginState: 'Sedang Mengerjakan',
    requestReset: true,
  },
  {
    id: 'ap4',
    selected: true,
    status: 'Non Active',
    kodeTes: 'GLDTKA25MAH2',
    username: 'TK0506010801574',
    password: 'SMADIP1574*',
    namaPeserta: 'AUREL RIZKY ADI PRATAMA',
    kelompok: '1',
    kelas: 'XII IPA',
    loginState: 'Belum Login',
  },
  {
    id: 'ap5',
    selected: true,
    status: 'Non Active',
    kodeTes: 'GLDTKA25MAH2',
    username: 'TK0506010801583',
    password: 'SMADIP1583*',
    namaPeserta: 'AHMAD DENY FIKRUDIN',
    kelompok: '1',
    kelas: 'XII IPS',
    loginState: 'Belum Login',
  },
  {
    id: 'ap6',
    selected: true,
    status: 'Non Active',
    kodeTes: 'GLDTKA25MAH2',
    username: 'TK0506010801592',
    password: 'SMADIP1592*',
    namaPeserta: 'ALDISA FRANDIKA LIAN PRATAMA',
    kelompok: '1',
    kelas: 'X',
    loginState: 'Belum Login',
  },
  {
    id: 'p7',
    selected: false,
    status: 'Active',
    kodeTes: 'GLDTKA25MAH2',
    username: 'P130100240',
    password: 'ANBKTKA26*',
    namaPeserta: 'NADIA PUTRI PRATAMA',
    kelompok: '1',
    kelas: 'XII IPA',
    loginState: 'Sedang Mengerjakan',
  },
  {
    id: 'p8',
    selected: false,
    status: 'Active',
    kodeTes: 'GLDTKA25MAH2',
    username: 'K020500118',
    password: 'SAINSTKA*',
    namaPeserta: 'BAGAS ADITYA NUGRAHA',
    kelompok: '2',
    kelas: 'XII IPA',
    loginState: 'Selesai',
  },
];

export interface AdminProctorItem {
  id: string;
  proctorId: string;
  fullName: string;
  roomName: string;
  rombel: string;
  encryptionCode: string;
  password: string;
  status: 'Active' | 'Non Active';
}

export const INITIAL_ADMIN_PROCTORS: AdminProctorItem[] = [
  {
    id: 'pr1',
    proctorId: 'K05060108-KB6K',
    fullName: 'DRS. H. AHMAD FAUZI, M.PD.',
    roomName: 'LAB KOMPUTER 1 (UTAMA)',
    rombel: 'Kelas X & XI IPA',
    encryptionCode: 'GLDTKASMA',
    password: 'SMADIP2026*',
    status: 'Active',
  },
  {
    id: 'pr2',
    proctorId: 'K05060108-KB7L',
    fullName: 'SITI NURHALIZA, S.KOM.',
    roomName: 'LAB KOMPUTER 2',
    rombel: 'Kelas XI IPS & XII IPA',
    encryptionCode: 'ENC-8842-WGR',
    password: 'PROKTOR02*',
    status: 'Active',
  },
  {
    id: 'pr3',
    proctorId: 'K05060108-KB8M',
    fullName: 'MOCHAMAD RIZALDI, S.PD.',
    roomName: 'LAB MULTIMEDIA 3',
    rombel: 'Kelas XII IPS',
    encryptionCode: 'ENC-9910-WGR',
    password: 'PROKTOR03*',
    status: 'Non Active',
  },
];

export const INITIAL_ADMIN_SCHEDULES: AdminScheduleItem[] = [
  {
    id: 'sch1',
    hariTanggal: 'Senin, 07 Desember 2026',
    kelas: 'X',
    mapel: 'Bahasa Indonesia & Literasi Membaca',
    waktuMulai: '07:30 WIB',
    durasi: '90 Menit',
    isActive: false,
  },
  {
    id: 'sch2',
    hariTanggal: 'Senin, 07 Desember 2026',
    kelas: 'XI IPA',
    mapel: 'Matematika & Fisika Dasar',
    waktuMulai: '07:30 WIB',
    durasi: '120 Menit',
    isActive: false,
  },
  {
    id: 'sch3',
    hariTanggal: 'Selasa, 08 Desember 2026',
    kelas: 'XI IPS',
    mapel: 'Ekonomi & Sosiologi',
    waktuMulai: '07:30 WIB',
    durasi: '90 Menit',
    isActive: false,
  },
  {
    id: 'sch4',
    hariTanggal: 'Rabu, 09 Desember 2026',
    kelas: 'XII IPA',
    mapel: 'Biologi & Kimia Terapan',
    waktuMulai: '09:30 WIB',
    durasi: '120 Menit',
    isActive: false,
  },
  {
    id: 'sch5',
    hariTanggal: 'Kamis, 10 Desember 2026',
    kelas: 'XII IPS',
    mapel: 'Geografi & Sejarah Indonesia',
    waktuMulai: '09:30 WIB',
    durasi: '90 Menit',
    isActive: false,
  },
];

type AdminSidebarMenuId =
  | 'beranda'
  | 'daftar_proktor'
  | 'status_peserta'
  | 'daftar_peserta'
  | 'jadwal'
  | 'status_tes'
  | 'request_reset'
  | 'daftar_login'
  | 'kelompok_tes'
  | 'laporan_pengolahan';

interface AdminDashboardViewProps {
  adminUsername: string;
  activeToken: string;
  tokenSecondsLeft: number;
  onUpdateToken: (newToken: string) => void;
  schedules: AdminScheduleItem[];
  onUpdateSchedules: (nextSchedules: AdminScheduleItem[]) => void;
  participants?: ProctorParticipantRow[];
  onUpdateParticipants?: React.Dispatch<
    React.SetStateAction<ProctorParticipantRow[]>
  >;
  proctors?: AdminProctorItem[];
  onUpdateProctors?: React.Dispatch<React.SetStateAction<AdminProctorItem[]>>;
  packages: ExamPackage[];
  onUpdatePackages: (nextPackages: ExamPackage[]) => void;
  onResetDefaultPackages: () => void;
  resultsHistory: ExamResultSummary[];
  onClearHistory: () => void;
  storageEngine?: 'vercel-kv' | 'vercel-serverless' | 'local';
  lastSyncedLabel?: string;
  onForceSyncStorage?: () => void;
  onLogoutAdmin: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  adminUsername,
  activeToken,
  tokenSecondsLeft,
  onUpdateToken,
  schedules,
  onUpdateSchedules,
  participants: externalParticipants,
  onUpdateParticipants,
  proctors: externalProctors,
  onUpdateProctors,
  packages,
  onUpdatePackages,
  onResetDefaultPackages,
  resultsHistory,
  onClearHistory,
  storageEngine = 'vercel-serverless',
  lastSyncedLabel = 'Tersimpan Otomatis',
  onForceSyncStorage,
  onLogoutAdmin,
}) => {
  // Default view is 'kelompok_tes' to match the user's attached screenshot 100%
  const [activeMenu, setActiveMenu] = useState<AdminSidebarMenuId>('kelompok_tes');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [localParticipants, setLocalParticipants] = useState<
    ProctorParticipantRow[]
  >(INITIAL_ADMIN_PARTICIPANTS);
  const [localProctors, setLocalProctors] = useState<AdminProctorItem[]>(
    INITIAL_ADMIN_PROCTORS
  );
  const participants = externalParticipants ?? localParticipants;
  const setParticipants = onUpdateParticipants ?? setLocalParticipants;
  const proctors = externalProctors ?? localProctors;
  const setProctors = onUpdateProctors ?? setLocalProctors;

  // Add New Proctor Form States
  const [newProctorName, setNewProctorName] = useState('');
  const [newProctorRoom, setNewProctorRoom] = useState('LAB KOMPUTER 1');
  const [newProctorRombel, setNewProctorRombel] = useState('Kelas X');
  const [newProctorPass] = useState('SMADIP2026*');
  const [proctorSearch, setProctorSearch] = useState('');

  // Filter controls (1: Status, 2: Kode Tes, 3: Kelompok, 4: Apply)
  const [filterStatus, setFilterStatus] = useState<string>('Non Aktif');
  const [filterKodeTes, setFilterKodeTes] = useState<string>('GLDTKA25MAH2');
  const [filterKelompok, setFilterKelompok] = useState<string>('1');

  const [appliedStatus, setAppliedStatus] = useState<string>('Non Aktif');
  const [appliedKodeTes, setAppliedKodeTes] = useState<string>('GLDTKA25MAH2');
  const [appliedKelompok, setAppliedKelompok] = useState<string>('1');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string>('');

  // Question Bank & Token states
  const [selectedPkgId, setSelectedPkgId] = useState(packages[0]?.id || '');
  const [customTokenInput, setCustomTokenInput] = useState(activeToken);

  useEffect(() => {
    setCustomTokenInput(activeToken);
  }, [activeToken]);

  const tokenMinutes = String(Math.floor(tokenSecondsLeft / 60)).padStart(2, '0');
  const tokenSeconds = String(tokenSecondsLeft % 60).padStart(2, '0');
  const tokenCountdownLabel = `${tokenMinutes}:${tokenSeconds}`;
  const tokenProgressPct = Math.max(
    0,
    Math.min(100, (tokenSecondsLeft / 300) * 100)
  );
  const [newCategory, setNewCategory] = useState('Literasi & Numerasi');
  const [newStimulusTitle, setNewStimulusTitle] = useState('');
  const [newStimulusText, setNewStimulusText] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [optE, setOptE] = useState('');
  const [correctOpt, setCorrectOpt] = useState('A');

  // Add New Participant form in Daftar Peserta (only requires Name; Username & Password auto-filled)
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantKelas, setNewParticipantKelas] = useState<string>('X');

  // Jadwal Ujian form state in menu Jadwal
  const [newHariTanggal, setNewHariTanggal] = useState('');
  const [newJadwalKelas, setNewJadwalKelas] = useState<string>('X');
  const [newJadwalMapel, setNewJadwalMapel] = useState('');
  const [newWaktuMulai, setNewWaktuMulai] = useState('07:30 WIB');
  const [newDurasi, setNewDurasi] = useState('90 Menit');

  const activeSchedules = useMemo(
    () => schedules.filter((s) => s.isActive),
    [schedules]
  );
  const isAnyScheduleActive = activeSchedules.length > 0;

  // Auto-generated Username & Password for next participant in Daftar Peserta
  const nextAutoSequence = 1547 + participants.length * 9;
  const autoGeneratedUsername = `TK050601080${nextAutoSequence}`;
  const autoGeneratedPassword = `SMADIP${nextAutoSequence}*`;

  // Auto-generated ID / Username Proktor & Kode Enkripsi in Daftar Proktor
  const nextProctorNumber = 6 + proctors.length;
  const nextProctorSuffixLetter = String.fromCharCode(
    65 + ((10 + proctors.length) % 26)
  );
  const autoGeneratedProctorId = `K05060108-KB${nextProctorNumber}${nextProctorSuffixLetter}`;
  const autoGeneratedProctorEnc = `ENC-${8104 + proctors.length * 319}-WGR`;

  const showNotice = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2600);
  };

  const filteredRows = useMemo(() => {
    return participants.filter((row) => {
      if (appliedStatus === 'Non Aktif' && row.status !== 'Non Active') {
        return false;
      }
      if (appliedStatus === 'Aktif' && row.status !== 'Active') {
        return false;
      }
      if (appliedKodeTes !== 'SEMUA' && row.kodeTes !== appliedKodeTes) {
        return false;
      }
      if (appliedKelompok !== 'SEMUA' && row.kelompok !== appliedKelompok) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchUser = row.username.toLowerCase().includes(q);
        const matchName = row.namaPeserta.toLowerCase().includes(q);
        if (!matchUser && !matchName) return false;
      }
      return true;
    });
  }, [
    participants,
    appliedStatus,
    appliedKodeTes,
    appliedKelompok,
    searchQuery,
  ]);

  const allVisibleSelected =
    filteredRows.length > 0 && filteredRows.every((r) => r.selected);

  const handleApplyFilter = () => {
    setAppliedStatus(filterStatus);
    setAppliedKodeTes(filterKodeTes);
    setAppliedKelompok(filterKelompok);
    showNotice('Filter Kelompok Test berhasil diterapkan.');
  };

  const handleToggleSelectAll = () => {
    const targetVal = !allVisibleSelected;
    const visibleIds = new Set(filteredRows.map((r) => r.id));
    setParticipants((prev) =>
      prev.map((r) =>
        visibleIds.has(r.id) ? { ...r, selected: targetVal } : r
      )
    );
  };

  const handleToggleRow = (id: string) => {
    setParticipants((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  };

  const handleAssignSelected = () => {
    const selectedCount = filteredRows.filter((r) => r.selected).length;
    if (selectedCount === 0) {
      showNotice('Centang minimal satu peserta terlebih dahulu.');
      return;
    }
    const visibleSelectedIds = new Set(
      filteredRows.filter((r) => r.selected).map((r) => r.id)
    );
    setParticipants((prev) =>
      prev.map((r) =>
        visibleSelectedIds.has(r.id) ? { ...r, status: 'Active' } : r
      )
    );
    setFilterStatus('Semua Status');
    setAppliedStatus('Semua Status');
    showNotice(`${selectedCount} peserta berhasil di-Assign (Status: Active).`);
  };

  const handleUnassignSelected = () => {
    const selectedCount = filteredRows.filter((r) => r.selected).length;
    if (selectedCount === 0) {
      showNotice('Centang minimal satu peserta terlebih dahulu.');
      return;
    }
    const visibleSelectedIds = new Set(
      filteredRows.filter((r) => r.selected).map((r) => r.id)
    );
    setParticipants((prev) =>
      prev.map((r) =>
        visibleSelectedIds.has(r.id) ? { ...r, status: 'Non Active' } : r
      )
    );
    setFilterStatus('Non Aktif');
    setAppliedStatus('Non Aktif');
    showNotice(`${selectedCount} peserta diubah menjadi Non Active.`);
  };

  const handleResetAll = () => {
    setFilterStatus('Non Aktif');
    setFilterKodeTes('GLDTKA25MAH2');
    setFilterKelompok('1');
    setAppliedStatus('Non Aktif');
    setAppliedKodeTes('GLDTKA25MAH2');
    setAppliedKelompok('1');
    setSearchQuery('');
    setParticipants(INITIAL_ADMIN_PARTICIPANTS);
    showNotice('Filter dan daftar peserta telah di-reset.');
  };

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParticipantName.trim()) return;
    const newRow: ProctorParticipantRow = {
      id: `ap_${Date.now()}`,
      selected: true,
      status: 'Non Active',
      kodeTes: 'GLDTKA25MAH2',
      username: autoGeneratedUsername,
      password: autoGeneratedPassword,
      namaPeserta: newParticipantName.trim().toUpperCase(),
      kelompok: '1',
      kelas: newParticipantKelas,
      loginState: 'Belum Login',
    };
    setParticipants((prev) => [newRow, ...prev]);
    setNewParticipantName('');
    showNotice(
      `Peserta ${newRow.namaPeserta} (Kelas ${newRow.kelas}) berhasil ditambahkan (Username: ${newRow.username} | Password: ${newRow.password}).`
    );
  };

  const selectedPackage =
    packages.find((p) => p.id === selectedPkgId) || packages[0];

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage || !newQuestionText.trim() || !optA.trim() || !optB.trim()) {
      return;
    }
    const nextNumber = selectedPackage.questions.length + 1;
    const newQuestion: Question = {
      id: `admin_q_${Date.now()}`,
      number: nextNumber,
      type: 'pilihan_ganda',
      category: newCategory.trim() || 'Sumatif Akhir Semester',
      stimulusTitle: newStimulusTitle.trim() || 'Wacana Soal',
      stimulusText:
        newStimulusText.trim() ||
        'Perhatikan bacaan berikut dengan saksama untuk menjawab soal.',
      questionText: newQuestionText.trim(),
      instructionText: 'Pilih satu jawaban yang paling tepat!',
      options: [
        { id: 'A', text: optA.trim() },
        { id: 'B', text: optB.trim() },
        { id: 'C', text: optC.trim() || 'Pilihan C' },
        { id: 'D', text: optD.trim() || 'Pilihan D' },
        { id: 'E', text: optE.trim() || 'Pilihan E' },
      ],
      correctOptionId: correctOpt,
      points: 10,
      explanation: `Kunci jawaban yang benar adalah opsi ${correctOpt}.`,
    };
    const nextPackages = packages.map((pkg) =>
      pkg.id === selectedPackage.id
        ? { ...pkg, questions: [...pkg.questions, newQuestion] }
        : pkg
    );
    onUpdatePackages(nextPackages);
    setNewStimulusTitle('');
    setNewStimulusText('');
    setNewQuestionText('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setOptE('');
    showNotice(`Soal No. ${nextNumber} berhasil ditambahkan ke bank soal.`);
  };

  const handleAddProctor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProctorName.trim()) return;
    const item: AdminProctorItem = {
      id: `pr_${Date.now()}`,
      proctorId: autoGeneratedProctorId,
      fullName: newProctorName.trim().toUpperCase(),
      roomName: newProctorRoom.trim().toUpperCase() || 'LAB KOMPUTER',
      rombel: newProctorRombel.trim() || 'Kelas X',
      encryptionCode: autoGeneratedProctorEnc,
      password: newProctorPass.trim() || 'SMADIP2026*',
      status: 'Active',
    };
    setProctors((prev) => [item, ...prev]);
    setNewProctorName('');
    showNotice(`Proktor ${item.fullName} (${item.proctorId}) berhasil ditambahkan.`);
  };

  const handleToggleProctorStatus = (id: string) => {
    setProctors((prev) =>
      prev.map((pr) =>
        pr.id === id
          ? { ...pr, status: pr.status === 'Active' ? 'Non Active' : 'Active' }
          : pr
      )
    );
    showNotice('Status aktif proktor berhasil diperbarui.');
  };

  const handleDeleteProctor = (id: string) => {
    setProctors((prev) => prev.filter((pr) => pr.id !== id));
    showNotice('Data proktor berhasil dihapus.');
  };

  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHariTanggal.trim() || !newJadwalMapel.trim()) return;
    const item: AdminScheduleItem = {
      id: `sch_${Date.now()}`,
      hariTanggal: newHariTanggal.trim(),
      kelas: newJadwalKelas,
      mapel: newJadwalMapel.trim(),
      waktuMulai: newWaktuMulai.trim() || '07:30 WIB',
      durasi: newDurasi.trim() || '90 Menit',
      isActive: false,
    };
    onUpdateSchedules([...schedules, item]);
    setNewHariTanggal('');
    setNewJadwalMapel('');
    showNotice(
      `Jadwal ${item.mapel} (Kelas ${item.kelas}) ditambahkan. Klik "Aktifkan Mapel" agar token keluar di Proktor & Siswa.`
    );
  };

  const handleToggleScheduleActive = (id: string) => {
    const target = schedules.find((s) => s.id === id);
    if (!target) return;
    const nextState = !target.isActive;
    const nextList = schedules.map((s) =>
      s.id === id ? { ...s, isActive: nextState } : s
    );
    onUpdateSchedules(nextList);
    if (nextState) {
      showNotice(
        `Mapel "${target.mapel}" (Kelas ${target.kelas}) DIAKTIFKAN! Token ujian kini keluar di halaman Proktor dan Siswa dapat mengerjakan.`
      );
    } else {
      showNotice(
        `Mapel "${target.mapel}" (Kelas ${target.kelas}) dinonaktifkan.`
      );
    }
  };

  const handleDeleteSchedule = (id: string) => {
    onUpdateSchedules(schedules.filter((s) => s.id !== id));
    showNotice('Data jadwal ujian berhasil dihapus.');
  };

  const SIDEBAR_MENUS: {
    id: AdminSidebarMenuId;
    label: string;
    breadcrumb: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'beranda', label: 'Beranda', breadcrumb: 'Beranda Administrator', icon: Home },
    { id: 'daftar_proktor', label: 'Daftar Proktor', breadcrumb: 'List Daftar Proktor', icon: UserCog },
    { id: 'status_peserta', label: 'Status Peserta', breadcrumb: 'List Status Peserta', icon: ClipboardList },
    { id: 'daftar_peserta', label: 'Daftar Peserta', breadcrumb: 'Manajemen Daftar Peserta', icon: User },
    { id: 'jadwal', label: 'Jadwal', breadcrumb: 'Jadwal Ujian Sumatif Akhir Semester', icon: Calendar },
    { id: 'status_tes', label: 'Status Tes', breadcrumb: 'Manajemen Bank Soal', icon: ClipboardCheck },
    { id: 'request_reset', label: 'Request Reset Login', breadcrumb: 'Request Reset Login', icon: RotateCcw },
    { id: 'daftar_login', label: 'Daftar Login', breadcrumb: 'Daftar Login Peserta', icon: UserCheck },
    { id: 'kelompok_tes', label: 'Kelompok Tes', breadcrumb: 'List Kelompok Test', icon: Users },
    { id: 'laporan_pengolahan', label: 'Laporan Pengolahan', breadcrumb: 'Laporan Pengolahan Nilai', icon: FileCheck2 },
  ];

  const currentMenuMeta =
    SIDEBAR_MENUS.find((m) => m.id === activeMenu) || SIDEBAR_MENUS[8];

  return (
    <div className="h-screen overflow-hidden flex bg-[#f4f6fa] text-slate-800">
      {/* LEFT SIDEBAR (Exact Deep Cobalt Navy & Geometric Facets matching reference screenshot) */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } h-screen relative overflow-hidden shrink-0 bg-[#001a6e] text-white flex flex-col transition-all duration-200 select-none shadow-xl z-20`}
      >
        {/* Exact Geometric Facet Overlay from ANBK Reference Screenshot */}
        <svg
          className="pointer-events-none absolute inset-0 w-full h-full"
          viewBox="0 0 260 900"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect width="260" height="900" fill="#001a6e" />
          <polygon points="0,380 260,220 260,640 0,520" fill="#001e7d" />
          <polygon points="260,470 75,900 260,900" fill="#002596" />
          <polygon points="0,510 175,900 0,900" fill="#00155a" />
        </svg>

        {/* Top Brand inside Sidebar */}
        <div className="relative z-10 h-16 shrink-0 px-5 bg-[#001147] flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <TutWuriLogo className="w-8 h-8 shrink-0" />
            {!sidebarCollapsed && (
              <span className="text-[16px] font-extrabold tracking-wide text-white whitespace-nowrap">
                ANBK
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="p-1.5 rounded-lg text-[#2563eb] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={sidebarCollapsed ? 'Perlebar Menu' : 'Ciutkan Menu'}
          >
            {sidebarCollapsed ? (
              <ChevronsRight className="w-5 h-5" />
            ) : (
              <ChevronsLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Scrollable Navigation Menu Items (Fixed height items so nothing shifts on click) */}
        <nav className="relative z-10 flex-1 overflow-y-auto overscroll-contain py-3 space-y-0.5">
          {SIDEBAR_MENUS.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeMenu === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveMenu(item.id)}
                className={`w-full h-12 shrink-0 flex items-center gap-3.5 px-6 text-left text-[13.5px] font-semibold leading-none transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#020c36] text-white'
                    : 'text-white hover:bg-[#020c36]/55'
                }`}
                title={item.label}
              >
                <IconComponent className="w-[18px] h-[18px] shrink-0 text-white" />
                {!sidebarCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Logout Administrator Button */}
        <div className="relative z-10 shrink-0 p-4 border-t border-white/10 bg-[#00155a]/90">
          <button
            type="button"
            onClick={onLogoutAdmin}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#020c36] hover:bg-rose-600 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Keluar Administrator</span>}
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top White Header Bar matching reference image */}
        <header className="shrink-0 bg-white px-7 py-3.5 flex items-center justify-between gap-4 border-b border-slate-200/80">
          <div>
            <h1 className="text-sm sm:text-[15px] font-bold tracking-wide text-slate-700 uppercase">
              ASSESMENT NASIONAL BERBASIS KOMPUTER
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-right">
              <div className="leading-tight">
                <div className="text-xs font-medium text-slate-500">
                  Hi, {adminUsername || 'K05060108-KB6K'}
                </div>
                <div className="text-xs font-bold text-slate-700">
                  GLDTKASMA
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#0095ff] text-white font-bold text-sm flex items-center justify-center shadow-xs">
                {(adminUsername || 'K').charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Sub-Header Breadcrumb Bar matching screenshot */}
        <div className="bg-white px-7 py-2.5 border-b border-slate-200/70 shadow-2xs flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5 text-slate-600">
            <span className="font-semibold text-slate-700">
              {currentMenuMeta.label === 'Kelompok Tes'
                ? 'Kelompok Test'
                : currentMenuMeta.label}
            </span>
            <span className="text-slate-300">|</span>
            <Home className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">•</span>
            <span className="text-slate-400">{currentMenuMeta.breadcrumb}</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Token Aktif:</span>
            {isAnyScheduleActive ? (
              <span className="font-mono font-black text-red-600 underline decoration-2 underline-offset-2 bg-red-50 px-2.5 py-0.5 rounded border border-red-200">
                {activeToken}
              </span>
            ) : (
              <span className="font-mono font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                BELUM KELUAR (Mapel Belum Aktif)
              </span>
            )}
          </div>
        </div>

        {/* MAIN BODY */}
        <main className="flex-1 p-6 sm:p-7 overflow-y-auto space-y-6">
          {/* 1. KELOMPOK TES (Exact Match to Attached Image) */}
          {activeMenu === 'kelompok_tes' && (
            <div className="space-y-6">
              {/* Filter Section */}
              <div className="space-y-3">
                <h2 className="text-[15px] font-semibold text-slate-700">
                  Filter
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
                  {/* 1. Status Dropdown */}
                  <div className="lg:col-span-3 space-y-1.5">
                    <label className="block text-xs font-medium text-slate-500">
                      Status
                    </label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm text-slate-700 bg-white border border-slate-200 rounded-lg shadow-2xs focus:outline-none focus:border-[#0095ff]"
                    >
                      <option value="Non Aktif">Non Aktif</option>
                      <option value="Aktif">Aktif</option>
                      <option value="Semua Status">Semua Status</option>
                    </select>
                  </div>

                  {/* 2. Kode Tes Dropdown */}
                  <div className="lg:col-span-3 space-y-1.5">
                    <label className="block text-xs font-medium text-slate-500">
                      Kode Tes
                    </label>
                    <select
                      value={filterKodeTes}
                      onChange={(e) => setFilterKodeTes(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm text-slate-700 bg-white border border-slate-200 rounded-lg shadow-2xs focus:outline-none focus:border-[#0095ff]"
                    >
                      <option value="GLDTKA25MAH2">GLDTKA25MAH2</option>
                      <option value="SEMUA">Semua Kode Tes</option>
                    </select>
                  </div>

                  {/* 3. Kelompok Dropdown */}
                  <div className="lg:col-span-3 space-y-1.5">
                    <label className="block text-xs font-medium text-slate-500">
                      Kelompok
                    </label>
                    <select
                      value={filterKelompok}
                      onChange={(e) => setFilterKelompok(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm text-slate-700 bg-white border border-slate-200 rounded-lg shadow-2xs focus:outline-none focus:border-[#0095ff]"
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="SEMUA">Semua Kelompok</option>
                    </select>
                  </div>

                  {/* 4. Apply Button */}
                  <div className="lg:col-span-3">
                    <button
                      type="button"
                      onClick={handleApplyFilter}
                      className="px-8 py-2.5 rounded-lg bg-[#0095ff] hover:bg-[#007acc] text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              {/* Table Card */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-100 overflow-hidden">
                {/* Search & Unassign / Assign / Reset Toolbar */}
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Search Input */}
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by Username atau Nama Peserta"
                      className="w-full pl-10 pr-4 py-2 text-xs text-slate-700 placeholder:text-slate-400 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#0095ff]"
                    />
                  </div>

                  {/* Action Buttons: Unassign | Assign | Reset */}
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleUnassignSelected}
                      className="px-4 py-2 rounded-lg border border-[#93c5fd] bg-blue-50/50 hover:bg-blue-100/70 text-[#3b82f6] text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Unassign
                    </button>
                    <button
                      type="button"
                      onClick={handleAssignSelected}
                      className="px-5 py-2 rounded-lg bg-[#0095ff] hover:bg-[#007acc] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      Assign
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAll}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#f04452] hover:bg-[#d93240] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>

                {/* Participant Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f8f9fc] border-y border-slate-100 text-[12px] font-bold text-slate-600">
                        <th className="py-3.5 px-5 w-12">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={handleToggleSelectAll}
                            aria-label="Pilih Semua Peserta"
                            className="w-4 h-4 rounded accent-[#0095ff] cursor-pointer"
                          />
                        </th>
                        <th className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5">
                            <span>Status</span>
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </div>
                        </th>
                        <th className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5">
                            <span>Kode Test</span>
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </div>
                        </th>
                        <th className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5">
                            <span>Username</span>
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </div>
                        </th>
                        <th className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5">
                            <span>Nama Peserta</span>
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </div>
                        </th>
                        <th className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <span>Kelompok</span>
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-10 text-center text-slate-400"
                          >
                            Tidak ada data peserta yang sesuai dengan filter. Klik tombol Reset atau ubah Status menjadi Semua Status.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row) => (
                          <tr
                            key={row.id}
                            onClick={() => handleToggleRow(row.id)}
                            className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                          >
                            <td
                              className="py-4 px-5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={row.selected}
                                onChange={() => handleToggleRow(row.id)}
                                aria-label={`Pilih ${row.namaPeserta}`}
                                className="w-4 h-4 rounded accent-[#0095ff] cursor-pointer"
                              />
                            </td>
                            <td className="py-4 px-4">
                              {row.status === 'Non Active' ? (
                                <span className="inline-block min-w-[110px] text-center px-3 py-1 rounded-md bg-[#ffe4e6] text-[#f43f5e] font-semibold text-[11.5px]">
                                  Non Active
                                </span>
                              ) : (
                                <span className="inline-block min-w-[110px] text-center px-3 py-1 rounded-md bg-emerald-100 text-emerald-700 font-semibold text-[11.5px]">
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 font-medium text-slate-600">
                              {row.kodeTes}
                            </td>
                            <td className="py-4 px-4 font-mono text-slate-600">
                              {row.username}
                            </td>
                            <td className="py-4 px-4 font-medium text-slate-700">
                              {row.namaPeserta}
                            </td>
                            <td className="py-4 px-4 text-center font-mono text-slate-600">
                              {row.kelompok}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. BERANDA */}
          {activeMenu === 'beranda' && (
            <div className="space-y-6">
              {/* Kartu Token Ujian Aktif (Otomatis Berganti Setiap 5 Menit jika Mapel di Jadwal Aktif) */}
              <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <KeyRound className="w-4 h-4 text-[#0095ff]" />
                      <span>Kartu Token Ujian Aktif</span>
                    </div>

                    {isAnyScheduleActive ? (
                      <div className="pt-1 flex flex-col items-start gap-3">
                        <div className="font-mono text-4xl sm:text-5xl font-black tracking-[0.25em] text-red-600 underline decoration-red-600 decoration-4 underline-offset-8 [text-shadow:0_0_1px_currentColor]">
                          {activeToken}
                        </div>
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
                          <span className="text-slate-500">
                            Berganti otomatis dalam:
                          </span>
                          <span className="font-mono font-black text-red-600 text-sm">
                            {tokenCountdownLabel}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-1 flex flex-col items-start gap-3">
                        <div className="font-mono text-4xl sm:text-5xl font-black tracking-[0.2em] text-slate-400 underline decoration-slate-300 decoration-4 underline-offset-8 [text-shadow:0_0_1px_currentColor]">
                          BELUM KELUAR
                        </div>
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-400">
                          <span>Berganti otomatis dalam: --:--</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setActiveMenu('jadwal')}
                            className="px-3.5 py-1.5 rounded-lg bg-[#0095ff] hover:bg-[#007acc] text-white text-xs font-semibold cursor-pointer"
                          >
                            Buka Menu Jadwal & Aktifkan Mapel →
                          </button>
                          <p className="text-xs text-slate-500 font-medium">
                            Mata pelajaran pada menu <strong>Jadwal</strong> belum diaktifkan oleh Administrator.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={!isAnyScheduleActive}
                      onClick={() => {
                        onUpdateToken(activeToken);
                        showNotice(
                          `Token aktif (${activeToken}) berhasil disimpan & durasi 5 menit di-reset.`
                        );
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold ${
                        isAnyScheduleActive
                          ? 'bg-slate-800 hover:bg-slate-900 text-white cursor-pointer'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      Simpan Token
                    </button>
                    <button
                      type="button"
                      disabled={!isAnyScheduleActive}
                      onClick={() => {
                        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                        let t = '';
                        for (let i = 0; i < 6; i++) {
                          t += chars.charAt(
                            Math.floor(Math.random() * chars.length)
                          );
                        }
                        setCustomTokenInput(t);
                        onUpdateToken(t);
                        showNotice(
                          `Token baru dirilis (${t}) — durasi otomatis 5 menit dimulai ulang.`
                        );
                      }}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold ${
                        isAnyScheduleActive
                          ? 'bg-[#0095ff] hover:bg-[#007acc] text-white cursor-pointer'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Rilis Token Baru</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-xs font-semibold text-slate-500">
                    Total Peserta Terdaftar
                  </div>
                  <div className="mt-2 font-mono text-2xl font-extrabold text-slate-800">
                    {participants.length} Peserta
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-xs font-semibold text-slate-500">
                    Mapel Jadwal Aktif
                  </div>
                  <div className="mt-2 font-mono text-2xl font-extrabold text-emerald-600">
                    {activeSchedules.length} / {schedules.length} Mapel
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-xs font-semibold text-slate-500">
                    Token Ujian Saat Ini (5 Menit)
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    {isAnyScheduleActive ? (
                      <>
                        <span className="font-mono text-2xl font-black tracking-widest text-red-600 underline decoration-red-600 decoration-2 underline-offset-4">
                          {activeToken}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-500">
                          {tokenCountdownLabel}
                        </span>
                      </>
                    ) : (
                      <span className="font-mono text-xl font-black tracking-wider text-slate-400 underline decoration-slate-300 decoration-2 underline-offset-4">
                        BELUM KELUAR
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-800">
                        Penyimpanan Cloud Vercel (`/api/storage`)
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[11px] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {storageEngine === 'vercel-kv'
                            ? 'Vercel KV / Redis Aktif'
                            : 'Vercel Serverless Storage Aktif'}
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Seluruh data Jadwal Ujian, Daftar Proktor, Daftar Peserta, Kelompok Tes, Bank Soal, Token Aktif, dan Laporan Nilai tersimpan otomatis di Vercel Storage ({lastSyncedLabel}).
                    </p>
                  </div>
                  {onForceSyncStorage && (
                    <button
                      type="button"
                      onClick={() => {
                        onForceSyncStorage();
                        showNotice(
                          'Data sistem berhasil disinkronkan ke Penyimpanan Vercel!'
                        );
                      }}
                      className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0095ff] hover:bg-[#007acc] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sinkronkan ke Vercel</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700">
                    Dashboard Administrator — CBT SMA Islam Diponegoro Wagir
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Kartu <strong>Token Ujian Aktif</strong> pada halaman Beranda ini akan berganti secara otomatis setiap <strong>5 menit</strong>. Gunakan menu <strong>Daftar Proktor</strong> untuk mengelola akun proktor ruang ujian, menu <strong>Kelompok Tes</strong> untuk mengaktifkan (Assign) peserta ujian, menu <strong>Daftar Peserta</strong> untuk menambah peserta baru, menu <strong>Status Tes</strong> untuk mengelola Bank Soal, dan menu <strong>Laporan Pengolahan</strong> untuk merekapitulasi nilai.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 2B. DAFTAR PROKTOR */}
          {activeMenu === 'daftar_proktor' && (
            <div className="space-y-6">
              {/* Form Tambah Proktor Baru */}
              <form
                onSubmit={handleAddProctor}
                className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800">
                    Tambah Akun Proktor Ruang Baru
                  </h3>
                  <span className="text-xs text-slate-500">
                    Total Proktor: <strong>{proctors.length}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                  <div className="space-y-1">
                    <label className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>ID / Username Proktor</span>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">
                        Otomatis
                      </span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={autoGeneratedProctorId}
                      title="ID / Username Proktor terisi otomatis"
                      className="w-full px-3 py-2 font-mono font-semibold text-xs text-slate-700 bg-slate-100 border border-slate-200 rounded-lg cursor-not-allowed select-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Nama Lengkap Proktor *
                    </label>
                    <input
                      type="text"
                      required
                      value={newProctorName}
                      onChange={(e) => setNewProctorName(e.target.value)}
                      placeholder="Nama lengkap & gelar"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0095ff]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Ruang / Lab Ujian
                    </label>
                    <input
                      type="text"
                      value={newProctorRoom}
                      onChange={(e) => setNewProctorRoom(e.target.value)}
                      placeholder="Misal: LAB KOMPUTER 1"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0095ff]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Rombel yang Dipegang
                    </label>
                    <input
                      type="text"
                      value={newProctorRombel}
                      onChange={(e) => setNewProctorRombel(e.target.value)}
                      placeholder="Misal: Kelas X & XI IPA"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0095ff]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>Kode Enkripsi</span>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">
                        Otomatis
                      </span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={autoGeneratedProctorEnc}
                      title="Kode Enkripsi terisi otomatis"
                      className="w-full px-3 py-2 font-mono font-bold text-xs text-emerald-700 bg-emerald-50/70 border border-emerald-200 rounded-lg cursor-not-allowed select-all"
                    />
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#0095ff] hover:bg-[#007acc] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Proktor</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Tabel Daftar Proktor */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-100 overflow-hidden">
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={proctorSearch}
                      onChange={(e) => setProctorSearch(e.target.value)}
                      placeholder="Cari ID Proktor, Nama, Ruang, atau Rombel..."
                      className="w-full pl-10 pr-4 py-2 text-xs text-slate-700 placeholder:text-slate-400 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#0095ff]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        generateProctorCardsPDF(
                          proctors,
                          'Kartu_Semua_Proktor_CBT_SMADIP.pdf',
                          schedules
                        );
                        showNotice(
                          'File PDF seluruh Kartu Proktor berhasil diunduh!'
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0095ff] hover:bg-[#007acc] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Cetak Semua Kartu Proktor (PDF)</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#f8f9fc] border-b border-slate-100 text-slate-600 font-bold">
                        <th className="py-3.5 px-5">Status</th>
                        <th className="py-3.5 px-4">ID Proktor</th>
                        <th className="py-3.5 px-4">Nama Proktor</th>
                        <th className="py-3.5 px-4">Ruang / Lab</th>
                        <th className="py-3.5 px-4">Rombel yang Dipegang</th>
                        <th className="py-3.5 px-4">Kode Enkripsi</th>
                        <th className="py-3.5 px-4">Kata Sandi</th>
                        <th className="py-3.5 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {proctors
                        .filter((pr) => {
                          if (!proctorSearch.trim()) return true;
                          const q = proctorSearch.toLowerCase();
                          return (
                            pr.proctorId.toLowerCase().includes(q) ||
                            pr.fullName.toLowerCase().includes(q) ||
                            pr.roomName.toLowerCase().includes(q) ||
                            pr.rombel.toLowerCase().includes(q)
                          );
                        })
                        .map((pr) => (
                          <tr key={pr.id} className="hover:bg-slate-50/90">
                            <td className="py-4 px-5">
                              {pr.status === 'Active' ? (
                                <span className="inline-block min-w-[96px] text-center px-3 py-1 rounded-md bg-emerald-100 text-emerald-700 font-semibold text-[11.5px]">
                                  Active
                                </span>
                              ) : (
                                <span className="inline-block min-w-[96px] text-center px-3 py-1 rounded-md bg-[#ffe4e6] text-[#f43f5e] font-semibold text-[11.5px]">
                                  Non Active
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 font-mono font-semibold text-slate-700">
                              {pr.proctorId}
                            </td>
                            <td className="py-4 px-4 font-semibold text-slate-800">
                              {pr.fullName}
                            </td>
                            <td className="py-4 px-4 text-slate-600">
                              {pr.roomName}
                            </td>
                            <td className="py-4 px-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-semibold text-[11px]">
                                {pr.rombel}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-mono font-bold text-[#0095ff]">
                              {pr.encryptionCode}
                            </td>
                            <td className="py-4 px-4 font-mono text-slate-500">
                              {pr.password}
                            </td>
                            <td className="py-4 px-4 text-right space-x-2 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleToggleProctorStatus(pr.id)}
                                className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#0095ff] text-[11px] font-semibold cursor-pointer"
                              >
                                {pr.status === 'Active' ? 'Nonaktifkan' : 'Aktifkan'}
                              </button>
                              {proctors.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProctor(pr.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer inline-flex items-center"
                                  title="Hapus Proktor"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Template Kartu Proktor (Sesuai Contoh Resmi) */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-100 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Template Kartu Proktor
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pratinjau format cetak Kartu Proktor (Nama Proktor, ID Proktor, Rombel yang Dipegang, Kode Enkripsi, Kata Sandi, dan Nama Sekolah)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {proctors
                    .filter((pr) => {
                      if (!proctorSearch.trim()) return true;
                      const q = proctorSearch.toLowerCase();
                      return (
                        pr.proctorId.toLowerCase().includes(q) ||
                        pr.fullName.toLowerCase().includes(q) ||
                        pr.roomName.toLowerCase().includes(q) ||
                        pr.rombel.toLowerCase().includes(q)
                      );
                    })
                    .map((pr) => (
                      <div
                        key={`card_${pr.id}`}
                        className="bg-white border border-slate-300 p-5 text-slate-900 shadow-2xs"
                      >
                        {/* Header Kartu dengan garis atas & bawah */}
                        <div className="border-y border-black py-2.5 px-2 flex items-center justify-between gap-3">
                          <TutWuriLogo className="w-14 h-14 shrink-0" />
                          <div className="text-center leading-snug font-bold text-black text-[13px] sm:text-sm tracking-tight">
                            <div>KARTU PROKTOR</div>
                            <div>SUMATIF AKHIR SEMESTER</div>
                            <div>TAHUN 2026</div>
                          </div>
                          <div className="w-14 shrink-0" aria-hidden="true" />
                        </div>

                        {/* Isi Data Proktor */}
                        <div className="mt-4 space-y-2 text-xs sm:text-[13px] text-black">
                          <div className="grid grid-cols-[155px_12px_1fr]">
                            <span>Nama Proktor</span>
                            <span>:</span>
                            <span className="font-medium">{pr.fullName}</span>
                          </div>
                          <div className="grid grid-cols-[155px_12px_1fr]">
                            <span>ID Proktor</span>
                            <span>:</span>
                            <span className="font-mono">{pr.proctorId}</span>
                          </div>
                          <div className="grid grid-cols-[155px_12px_1fr]">
                            <span>Rombel yang Dipegang</span>
                            <span>:</span>
                            <span>{pr.rombel}</span>
                          </div>
                          <div className="grid grid-cols-[155px_12px_1fr]">
                            <span>Kode Enkripsi</span>
                            <span>:</span>
                            <span className="font-mono">{pr.encryptionCode}</span>
                          </div>
                          <div className="grid grid-cols-[155px_12px_1fr]">
                            <span>Kata Sandi</span>
                            <span>:</span>
                            <span className="font-mono">{pr.password}</span>
                          </div>
                          <div className="grid grid-cols-[155px_12px_1fr]">
                            <span>Nama Sekolah</span>
                            <span>:</span>
                            <span>SMA ISLAM DIPONEGORO WAGIR</span>
                          </div>
                        </div>

                        <div className="mt-5 border-b border-black" />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. DAFTAR PESERTA / STATUS PESERTA / REQUEST RESET / DAFTAR LOGIN */}
          {(activeMenu === 'daftar_peserta' ||
            activeMenu === 'status_peserta' ||
            activeMenu === 'request_reset' ||
            activeMenu === 'daftar_login') && (
            <div className="space-y-6">
              {activeMenu === 'daftar_peserta' && (
                <form
                  onSubmit={handleAddParticipant}
                  className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        Tambah Peserta Baru (Username & Password Otomatis)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Cukup masukkan <strong>Nama Lengkap Peserta</strong> saja. Username dan Password peserta akan terisi secara otomatis oleh sistem.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                    {/* Input Nama Peserta Saja */}
                    <div className="lg:col-span-3 space-y-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Nama Lengkap Peserta *
                      </label>
                      <input
                        type="text"
                        required
                        value={newParticipantName}
                        onChange={(e) => setNewParticipantName(e.target.value)}
                        placeholder="Ketikkan nama lengkap peserta saja..."
                        className="w-full px-3.5 py-2 text-xs bg-white border border-blue-300 focus:border-[#0095ff] rounded-lg focus:outline-none shadow-2xs"
                      />
                    </div>

                    {/* Auto-filled Username */}
                    <div className="lg:col-span-3 space-y-1">
                      <label className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>Username Peserta</span>
                        <span className="text-[10px] font-bold text-[#0095ff] uppercase">
                          Otomatis
                        </span>
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={autoGeneratedUsername}
                        title="Username terisi otomatis"
                        className="w-full px-3.5 py-2 font-mono font-semibold text-xs text-slate-700 bg-slate-100 border border-slate-200 rounded-lg cursor-not-allowed select-all"
                      />
                    </div>

                    {/* Auto-filled Password */}
                    <div className="lg:col-span-2 space-y-1">
                      <label className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>Password</span>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase">
                          Otomatis
                        </span>
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={autoGeneratedPassword}
                        title="Password terisi otomatis"
                        className="w-full px-3.5 py-2 font-mono font-bold text-xs text-emerald-700 bg-emerald-50/70 border border-emerald-200 rounded-lg cursor-not-allowed select-all"
                      />
                    </div>

                    {/* Kelas */}
                    <div className="lg:col-span-2 space-y-1">
                      <label className="block text-xs font-semibold text-slate-600">
                        Kelas
                      </label>
                      <select
                        value={newParticipantKelas}
                        onChange={(e) => setNewParticipantKelas(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0095ff]"
                      >
                        {KELAS_OPTIONS.map((kls) => (
                          <option key={kls} value={kls}>
                            {kls}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Submit Button */}
                    <div className="lg:col-span-2">
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#0095ff] hover:bg-[#007acc] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tambah Peserta</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="bg-white rounded-xl shadow-xs border border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800">
                    {currentMenuMeta.label} ({participants.length} Peserta)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveMenu('kelompok_tes')}
                    className="text-xs font-semibold text-[#0095ff] hover:underline cursor-pointer"
                  >
                    Ke Menu Kelompok Tes →
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#f8f9fc] border-b border-slate-100 text-slate-600 font-bold">
                        <th className="py-3.5 px-5">Username</th>
                        <th className="py-3.5 px-4">Password</th>
                        <th className="py-3.5 px-4">Nama Peserta</th>
                        <th className="py-3.5 px-4">Kode Test</th>
                        <th className="py-3.5 px-4 text-center">Kelas</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Sesi Login</th>
                        <th className="py-3.5 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {participants.map((p, idx) => {
                        const displayPassword =
                          p.password || `SMADIP${1547 + idx * 9}*`;
                        const currentKelas =
                          p.kelas || KELAS_OPTIONS[idx % KELAS_OPTIONS.length];
                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-3.5 px-5 font-mono font-semibold text-slate-700">
                              {p.username}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-[#0095ff]">
                              {displayPassword}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-800">
                              {p.namaPeserta}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              {p.kodeTes}
                            </td>
                            <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                              {currentKelas}
                            </td>
                            <td className="py-3.5 px-4">
                              {p.status === 'Active' ? (
                                <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-700 font-semibold">
                                  Active
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded bg-[#ffe4e6] text-[#f43f5e] font-semibold">
                                  Non Active
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">{p.loginState}</td>
                            <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setParticipants((prev) =>
                                    prev.map((row) =>
                                      row.id === p.id
                                        ? {
                                            ...row,
                                            loginState: 'Belum Login',
                                            requestReset: false,
                                          }
                                        : row
                                    )
                                  );
                                  showNotice(
                                    `Login peserta ${p.namaPeserta} telah di-reset.`
                                  );
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#f04452] hover:bg-[#d93240] text-white text-[11px] font-semibold cursor-pointer"
                              >
                                Reset Login
                              </button>
                              {participants.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setParticipants((prev) =>
                                      prev.filter((row) => row.id !== p.id)
                                    );
                                    showNotice(
                                      `Peserta ${p.namaPeserta} telah dihapus.`
                                    );
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer inline-flex items-center"
                                  title="Hapus Peserta"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3B. JADWAL UJIAN (Di atas menu Status Tes) */}
          {activeMenu === 'jadwal' && (
            <div className="space-y-6">
              {/* Form Tambah Jadwal Ujian */}
              <form
                onSubmit={handleAddSchedule}
                className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Tambah Jadwal Ujian Sumatif Akhir Semester
                    </h3>
                    <p className="text-xs text-slate-500">
                      Lengkapi Hari dan Tanggal, Kelas, Mata Pelajaran (Mapel), Waktu Mulai, serta Durasi ujian.
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">
                    Total Jadwal: <strong>{schedules.length}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                  {/* Hari dan Tanggal */}
                  <div className="lg:col-span-3 space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Hari dan Tanggal *
                    </label>
                    <input
                      type="text"
                      required
                      value={newHariTanggal}
                      onChange={(e) => setNewHariTanggal(e.target.value)}
                      placeholder="Contoh: Senin, 07 Desember 2026"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0095ff]"
                    />
                  </div>

                  {/* Kelas */}
                  <div className="lg:col-span-2 space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Kelas *
                    </label>
                    <select
                      value={newJadwalKelas}
                      onChange={(e) => setNewJadwalKelas(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0095ff]"
                    >
                      {KELAS_OPTIONS.map((kls) => (
                        <option key={kls} value={kls}>
                          {kls}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Mapel */}
                  <div className="lg:col-span-3 space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Mapel (Mata Pelajaran) *
                    </label>
                    <input
                      type="text"
                      required
                      value={newJadwalMapel}
                      onChange={(e) => setNewJadwalMapel(e.target.value)}
                      placeholder="Contoh: Matematika Wajib"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0095ff]"
                    />
                  </div>

                  {/* Waktu Mulai */}
                  <div className="lg:col-span-2 space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Waktu Mulai
                    </label>
                    <input
                      type="text"
                      value={newWaktuMulai}
                      onChange={(e) => setNewWaktuMulai(e.target.value)}
                      placeholder="Contoh: 07:30 WIB"
                      className="w-full px-3 py-2 font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0095ff]"
                    />
                  </div>

                  {/* Durasi */}
                  <div className="lg:col-span-2 space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Durasi
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newDurasi}
                        onChange={(e) => setNewDurasi(e.target.value)}
                        placeholder="90 Menit"
                        className="w-full px-3 py-2 font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0095ff]"
                      />
                      <button
                        type="submit"
                        className="shrink-0 inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-lg bg-[#0095ff] hover:bg-[#007acc] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                        title="Tambah Jadwal"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tambah</span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Tabel Jadwal Ujian */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#0095ff]" />
                      <h3 className="text-sm font-bold text-slate-800">
                        Daftar Jadwal Ujian — CBT SMA Islam Diponegoro Wagir
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500">
                      Klik tombol <strong>Aktifkan Mapel</strong> pada jadwal di bawah agar Token Ujian keluar pada halaman Proktor dan Siswa dapat mulai mengerjakan.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateSchedules(
                          schedules.map((s) => ({ ...s, isActive: true }))
                        );
                        showNotice(
                          'Semua mata pelajaran diaktifkan! Token ujian kini keluar di halaman Proktor & Siswa.'
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Aktifkan Semua Mapel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateSchedules(
                          schedules.map((s) => ({ ...s, isActive: false }))
                        );
                        showNotice(
                          'Semua mata pelajaran dinonaktifkan. Token ujian disembunyikan dari Proktor & Siswa.'
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      <span>Nonaktifkan Semua</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateSchedules(INITIAL_ADMIN_SCHEDULES);
                        showNotice('Jadwal ujian dikembalikan ke data awal.');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#f04452] hover:bg-[#d93240] text-white text-xs font-semibold cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Jadwal</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#f8f9fc] border-b border-slate-100 text-slate-600 font-bold">
                        <th className="py-3.5 px-5 w-12">No</th>
                        <th className="py-3.5 px-4">Status Mapel</th>
                        <th className="py-3.5 px-4">Hari dan Tanggal</th>
                        <th className="py-3.5 px-4 text-center">Kelas</th>
                        <th className="py-3.5 px-4">Mapel</th>
                        <th className="py-3.5 px-4">Waktu Mulai</th>
                        <th className="py-3.5 px-4">Durasi</th>
                        <th className="py-3.5 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedules.map((sch, index) => (
                        <tr key={sch.id} className="hover:bg-slate-50/90">
                          <td className="py-3.5 px-5 font-mono text-slate-500">
                            {index + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            {sch.isActive ? (
                              <span className="inline-block min-w-[110px] text-center px-3 py-1 rounded-md bg-emerald-100 text-emerald-700 font-semibold text-[11.5px]">
                                Aktif (Token Keluar)
                              </span>
                            ) : (
                              <span className="inline-block min-w-[110px] text-center px-3 py-1 rounded-md bg-[#ffe4e6] text-[#f43f5e] font-semibold text-[11.5px]">
                                Belum Diaktifkan
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {sch.hariTanggal}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-block px-2.5 py-1 rounded-md bg-blue-50 text-[#0095ff] font-bold">
                              {sch.kelas}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-700">
                            {sch.mapel}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{sch.waktuMulai}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-emerald-700">
                            {sch.durasi}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleToggleScheduleActive(sch.id)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                                sch.isActive
                                  ? 'border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600'
                                  : 'bg-[#0095ff] hover:bg-[#007acc] text-white shadow-2xs'
                              }`}
                            >
                              {sch.isActive
                                ? 'Nonaktifkan Mapel'
                                : 'Aktifkan Mapel'}
                            </button>
                            {schedules.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSchedule(sch.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer inline-flex items-center"
                                title="Hapus Jadwal"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. STATUS TES (Manajemen Bank Soal) */}
          {activeMenu === 'status_tes' && selectedPackage && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#0095ff]" />
                    <h3 className="text-sm font-bold text-slate-800">
                      Manajemen Bank Soal ({selectedPackage.questions.length} Soal)
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      value={selectedPackage.id}
                      onChange={(e) => setSelectedPkgId(e.target.value)}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg"
                    >
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        onResetDefaultPackages();
                        showNotice('Bank soal dikembalikan ke setelan awal.');
                      }}
                      className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                    >
                      Reset Soal Bawaan
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                  {selectedPackage.questions.map((q) => (
                    <div
                      key={q.id}
                      className="p-3.5 flex items-start justify-between gap-3 hover:bg-slate-50 text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-[#0095ff]">
                          No. {q.number}
                        </span>{' '}
                        <span className="font-semibold text-slate-700">
                          [{getQuestionTypeLabel(q.type)}]
                        </span>{' '}
                        <span className="text-slate-400">· {q.category}</span>
                        <p className="text-slate-700 mt-1">{q.questionText}</p>
                      </div>
                      {selectedPackage.questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextPackages = packages.map((pkg) => {
                              if (pkg.id !== selectedPackage.id) return pkg;
                              const filtered = pkg.questions
                                .filter((item) => item.id !== q.id)
                                .map((item, idx) => ({
                                  ...item,
                                  number: idx + 1,
                                }));
                              return { ...pkg, questions: filtered };
                            });
                            onUpdatePackages(nextPackages);
                            showNotice('Soal berhasil dihapus.');
                          }}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={handleAddQuestion}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Plus className="w-4 h-4 text-[#0095ff]" />
                    <span>Tambah Soal Pilihan Ganda Baru</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Kategori / Materi"
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      value={newStimulusTitle}
                      onChange={(e) => setNewStimulusTitle(e.target.value)}
                      placeholder="Judul Wacana"
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={newStimulusText}
                    onChange={(e) => setNewStimulusText(e.target.value)}
                    placeholder="Teks Wacana Soal..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    required
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Pertanyaan Soal *"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      value={optA}
                      onChange={(e) => setOptA(e.target.value)}
                      placeholder="Opsi A *"
                      className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      required
                      value={optB}
                      onChange={(e) => setOptB(e.target.value)}
                      placeholder="Opsi B *"
                      className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      value={optC}
                      onChange={(e) => setOptC(e.target.value)}
                      placeholder="Opsi C"
                      className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      value={optD}
                      onChange={(e) => setOptD(e.target.value)}
                      placeholder="Opsi D"
                      className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      value={optE}
                      onChange={(e) => setOptE(e.target.value)}
                      placeholder="Opsi E"
                      className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                    <select
                      value={correctOpt}
                      onChange={(e) => setCorrectOpt(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                    >
                      {['A', 'B', 'C', 'D', 'E'].map((k) => (
                        <option key={k} value={k}>
                          Kunci: Opsi {k}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-[#0095ff] hover:bg-[#007acc] text-white text-xs font-semibold cursor-pointer"
                  >
                    Simpan Soal
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 5. LAPORAN PENGOLAHAN */}
          {activeMenu === 'laporan_pengolahan' && (
            <div className="bg-white rounded-xl p-6 shadow-xs border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  Laporan Pengolahan Hasil Ujian Peserta
                </h3>
                {resultsHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearHistory}
                    className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    Bersihkan Riwayat
                  </button>
                )}
              </div>

              {resultsHistory.length === 0 ? (
                <div className="py-12 text-center rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
                  Belum ada hasil ujian peserta yang masuk.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                        <th className="py-3 px-4">Username</th>
                        <th className="py-3 px-4">Nama Peserta</th>
                        <th className="py-3 px-4">Mata Ujian</th>
                        <th className="py-3 px-4">Benar</th>
                        <th className="py-3 px-4">Nilai Akhir</th>
                        <th className="py-3 px-4">Waktu Selesai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {resultsHistory.map((r) => (
                        <tr key={r.id}>
                          <td className="py-3 px-4 font-mono">
                            {r.participant.username}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            {r.participant.fullName}
                          </td>
                          <td className="py-3 px-4">{r.packageTitle}</td>
                          <td className="py-3 px-4 font-mono">
                            {r.correctCount} / {r.totalQuestions}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[#0095ff]">
                            {r.finalScore}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {r.completedAt}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
