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
  Settings,
  Save,
  ShieldCheck,
  Download,
  Sliders,
  GraduationCap,
  FolderTree,
  Layers,
  Upload,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { TutWuriLogo } from './PusmendikHeader';
import {
  AdminScheduleItem,
  ExamPackage,
  ExamResultSummary,
  Question,
  QuestionType,
} from '../types/cbt';
import { getQuestionTypeLabel } from '../data/cbtData';
import {
  ProctorParticipantRow,
  isParticipantLockedByViolation,
  sanitizeParticipantRows,
} from './ProctorDashboardView';
import { generateProctorCardsPDF } from '../utils/pdfProctorCard';
import { generateParticipantCardsPDF } from '../utils/pdfParticipantCard';
import {
  parseWordQuestions,
  downloadWordQuestionTemplate,
} from '../utils/wordQuestionParser';

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

    // Langsung memicu Fullscreen pada interaksi klik Login Administrator
    try {
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
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
    requestReset: false,
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
    requestReset: false,
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
    loginState: 'Belum Login',
    requestReset: false,
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
    requestReset: false,
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
    requestReset: false,
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
    requestReset: false,
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
    loginState: 'Belum Login',
    requestReset: false,
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
    loginState: 'Belum Login',
    requestReset: false,
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
  | 'laporan_pengolahan'
  | 'pengaturan';

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
  onUpdatePackages: (
    updater:
      | ExamPackage[]
      | ((prevPackages: ExamPackage[]) => ExamPackage[])
  ) => void;
  onResetDefaultPackages: () => void;
  resultsHistory: ExamResultSummary[];
  onClearHistory: () => void;
  storageEngine?: 'vercel-kv' | 'vercel-serverless' | 'local';
  lastSyncedLabel?: string;
  onForceSyncStorage?: () => void;
  onLogoutAdmin: () => void;
}

export const STATUS_TES_CLASS_GROUPS = [
  'Kelas X',
  'Kelas XI IPA',
  'Kelas XI IPS',
  'Kelas XII IPA',
  'Kelas XII IPS',
] as const;

export function getTargetClassFromMapel(mapel: {
  tingkat?: string;
  kategori?: string;
  nama?: string;
  kode?: string;
}): string {
  const rawTingkat = (mapel.tingkat || '').trim();
  const tingkatUpper = rawTingkat.toUpperCase();
  const katUpper = (mapel.kategori || '').toUpperCase();
  const namaUpper = (mapel.nama || '').toUpperCase();
  const kodeUpper = (mapel.kode || '').toUpperCase();

  if (tingkatUpper === 'KELAS XII IPA' || tingkatUpper === 'XII IPA' || tingkatUpper === 'XII-IPA') {
    return 'Kelas XII IPA';
  }
  if (tingkatUpper === 'KELAS XII IPS' || tingkatUpper === 'XII IPS' || tingkatUpper === 'XII-IPS') {
    return 'Kelas XII IPS';
  }
  if (tingkatUpper === 'KELAS XI IPA' || tingkatUpper === 'XI IPA' || tingkatUpper === 'XI-IPA') {
    return 'Kelas XI IPA';
  }
  if (tingkatUpper === 'KELAS XI IPS' || tingkatUpper === 'XI IPS' || tingkatUpper === 'XI-IPS') {
    return 'Kelas XI IPS';
  }
  if (
    tingkatUpper === 'KELAS X' ||
    tingkatUpper === 'X' ||
    tingkatUpper === 'X-1' ||
    tingkatUpper === 'X-2' ||
    tingkatUpper === 'KELAS X (FASE E)'
  ) {
    return 'Kelas X';
  }

  const isGenericMultiLevel =
    tingkatUpper.includes('SEMUA') || tingkatUpper.includes('XI & XII');

  if (!isGenericMultiLevel) {
    if (/\bKELAS XII\b/.test(tingkatUpper)) {
      if (
        katUpper.includes('IPS') ||
        namaUpper.includes('SEJARAH') ||
        namaUpper.includes('GEOGRAFI') ||
        namaUpper.includes('SOSIOLOGI') ||
        namaUpper.includes('EKONOMI')
      ) {
        return 'Kelas XII IPS';
      }
      return 'Kelas XII IPA';
    }
    if (/\bKELAS XI\b/.test(tingkatUpper)) {
      if (
        katUpper.includes('IPS') ||
        namaUpper.includes('EKONOMI') ||
        namaUpper.includes('SOSIOLOGI') ||
        namaUpper.includes('GEOGRAFI')
      ) {
        return 'Kelas XI IPS';
      }
      return 'Kelas XI IPA';
    }
    if (/\bKELAS X\b/.test(tingkatUpper) || tingkatUpper.includes('FASE E')) {
      return 'Kelas X';
    }
  }

  if (
    kodeUpper.includes('BIN') ||
    namaUpper.includes('INDONESIA') ||
    kodeUpper.includes('PAI') ||
    namaUpper.includes('AGAMA') ||
    kodeUpper.includes('PKN') ||
    namaUpper.includes('PANCASILA')
  ) {
    return 'Kelas X';
  }
  if (
    kodeUpper.includes('BIO') ||
    kodeUpper.includes('SAINS') ||
    namaUpper.includes('BIOLOGI') ||
    namaUpper.includes('PENALARAN SAINS')
  ) {
    return 'Kelas XI IPA';
  }
  if (
    kodeUpper.includes('EKO') ||
    kodeUpper.includes('MAT') ||
    namaUpper.includes('EKONOMI') ||
    namaUpper.includes('MATEMATIKA WAJIB')
  ) {
    return 'Kelas XI IPS';
  }
  if (
    kodeUpper.includes('BIG') ||
    kodeUpper.includes('FIS') ||
    namaUpper.includes('INGGRIS') ||
    namaUpper.includes('FISIKA')
  ) {
    return 'Kelas XII IPA';
  }
  if (
    kodeUpper.includes('SEJ') ||
    kodeUpper.includes('GEO') ||
    namaUpper.includes('SEJARAH') ||
    namaUpper.includes('GEOGRAFI') ||
    namaUpper.includes('SOSIOLOGI KONTEMPORER')
  ) {
    return 'Kelas XII IPS';
  }

  if (katUpper.includes('MIPA')) return 'Kelas XI IPA';
  if (katUpper.includes('IPS')) return 'Kelas XI IPS';

  return 'Kelas X';
}

export const getPkgClass = (pkg: ExamPackage): string => {
  if (
    pkg.targetClass &&
    pkg.targetClass !== 'Semua Kelas' &&
    !pkg.targetClass.toUpperCase().includes('SEMUA')
  ) {
    return pkg.targetClass;
  }
  return getTargetClassFromMapel({
    tingkat: pkg.targetClass,
    kategori: pkg.subtest,
    nama: pkg.title,
    kode: pkg.code,
  });
};

export const DEFAULT_MAPEL_LIST = [
  {
    kode: 'BIN-SAS',
    nama: 'Bahasa Indonesia & Literasi Membaca',
    tingkat: 'Kelas X',
    kategori: 'Wajib Umum',
    alokasiMenit: 90,
    kkm: 75,
    status: 'Aktif',
  },
  {
    kode: 'PAI-SAS',
    nama: 'Pendidikan Agama Islam & Budi Pekerti',
    tingkat: 'Kelas X',
    kategori: 'Pendidikan Agama',
    alokasiMenit: 60,
    kkm: 80,
    status: 'Aktif',
  },
  {
    kode: 'BIO-SAS',
    nama: 'Biologi & Kimia Terapan',
    tingkat: 'Kelas XI IPA',
    kategori: 'Peminatan MIPA',
    alokasiMenit: 90,
    kkm: 78,
    status: 'Aktif',
  },
  {
    kode: 'TKA-SAINS-02',
    nama: 'Matematika Lanjut & Penalaran Sains',
    tingkat: 'Kelas XI IPA',
    kategori: 'Peminatan MIPA',
    alokasiMenit: 90,
    kkm: 78,
    status: 'Aktif',
  },
  {
    kode: 'MAT-SAS',
    nama: 'Matematika Wajib & Numerasi',
    tingkat: 'Kelas XI IPS',
    kategori: 'Wajib Umum',
    alokasiMenit: 90,
    kkm: 75,
    status: 'Aktif',
  },
  {
    kode: 'EKO-SAS',
    nama: 'Ekonomi & Sosiologi Terapan',
    tingkat: 'Kelas XI IPS',
    kategori: 'Peminatan IPS',
    alokasiMenit: 90,
    kkm: 75,
    status: 'Aktif',
  },
  {
    kode: 'BIG-SAS',
    nama: 'Bahasa Inggris & Literasi Digital',
    tingkat: 'Kelas XII IPA',
    kategori: 'Wajib Umum',
    alokasiMenit: 90,
    kkm: 75,
    status: 'Aktif',
  },
  {
    kode: 'FIS-SAS',
    nama: 'Fisika & Kimia Analisis Lanjut',
    tingkat: 'Kelas XII IPA',
    kategori: 'Peminatan MIPA',
    alokasiMenit: 90,
    kkm: 78,
    status: 'Aktif',
  },
  {
    kode: 'SEJ-SAS',
    nama: 'Sejarah Indonesia & Kebangsaan',
    tingkat: 'Kelas XII IPS',
    kategori: 'Wajib Umum',
    alokasiMenit: 60,
    kkm: 75,
    status: 'Aktif',
  },
  {
    kode: 'GEO-SAS',
    nama: 'Geografi & Sosiologi Kontemporer',
    tingkat: 'Kelas XII IPS',
    kategori: 'Peminatan IPS',
    alokasiMenit: 90,
    kkm: 75,
    status: 'Aktif',
  },
];

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
  const rawParticipants = externalParticipants ?? localParticipants;
  const participants = useMemo(
    () => sanitizeParticipantRows(rawParticipants),
    [rawParticipants]
  );
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
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState<boolean>(false);

  // Question Bank & Token states
  const [selectedPkgId, setSelectedPkgId] = useState(packages[0]?.id || '');
  const [statusTesKelas, setStatusTesKelas] = useState('Semua Kelas');
  const [statusTesTipeSoal, setStatusTesTipeSoal] = useState('Semua Tipe Soal');
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
  const [newQuestionType, setNewQuestionType] = useState<QuestionType>('pilihan_ganda');
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
  const [complexCorrectOpts, setComplexCorrectOpts] = useState<string[]>(['A', 'C']);
  const [statement1, setStatement1] = useState('Pernyataan 1 terkait materi ujian');
  const [statement1Val, setStatement1Val] = useState<'Benar' | 'Salah'>('Benar');
  const [statement2, setStatement2] = useState('Pernyataan 2 terkait materi ujian');
  const [statement2Val, setStatement2Val] = useState<'Benar' | 'Salah'>('Salah');
  const [statement3, setStatement3] = useState('Pernyataan 3 terkait materi ujian');
  const [statement3Val, setStatement3Val] = useState<'Benar' | 'Salah'>('Benar');

  // Add New Participant form in Daftar Peserta (only requires Name; Username & Password auto-filled)
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantKelas, setNewParticipantKelas] = useState<string>('X');
  const [participantSearchQuery, setParticipantSearchQuery] = useState('');
  const excelInputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploadedExcelInfo, setUploadedExcelInfo] = useState<{
    fileName: string;
    count: number;
    uploadedAt: string;
  } | null>(() => {
    try {
      const savedInfo = localStorage.getItem('pusmendik_cbt_excel_info_v1');
      return savedInfo ? JSON.parse(savedInfo) : null;
    } catch {
      return null;
    }
  });

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
  const nextAutoSequence = useMemo(() => {
    let maxSeq = 1538;
    participants.forEach((p) => {
      const match = p.username.match(/(\d{4,})$/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val >= 1547 && val < 99999 && val > maxSeq) {
          maxSeq = val;
        }
      }
    });
    return Math.max(1547 + participants.length * 9, maxSeq + 9);
  }, [participants]);
  const autoGeneratedUsername = `TK050601080${nextAutoSequence}`;
  const autoGeneratedPassword = `SMADIP${nextAutoSequence}*`;

  // Auto-generated ID / Username Proktor & Kode Enkripsi in Daftar Proktor
  const nextProctorNumber = 6 + proctors.length;
  const nextProctorSuffixLetter = String.fromCharCode(
    65 + ((10 + proctors.length) % 26)
  );
  const autoGeneratedProctorId = `K05060108-KB${nextProctorNumber}${nextProctorSuffixLetter}`;
  const autoGeneratedProctorEnc = `ENC-${8104 + proctors.length * 319}-WGR`;

  // Pengaturan State
  const defaultKelasList = [
    { kode: 'X-1', tingkat: 'Kelas X', jurusan: 'Fase E (Umum)', ruang: 'LAB KOMPUTER 1', sesi: 'Sesi 1', status: 'Aktif' },
    { kode: 'X-2', tingkat: 'Kelas X', jurusan: 'Fase E (Umum)', ruang: 'LAB KOMPUTER 1', sesi: 'Sesi 2', status: 'Aktif' },
    { kode: 'XI-IPA', tingkat: 'Kelas XI', jurusan: 'MIPA (Fase F)', ruang: 'LAB KOMPUTER 2', sesi: 'Sesi 1', status: 'Aktif' },
    { kode: 'XI-IPS', tingkat: 'Kelas XI', jurusan: 'IPS (Fase F)', ruang: 'LAB KOMPUTER 2', sesi: 'Sesi 2', status: 'Aktif' },
    { kode: 'XII-IPA', tingkat: 'Kelas XII', jurusan: 'MIPA', ruang: 'LAB KOMPUTER 3', sesi: 'Sesi 1', status: 'Aktif' },
    { kode: 'XII-IPS', tingkat: 'Kelas XII', jurusan: 'IPS', ruang: 'LAB KOMPUTER 3', sesi: 'Sesi 2', status: 'Aktif' },
  ];

  const defaultMapelList = DEFAULT_MAPEL_LIST;

  const defaultAdminList = [
    {
      id: 'adm_1',
      adminId: 'K05060108-KB6K',
      namaLengkap: 'ROMEO GALISTRA, S.Pd.',
      nip: '-',
      email: 'romeo.galistra@smadiponegorowagir.sch.id',
      noHp: '0812-3456-7890',
      role: 'Penanggung Jawab / Super Admin',
      status: 'Aktif',
    },
    {
      id: 'adm_2',
      adminId: 'ADMIN_SMADIP',
      namaLengkap: 'TIM TEKNIS CBT SMA ISLAM DIPONEGORO',
      nip: '-',
      email: 'admin.cbt@smadiponegorowagir.sch.id',
      noHp: '0857-1122-3344',
      role: 'Administrator Server & Database',
      status: 'Aktif',
    },
  ];

  const defaultAdminConfig = {
    namaSekolah: 'SMA Islam Diponegoro Wagir',
    namaKepalaSekolah: 'ROMEO GALISTRA, S.Pd.',
    npsn: '20517890',
    namaUjian: 'SUMATIF AKHIR SEMESTER (SAS)',
    semester: 'Genap 2025/2026',
    modaPelaksanaan: 'Daring (Online)',
    ruangDefault: 'LAB KOMPUTER',
    tingkatKelas: 'Semua Tingkat (Kelas X, XI, XII)',
    daftarKelas: 'X-1, X-2, XI-IPA, XI-IPS, XII-IPA, XII-IPS',
    adminNama: 'ROMEO GALISTRA, S.Pd.',
    adminId: 'K05060108-KB6K',
    adminNip: '-',
    adminEmail: 'admin.cbt@smadiponegorowagir.sch.id',
    adminNoHp: '0812-3456-7890',
    adminRole: 'Super Administrator CBT',
    adminList: defaultAdminList,
    kelasList: defaultKelasList,
    mapelList: defaultMapelList,
    durasiDefault: 90,
    minMinutesBeforeFinish: 45,
    acakSoal: true,
    acakOpsi: true,
    wajibFullscreen: true,
    kunciKeluarSistem: true,
    tampilkanNilaiPeserta: false,
    tokenIntervalMenit: 15,
    pesanPelanggaran:
      'Anda terdeteksi keluar dari layar CBT! Harap lapor ke Proktor / Pengawas untuk reset login.',
  };

  const [appConfig, setAppConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('cbt_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const rawMapelList = Array.isArray(parsed.mapelList)
          ? parsed.mapelList
          : defaultMapelList;

        const normalizedMapelList = rawMapelList.map((m: any) => ({
          ...m,
          tingkat: getTargetClassFromMapel(m),
        }));

        return {
          ...defaultAdminConfig,
          ...parsed,
          adminList:
            Array.isArray(parsed.adminList) && parsed.adminList.length > 0
              ? parsed.adminList
              : defaultAdminList,
          kelasList:
            Array.isArray(parsed.kelasList) && parsed.kelasList.length > 0
              ? parsed.kelasList
              : defaultKelasList,
          mapelList: normalizedMapelList,
        };
      }
    } catch {
      // fallback
    }
    return defaultAdminConfig;
  });

  // State untuk form Tambah Data Administrator Baru di menu Pengaturan
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [newAdminId, setNewAdminId] = useState('');
  const [newAdminNama, setNewAdminNama] = useState('');
  const [newAdminNip, setNewAdminNip] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminNoHp, setNewAdminNoHp] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('Administrator Server & Database');

  // State untuk tambah kolom kelas baru di menu Pengaturan
  const [newPengaturanKelasKode, setNewPengaturanKelasKode] = useState('');
  const [newPengaturanKelasTingkat, setNewPengaturanKelasTingkat] = useState('Kelas X');
  const [newPengaturanKelasJurusan, setNewPengaturanKelasJurusan] = useState('Fase E (Umum)');
  const [newPengaturanKelasRuang, setNewPengaturanKelasRuang] = useState('LAB KOMPUTER 1');
  const [newPengaturanKelasSesi, setNewPengaturanKelasSesi] = useState('Sesi 1');

  // State & form untuk Input Mata Pelajaran di menu Pengaturan
  const [showMapelForm, setShowMapelForm] = useState(false);
  const [newMapelKode, setNewMapelKode] = useState('');
  const [newMapelNama, setNewMapelNama] = useState('');
  const [newMapelTingkat, setNewMapelTingkat] = useState('Kelas X');
  const [newMapelKategori, setNewMapelKategori] = useState('Wajib Umum');
  const [newMapelAlokasi, setNewMapelAlokasi] = useState(90);
  const [newMapelKKM, setNewMapelKKM] = useState(75);

  const handleAddMapelToSettings = () => {
    if (!newMapelNama.trim()) {
      showNotice('Harap masukkan nama mata pelajaran.');
      return;
    }
    const cleanNama = newMapelNama.trim();
    const cleanKode = (
      newMapelKode.trim() ||
      cleanNama
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() + '-SAS'
    ).toUpperCase();

    const currentList = Array.isArray(appConfig.mapelList)
      ? appConfig.mapelList
      : defaultMapelList;

    if (currentList.some((m: { kode: string }) => m.kode.toUpperCase() === cleanKode)) {
      showNotice(`Mata pelajaran dengan kode ${cleanKode} sudah terdaftar.`);
      return;
    }

    const newEntry = {
      kode: cleanKode,
      nama: cleanNama,
      tingkat: newMapelTingkat,
      kategori: newMapelKategori,
      alokasiMenit: Number(newMapelAlokasi) || 90,
      kkm: Number(newMapelKKM) || 75,
      status: 'Aktif',
    };

    const updatedList = [...currentList, newEntry];
    const updatedConfig = {
      ...appConfig,
      mapelList: updatedList,
    };
    setAppConfig(updatedConfig);
    try {
      localStorage.setItem('cbt_admin_settings', JSON.stringify(updatedConfig));
    } catch {
      // ignore
    }
    setNewMapelKode('');
    setNewMapelNama('');
    setNewMapelAlokasi(90);
    setNewMapelKKM(75);
    showNotice(`Mata pelajaran "${cleanNama}" (${cleanKode}) berhasil ditambahkan!`);
  };

  const handleDeleteMapelFromSettings = (kodeToDelete: string) => {
    const currentList = Array.isArray(appConfig.mapelList)
      ? appConfig.mapelList
      : defaultMapelList;
    const updatedList = currentList.filter(
      (m: { kode: string }) => m.kode !== kodeToDelete
    );
    const updatedConfig = {
      ...appConfig,
      mapelList: updatedList,
    };
    setAppConfig(updatedConfig);
    try {
      localStorage.setItem('cbt_admin_settings', JSON.stringify(updatedConfig));
    } catch {
      // ignore
    }
    showNotice(`Mata pelajaran ${kodeToDelete} berhasil dihapus dari pengaturan.`);
  };

  const handleToggleMapelStatus = (kodeToToggle: string) => {
    const currentList = Array.isArray(appConfig.mapelList)
      ? appConfig.mapelList
      : defaultMapelList;
    const updatedList = currentList.map((m: any) =>
      m.kode === kodeToToggle
        ? { ...m, status: m.status === 'Aktif' ? 'Non Aktif' : 'Aktif' }
        : m
    );
    const updatedConfig = {
      ...appConfig,
      mapelList: updatedList,
    };
    setAppConfig(updatedConfig);
    try {
      localStorage.setItem('cbt_admin_settings', JSON.stringify(updatedConfig));
    } catch {
      // ignore
    }
  };

  const handleAddAdminToSettings = () => {
    if (!newAdminId.trim() || !newAdminNama.trim()) {
      showNotice('Harap lengkapi ID Administrator dan Nama Lengkap.');
      return;
    }
    const cleanId = newAdminId.trim().toUpperCase();
    const currentList = Array.isArray(appConfig.adminList) ? appConfig.adminList : defaultAdminList;
    if (currentList.some((a: any) => a.adminId.toUpperCase() === cleanId)) {
      showNotice(`Administrator dengan ID ${cleanId} sudah terdaftar.`);
      return;
    }
    const newEntry = {
      id: `adm_${Date.now()}`,
      adminId: cleanId,
      namaLengkap: newAdminNama.trim(),
      nip: newAdminNip.trim() || '-',
      email: newAdminEmail.trim() || 'admin.cbt@smadiponegorowagir.sch.id',
      noHp: newAdminNoHp.trim() || '-',
      role: newAdminRole,
      status: 'Aktif',
    };
    const updatedList = [...currentList, newEntry];
    setAppConfig({
      ...appConfig,
      adminList: updatedList,
    });
    setNewAdminId('');
    setNewAdminNama('');
    setNewAdminNip('');
    setNewAdminEmail('');
    setNewAdminNoHp('');
    setShowAdminForm(false);
    showNotice(`Administrator ${newEntry.namaLengkap} (${cleanId}) berhasil ditambahkan ke pengaturan.`);
  };

  const handleToggleAdminStatusInSettings = (adminIdToToggle: string) => {
    const currentList = Array.isArray(appConfig.adminList) ? appConfig.adminList : defaultAdminList;
    const updatedList = currentList.map((a: any) =>
      a.adminId === adminIdToToggle
        ? { ...a, status: a.status === 'Aktif' ? 'Non Aktif' : 'Aktif' }
        : a
    );
    setAppConfig({
      ...appConfig,
      adminList: updatedList,
    });
    showNotice(`Status aktif administrator ${adminIdToToggle} berhasil diperbarui.`);
  };

  const handleDeleteAdminFromSettings = (adminIdToDelete: string) => {
    const currentList = Array.isArray(appConfig.adminList) ? appConfig.adminList : defaultAdminList;
    if (currentList.length <= 1) {
      showNotice('Minimal harus terdapat 1 akun administrator utama aktif.');
      return;
    }
    const updatedList = currentList.filter((a: any) => a.adminId !== adminIdToDelete);
    setAppConfig({
      ...appConfig,
      adminList: updatedList,
    });
    showNotice(`Administrator ${adminIdToDelete} berhasil dihapus dari pengaturan.`);
  };

  const handleAddKelasToSettings = () => {
    if (!newPengaturanKelasKode.trim()) {
      showNotice('Harap ketik kode/nama kelas terlebih dahulu.');
      return;
    }
    const cleanKode = newPengaturanKelasKode.trim().toUpperCase();
    const currentList = Array.isArray(appConfig.kelasList) ? appConfig.kelasList : defaultKelasList;
    if (currentList.some((k: { kode: string }) => k.kode.toUpperCase() === cleanKode)) {
      showNotice(`Kelas ${cleanKode} sudah ada dalam daftar.`);
      return;
    }
    const newEntry = {
      kode: cleanKode,
      tingkat: newPengaturanKelasTingkat,
      jurusan: newPengaturanKelasJurusan,
      ruang: newPengaturanKelasRuang,
      sesi: newPengaturanKelasSesi,
      status: 'Aktif',
    };
    const updatedList = [...currentList, newEntry];
    const updatedDaftar = updatedList.map((k: { kode: string }) => k.kode).join(', ');
    setAppConfig({
      ...appConfig,
      kelasList: updatedList,
      daftarKelas: updatedDaftar,
    });
    setNewPengaturanKelasKode('');
    showNotice(`Kolom kelas ${cleanKode} berhasil ditambahkan!`);
  };

  const handleDeleteKelasFromSettings = (kodeToDelete: string) => {
    const currentList = Array.isArray(appConfig.kelasList) ? appConfig.kelasList : defaultKelasList;
    const updatedList = currentList.filter((k: { kode: string }) => k.kode !== kodeToDelete);
    const updatedDaftar = updatedList.map((k: { kode: string }) => k.kode).join(', ');
    setAppConfig({
      ...appConfig,
      kelasList: updatedList,
      daftarKelas: updatedDaftar,
    });
    showNotice(`Kelas ${kodeToDelete} berhasil dihapus dari pengaturan.`);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('cbt_admin_settings', JSON.stringify(appConfig));
    } catch {
      // ignore
    }
    showNotice('Pengaturan sistem ujian SAS berhasil disimpan dan diterapkan!');
  };

  const handleExportSettings = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(appConfig, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `pengaturan_sas_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotice('File backup pengaturan berhasil diunduh.');
  };

  const handleResetSettings = () => {
    setAppConfig(defaultAdminConfig);
    try {
      localStorage.setItem('cbt_admin_settings', JSON.stringify(defaultAdminConfig));
    } catch {
      // ignore
    }
    showNotice('Pengaturan dikembalikan ke konfigurasi standar.');
  };

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
    setParticipants((prev) => [...prev, newRow]);
    setNewParticipantName('');
    showNotice(
      `Peserta ${newRow.namaPeserta} (Kelas ${newRow.kelas}) berhasil ditambahkan (Username: ${newRow.username} | Password: ${newRow.password}).`
    );
  };

  const handleDownloadTemplateExcel = () => {
    const sampleRows = [
      { 'Nama Siswa': 'M. REIHAN ALFARIZI', Kelas: 'X' },
      { 'Nama Siswa': 'SITI AISYAH PUTRI', Kelas: 'X' },
      { 'Nama Siswa': 'BAGAS ADITYA NUGRAHA', Kelas: 'XI IPA' },
      { 'Nama Siswa': 'PUTRI AYU NINGTYAS', Kelas: 'XI IPS' },
      { 'Nama Siswa': 'AUREL RIZKY ADI PRATAMA', Kelas: 'XII IPA' },
      { 'Nama Siswa': 'AHMAD DENY FIKRUDIN', Kelas: 'XII IPS' },
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    worksheet['!cols'] = [{ wch: 34 }, { wch: 16 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Peserta');
    XLSX.writeFile(workbook, 'Format_Upload_Daftar_Peserta_SAS.xlsx');
    showNotice('Format Template Excel (Nama Siswa & Kelas) berhasil diunduh.');
  };

  const handleUploadParticipantExcel = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        if (!buffer) return;

        const workbook = XLSX.read(buffer, { type: 'array' });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          showNotice('File Excel kosong atau tidak memiliki lembar kerja.');
          return;
        }

        const parsedEntries: Array<{ namaPeserta: string; kelas: string }> = [];

        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) return;

          const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
            header: 1,
            defval: '',
          });

          const nonEmptyRows = rawRows.filter(
            (row) =>
              Array.isArray(row) &&
              row.some((cell) => String(cell ?? '').trim() !== '')
          );

          if (nonEmptyRows.length === 0) return;

          // Deteksi baris header jika ada kolom bertuliskan "Nama" / "Nama Siswa" dan "Kelas"
          let startRowIdx = 0;
          let namaColIdx = 0;
          let kelasColIdx = 1;

          const firstRowCells = nonEmptyRows[0].map((c) =>
            String(c ?? '')
              .trim()
              .toLowerCase()
          );

          const detectedNamaIdx = firstRowCells.findIndex(
            (c) =>
              c.includes('nama') ||
              c.includes('siswa') ||
              c.includes('peserta') ||
              c === 'student' ||
              c === 'name'
          );
          const detectedKelasIdx = firstRowCells.findIndex(
            (c) =>
              c.includes('kelas') ||
              c.includes('rombel') ||
              c.includes('tingkat') ||
              c === 'class'
          );

          if (detectedNamaIdx !== -1 || detectedKelasIdx !== -1) {
            startRowIdx = 1;
            if (detectedNamaIdx !== -1) {
              namaColIdx = detectedNamaIdx;
            } else {
              namaColIdx = detectedKelasIdx === 0 ? 1 : 0;
            }
            if (detectedKelasIdx !== -1) {
              kelasColIdx = detectedKelasIdx;
            } else {
              kelasColIdx = namaColIdx === 0 ? 1 : 0;
            }
          } else if (
            firstRowCells.length >= 3 &&
            (firstRowCells[0] === 'no' ||
              firstRowCells[0] === 'no.' ||
              firstRowCells[0] === 'nomor')
          ) {
            startRowIdx = 1;
            namaColIdx = 1;
            kelasColIdx = 2;
          }

          const dataRows = nonEmptyRows.slice(startRowIdx);

          dataRows.forEach((row) => {
            let rawNama = String(row[namaColIdx] ?? '').trim();
            let rawKelas = String(row[kelasColIdx] ?? '').trim();

            // Jika baris memiliki kolom nomor di paling kiri tanpa header
            if (
              detectedNamaIdx === -1 &&
              row.length >= 3 &&
              /^\d+$/.test(rawNama) &&
              String(row[1] ?? '').trim() !== ''
            ) {
              rawNama = String(row[1] ?? '').trim();
              rawKelas = String(row[2] ?? '').trim();
            }

            if (!rawNama) return;

            // Normalisasi penulisan kelas (mis. "Kelas X" -> "X", "Kelas XII IPA" -> "XII IPA")
            let cleanKelas = rawKelas
              .replace(/^kelas\s+/i, '')
              .trim()
              .toUpperCase();
            if (!cleanKelas) {
              const sheetKelasFallback = sheetName
                .replace(/^(daftar\s+peserta|sheet\d*|data|siswa|kelas)\s*/i, '')
                .trim()
                .toUpperCase();
              cleanKelas = sheetKelasFallback || newParticipantKelas || 'X';
            }

            parsedEntries.push({
              namaPeserta: rawNama.toUpperCase(),
              kelas: cleanKelas,
            });
          });
        });

        if (parsedEntries.length === 0) {
          showNotice(
            'Tidak ada baris Nama Siswa & Kelas yang valid pada file Excel tersebut.'
          );
          return;
        }

        // Jika daftar peserta saat ini masih murni data contoh awal (bawaan sistem),
        // maka upload pertama menggantikan data contoh awal.
        // Namun jika sudah ada data kelas hasil upload / tambah sebelumnya,
        // upload kelas berikutnya otomatis melanjutkan di bawah kelas sebelumnya (tidak menimpa).
        const initialDefaultIds = new Set(
          INITIAL_ADMIN_PARTICIPANTS.map((p) => p.id)
        );
        const isStillInitialDefaultOnly =
          participants.length > 0 &&
          participants.every((p) => initialDefaultIds.has(p.id));

        const baseParticipants = isStillInitialDefaultOnly
          ? []
          : participants.filter((p) => !initialDefaultIds.has(p.id));

        // Hitung nomor urut username/password lanjutan agar tidak bentrok dengan kelas sebelumnya
        let maxExistingSeq = 1538;
        const existingKeys = new Set<string>();
        baseParticipants.forEach((p) => {
          const match = p.username.match(/(\d{4,})$/);
          if (match) {
            const val = parseInt(match[1], 10);
            if (
              !isNaN(val) &&
              val >= 1547 &&
              val < 99999 &&
              val > maxExistingSeq
            ) {
              maxExistingSeq = val;
            }
          }
          existingKeys.add(
            `${p.namaPeserta.trim().toUpperCase()}__${(p.kelas || '').trim().toUpperCase()}`
          );
        });

        const startSeq = Math.max(
          1547 + baseParticipants.length * 9,
          maxExistingSeq + 9
        );

        const nowTs = Date.now();
        const appendedParticipants: ProctorParticipantRow[] = [];

        parsedEntries.forEach((entry, idx) => {
          const compositeKey = `${entry.namaPeserta}__${entry.kelas}`;
          if (existingKeys.has(compositeKey)) {
            return;
          }
          existingKeys.add(compositeKey);

          const seq = startSeq + appendedParticipants.length * 9;
          appendedParticipants.push({
            id: `excel_${nowTs}_${idx}`,
            selected: true,
            status: 'Non Active',
            kodeTes: 'GLDTKA25MAH2',
            username: `TK050601080${seq}`,
            password: `SMADIP${seq}*`,
            namaPeserta: entry.namaPeserta,
            kelompok: '1',
            kelas: entry.kelas,
            loginState: 'Belum Login',
          });
        });

        const combinedParticipants = [
          ...baseParticipants,
          ...appendedParticipants,
        ];

        setParticipants(combinedParticipants);
        setFilterStatus('Semua Status');
        setAppliedStatus('Semua Status');

        const uploadedClasses = Array.from(
          new Set(parsedEntries.map((item) => item.kelas))
        ).join(', ');

        const info = {
          fileName: file.name,
          count: combinedParticipants.length,
          uploadedAt: new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        setUploadedExcelInfo(info);
        try {
          localStorage.setItem(
            'pusmendik_cbt_excel_info_v1',
            JSON.stringify(info)
          );
        } catch {
          // ignore storage error
        }

        if (baseParticipants.length > 0 && appendedParticipants.length > 0) {
          showNotice(
            `Berhasil menambahkan ${appendedParticipants.length} siswa (Kelas ${uploadedClasses}) di bawah daftar sebelumnya. Total: ${combinedParticipants.length} peserta.`
          );
        } else if (
          baseParticipants.length > 0 &&
          appendedParticipants.length === 0
        ) {
          showNotice(
            `Data siswa pada "${file.name}" (Kelas ${uploadedClasses}) sudah ada dalam daftar peserta.`
          );
        } else {
          showNotice(
            `Berhasil mengunggah "${file.name}": ${appendedParticipants.length} siswa (Kelas ${uploadedClasses}) telah dimuat ke Daftar Peserta!`
          );
        }
      } catch {
        showNotice(
          'Gagal membaca file Excel. Pastikan file berformat .xlsx, .xls, atau .csv dengan kolom Nama Siswa dan Kelas.'
        );
      } finally {
        if (excelInputRef.current) {
          excelInputRef.current.value = '';
        }
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const displayPackages = useMemo(() => {
    const currentMapelList = Array.isArray(appConfig.mapelList)
      ? appConfig.mapelList
      : defaultMapelList;

    const result: ExamPackage[] = [];
    const processedPkgIds = new Set<string>();

    currentMapelList.forEach((mapel: any) => {
      const cleanKode = (mapel.kode || '').trim().toUpperCase();
      const cleanNama = (mapel.nama || '').trim().toLowerCase();
      const newPkgId = 'mapel_pkg_' + cleanKode.toLowerCase().replace(/[^a-z0-9]/g, '_');

      const existing = packages.find((p) => {
        if (p.id === newPkgId) return true;
        const pCode = (p.code || '').trim().toUpperCase();
        const pTitle = (p.title || '').trim().toLowerCase();
        return (
          (cleanKode.length > 0 && pCode === cleanKode) ||
          (cleanNama.length > 0 && pTitle === cleanNama)
        );
      });

      const targetClass = getTargetClassFromMapel(mapel);

      if (existing && !processedPkgIds.has(existing.id)) {
        processedPkgIds.add(existing.id);
        result.push({
          ...existing,
          code: mapel.kode || existing.code,
          title: mapel.nama || existing.title,
          durationMinutes: mapel.alokasiMenit || existing.durationMinutes,
          subtest: mapel.kategori || existing.subtest,
          targetClass: targetClass,
        });
      } else if (!processedPkgIds.has(newPkgId)) {
        processedPkgIds.add(newPkgId);
        result.push({
          id: newPkgId,
          code: mapel.kode || 'MAPEL-01',
          title: mapel.nama || 'Mata Pelajaran Ujian',
          level: 'SMA / MA / SMK / Sederajat',
          subtest: mapel.kategori || 'Wajib Umum',
          durationMinutes: mapel.alokasiMenit || 90,
          targetClass: targetClass,
          questions: [
            {
              id: `q_default_${cleanKode}_1`,
              number: 1,
              type: 'pilihan_ganda',
              category: mapel.kategori || 'Materi Utama',
              stimulusTitle: `Soal Latihan ${mapel.nama}`,
              stimulusText: `Berikut adalah contoh butir soal untuk mata pelajaran ${mapel.nama} (${mapel.kode}).`,
              questionText: `Manakah pernyataan yang paling tepat terkait pokok bahasan ${mapel.nama}?`,
              instructionText: 'Pilih satu jawaban yang benar!',
              options: [
                { id: 'A', text: 'Pilihan A merupakan konsep utama yang tepat.' },
                { id: 'B', text: 'Pilihan B merupakan konsep pendukung.' },
                { id: 'C', text: 'Pilihan C merupakan contoh penerapan.' },
                { id: 'D', text: 'Pilihan D merupakan evaluasi teori.' },
              ],
              correctOptionId: 'A',
              points: 25,
              explanation: 'Penjelasan kunci jawaban contoh soal.',
            },
          ],
        });
      }
    });

    return result;
  }, [appConfig.mapelList, packages]);

  const selectedPackage =
    displayPackages.find((p) => p.id === selectedPkgId) || displayPackages[0];

  const [lastUploadedWordFile, setLastUploadedWordFile] = useState<string>('');

  const syncSelectedPackageQuestions = (nextQuestions: Question[]) => {
    if (!selectedPackage) return;
    const renumbered = nextQuestions.map((q, idx) => ({
      ...q,
      number: idx + 1,
    }));
    const updatedSelectedPackage: ExamPackage = {
      ...selectedPackage,
      questions: renumbered,
    };
    const cleanSelectedKode = (selectedPackage.code || '').trim().toUpperCase();
    const cleanSelectedNama = (selectedPackage.title || '').trim().toLowerCase();

    onUpdatePackages((prevPackages) => {
      const baseList = Array.isArray(prevPackages) ? prevPackages : packages;
      let matched = false;
      const nextList: ExamPackage[] = [];

      baseList.forEach((pkg) => {
        const pCode = (pkg.code || '').trim().toUpperCase();
        const pTitle = (pkg.title || '').trim().toLowerCase();
        const isMatch =
          pkg.id === selectedPackage.id ||
          (cleanSelectedKode.length > 0 && pCode === cleanSelectedKode) ||
          (cleanSelectedNama.length > 0 && pTitle === cleanSelectedNama);

        if (isMatch) {
          if (!matched) {
            matched = true;
            nextList.push({
              ...updatedSelectedPackage,
              id: pkg.id,
            });
          }
        } else {
          nextList.push(pkg);
        }
      });

      if (!matched) {
        nextList.push(updatedSelectedPackage);
      }
      return nextList;
    });
  };

  const handleDeleteQuestion = (qId: string) => {
    if (!selectedPackage) return;
    const filtered = selectedPackage.questions.filter((item) => item.id !== qId);
    syncSelectedPackageQuestions(filtered);
    if (filtered.length === 0) {
      setLastUploadedWordFile('');
    }
    showNotice('Butir soal berhasil dihapus.');
  };

  const handleDeleteAllQuestions = () => {
    if (!selectedPackage || selectedPackage.questions.length === 0) return;
    if (statusTesTipeSoal === 'Semua Tipe Soal') {
      syncSelectedPackageQuestions([]);
      setLastUploadedWordFile('');
      showNotice(
        `Seluruh butir soal pada mata pelajaran ${selectedPackage.title} berhasil dihapus.`
      );
    } else {
      const remaining = selectedPackage.questions.filter(
        (q) => q.type !== statusTesTipeSoal
      );
      syncSelectedPackageQuestions(remaining);
      if (remaining.length === 0) {
        setLastUploadedWordFile('');
      }
      showNotice(
        `Seluruh soal tipe ${getQuestionTypeLabel(statusTesTipeSoal as QuestionType)} berhasil dihapus.`
      );
    }
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage) {
      return;
    }
    if (!newQuestionText.trim()) {
      if (
        lastUploadedWordFile ||
        selectedPackage.questions.some((q) => q.id.startsWith('word_q_'))
      ) {
        showNotice(
          'Data soal dan jawaban dari file Word sudah tersimpan otomatis di Bank Soal (kolom pertanyaan & jawaban manual tidak perlu diisi).'
        );
      } else {
        showNotice(
          'Silakan klik tombol "Upload Word" untuk mengunggah soal, atau ketik pertanyaan soal jika ingin menambah manual.'
        );
      }
      return;
    }

    const baseQuestions = selectedPackage.questions.filter(
      (q) => !q.id.startsWith('q_default_')
    );
    const nextNumber = baseQuestions.length + 1;
    let newQuestion: Question;

    if (newQuestionType === 'pilihan_ganda') {
      newQuestion = {
        id: `admin_q_${Date.now()}`,
        number: nextNumber,
        type: 'pilihan_ganda',
        category: newCategory.trim() || 'Sumatif Akhir Semester',
        questionText: newQuestionText.trim(),
        instructionText: 'Pilih satu jawaban yang paling tepat!',
        options: [
          { id: 'A', text: optA.trim() || 'Pilihan A' },
          { id: 'B', text: optB.trim() || 'Pilihan B' },
          { id: 'C', text: optC.trim() || 'Pilihan C' },
          { id: 'D', text: optD.trim() || 'Pilihan D' },
          { id: 'E', text: optE.trim() || 'Pilihan E' },
        ],
        correctOptionId: correctOpt,
        points: 10,
        explanation: `Kunci jawaban yang benar adalah opsi ${correctOpt}.`,
      };
    } else if (newQuestionType === 'pilihan_ganda_kompleks') {
      const finalCorrectIds =
        complexCorrectOpts.length > 0 ? complexCorrectOpts : ['A'];
      newQuestion = {
        id: `admin_q_${Date.now()}`,
        number: nextNumber,
        type: 'pilihan_ganda_kompleks',
        category: newCategory.trim() || 'Sumatif Akhir Semester',
        questionText: newQuestionText.trim(),
        instructionText: 'Pilihlah lebih dari satu jawaban yang benar!',
        options: [
          { id: 'A', text: optA.trim() || 'Pilihan A' },
          { id: 'B', text: optB.trim() || 'Pilihan B' },
          { id: 'C', text: optC.trim() || 'Pilihan C' },
          { id: 'D', text: optD.trim() || 'Pilihan D' },
          { id: 'E', text: optE.trim() || 'Pilihan E' },
        ],
        correctOptionIds: finalCorrectIds,
        points: 10,
        explanation: `Kunci jawaban yang benar adalah opsi: ${finalCorrectIds.join(', ')}.`,
      };
    } else {
      // benar_salah
      newQuestion = {
        id: `admin_q_${Date.now()}`,
        number: nextNumber,
        type: 'benar_salah',
        category: newCategory.trim() || 'Sumatif Akhir Semester',
        questionText: newQuestionText.trim(),
        instructionText: 'Tentukan Benar atau Salah untuk setiap pernyataan!',
        statements: [
          { id: 'st1', statement: statement1.trim() || 'Pernyataan 1', correctValue: statement1Val },
          { id: 'st2', statement: statement2.trim() || 'Pernyataan 2', correctValue: statement2Val },
          { id: 'st3', statement: statement3.trim() || 'Pernyataan 3', correctValue: statement3Val },
        ],
        trueLabel: 'Benar',
        falseLabel: 'Salah',
        points: 10,
        explanation: 'Kunci jawaban ditentukan berdasarkan kesesuaian pernyataan dengan teks.',
      };
    }

    syncSelectedPackageQuestions([...baseQuestions, newQuestion]);
    setNewStimulusTitle('');
    setNewStimulusText('');
    setNewQuestionText('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setOptE('');
    showNotice(`Soal (${getQuestionTypeLabel(newQuestionType)}) No. ${nextNumber} berhasil ditambahkan ke bank soal.`);
  };

  const wordQuestionInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleUploadWordQuestions = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPackage) return;

    try {
      const existingRealQuestions = selectedPackage.questions.filter(
        (q) => !q.id.startsWith('q_default_') && !q.id.startsWith('word_q_')
      );
      const startNum = existingRealQuestions.length + 1;
      const defaultCat =
        selectedPackage.subtest || newCategory.trim() || 'Sumatif Akhir Semester';
      const {
        questions: importedQuestions,
        redDetectedCount,
        tableCount,
      } = await parseWordQuestions(file, newQuestionType, startNum, defaultCat);

      if (importedQuestions.length === 0) {
        showNotice(
          'Tidak ditemukan format soal dan pilihan jawaban (A, B, C, D, E) atau tabel soal yang valid pada file Word tersebut.'
        );
        return;
      }

      const combinedQuestions = [
        ...existingRealQuestions,
        ...importedQuestions,
      ];

      syncSelectedPackageQuestions(combinedQuestions);
      setLastUploadedWordFile(file.name);
      setNewQuestionText('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
      setOptE('');

      const tableInfo =
        tableCount > 0 ? `, termasuk ${tableCount} tabel soal` : '';
      showNotice(
        `Berhasil mengunggah "${file.name}": ${importedQuestions.length} butir soal ditambahkan (${redDetectedCount} kunci jawaban teks merah${tableInfo}). Kolom pertanyaan & jawaban manual tidak perlu diisi.`
      );
    } catch {
      showNotice(
        'Gagal membaca file Word. Pastikan file berformat .docx atau .doc dan beri warna merah pada teks jawaban yang benar.'
      );
    } finally {
      if (wordQuestionInputRef.current) {
        wordQuestionInputRef.current.value = '';
      }
    }
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
    { id: 'pengaturan', label: 'Pengaturan', breadcrumb: 'Pengaturan Sistem Ujian SAS', icon: Settings },
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
        <div className="relative z-10 h-16 shrink-0 px-4 bg-[#001147] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
            <TutWuriLogo className="w-8 h-8 shrink-0" />
            {!sidebarCollapsed && (
              <span className="text-[13px] font-extrabold tracking-tight text-white whitespace-nowrap truncate">
                ADMINISTRATOR SAS
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
            const resetCount =
              item.id === 'request_reset'
                ? participants.filter((p) => isParticipantLockedByViolation(p))
                    .length
                : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveMenu(item.id)}
                className={`w-full h-12 shrink-0 flex items-center justify-between gap-2 px-6 text-left text-[13.5px] font-semibold leading-none transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#020c36] text-white'
                    : 'text-white hover:bg-[#020c36]/55'
                }`}
                title={item.label}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <IconComponent className="w-[18px] h-[18px] shrink-0 text-white" />
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </div>
                {!sidebarCollapsed && resetCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                    {resetCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Logout Administrator Button */}
        <div className="relative z-10 shrink-0 p-4 border-t border-white/10 bg-[#00155a]/90">
          <button
            type="button"
            onClick={() => setShowLogoutConfirmModal(true)}
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
              SUMATIF AKHIR SEMESTER
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

            <button
              type="button"
              onClick={() => setShowLogoutConfirmModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Keluar dari sesi Administrator"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
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
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Logo Kementerian Pendidikan di Sebelah Kiri Atas */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 shrink-0 rounded-xl bg-blue-50/70 border border-blue-200/80 p-1 flex items-center justify-center shadow-xs">
                      <TutWuriLogo className="w-11 h-11" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Kementerian Pendidikan Dasar dan Menengah RI
                      </div>
                      <h2 className="text-base font-extrabold text-[#001a6e] tracking-tight">
                        Daftar Peserta & Cetak Kartu Login SAS 2026
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {appConfig?.namaSekolah || 'SMA Islam Diponegoro Wagir'} · NPSN: {appConfig?.npsn || '20517890'} · Total Terdaftar: <strong>{participants.length} Siswa</strong>
                      </p>
                    </div>
                  </div>

                  {/* Tombol Upload Excel (Nama Siswa & Kelas) dan Unduh Kartu Peserta (PDF) */}
                  <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
                    <input
                      ref={excelInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleUploadParticipantExcel}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={handleDownloadTemplateExcel}
                      className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      title="Unduh contoh file Excel dengan format kolom Nama Siswa dan Kelas"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Unduh Format Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => excelInputRef.current?.click()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
                      title="Upload file Excel (.xlsx / .xls / .csv) dengan format kolom Nama Siswa dan Kelas"
                    >
                      <Upload className="w-4 h-4 text-white" />
                      <span>Upload Excel (Nama Siswa & Kelas)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        generateParticipantCardsPDF(
                          participants,
                          `Kartu_Peserta_SAS_2026_${(appConfig?.namaSekolah || 'SMA_Islam_Diponegoro_Wagir').replace(/\s+/g, '_')}.pdf`,
                          appConfig?.namaSekolah || 'SMA ISLAM DIPONEGORO WAGIR',
                          appConfig?.namaKepalaSekolah || 'ROMEO GALISTRA, S.Pd.'
                        );
                        showNotice(`File PDF Kartu Peserta (${participants.length} Siswa) berhasil diunduh!`);
                      }}
                      className="px-4 py-2 bg-[#001a6e] hover:bg-[#00155a] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
                      title="Unduh seluruh kartu peserta dalam format PDF (A4 siap cetak)"
                    >
                      <Download className="w-4 h-4 text-[#0095ff]" />
                      <span>Unduh Kartu Peserta (PDF)</span>
                    </button>
                  </div>
                </div>
              )}

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
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <h3 className="text-sm font-bold text-slate-800 whitespace-nowrap">
                      {currentMenuMeta.label} (
                      {activeMenu === 'request_reset'
                        ? `${
                            participants.filter((p) =>
                              isParticipantLockedByViolation(p)
                            ).length
                          } Permintaan Reset`
                        : `${participants.length} Peserta`}
                      )
                    </h3>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={participantSearchQuery}
                        onChange={(e) => setParticipantSearchQuery(e.target.value)}
                        placeholder="Cari nama siswa..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#0095ff] focus:ring-2 focus:ring-[#0095ff]/15"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {activeMenu === 'request_reset' &&
                      participants.some((p) =>
                        isParticipantLockedByViolation(p)
                      ) && (
                        <button
                          type="button"
                          onClick={() => {
                            const nowTs = Date.now();
                            setParticipants((prev) =>
                              prev.map((row) => ({
                                ...row,
                                loginState:
                                  row.loginState === 'Terkunci (Pelanggaran)'
                                    ? 'Belum Login'
                                    : row.loginState,
                                requestReset: false,
                                violationReason: undefined,
                                violationAt: undefined,
                                violationSchema: undefined,
                                violationTimestamp: undefined,
                                lastResetAt: nowTs,
                              }))
                            );
                            showNotice(
                              'Seluruh permintaan Reset Login peserta telah dibersihkan.'
                            );
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-[#f04452] hover:bg-[#d93240] text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Semua Pelanggaran</span>
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => setActiveMenu('kelompok_tes')}
                      className="text-xs font-semibold text-[#0095ff] hover:underline cursor-pointer"
                    >
                      Ke Menu Kelompok Tes →
                    </button>
                  </div>
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
                      {(() => {
                        const filteredParticipantList = participants.filter((p) => {
                          const matchesMenu =
                            activeMenu === 'request_reset'
                              ? isParticipantLockedByViolation(p)
                              : true;
                          if (!matchesMenu) return false;
                          if (participantSearchQuery.trim()) {
                            const q = participantSearchQuery.trim().toLowerCase();
                            return p.namaPeserta.toLowerCase().includes(q);
                          }
                          return true;
                        });

                        if (filteredParticipantList.length === 0) {
                          return (
                            <tr>
                              <td
                                colSpan={8}
                                className="py-10 px-5 text-center text-slate-500"
                              >
                                {activeMenu === 'request_reset' &&
                                !participantSearchQuery.trim()
                                  ? 'Tidak ada pelanggaran atau permintaan Reset Login saat ini. Seluruh sesi peserta berjalan normal.'
                                  : `Tidak ada peserta dengan nama "${participantSearchQuery}" yang ditemukan.`}
                              </td>
                            </tr>
                          );
                        }

                        return filteredParticipantList.map((p, idx) => {
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
                              <td className="py-3.5 px-4">
                                {isParticipantLockedByViolation(p) ? (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-100 text-rose-700 font-bold text-[11px]">
                                      Terkunci (Pelanggaran Keluar CBT)
                                    </span>
                                    {p.violationReason && (
                                      <div className="text-[11px] text-rose-600">
                                        {p.violationReason}
                                        {p.violationAt
                                          ? ` (${p.violationAt})`
                                          : ''}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  p.loginState
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const targetUser = p.username.trim().toUpperCase();
                                    const nowTs = Date.now();
                                    setParticipants((prev) =>
                                      prev.map((row) =>
                                        row.id === p.id ||
                                        row.username.trim().toUpperCase() === targetUser
                                          ? {
                                              ...row,
                                              loginState: 'Belum Login',
                                              requestReset: false,
                                              violationReason: undefined,
                                              violationAt: undefined,
                                              violationSchema: undefined,
                                              violationTimestamp: undefined,
                                              lastResetAt: nowTs,
                                            }
                                          : row
                                      )
                                    );
                                    showNotice(
                                      `Login peserta ${p.namaPeserta} (${p.username}) berhasil di-reset. Siswa kini dapat login kembali.`
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
                        });
                      })()}
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
                      list="mapel-settings-suggestions"
                      value={newJadwalMapel}
                      onChange={(e) => setNewJadwalMapel(e.target.value)}
                      placeholder="Contoh: Matematika Wajib"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0095ff]"
                    />
                    <datalist id="mapel-settings-suggestions">
                      {(appConfig.mapelList || []).map((mpl: any, mIdx: number) => (
                        <option key={mpl.kode + mIdx} value={mpl.nama}>
                          {mpl.kode} - {mpl.nama} ({mpl.alokasiMenit} mnt)
                        </option>
                      ))}
                    </datalist>
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

          {/* 4. STATUS TES (Manajemen Bank Soal & Input Soal) */}
          {activeMenu === 'status_tes' && !selectedPackage && (
            <div className="bg-white p-8 rounded-xl border border-slate-200/80 shadow-2xs text-center space-y-3">
              <FolderTree className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">
                  Belum Ada Mata Pelajaran Terdaftar
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Silakan daftarkan mata pelajaran terlebih dahulu pada menu <strong>Pengaturan &rarr; Daftar Mata Pelajaran Ujian</strong> agar muncul pada kartu pengelompokan mata pelajaran.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveMenu('pengaturan')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#001a6e] hover:bg-[#00155a] text-white text-xs font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Buka Pengaturan Mata Pelajaran</span>
              </button>
            </div>
          )}

          {activeMenu === 'status_tes' && selectedPackage && (
            <div className="space-y-6">
              {/* KARTU 0: PENGELOMPOKAN MATA PELAJARAN SESUAI KELASNYA */}
              <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <FolderTree className="w-5 h-5 text-[#0095ff] shrink-0" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        Pengelompokan Mata Pelajaran Sesuai Kelasnya
                      </h3>
                      <p className="text-[11.5px] text-slate-500">
                        Daftar mata pelajaran dari menu Pengaturan dikelompokkan berdasarkan masing-masing kelas (Kelas X, XI IPA, XI IPS, XII IPA, XII IPS).
                      </p>
                    </div>
                  </div>

                  {/* Filter Cepat Kelas pada Kartu Pengelompokan */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['Semua Kelas', ...STATUS_TES_CLASS_GROUPS] as const).map((klsTab) => {
                      const isTabActive = statusTesKelas === klsTab;
                      const countInClass =
                        klsTab === 'Semua Kelas'
                          ? displayPackages.length
                          : displayPackages.filter((p) => getPkgClass(p) === klsTab).length;
                      return (
                        <button
                          key={klsTab}
                          type="button"
                          onClick={() => {
                            setStatusTesKelas(klsTab);
                            if (klsTab !== 'Semua Kelas') {
                              const firstPkgInClass = displayPackages.find(
                                (p) => getPkgClass(p) === klsTab
                              );
                              if (firstPkgInClass) {
                                setSelectedPkgId(firstPkgInClass.id);
                              }
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 border ${
                            isTabActive
                              ? 'bg-[#001a6e] text-white border-[#001a6e] shadow-2xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-[#0095ff] hover:border-blue-200'
                          }`}
                        >
                          <span>{klsTab}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                              isTabActive
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-200/80 text-slate-700'
                            }`}
                          >
                            {countInClass}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  className={`grid grid-cols-1 ${
                    statusTesKelas === 'Semua Kelas'
                      ? 'md:grid-cols-2 lg:grid-cols-3'
                      : 'md:grid-cols-1'
                  } gap-4`}
                >
                  {STATUS_TES_CLASS_GROUPS.filter(
                    (groupName) =>
                      statusTesKelas === 'Semua Kelas' || statusTesKelas === groupName
                  ).map((groupName) => {
                    const groupPkgs = displayPackages.filter(
                      (p) => getPkgClass(p) === groupName
                    );

                    const badgeStyle: Record<string, string> = {
                      'Kelas X': 'bg-blue-100 text-blue-800 border-blue-200',
                      'Kelas XI IPA': 'bg-emerald-100 text-emerald-800 border-emerald-200',
                      'Kelas XI IPS': 'bg-amber-100 text-amber-800 border-amber-200',
                      'Kelas XII IPA': 'bg-purple-100 text-purple-800 border-purple-200',
                      'Kelas XII IPS': 'bg-rose-100 text-rose-800 border-rose-200',
                    };

                    const headerBgStyle: Record<string, string> = {
                      'Kelas X': 'border-t-4 border-t-blue-500',
                      'Kelas XI IPA': 'border-t-4 border-t-emerald-500',
                      'Kelas XI IPS': 'border-t-4 border-t-amber-500',
                      'Kelas XII IPA': 'border-t-4 border-t-purple-500',
                      'Kelas XII IPS': 'border-t-4 border-t-rose-500',
                    };

                    return (
                      <div
                        key={groupName}
                        className={`p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 ${headerBgStyle[groupName] || ''}`}
                      >
                        <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-slate-600" />
                            <span
                              className={`px-2.5 py-0.5 text-xs font-extrabold rounded-md border ${
                                badgeStyle[groupName] || 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {groupName}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {groupPkgs.length} Mata Pelajaran
                          </span>
                        </div>

                        <div
                          className={
                            statusTesKelas !== 'Semua Kelas'
                              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'
                              : 'space-y-2.5'
                          }
                        >
                          {groupPkgs.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-4 text-center col-span-full">
                              Belum ada mata pelajaran untuk {groupName}
                            </p>
                          ) : (
                            groupPkgs.map((pkg, idxMapel) => {
                              const isSelected = selectedPackage.id === pkg.id;
                              const cleanTitle = pkg.title
                                .replace(/^Simulasi TKA\s*-\s*/i, '')
                                .replace(/\s*\(SMA\/MA\/SMK\)/i, '');

                              return (
                                <div
                                  key={pkg.id}
                                  onClick={() => setSelectedPkgId(pkg.id)}
                                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-50/90 border-[#0095ff] ring-1 ring-[#0095ff]/30 shadow-xs'
                                      : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/60'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                        {idxMapel + 1}. {pkg.code}
                                      </span>
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#001a6e] border border-blue-200">
                                        {groupName}
                                      </span>
                                    </div>
                                    <div className="text-xs font-bold text-slate-800 mt-1.5 leading-snug">
                                      {cleanTitle}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                      {pkg.subtest} · {pkg.durationMinutes} mnt
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* KARTU 1 (ATAS): TAMBAH BUTIR SOAL BARU & UPLOAD WORD */}
              <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-[#0095ff]" />
                    <h3 className="text-sm font-bold text-slate-800">
                      Tambah Butir Soal Baru ({getQuestionTypeLabel(newQuestionType)})
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    {/* Input File Word Tersembunyi */}
                    <input
                      ref={wordQuestionInputRef}
                      type="file"
                      accept=".docx,.doc"
                      onChange={handleUploadWordQuestions}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => wordQuestionInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-2xs transition-colors"
                      title="Upload file Word (.docx / .doc) dengan teks berwarna merah sebagai kunci jawaban yang benar"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Word (Teks Merah = Jawaban Benar)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadWordQuestionTemplate(selectedPackage.title)
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
                      title="Unduh contoh format soal Word (.docx) dengan jawaban benar berwarna merah"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      Template Word
                    </button>

                    {/* Dropdown Tipe Soal */}
                    <div className="flex items-center gap-1.5">
                      <label className="font-semibold text-slate-700 whitespace-nowrap">
                        Tipe Soal:
                      </label>
                      <select
                        value={newQuestionType}
                        onChange={(e) => setNewQuestionType(e.target.value as QuestionType)}
                        className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-[#0095ff]"
                      >
                        <option value="pilihan_ganda">Pilihan Ganda (PG)</option>
                        <option value="pilihan_ganda_kompleks">Pilihan Ganda Kompleks (PG Kompleks)</option>
                        <option value="benar_salah">Benar / Salah</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-medium">Mapel Target:</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                        {getPkgClass(selectedPackage)}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-[#001a6e] font-semibold border border-blue-200">
                        {selectedPackage.title.replace(/^Simulasi TKA\s*-\s*/i, '').replace(/\s*\(SMA\/MA\/SMK\)/i, '')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-rose-50/70 border border-rose-200/80 text-xs text-rose-900">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <strong>Format Upload Word (.docx / .doc) & Tabel:</strong> Beri{' '}
                      <span className="font-bold text-rose-600 underline">
                        warna merah
                      </span>{' '}
                      pada tulisan opsi jawaban yang benar di dalam file Word (mendukung format paragraf maupun tabel). Jika sudah Upload Word, kolom Pertanyaan Soal dan Jawaban di bawah <strong>tidak harus diisi</strong>.
                    </span>
                  </div>
                  {lastUploadedWordFile && (
                    <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 shrink-0">
                      Terunggah: {lastUploadedWordFile}
                    </span>
                  )}
                </div>

                <form
                  onSubmit={handleAddQuestion}
                  className="space-y-4 text-xs"
                >
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Pertanyaan Soal{' '}
                      <span className="font-normal text-slate-500">
                        (Opsional / Tidak harus diisi jika sudah Upload Word)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={newQuestionText}
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      placeholder={
                        newQuestionType === 'pilihan_ganda'
                          ? 'Ketik butir pertanyaan soal pilihan ganda di sini (opsional jika menggunakan Upload Word)'
                          : newQuestionType === 'pilihan_ganda_kompleks'
                          ? 'Ketik butir pertanyaan soal pilihan ganda kompleks di sini (opsional jika menggunakan Upload Word)'
                          : 'Ketik pokok pertanyaan / instruksi soal benar-salah di sini (opsional jika menggunakan Upload Word)'
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-[#0095ff]"
                    />
                  </div>

                  {/* Input Khusus Tipe: Pilihan Ganda (PG) */}
                  {newQuestionType === 'pilihan_ganda' && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Pilihan Jawaban (A, B, C, D, E) & Kunci Jawaban Tunggal{' '}
                        <span className="font-normal text-slate-500">
                          (Opsional / Tidak harus diisi jika sudah Upload Word)
                        </span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        <input
                          type="text"
                          value={optA}
                          onChange={(e) => setOptA(e.target.value)}
                          placeholder="Opsi A"
                          className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-[#0095ff]"
                        />
                        <input
                          type="text"
                          value={optB}
                          onChange={(e) => setOptB(e.target.value)}
                          placeholder="Opsi B"
                          className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-[#0095ff]"
                        />
                        <input
                          type="text"
                          value={optC}
                          onChange={(e) => setOptC(e.target.value)}
                          placeholder="Opsi C"
                          className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-[#0095ff]"
                        />
                        <input
                          type="text"
                          value={optD}
                          onChange={(e) => setOptD(e.target.value)}
                          placeholder="Opsi D"
                          className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-[#0095ff]"
                        />
                        <input
                          type="text"
                          value={optE}
                          onChange={(e) => setOptE(e.target.value)}
                          placeholder="Opsi E"
                          className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-[#0095ff]"
                        />
                        <select
                          value={correctOpt}
                          onChange={(e) => setCorrectOpt(e.target.value)}
                          className="px-3 py-1.5 font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-[#0095ff]"
                        >
                          {['A', 'B', 'C', 'D', 'E'].map((k) => (
                            <option key={k} value={k}>
                              Kunci: Opsi {k}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Input Khusus Tipe: Pilihan Ganda Kompleks (PG Kompleks) */}
                  {newQuestionType === 'pilihan_ganda_kompleks' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block font-semibold text-slate-700">
                          Pilihan Jawaban (A, B, C, D, E) & Centang Kunci Jawaban Benar (Bisa Lebih dari 1) *
                        </label>
                        <span className="text-[11px] text-blue-600 font-medium">
                          Terpilih: {complexCorrectOpts.join(', ') || 'Belum ada'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {[
                          { id: 'A', val: optA, setVal: setOptA, ph: 'Opsi A *' },
                          { id: 'B', val: optB, setVal: setOptB, ph: 'Opsi B *' },
                          { id: 'C', val: optC, setVal: setOptC, ph: 'Opsi C' },
                          { id: 'D', val: optD, setVal: setOptD, ph: 'Opsi D' },
                          { id: 'E', val: optE, setVal: setOptE, ph: 'Opsi E' },
                        ].map((item) => {
                          const isChecked = complexCorrectOpts.includes(item.id);
                          return (
                            <div key={item.id} className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                              <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer text-xs shrink-0 px-1">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setComplexCorrectOpts((prev) => [...prev, item.id].sort());
                                    } else {
                                      setComplexCorrectOpts((prev) => prev.filter((x) => x !== item.id));
                                    }
                                  }}
                                  className="w-4 h-4 text-[#001a6e] rounded border-slate-300 focus:ring-[#0095ff]"
                                />
                                <span>{item.id}</span>
                              </label>
                              <input
                                type="text"
                                value={item.val}
                                onChange={(e) => item.setVal(e.target.value)}
                                placeholder={item.ph}
                                className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:border-[#0095ff]"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Input Khusus Tipe: Benar / Salah */}
                  {newQuestionType === 'benar_salah' && (
                    <div className="space-y-2.5">
                      <label className="block font-semibold text-slate-700">
                        Daftar Pernyataan & Kunci Nilai (Benar / Salah) *
                      </label>
                      <div className="space-y-2">
                        {[
                          { id: 'st1', label: 'Pernyataan 1', val: statement1, setVal: setStatement1, ans: statement1Val, setAns: setStatement1Val },
                          { id: 'st2', label: 'Pernyataan 2', val: statement2, setVal: setStatement2, ans: statement2Val, setAns: setStatement2Val },
                          { id: 'st3', label: 'Pernyataan 3', val: statement3, setVal: setStatement3, ans: statement3Val, setAns: setStatement3Val },
                        ].map((st) => (
                          <div key={st.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                            <span className="font-semibold text-slate-700 shrink-0 w-24">
                              {st.label}:
                            </span>
                            <input
                              type="text"
                              value={st.val}
                              onChange={(e) => st.setVal(e.target.value)}
                              placeholder={`Ketik isi ${st.label.toLowerCase()} di sini...`}
                              className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-[#0095ff]"
                            />
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => st.setAns('Benar')}
                                className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                                  st.ans === 'Benar'
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                Benar
                              </button>
                              <button
                                type="button"
                                onClick={() => st.setAns('Salah')}
                                className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                                  st.ans === 'Salah'
                                    ? 'bg-rose-600 text-white shadow-2xs'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                Salah
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end pt-2">
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-lg bg-[#001a6e] hover:bg-[#00155a] text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Simpan Soal ({getQuestionTypeLabel(newQuestionType)})
                    </button>
                  </div>
                </form>

                {/* BAGIAN BAWAH (TERGABUNG): MANAJEMEN BANK SOAL */}
                <div className="pt-6 border-t border-slate-200 space-y-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#0095ff]" />
                      <h3 className="text-sm font-bold text-slate-800">
                        Manajemen Bank Soal — {getPkgClass(selectedPackage)} ({
                          selectedPackage.questions.filter((q) => {
                            if (statusTesTipeSoal === 'Semua Tipe Soal') return true;
                            return q.type === statusTesTipeSoal;
                          }).length
                        } dari {selectedPackage.questions.length} Soal)
                      </h3>
                    </div>

                  {/* Dropdown Kelas, Dropdown Mata Pelajaran (Sesuai Kelas), dan Dropdown Tipe Soal */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Dropdown Kelas */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <label className="font-semibold text-slate-700 whitespace-nowrap">
                        Kelas:
                      </label>
                      <select
                        value={statusTesKelas}
                        onChange={(e) => {
                          const newKelas = e.target.value;
                          setStatusTesKelas(newKelas);
                          if (newKelas !== 'Semua Kelas') {
                            const matched = displayPackages.find(
                              (p) => getPkgClass(p) === newKelas
                            );
                            if (matched) {
                              setSelectedPkgId(matched.id);
                            }
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-[#0095ff]"
                      >
                        <option value="Semua Kelas">Semua Kelas</option>
                        {STATUS_TES_CLASS_GROUPS.map((kls) => (
                          <option key={kls} value={kls}>
                            {kls}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Dropdown Mata Pelajaran (Dikelompokkan Sesuai Kelasnya) */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <label className="font-semibold text-slate-700 whitespace-nowrap">
                        Mata Pelajaran:
                      </label>
                      <select
                        value={selectedPackage.id}
                        onChange={(e) => setSelectedPkgId(e.target.value)}
                        className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-[#0095ff]"
                      >
                        {STATUS_TES_CLASS_GROUPS.filter(
                          (groupName) =>
                            statusTesKelas === 'Semua Kelas' ||
                            statusTesKelas === groupName
                        ).map((groupName) => {
                          const groupPkgs = displayPackages.filter(
                            (p) => getPkgClass(p) === groupName
                          );
                          if (groupPkgs.length === 0) return null;
                          return (
                            <optgroup
                              key={groupName}
                              label={`── ${groupName.toUpperCase()} (${groupPkgs.length} Mapel) ──`}
                            >
                              {groupPkgs.map((p) => {
                                const cleanTitle = p.title
                                  .replace(/^Simulasi TKA\s*-\s*/i, '')
                                  .replace(/\s*\(SMA\/MA\/SMK\)/i, '');
                                return (
                                  <option key={p.id} value={p.id}>
                                    [{groupName}] {cleanTitle} ({p.code})
                                  </option>
                                );
                              })}
                            </optgroup>
                          );
                        })}
                      </select>
                    </div>

                    {/* Dropdown Tipe Soal (PG, PG Kompleks, Benar/Salah) */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <label className="font-semibold text-slate-700 whitespace-nowrap">
                        Tipe Soal:
                      </label>
                      <select
                        value={statusTesTipeSoal}
                        onChange={(e) => setStatusTesTipeSoal(e.target.value)}
                        className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-[#0095ff]"
                      >
                        <option value="Semua Tipe Soal">Semua Tipe Soal</option>
                        <option value="pilihan_ganda">Pilihan Ganda (PG)</option>
                        <option value="pilihan_ganda_kompleks">Pilihan Ganda Kompleks (PG Kompleks)</option>
                        <option value="benar_salah">Benar / Salah</option>
                      </select>
                    </div>

                    {selectedPackage.questions.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDeleteAllQuestions}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors"
                        title="Hapus semua butir soal pada daftar ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Semua Soal</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
                  {selectedPackage.questions.filter((q) => {
                    if (statusTesTipeSoal === 'Semua Tipe Soal') return true;
                    return q.type === statusTesTipeSoal;
                  }).length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 italic">
                      Belum ada butir soal pada mata pelajaran ini. Silakan klik tombol <strong>Upload Word</strong> atau tambahkan soal baru di atas.
                    </div>
                  ) : (
                    selectedPackage.questions
                      .filter((q) => {
                        if (statusTesTipeSoal === 'Semua Tipe Soal') return true;
                        return q.type === statusTesTipeSoal;
                      })
                      .map((q) => (
                      <div
                        key={q.id}
                        className="p-3.5 flex items-start justify-between gap-3 hover:bg-slate-50 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono font-bold text-[#0095ff]">
                              No. {q.number}
                            </span>
                            <span className="font-semibold text-slate-700">
                              [{getQuestionTypeLabel(q.type)}]
                            </span>
                            <span className="text-slate-400">· {q.category}</span>
                            {q.correctOptionId && (
                              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                                Kunci: {q.correctOptionId}
                              </span>
                            )}
                            {q.correctOptionIds && q.correctOptionIds.length > 0 && (
                              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                                Kunci: {q.correctOptionIds.join(', ')}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-700 mt-1">{q.questionText}</p>
                          {q.stimulusTable && (
                            <div className="mt-2 overflow-x-auto border border-slate-200 rounded-lg bg-white max-w-2xl">
                              <table className="w-full text-left border-collapse text-[11px]">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                                    {q.stimulusTable.headers.map((h, hIdx) => (
                                      <th key={hIdx} className="py-1.5 px-2.5 font-semibold border-r last:border-r-0 border-slate-200">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {q.stimulusTable.rows.map((r, rIdx) => (
                                    <tr key={rIdx}>
                                      {r.map((cell, cIdx) => (
                                        <td key={cIdx} className="py-1 px-2.5 text-slate-700 border-r last:border-r-0 border-slate-100">
                                          {cell}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          title="Hapus soal ini"
                          className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                </div>
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

          {/* MENU 11: PENGATURAN SISTEM UJIAN SAS */}
          {activeMenu === 'pengaturan' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-[#001a6e]" />
                    Pengaturan Sistem & Pelaksanaan Ujian SAS
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Konfigurasi parameter pelaksanaan Sumatif Akhir Semester, aturan anti-curang, dan sinkronisasi server.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportSettings}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Ekspor JSON
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSettings}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Standar
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-6">
                {/* Bagian 1: Identitas Lembaga & Sesi Ujian */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#0095ff]" />
                    1. Identitas Satuan Pendidikan & Kegiatan Ujian
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Nama Satuan Pendidikan / Sekolah
                      </label>
                      <input
                        type="text"
                        value={appConfig.namaSekolah}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, namaSekolah: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#0095ff] outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        NPSN Sekolah
                      </label>
                      <input
                        type="text"
                        value={appConfig.npsn}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, npsn: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Nama Kepala Sekolah
                      </label>
                      <input
                        type="text"
                        value={appConfig.namaKepalaSekolah || 'ROMEO GALISTRA, S.Pd.'}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, namaKepalaSekolah: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#0095ff] outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Nama Kegiatan Ujian
                      </label>
                      <input
                        type="text"
                        value={appConfig.namaUjian}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, namaUjian: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#0095ff] outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Semester / Tahun Ajaran
                      </label>
                      <input
                        type="text"
                        value={appConfig.semester}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, semester: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Moda Pelaksanaan
                      </label>
                      <select
                        value={appConfig.modaPelaksanaan}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, modaPelaksanaan: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#0095ff] outline-none"
                      >
                        <option value="Daring (Online)">Daring (Online Penuh / Cloud)</option>
                        <option value="Semi-Daring (Semi-Online)">Semi-Daring (Local Server / VHD)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Ruang Pelaksanaan Utama
                      </label>
                      <input
                        type="text"
                        value={appConfig.ruangDefault}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, ruangDefault: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Tingkat / Jenjang Sasaran
                      </label>
                      <select
                        value={appConfig.tingkatKelas || 'Semua Tingkat (Kelas X, XI, XII)'}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, tingkatKelas: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#0095ff] outline-none"
                      >
                        <option value="Semua Tingkat (Kelas X, XI, XII)">Semua Tingkat (Kelas X, XI, XII)</option>
                        <option value="Kelas X (Fase E)">Kelas X (Fase E)</option>
                        <option value="Kelas XI (Fase F)">Kelas XI (Fase F)</option>
                        <option value="Kelas XII (Tingkat Akhir)">Kelas XII (Tingkat Akhir)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Kolom Ringkasan Rombel
                      </label>
                      <input
                        type="text"
                        value={appConfig.daftarKelas || ''}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, daftarKelas: e.target.value })
                        }
                        placeholder="Contoh: X-1, X-2, XI-IPA..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono text-[11px] text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Nama Administrator Utama
                      </label>
                      <input
                        type="text"
                        value={appConfig.adminNama || 'ROMEO GALISTRA, S.Pd.'}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, adminNama: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#0095ff] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        ID Administrator Utama
                      </label>
                      <input
                        type="text"
                        value={appConfig.adminId || 'K05060108-KB6K'}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, adminId: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        No. Kontak / WhatsApp Admin
                      </label>
                      <input
                        type="text"
                        value={appConfig.adminNoHp || '0812-3456-7890'}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, adminNoHp: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Email Resmi Administrator
                      </label>
                      <input
                        type="email"
                        value={appConfig.adminEmail || 'admin.cbt@smadiponegorowagir.sch.id'}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, adminEmail: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Bagian 2: Kolom Data Administrator & Penanggung Jawab CBT */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <UserCog className="w-4 h-4 text-[#0095ff]" />
                        2. Kolom Data Administrator & Penanggung Jawab CBT
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Kelola data akun administrator sistem ujian SAS, hak akses wewenang, ID administrator, kontak resmi, dan status keaktifan akun.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#001a6e] border border-blue-200 rounded-full text-xs font-bold shadow-2xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#0095ff]" />
                        Total {(appConfig.adminList || []).length} Administrator Terdaftar
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAdminForm((prev) => !prev)}
                        className="px-3.5 py-1.5 bg-[#001a6e] hover:bg-[#00155a] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                        title="Klik untuk membuka formulir input data administrator baru"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{showAdminForm ? 'Tutup Form' : 'Tambah Administrator'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Form Tambah Administrator Baru */}
                  {(showAdminForm || (appConfig.adminList || []).length === 0) && (
                    <div className="bg-white border-2 border-blue-200/90 rounded-lg p-4 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5 text-[#0095ff]" />
                          Form Tambah Kolom Data Administrator Baru
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Lengkapi ID Administrator dan Nama Lengkap lalu tekan Simpan
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">
                            ID Administrator *
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: ADM-TEKNIS-02"
                            value={newAdminId}
                            onChange={(e) => setNewAdminId(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono uppercase text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="block font-semibold text-slate-600 mb-1">
                            Nama Lengkap Administrator *
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: AHMAD FAUZI, S.Kom."
                            value={newAdminNama}
                            onChange={(e) => setNewAdminNama(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">
                            NIP / NUPTK
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: 198503152010011012"
                            value={newAdminNip}
                            onChange={(e) => setNewAdminNip(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">
                            Peran / Wewenang
                          </label>
                          <select
                            value={newAdminRole}
                            onChange={(e) => setNewAdminRole(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                          >
                            <option value="Penanggung Jawab / Super Admin">Penanggung Jawab / Super Admin</option>
                            <option value="Administrator Server & Database">Administrator Server & Database</option>
                            <option value="Administrator Kurikulum & Bank Soal">Administrator Kurikulum & Bank Soal</option>
                            <option value="Tim Teknis / IT Support">Tim Teknis / IT Support</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">
                            Kontak / No. WhatsApp
                          </label>
                          <input
                            type="text"
                            placeholder="0812-xxxx-xxxx"
                            value={newAdminNoHp}
                            onChange={(e) => setNewAdminNoHp(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-2 border-t border-slate-100 gap-2">
                        <div className="flex-1 max-w-sm">
                          <label className="block font-semibold text-slate-600 mb-1 text-xs">
                            Email Resmi Administrator
                          </label>
                          <input
                            type="email"
                            placeholder="admin.cbt@smadiponegorowagir.sch.id"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none text-xs"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2 self-end">
                          {showAdminForm && (
                            <button
                              type="button"
                              onClick={() => setShowAdminForm(false)}
                              className="py-1.5 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                            >
                              Batal
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleAddAdminToSettings}
                            className="py-1.5 px-4 bg-[#001a6e] hover:bg-[#00155a] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Simpan Administrator
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tombol Akses Cepat Tambah Administrator */}
                  {!showAdminForm && (appConfig.adminList || []).length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white border border-dashed border-blue-300 rounded-lg hover:border-blue-400 transition-colors gap-2">
                      <div className="flex items-center gap-2 text-xs text-slate-700">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                          <UserCog className="w-4 h-4 text-[#0095ff]" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">Tambah Akun Administrator Baru</div>
                          <div className="text-[11px] text-slate-500">Klik tombol di sebelah kanan untuk menambahkan administrator atau tim teknis CBT baru.</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAdminForm(true)}
                        className="py-2 px-4 bg-[#001a6e] hover:bg-[#00155a] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Tambah Administrator
                      </button>
                    </div>
                  )}

                  {/* Tabel Kolom Data Administrator */}
                  <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                          <th className="py-2.5 px-3 w-12 text-center">No</th>
                          <th className="py-2.5 px-3">ID Administrator</th>
                          <th className="py-2.5 px-3">Nama Lengkap Administrator</th>
                          <th className="py-2.5 px-3">NIP / NUPTK</th>
                          <th className="py-2.5 px-3">Kontak / WhatsApp</th>
                          <th className="py-2.5 px-3">Email Resmi</th>
                          <th className="py-2.5 px-3">Peran / Hak Akses</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-center w-20">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(appConfig.adminList || []).map((adm: any, idx: number) => {
                          return (
                            <tr key={adm.id || adm.adminId + idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-bold">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 text-[#001a6e] border border-blue-200 font-mono font-bold text-[11px]">
                                  {adm.adminId}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {adm.namaLengkap}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                                {adm.nip || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 font-medium">
                                {adm.noHp || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {adm.email || '-'}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-semibold">
                                  {adm.role || 'Administrator'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleAdminStatusInSettings(adm.adminId)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                                    adm.status === 'Aktif'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                                  }`}
                                  title="Klik untuk ubah status keaktifan"
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      adm.status === 'Aktif' ? 'bg-emerald-500' : 'bg-slate-400'
                                    }`}
                                  ></span>
                                  {adm.status || 'Aktif'}
                                </button>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAdminFromSettings(adm.adminId)}
                                  className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                  title={`Hapus administrator ${adm.namaLengkap}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {(!appConfig.adminList || appConfig.adminList.length === 0) && (
                          <tr>
                            <td colSpan={9} className="py-6 text-center text-slate-400">
                              Belum ada akun administrator yang didaftarkan. Gunakan formulir di atas untuk menambahkan.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pratinjau Tag Kolom Administrator Terdaftar */}
                  <div className="pt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-semibold text-slate-600 mr-1">Administrator Aktif:</span>
                    {(appConfig.adminList || []).map((adm: any, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-300 text-slate-700 rounded-md font-mono text-[11px] shadow-2xs"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${adm.status === 'Aktif' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {adm.adminId} ({adm.namaLengkap})
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bagian 3: Kolom Kelas & Rombongan Belajar (Rombel) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-[#0095ff]" />
                        3. Kolom Kelas & Rombongan Belajar (Rombel) Peserta Ujian
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Konfigurasi kolom kelas aktif, penetapan tingkat, program keahlian/jurusan, dan ruang ujian pelaksanaan.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#001a6e] border border-blue-200 rounded-full text-xs font-bold shadow-2xs self-start sm:self-auto">
                      <GraduationCap className="w-3.5 h-3.5 text-[#0095ff]" />
                      Total {(appConfig.kelasList || []).length} Kolom Kelas Terdaftar
                    </span>
                  </div>

                  {/* Form Tambah Kolom Kelas Baru */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-2xs">
                    <span className="text-xs font-bold text-slate-700 block">
                      Tambah Kolom Kelas / Rombel Baru
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">
                          Nama / Kode Kelas
                        </label>
                        <input
                          type="text"
                          placeholder="Misal: X-3 atau XII-BAHASA"
                          value={newPengaturanKelasKode}
                          onChange={(e) => setNewPengaturanKelasKode(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-800 font-semibold uppercase focus:bg-white focus:ring-2 focus:ring-[#0095ff] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">
                          Tingkat / Jenjang
                        </label>
                        <select
                          value={newPengaturanKelasTingkat}
                          onChange={(e) => setNewPengaturanKelasTingkat(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                        >
                          <option value="Kelas X">Kelas X (Fase E)</option>
                          <option value="Kelas XI">Kelas XI (Fase F)</option>
                          <option value="Kelas XII">Kelas XII (Tingkat Akhir)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">
                          Program / Peminatan
                        </label>
                        <select
                          value={newPengaturanKelasJurusan}
                          onChange={(e) => setNewPengaturanKelasJurusan(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                        >
                          <option value="Fase E (Umum)">Fase E (Umum)</option>
                          <option value="MIPA (Fase F)">MIPA (Fase F)</option>
                          <option value="IPS (Fase F)">IPS (Fase F)</option>
                          <option value="Bahasa & Budaya">Bahasa & Budaya</option>
                          <option value="Keagamaan">Keagamaan</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">
                          Ruang Lab Pelaksanaan
                        </label>
                        <input
                          type="text"
                          value={newPengaturanKelasRuang}
                          onChange={(e) => setNewPengaturanKelasRuang(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleAddKelasToSettings}
                          className="w-full py-1.5 px-3 bg-[#001a6e] hover:bg-[#00155a] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Tambah Kolom
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tabel Kolom Kelas */}
                  <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                          <th className="py-2.5 px-3 w-12 text-center">No</th>
                          <th className="py-2.5 px-3">Kolom / Nama Kelas</th>
                          <th className="py-2.5 px-3">Tingkat / Fase</th>
                          <th className="py-2.5 px-3">Program / Jurusan</th>
                          <th className="py-2.5 px-3">Ruang Ujian</th>
                          <th className="py-2.5 px-3">Sesi Bawaan</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-center w-20">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(appConfig.kelasList || []).map((kls: any, idx: number) => {
                          const tingkatBadgeColor =
                            kls.tingkat === 'Kelas X'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : kls.tingkat === 'Kelas XI'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-purple-50 text-purple-700 border-purple-200';

                          return (
                            <tr key={kls.kode + idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2 px-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold text-slate-800">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 font-mono">
                                  {kls.kode}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <span className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${tingkatBadgeColor}`}>
                                  {kls.tingkat}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-600 font-medium">{kls.jurusan}</td>
                              <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">{kls.ruang}</td>
                              <td className="py-2 px-3 text-slate-600">{kls.sesi}</td>
                              <td className="py-2 px-3 text-center">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold text-[10px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  {kls.status || 'Aktif'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteKelasFromSettings(kls.kode)}
                                  className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                  title={`Hapus kelas ${kls.kode}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {(!appConfig.kelasList || appConfig.kelasList.length === 0) && (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-slate-400">
                              Belum ada kolom kelas yang didaftarkan. Gunakan formulir di atas untuk menambahkan.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pratinjau Tag Kolom Kelas Aktif */}
                  <div className="pt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-semibold text-slate-600 mr-1">Rombel Terdaftar:</span>
                    {(appConfig.kelasList || []).map((kls: any, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-300 text-slate-700 rounded-md font-mono text-[11px] shadow-2xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0095ff]"></span>
                        {kls.kode}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bagian 4: Daftar & Pengaturan Mata Pelajaran (Mapel) Ujian */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#0095ff]" />
                        4. Mata Pelajaran (Mapel) Ujian SAS
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Kelola kurikulum mata pelajaran ujian SAS, penetapan kode mapel, tingkat sasaran, durasi waktu pengerjaan, dan KKM kelulusan.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#001a6e] border border-blue-200 rounded-full text-xs font-bold shadow-2xs">
                        <BookOpen className="w-3.5 h-3.5 text-[#0095ff]" />
                        Total {(appConfig.mapelList || []).length} Mapel Terdaftar
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowMapelForm((prev) => !prev)}
                        className="px-3.5 py-1.5 bg-[#0095ff] hover:bg-[#007acc] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                        title="Klik untuk membuka formulir input mata pelajaran baru"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{showMapelForm ? 'Tutup Form' : 'Input Mata Pelajaran'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Form Input Mata Pelajaran Baru */}
                  {(showMapelForm || (appConfig.mapelList || []).length === 0) && (
                    <div className="bg-white border-2 border-blue-200/90 rounded-lg p-4 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5 text-[#0095ff]" />
                          Form Input Mata Pelajaran Baru
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Lengkapi nama mata pelajaran lalu tekan Simpan
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                        <div className="lg:col-span-2">
                          <label className="block font-semibold text-slate-600 mb-1">
                            Nama Mata Pelajaran *
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: Bahasa Indonesia & Literasi"
                            value={newMapelNama}
                            onChange={(e) => setNewMapelNama(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">
                            Kode Mapel
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: BIN-SAS"
                            value={newMapelKode}
                            onChange={(e) => setNewMapelKode(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono uppercase text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">
                            Kelas Sasaran
                          </label>
                          <select
                            value={newMapelTingkat}
                            onChange={(e) => setNewMapelTingkat(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                          >
                            <option value="Kelas X">Kelas X</option>
                            <option value="Kelas XI IPA">Kelas XI IPA</option>
                            <option value="Kelas XI IPS">Kelas XI IPS</option>
                            <option value="Kelas XII IPA">Kelas XII IPA</option>
                            <option value="Kelas XII IPS">Kelas XII IPS</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">
                            Kategori / Jurusan
                          </label>
                          <select
                            value={newMapelKategori}
                            onChange={(e) => setNewMapelKategori(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                          >
                            <option value="Wajib Umum">Wajib Umum</option>
                            <option value="Peminatan MIPA">Peminatan MIPA</option>
                            <option value="Peminatan IPS">Peminatan IPS</option>
                            <option value="Pendidikan Agama">Pendidikan Agama</option>
                            <option value="Muatan Lokal / Bahasa">Muatan Lokal</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block font-semibold text-slate-600 mb-1">
                              Durasi (Mnt)
                            </label>
                            <input
                              type="number"
                              min={10}
                              max={240}
                              value={newMapelAlokasi}
                              onChange={(e) => setNewMapelAlokasi(Number(e.target.value) || 90)}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-center font-mono text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-600 mb-1">
                              KKM
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={newMapelKKM}
                              onChange={(e) => setNewMapelKKM(Number(e.target.value) || 75)}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-center font-mono text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        {showMapelForm && (
                          <button
                            type="button"
                            onClick={() => setShowMapelForm(false)}
                            className="py-1.5 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                          >
                            Batal
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleAddMapelToSettings}
                          className="py-1.5 px-4 bg-[#001a6e] hover:bg-[#00155a] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Simpan Mata Pelajaran
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tombol Input Mata Pelajaran Akses Cepat */}
                  {!showMapelForm && (appConfig.mapelList || []).length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white border border-dashed border-blue-300 rounded-lg hover:border-blue-400 transition-colors gap-2">
                      <div className="flex items-center gap-2 text-xs text-slate-700">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4 text-[#0095ff]" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">Tambah Mata Pelajaran Ujian Baru</div>
                          <div className="text-[11px] text-slate-500">Klik tombol di sebelah kanan untuk membuka formulir input mata pelajaran.</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowMapelForm(true)}
                        className="py-2 px-4 bg-[#001a6e] hover:bg-[#00155a] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Input Mata Pelajaran
                      </button>
                    </div>
                  )}

                  {/* Tabel Daftar Mata Pelajaran */}
                  <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                          <th className="py-2.5 px-3 w-12 text-center">No</th>
                          <th className="py-2.5 px-3">Kode Mapel</th>
                          <th className="py-2.5 px-3">Nama Mata Pelajaran</th>
                          <th className="py-2.5 px-3">Tingkat / Fase</th>
                          <th className="py-2.5 px-3">Kategori</th>
                          <th className="py-2.5 px-3 text-center">Durasi</th>
                          <th className="py-2.5 px-3 text-center">KKM</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-center w-20">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(appConfig.mapelList || []).map((mpl: any, idx: number) => {
                          return (
                            <tr key={mpl.kode + idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-bold">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 text-[#001a6e] border border-blue-200 font-mono font-bold text-[11px]">
                                  {mpl.kode}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {mpl.nama}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium">
                                  {mpl.tingkat}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 font-medium">{mpl.kategori}</td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-700 font-semibold">
                                {mpl.alokasiMenit} mnt
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700">
                                {mpl.kkm}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleMapelStatus(mpl.kode)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded-full font-semibold text-[10px] cursor-pointer transition-colors ${
                                    mpl.status === 'Aktif'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                  }`}
                                  title="Klik untuk mengubah status aktif/non-aktif"
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      mpl.status === 'Aktif' ? 'bg-emerald-500' : 'bg-slate-400'
                                    }`}
                                  ></span>
                                  {mpl.status || 'Aktif'}
                                </button>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMapelFromSettings(mpl.kode)}
                                  className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                  title={`Hapus mata pelajaran ${mpl.nama}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {(!appConfig.mapelList || appConfig.mapelList.length === 0) && (
                          <tr>
                            <td colSpan={9} className="py-6 text-center text-slate-400">
                              Belum ada mata pelajaran yang didaftarkan. Gunakan tombol Input Mata Pelajaran di atas untuk menambahkan.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pratinjau Tag Mata Pelajaran Terdaftar */}
                  <div className="pt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-semibold text-slate-600 mr-1">Mapel Terdaftar:</span>
                    {(appConfig.mapelList || []).map((mpl: any, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-300 text-slate-700 rounded-md font-mono text-[11px] shadow-2xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {mpl.kode} - {mpl.nama}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bagian 5: Parameter Teknis Ujian */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#0095ff]" />
                    5. Parameter Waktu & Alur Pengerjaan
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Durasi Standar Ujian (Menit)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={300}
                        value={appConfig.durasiDefault}
                        onChange={(e) =>
                          setAppConfig({
                            ...appConfig,
                            durasiDefault: Number(e.target.value) || 90,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                      />
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Durasi bawaan saat membuat jadwal baru.
                      </span>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Waktu Minimal Tombol Selesai (Menit)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={appConfig.durasiDefault}
                        value={appConfig.minMinutesBeforeFinish}
                        onChange={(e) =>
                          setAppConfig({
                            ...appConfig,
                            minMinutesBeforeFinish: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                      />
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Peserta tidak dapat klik selesai sebelum waktu ini lewat.
                      </span>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Interval Pembaruan Token (Menit)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={60}
                        value={appConfig.tokenIntervalMenit}
                        onChange={(e) =>
                          setAppConfig({
                            ...appConfig,
                            tokenIntervalMenit: Number(e.target.value) || 15,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                      />
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Sistem merefresh token otomatis tiap X menit.
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={appConfig.acakSoal}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, acakSoal: e.target.checked })
                        }
                        className="w-4 h-4 text-[#001a6e] rounded border-slate-300 focus:ring-[#0095ff]"
                      />
                      <div>
                        <span className="font-semibold text-slate-800 block">
                          Acak Urutan Soal (Shuffle Questions)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Urutan nomor soal berbeda untuk tiap peserta.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={appConfig.acakOpsi}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, acakOpsi: e.target.checked })
                        }
                        className="w-4 h-4 text-[#001a6e] rounded border-slate-300 focus:ring-[#0095ff]"
                      />
                      <div>
                        <span className="font-semibold text-slate-800 block">
                          Acak Pilihan Jawaban (Shuffle Options)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Pilihan A, B, C, D, E diacak secara dinamis.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={appConfig.tampilkanNilaiPeserta}
                        onChange={(e) =>
                          setAppConfig({
                            ...appConfig,
                            tampilkanNilaiPeserta: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-[#001a6e] rounded border-slate-300 focus:ring-[#0095ff]"
                      />
                      <div>
                        <span className="font-semibold text-slate-800 block">
                          Tampilkan Nilai Akhir ke Siswa
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Siswa langsung melihat skor setelah menekan tombol selesai.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Bagian 6: Keamanan & Pengawasan Ujian */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    6. Keamanan, Anti-Kecurangan & Kunci Sistem
                  </h4>
                  <div className="space-y-3 text-xs">
                    <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={appConfig.wajibFullscreen}
                        onChange={(e) =>
                          setAppConfig({
                            ...appConfig,
                            wajibFullscreen: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-[#001a6e] rounded border-slate-300 focus:ring-[#0095ff]"
                      />
                      <div>
                        <span className="font-semibold text-slate-800 block">
                          Wajib Mode Layar Penuh (Fullscreen Lock)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Memaksa tampilan layar penuh pada perangkat HP dan komputer.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={appConfig.kunciKeluarSistem}
                        onChange={(e) =>
                          setAppConfig({
                            ...appConfig,
                            kunciKeluarSistem: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-[#001a6e] rounded border-slate-300 focus:ring-[#0095ff]"
                      />
                      <div>
                        <span className="font-semibold text-slate-800 block">
                          Wajib Reset Login oleh Proktor saat Pelanggaran Keluar Sistem
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Jika siswa berpindah aplikasi / tab browser / keluar fullscreen, status peserta terkunci dan harus disetujui di menu Request Reset Login.
                        </span>
                      </div>
                    </label>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Pesan Peringatan Pelanggaran untuk Peserta
                      </label>
                      <input
                        type="text"
                        value={appConfig.pesanPelanggaran}
                        onChange={(e) =>
                          setAppConfig({
                            ...appConfig,
                            pesanPelanggaran: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[#0095ff] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Bagian 7: Status Penyimpanan & Server */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    7. Status Server & Penyimpanan Cloud
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <span className="text-[11px] text-slate-500 block">Storage Engine</span>
                      <span className="font-bold text-slate-800 uppercase font-mono">
                        {storageEngine}
                      </span>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <span className="text-[11px] text-slate-500 block">Sinkronisasi Terakhir</span>
                      <span className="font-semibold text-emerald-700">
                        {lastSyncedLabel}
                      </span>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <span className="text-[11px] text-slate-500 block">Sistem Operasi / Target</span>
                      <span className="font-semibold text-slate-700">
                        Vercel Cloud Deployment
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#001a6e] hover:bg-[#00155a] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Simpan Pengaturan
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* Pop Up Konfirmasi Keluar Administrator */}
      {showLogoutConfirmModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-logout-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLogoutConfirmModal(false);
            }
          }}
        >
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all">
            {/* Modal Header Bar */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="admin-logout-modal-title"
                  className="text-sm font-bold text-slate-800"
                >
                  Konfirmasi Keluar Administrator
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Sesi Ujian Sumatif Akhir Semester (SAS)
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin keluar dari halaman{' '}
                <strong>Administrator CBT</strong>? Semua perubahan yang telah
                disimpan akan tetap tersimpan di sistem.
              </p>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                <span className="font-bold">Info:</span>
                <span>
                  Untuk masuk kembali, Anda perlu memasukkan kode & password Administrator.
                </span>
              </div>
            </div>

            {/* Modal Footer Buttons */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowLogoutConfirmModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirmModal(false);
                  onLogoutAdmin();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Ya, Keluar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
