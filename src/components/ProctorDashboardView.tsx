import React, { useState, useMemo } from 'react';
import {
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
  Download,
  FolderTree,
  Layers,
  GraduationCap,
  Upload,
  FileText,
  Eye,
} from 'lucide-react';
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
  getPkgClass,
  getTargetClassFromMapel,
  DEFAULT_MAPEL_LIST,
  STATUS_TES_CLASS_GROUPS,
  QuestionPreviewModal,
} from './AdminViews';
import { generateParticipantCardsPDF } from '../utils/pdfParticipantCard';
import {
  generateExamReportPDF,
  resolveResultClass,
} from '../utils/pdfExamReport';
import {
  parseWordQuestions,
  downloadWordQuestionTemplate,
} from '../utils/wordQuestionParser';

export interface ProctorParticipantRow {
  id: string;
  selected: boolean;
  status: 'Non Active' | 'Active';
  kodeTes: string;
  username: string;
  password?: string;
  namaPeserta: string;
  kelompok: string;
  kelas?: string;
  loginState:
    | 'Belum Login'
    | 'Sedang Mengerjakan'
    | 'Selesai'
    | 'Terkunci (Pelanggaran)';
  requestReset?: boolean;
  violationReason?: string;
  violationAt?: string;
  violationSchema?: number;
  violationTimestamp?: number;
  lastResetAt?: number;
}

export function normalizeKelasCode(raw?: string): string {
  if (!raw) return '';
  const s = raw
    .replace(/^kelas\s+/i, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (!s) return '';
  if (/^XII\b/.test(s)) {
    if (s.includes('IPS')) return 'XII IPS';
    if (s.includes('IPA') || s.includes('MIPA')) return 'XII IPA';
    return s;
  }
  if (/^XI\b/.test(s)) {
    if (s.includes('IPS')) return 'XI IPS';
    if (s.includes('IPA') || s.includes('MIPA')) return 'XI IPA';
    return s;
  }
  if (/^X\b/.test(s)) {
    return 'X';
  }
  return s;
}

export function doesKelasMatch(
  studentKelas?: string,
  scheduleKelas?: string
): boolean {
  const rawA = (studentKelas || '')
    .replace(/^kelas\s+/i, '')
    .trim()
    .toUpperCase();
  const rawB = (scheduleKelas || '')
    .replace(/^kelas\s+/i, '')
    .trim()
    .toUpperCase();
  if (!rawA || !rawB) return false;
  if (rawA === rawB) return true;
  const normA = normalizeKelasCode(studentKelas);
  const normB = normalizeKelasCode(scheduleKelas);
  return Boolean(normA && normB && normA === normB);
}

export function isParticipantLockedByViolation(
  p: ProctorParticipantRow
): boolean {
  const vTs = typeof p.violationTimestamp === 'number' ? p.violationTimestamp : 0;
  const resetTs = typeof p.lastResetAt === 'number' ? p.lastResetAt : 0;
  return (
    p.violationSchema === 3 &&
    vTs > 0 &&
    vTs > resetTs &&
    Boolean(p.requestReset || p.loginState === 'Terkunci (Pelanggaran)')
  );
}

const FALLBACK_KELAS_CYCLE = ['X', 'XI IPA', 'XI IPS', 'XII IPA', 'XII IPS'] as const;

const LEGACY_USERNAME_MAP: Record<string, string> = {
  TK0506010801547: 'SA20264821',
  TK1547: 'SA20264821',
  TK0506010801556: 'SA20267394',
  TK1556: 'SA20267394',
  TK0506010801565: 'SA20262918',
  TK1565: 'SA20262918',
  TK0506010801574: 'SA20268563',
  TK1574: 'SA20268563',
  TK0506010801583: 'SA20265147',
  TK1583: 'SA20265147',
  TK0506010801592: 'SA20269302',
  TK1592: 'SA20269302',
  P130100240: 'SA20266475',
  TK1601: 'SA20266475',
  K020500118: 'SA20261839',
  TK1610: 'SA20261839',
};

export function shortenStudentUsername(raw?: string): string {
  if (!raw) return '';
  const clean = raw.trim().toUpperCase();
  if (LEGACY_USERNAME_MAP[clean]) {
    return LEGACY_USERNAME_MAP[clean];
  }
  const longMatch = clean.match(/^TK(?:050601080)?(\d{4,})$/);
  if (longMatch) {
    return `SA2026${longMatch[1].slice(-4)}`;
  }
  return clean;
}

export function sanitizeParticipantRows(
  rows: ProctorParticipantRow[]
): ProctorParticipantRow[] {
  if (!Array.isArray(rows)) return [];
  const hasUploadedExcelRows = rows.some((r) =>
    String(r?.id || '').startsWith('excel_')
  );
  let changed = false;
  const filtered = hasUploadedExcelRows
    ? rows.filter((r) => {
        const u = String(r?.username || '').trim().toUpperCase();
        const isLegacyPreset =
          u === 'P130100240' ||
          u === 'K020500118' ||
          u === 'TK1601' ||
          u === 'TK1610' ||
          u === 'SA20266475' ||
          u === 'SA20261839';
        if (isLegacyPreset && (r.id === 'p7' || r.id === 'p8')) {
          changed = true;
          return false;
        }
        return true;
      })
    : rows;

  const next = filtered.map((row, idx) => {
    const validLock = isParticipantLockedByViolation(row);
    const resolvedKelas =
      row.kelas && row.kelas.trim()
        ? row.kelas.trim()
        : FALLBACK_KELAS_CYCLE[idx % FALLBACK_KELAS_CYCLE.length];
    const resolvedKodeTes =
      !row.kodeTes || row.kodeTes === 'GLDTKA25MAH2'
        ? 'SAS26SMADIP1'
        : row.kodeTes;
    const resolvedUsername = shortenStudentUsername(row.username);
    const needsKelasFill = row.kelas !== resolvedKelas;
    const needsKodeTesFix = row.kodeTes !== resolvedKodeTes;
    const needsUsernameFix = row.username !== resolvedUsername;
    const needsUnlock =
      !validLock &&
      (row.requestReset || row.loginState === 'Terkunci (Pelanggaran)');

    if (needsUnlock || needsKelasFill || needsKodeTesFix || needsUsernameFix) {
      changed = true;
      return {
        ...row,
        username: resolvedUsername,
        kodeTes: resolvedKodeTes,
        kelas: resolvedKelas,
        loginState:
          needsUnlock && row.loginState === 'Terkunci (Pelanggaran)'
            ? ('Belum Login' as const)
            : row.loginState,
        requestReset: needsUnlock ? false : row.requestReset,
        violationReason: needsUnlock ? undefined : row.violationReason,
        violationAt: needsUnlock ? undefined : row.violationAt,
        violationSchema: needsUnlock ? undefined : row.violationSchema,
        violationTimestamp: needsUnlock ? undefined : row.violationTimestamp,
      };
    }
    return row;
  });
  return changed ? next : rows;
}

const INITIAL_PARTICIPANT_ROWS: ProctorParticipantRow[] = [
  {
    id: 'p1',
    selected: true,
    status: 'Non Active',
    kodeTes: 'SAS26SMADIP1',
    username: 'SA20264821',
    namaPeserta: 'ANDRIAN FAJARICO PRASETYA',
    kelompok: '1',
    kelas: 'X',
    loginState: 'Belum Login',
    requestReset: false,
  },
  {
    id: 'p2',
    selected: true,
    status: 'Non Active',
    kodeTes: 'SAS26SMADIP1',
    username: 'SA20267394',
    namaPeserta: 'AHMAD RIZKI NOVANSYAH',
    kelompok: '1',
    kelas: 'XI IPA',
    loginState: 'Belum Login',
    requestReset: false,
  },
  {
    id: 'p3',
    selected: true,
    status: 'Non Active',
    kodeTes: 'SAS26SMADIP1',
    username: 'SA20262918',
    namaPeserta: 'ARYA RESTU KUSUMA',
    kelompok: '1',
    kelas: 'XI IPS',
    loginState: 'Belum Login',
    requestReset: false,
  },
  {
    id: 'p4',
    selected: true,
    status: 'Non Active',
    kodeTes: 'SAS26SMADIP1',
    username: 'SA20268563',
    namaPeserta: 'AUREL RIZKY ADI PRATAMA',
    kelompok: '1',
    kelas: 'XII IPA',
    loginState: 'Belum Login',
    requestReset: false,
  },
  {
    id: 'p5',
    selected: true,
    status: 'Non Active',
    kodeTes: 'SAS26SMADIP1',
    username: 'SA20265147',
    namaPeserta: 'AHMAD DENY FIKRUDIN',
    kelompok: '1',
    kelas: 'XII IPS',
    loginState: 'Belum Login',
    requestReset: false,
  },
  {
    id: 'p6',
    selected: true,
    status: 'Non Active',
    kodeTes: 'SAS26SMADIP1',
    username: 'SA20269302',
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
    kodeTes: 'SAS26SMADIP1',
    username: 'SA20266475',
    namaPeserta: 'NADIA PUTRI PRATAMA',
    kelompok: '1',
    kelas: 'XI IPA',
    loginState: 'Belum Login',
    requestReset: false,
  },
  {
    id: 'p8',
    selected: false,
    status: 'Active',
    kodeTes: 'SAS26SMADIP1',
    username: 'SA20261839',
    namaPeserta: 'BAGAS ADITYA NUGRAHA',
    kelompok: '2',
    kelas: 'XII IPA',
    loginState: 'Belum Login',
    requestReset: false,
  },
];

type SidebarMenuId =
  | 'beranda'
  | 'status_peserta'
  | 'daftar_peserta'
  | 'status_tes'
  | 'request_reset'
  | 'daftar_login'
  | 'kelompok_tes'
  | 'laporan_pengolahan';

interface ProctorDashboardViewProps {
  proctorName: string;
  encryptionCode: string;
  activeToken: string;
  tokenSecondsLeft: number;
  onUpdateToken: (newToken: string) => void;
  isScheduleActive: boolean;
  activeSchedules: AdminScheduleItem[];
  participants?: ProctorParticipantRow[];
  onUpdateParticipants?: React.Dispatch<
    React.SetStateAction<ProctorParticipantRow[]>
  >;
  packages: ExamPackage[];
  onUpdatePackages: (
    updater:
      | ExamPackage[]
      | ((prevPackages: ExamPackage[]) => ExamPackage[])
  ) => void;
  onResetDefaultPackages: () => void;
  resultsHistory: ExamResultSummary[];
  onClearHistory: () => void;
  onLogoutProctor: () => void;
}

export const ProctorDashboardView: React.FC<ProctorDashboardViewProps> = ({
  proctorName,
  encryptionCode,
  activeToken,
  tokenSecondsLeft,
  isScheduleActive,
  activeSchedules,
  participants: externalParticipants,
  onUpdateParticipants,
  packages,
  onUpdatePackages,
  onResetDefaultPackages,
  resultsHistory,
  onClearHistory,
  onLogoutProctor,
}) => {
  // Default active tab is 'kelompok_tes' to match the reference screenshot immediately
  const [activeMenu, setActiveMenu] = useState<SidebarMenuId>('kelompok_tes');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [localParticipants, setLocalParticipants] = useState<
    ProctorParticipantRow[]
  >(INITIAL_PARTICIPANT_ROWS);
  const rawParticipants = externalParticipants ?? localParticipants;
  const participants = useMemo(
    () => sanitizeParticipantRows(rawParticipants),
    [rawParticipants]
  );
  const setParticipants = onUpdateParticipants ?? setLocalParticipants;

  // Filter states for Kelompok Tes (matching 1, 2, 3, 4 in screenshot)
  const [filterStatus, setFilterStatus] = useState<string>('Non Aktif');
  const [filterKodeTes, setFilterKodeTes] = useState<string>('SAS26SMADIP1');
  const [filterKelompok, setFilterKelompok] = useState<string>('1');

  // Applied filters when clicking "Apply"
  const [appliedStatus, setAppliedStatus] = useState<string>('Non Aktif');
  const [appliedKodeTes, setAppliedKodeTes] = useState<string>('SAS26SMADIP1');
  const [appliedKelompok, setAppliedKelompok] = useState<string>('1');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string>('');
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState<boolean>(false);

  // Bank Soal & Status Tes state
  const [selectedPkgId, setSelectedPkgId] = useState(packages[0]?.id || '');
  const [statusTesKelas, setStatusTesKelas] = useState('Semua Kelas');
  const [statusTesTipeSoal, setStatusTesTipeSoal] = useState('Semua Tipe Soal');
  const [showQuestionPreviewModal, setShowQuestionPreviewModal] = useState(false);
  const [previewQuestionIdx, setPreviewQuestionIdx] = useState(0);
  const tokenMinutes = String(Math.floor(tokenSecondsLeft / 60)).padStart(2, '0');
  const tokenSeconds = String(tokenSecondsLeft % 60).padStart(2, '0');
  const tokenCountdownLabel = `${tokenMinutes}:${tokenSeconds}`;
  const tokenProgressPct = Math.max(
    0,
    Math.min(100, (tokenSecondsLeft / 300) * 100)
  );
  const [newQuestionType, setNewQuestionType] = useState<QuestionType>('pilihan_ganda');
  const [newCategory, setNewCategory] = useState('Literasi & Penalaran Umum');
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
  const [newExplanation, setNewExplanation] = useState('');

  const showNotice = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2600);
  };

  // Filtered rows for Kelompok Tes table
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
    showNotice('Filter Kelompok Tes berhasil diterapkan.');
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
      showNotice('Pilih minimal satu peserta terlebih dahulu.');
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
    // Switch filter view to Semua Status or Aktif so user sees the updated status
    setFilterStatus('Semua Status');
    setAppliedStatus('Semua Status');
    showNotice(`${selectedCount} peserta berhasil di-Assign (Status: Active).`);
  };

  const handleUnassignSelected = () => {
    const selectedCount = filteredRows.filter((r) => r.selected).length;
    if (selectedCount === 0) {
      showNotice('Pilih minimal satu peserta terlebih dahulu.');
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
    showNotice(
      `${selectedCount} peserta berhasil di-Unassign (Status: Non Active).`
    );
  };

  const handleResetFiltersAndSelection = () => {
    setFilterStatus('Non Aktif');
    setFilterKodeTes('SAS26SMADIP1');
    setFilterKelompok('1');
    setAppliedStatus('Non Aktif');
    setAppliedKodeTes('SAS26SMADIP1');
    setAppliedKelompok('1');
    setSearchQuery('');
    setParticipants(INITIAL_PARTICIPANT_ROWS);
    showNotice('Data filter dan pilihan peserta telah di-reset.');
  };

  const handleResetParticipantLogin = (id: string, name: string, username?: string) => {
    const cleanUser = (username || '').trim().toUpperCase();
    const nowTs = Date.now();
    setParticipants((prev) =>
      prev.map((r) =>
        r.id === id || (cleanUser && r.username.trim().toUpperCase() === cleanUser)
          ? {
              ...r,
              loginState: 'Belum Login',
              requestReset: false,
              violationReason: undefined,
              violationAt: undefined,
              violationSchema: undefined,
              violationTimestamp: undefined,
              lastResetAt: nowTs,
            }
          : r
      )
    );
    showNotice(`Sesi login peserta ${name} berhasil di-reset. Siswa kini dapat login kembali.`);
  };

  const handleResetAllLockedParticipants = () => {
    const nowTs = Date.now();
    setParticipants((prev) =>
      prev.map((r) => ({
        ...r,
        loginState:
          r.loginState === 'Terkunci (Pelanggaran)' ? 'Belum Login' : r.loginState,
        requestReset: false,
        violationReason: undefined,
        violationAt: undefined,
        violationSchema: undefined,
        violationTimestamp: undefined,
        lastResetAt: nowTs,
      }))
    );
    showNotice('Seluruh permintaan Reset Login peserta telah dibersihkan.');
  };

  const displayPackages = useMemo(() => {
    let currentMapelList: any[] = [...DEFAULT_MAPEL_LIST];
    try {
      const saved = localStorage.getItem('cbt_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.mapelList)) {
          currentMapelList = parsed.mapelList.map((m: any) => ({
            ...m,
            tingkat: getTargetClassFromMapel(m),
          }));
        }
      }
    } catch {
      // fallback
    }

    const result: ExamPackage[] = [];
    const processedPkgIds = new Set<string>();

    currentMapelList.forEach((mapel: any) => {
      const cleanKode = (mapel.kode || '').trim().toUpperCase();
      const cleanNama = (mapel.nama || '')
        .replace(/^Simulasi TKA\s*-\s*/i, '')
        .trim()
        .toLowerCase();
      const newPkgId = 'mapel_pkg_' + cleanKode.toLowerCase().replace(/[^a-z0-9]/g, '_');

      const existing = packages.find((p) => {
        if (processedPkgIds.has(p.id)) return false;
        if (p.id === newPkgId) return true;
        const pCode = (p.code || '').trim().toUpperCase();
        const pTitle = (p.title || '')
          .replace(/^Simulasi TKA\s*-\s*/i, '')
          .trim()
          .toLowerCase();
        return (
          (cleanKode.length > 0 &&
            (pCode === cleanKode ||
              pCode.startsWith(cleanKode + '-') ||
              cleanKode.startsWith(pCode + '-'))) ||
          (cleanNama.length > 0 && pTitle === cleanNama)
        );
      });

      const targetClass = getTargetClassFromMapel(mapel);

      if (existing && !processedPkgIds.has(existing.id)) {
        processedPkgIds.add(existing.id);
        const cleanedQuestions = Array.isArray(existing.questions)
          ? existing.questions.filter(
              (q) => !String(q?.id || '').startsWith('q_default_')
            )
          : [];
        result.push({
          ...existing,
          code: mapel.kode || existing.code,
          title: mapel.nama || existing.title,
          durationMinutes: mapel.alokasiMenit || existing.durationMinutes,
          subtest: mapel.kategori || existing.subtest,
          targetClass: targetClass,
          questions: cleanedQuestions,
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
          questions: [],
        });
      }
    });

    packages.forEach((pkg) => {
      if (!processedPkgIds.has(pkg.id)) {
        processedPkgIds.add(pkg.id);
        const cleanedQuestions = Array.isArray(pkg.questions)
          ? pkg.questions.filter(
              (q) => !String(q?.id || '').startsWith('q_default_')
            )
          : [];
        result.push({
          ...pkg,
          questions: cleanedQuestions,
        });
      }
    });

    return result;
  }, [packages]);

  const visiblePackagesForKelas = useMemo(() => {
    if (statusTesKelas === 'Semua Kelas') return displayPackages;
    const filtered = displayPackages.filter(
      (p) => getPkgClass(p) === statusTesKelas
    );
    return filtered.length > 0 ? filtered : displayPackages;
  }, [displayPackages, statusTesKelas]);

  const selectedPackage =
    visiblePackagesForKelas.find((p) => p.id === selectedPkgId) ||
    displayPackages.find((p) => p.id === selectedPkgId) ||
    visiblePackagesForKelas[0] ||
    displayPackages[0];

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
    const cleanSelectedNama = (selectedPackage.title || '')
      .replace(/^Simulasi TKA\s*-\s*/i, '')
      .trim()
      .toLowerCase();

    onUpdatePackages((prevPackages) => {
      const baseList = Array.isArray(prevPackages) ? prevPackages : packages;
      let matched = false;
      const nextList: ExamPackage[] = [];

      baseList.forEach((pkg) => {
        const pCode = (pkg.code || '').trim().toUpperCase();
        const pTitle = (pkg.title || '')
          .replace(/^Simulasi TKA\s*-\s*/i, '')
          .trim()
          .toLowerCase();
        const isMatch =
          pkg.id === selectedPackage.id ||
          (cleanSelectedKode.length > 0 &&
            (pCode === cleanSelectedKode ||
              pCode.startsWith(cleanSelectedKode + '-') ||
              cleanSelectedKode.startsWith(pCode + '-'))) ||
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
        id: `custom_${Date.now()}`,
        number: nextNumber,
        type: 'pilihan_ganda',
        category: newCategory.trim() || 'Penalaran Umum',
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
        explanation:
          newExplanation.trim() || `Kunci jawaban yang benar adalah ${correctOpt}.`,
      };
    } else if (newQuestionType === 'pilihan_ganda_kompleks') {
      const finalCorrectIds =
        complexCorrectOpts.length > 0 ? complexCorrectOpts : ['A'];
      newQuestion = {
        id: `custom_${Date.now()}`,
        number: nextNumber,
        type: 'pilihan_ganda_kompleks',
        category: newCategory.trim() || 'Penalaran Umum',
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
        explanation:
          newExplanation.trim() || `Kunci jawaban yang benar adalah opsi: ${finalCorrectIds.join(', ')}.`,
      };
    } else {
      // benar_salah
      newQuestion = {
        id: `custom_${Date.now()}`,
        number: nextNumber,
        type: 'benar_salah',
        category: newCategory.trim() || 'Penalaran Umum',
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
        explanation: newExplanation.trim() || 'Kunci jawaban ditentukan berdasarkan kesesuaian pernyataan dengan teks.',
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
    setNewExplanation('');
    showNotice(`Soal (${getQuestionTypeLabel(newQuestionType)}) No. ${nextNumber} berhasil ditambahkan ke bank soal.`);
  };

  const wordQuestionInputRef = React.useRef<HTMLInputElement | null>(null);

  const ensureFullscreenMode = () => {
    try {
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
        msFullscreenElement?: Element | null;
      };
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
      };
      if (!doc.fullscreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        }
      }
    } catch {
      // Ignore
    }
  };

  const triggerUploadWordFile = () => {
    ensureFullscreenMode();

    // Ketika jendela file eksplorer ditutup (baik via Open/OK maupun Cancel), kembalikan fullscreen saat window kembali fokus
    const handleReturnFocus = () => {
      window.removeEventListener('focus', handleReturnFocus);
      setTimeout(() => {
        ensureFullscreenMode();
      }, 100);
      setTimeout(() => {
        ensureFullscreenMode();
      }, 500);
    };
    window.addEventListener('focus', handleReturnFocus, { once: true });

    if (wordQuestionInputRef.current) {
      wordQuestionInputRef.current.value = '';
      if (typeof wordQuestionInputRef.current.showPicker === 'function') {
        try {
          wordQuestionInputRef.current.showPicker();
          return;
        } catch {
          // Fallback to click()
        }
      }
      wordQuestionInputRef.current.click();
    }
  };

  const handleUploadWordQuestions = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    // Pastikan fullscreen kembali aktif seketika setelah pengguna memilih file dan klik Open/OK
    ensureFullscreenMode();
    setTimeout(() => {
      ensureFullscreenMode();
    }, 150);
    setTimeout(() => {
      ensureFullscreenMode();
    }, 450);

    const file = e.target.files?.[0];
    if (!file || !selectedPackage) return;

    try {
      const existingRealQuestions = selectedPackage.questions.filter(
        (q) => !q.id.startsWith('q_default_') && !q.id.startsWith('word_q_')
      );
      const startNum = existingRealQuestions.length + 1;
      const defaultCat =
        selectedPackage.subtest || newCategory.trim() || 'Penalaran Umum';
      const {
        questions: importedQuestions,
        redDetectedCount,
        tableCount,
        typeBreakdown,
      } = await parseWordQuestions(file, newQuestionType, startNum, defaultCat);

      if (importedQuestions.length === 0) {
        showNotice(
          'Tidak ditemukan butir soal yang valid pada file yang diunggah. Pastikan file berisi daftar pertanyaan atau tabel soal.'
        );
        return;
      }

      const combinedQuestions = [
        ...existingRealQuestions,
        ...importedQuestions,
      ];

      syncSelectedPackageQuestions(combinedQuestions);
      setLastUploadedWordFile(file.name);
      setStatusTesTipeSoal('Semua Tipe Soal');

      const detectedTypes = Object.keys(typeBreakdown) as QuestionType[];
      if (detectedTypes.length === 1) {
        setNewQuestionType(detectedTypes[0]);
      }

      setNewQuestionText('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
      setOptE('');

      const breakdownSummary = detectedTypes
        .map((t) => `${typeBreakdown[t]} ${getQuestionTypeLabel(t)}`)
        .join(', ');
      const tableInfo =
        tableCount > 0 ? `, termasuk ${tableCount} tabel soal` : '';
      showNotice(
        `Berhasil mengunggah "${file.name}": ${importedQuestions.length} soal dikenali otomatis (${breakdownSummary}; ${redDetectedCount} kunci jawaban${tableInfo}).`
      );
    } catch {
      showNotice(
        'Gagal membaca file soal. Pastikan file berformat .docx, .doc, .xlsx, .xls, .csv, .txt, .rtf, atau .json yang valid.'
      );
    } finally {
      if (wordQuestionInputRef.current) {
        wordQuestionInputRef.current.value = '';
      }
      ensureFullscreenMode();
      setTimeout(() => {
        ensureFullscreenMode();
      }, 200);
    }
  };

  const handleDeleteQuestion = (
    _pkgId: string,
    qId: string,
    qNumber?: number,
    targetQuestion?: Question
  ) => {
    if (!selectedPackage) return;
    let deletedOne = false;
    const filtered = selectedPackage.questions.filter((item) => {
      if (deletedOne) return true;
      if (targetQuestion && item === targetQuestion) {
        deletedOne = true;
        return false;
      }
      if (qId && item.id === qId) {
        deletedOne = true;
        return false;
      }
      if (qNumber !== undefined && item.number === qNumber) {
        deletedOne = true;
        return false;
      }
      return true;
    });
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

  const SIDEBAR_MENUS: {
    id: SidebarMenuId;
    label: string;
    breadcrumb: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'beranda', label: 'Beranda', breadcrumb: 'Dashboard Beranda', icon: Home },
    { id: 'status_peserta', label: 'Status Peserta', breadcrumb: 'List Status Peserta', icon: ClipboardList },
    { id: 'daftar_peserta', label: 'Daftar Peserta', breadcrumb: 'Data Daftar Peserta', icon: User },
    { id: 'status_tes', label: 'Status Tes', breadcrumb: 'Manajemen Bank Soal', icon: ClipboardCheck },
    { id: 'request_reset', label: 'Request Reset Login', breadcrumb: 'Permintaan Reset Peserta', icon: RotateCcw },
    { id: 'daftar_login', label: 'Daftar Login', breadcrumb: 'Log Sesi Peserta Aktif', icon: UserCheck },
    { id: 'kelompok_tes', label: 'Kelompok Tes', breadcrumb: 'List Kelompok Test', icon: Users },
    { id: 'laporan_pengolahan', label: 'Laporan Pengolahan', breadcrumb: 'Rekapitulasi Hasil & Nilai', icon: FileCheck2 },
  ];

  const currentMenuMeta =
    SIDEBAR_MENUS.find((m) => m.id === activeMenu) || SIDEBAR_MENUS[6];

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
              <span className="text-[14px] font-extrabold tracking-wide text-white whitespace-nowrap truncate">
                PROKTOR SAS
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

        {/* Bottom Logout Proctor Button */}
        <div className="relative z-10 shrink-0 p-4 border-t border-white/10 bg-[#00155a]/90">
          <button
            type="button"
            onClick={() => setShowLogoutConfirmModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#020c36] hover:bg-rose-600 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Keluar Proktor</span>}
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top White Header Bar matching screenshot */}
        <header className="shrink-0 bg-white px-7 py-3.5 flex items-center justify-between gap-4 border-b border-slate-200/80">
          <div>
            <h1 className="text-sm sm:text-[15px] font-bold tracking-wide text-slate-700 uppercase">
              SUMATIF AKHIR SEMESTER
            </h1>
            <p className="text-[11px] font-semibold text-blue-600">
              CBT SMA ISLAM DIPONEGORO WAGIR · APLIKASI SUMATIF AKHIR SEMESTER
            </p>
          </div>

          <div className="flex items-center gap-4">
            {(() => {
              const proctorDirectory = [
                {
                  proctorId: 'K05060108-KB6K',
                  fullName: 'DRS. H. AHMAD FAUZI, M.PD.',
                  encryptionCode: 'GLDTKASMA',
                },
                {
                  proctorId: 'K05060108-KB7L',
                  fullName: 'SITI NURHALIZA, S.KOM.',
                  encryptionCode: 'ENC-8842-WGR',
                },
                {
                  proctorId: 'K05060108-KB8M',
                  fullName: 'MOCHAMAD RIZALDI, S.PD.',
                  encryptionCode: 'ENC-9910-WGR',
                },
              ];
              const cleanInput = (proctorName || '').trim().toUpperCase();
              const cleanEnc = (encryptionCode || '').trim().toUpperCase();
              const matched =
                proctorDirectory.find(
                  (p) =>
                    p.proctorId.toUpperCase() === cleanInput ||
                    p.fullName.toUpperCase() === cleanInput
                ) ||
                proctorDirectory.find(
                  (p) => p.encryptionCode.toUpperCase() === cleanEnc
                );

              const displayFullName = matched
                ? matched.fullName
                : cleanInput && !cleanInput.startsWith('K05060108')
                  ? proctorName
                  : 'DRS. H. AHMAD FAUZI, M.PD.';
              const displayProctorId = matched
                ? matched.proctorId
                : cleanInput.startsWith('K05060108')
                  ? cleanInput
                  : 'K05060108-KB6K';

              return (
                <div className="flex items-center gap-3 text-right">
                  <div className="leading-tight">
                    <div className="text-xs font-bold text-slate-800">
                      {displayFullName}
                    </div>
                    <div className="text-[11px] font-mono font-semibold text-slate-500">
                      {displayProctorId}
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-[#0095ff] text-white font-bold text-sm flex items-center justify-center shadow-xs">
                    {displayFullName.charAt(0).toUpperCase()}
                  </div>
                </div>
              );
            })()}

            <button
              type="button"
              onClick={() => setShowLogoutConfirmModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Keluar dari sesi Proktor"
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
            <span className="text-slate-500">Token Rilis Aktif:</span>
            {isScheduleActive ? (
              <>
                <span className="font-mono font-black text-red-600 underline decoration-2 underline-offset-2 bg-red-50 px-2.5 py-0.5 rounded border border-red-200">
                  {activeToken}
                </span>
                <span className="font-mono text-[11px] font-semibold text-slate-500">
                  ({tokenCountdownLabel})
                </span>
              </>
            ) : (
              <span className="font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                BELUM KELUAR (Mapel Belum Diaktifkan Admin)
              </span>
            )}
          </div>
        </div>

        {/* WORKSPACE BODY */}
        <main className="flex-1 p-6 sm:p-7 overflow-y-auto space-y-6">
          {/* VIEW 1: KELOMPOK TES (Exact Match to Screenshot!) */}
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
                      <option value="SAS26SMADIP1">SAS26SMADIP1</option>
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
                  {/* Search Box */}
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
                      onClick={handleResetFiltersAndSelection}
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
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
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: BERANDA */}
          {activeMenu === 'beranda' && (
            <div className="space-y-6">
              {/* Kartu Token Ujian Aktif (Read-Only untuk Proktor, Tanpa Tombol Simpan/Rilis) */}
              <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <KeyRound className="w-4 h-4 text-[#0095ff]" />
                    <span>Kartu Token Ujian Aktif</span>
                  </div>
                  {isScheduleActive ? (
                    <div className="mt-2 flex flex-col items-start gap-3">
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
                    <div className="mt-2 flex flex-col items-start gap-3">
                      <div className="font-mono text-4xl sm:text-5xl font-black tracking-[0.2em] text-slate-400 underline decoration-slate-300 decoration-4 underline-offset-8 [text-shadow:0_0_1px_currentColor]">
                        BELUM KELUAR
                      </div>
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-400">
                        <span>Berganti otomatis dalam: --:--</span>
                      </div>
                      <p className="text-xs text-slate-400 font-medium">
                        Mata pelajaran pada menu <strong>Jadwal</strong> belum diaktifkan oleh Administrator. Token ujian belum keluar dan siswa belum dapat mengerjakan ujian.
                      </p>
                    </div>
                  )}
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
                    Peserta Status Active
                  </div>
                  <div className="mt-2 font-mono text-2xl font-extrabold text-emerald-600">
                    {participants.filter((p) => p.status === 'Active').length}{' '}
                    Peserta
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-xs font-semibold text-slate-500">
                    Token Ujian Saat Ini
                  </div>
                  {isScheduleActive ? (
                    <div className="mt-2 flex items-baseline justify-between gap-2">
                      <span className="font-mono text-2xl font-black tracking-widest text-red-600 underline decoration-red-600 decoration-2 underline-offset-4">
                        {activeToken}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-500">
                        {tokenCountdownLabel}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <span className="font-mono text-xl font-black tracking-wider text-slate-400 underline decoration-slate-300 decoration-2 underline-offset-4">
                        BELUM KELUAR
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-slate-800">
                  Informasi Server Proktor — CBT SMA Islam Diponegoro Wagir
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Selamat datang di Dashboard Proktor Aplikasi Sumatif Akhir Semester. Kartu <strong>Token Ujian Aktif</strong> kini berada di menu <strong>Beranda</strong> ini dan diperbarui otomatis setiap 5 menit dari server Administrator. Gunakan menu <strong>Kelompok Tes</strong> untuk mengaktifkan (Assign) peserta ujian, menu <strong>Status Tes</strong> untuk mengelola Bank Soal, dan menu <strong>Laporan Pengolahan</strong> untuk memantau nilai akhir peserta.
                </p>
              </div>
            </div>
          )}

          {/* VIEW 3: STATUS TES (Question Bank Management & Input Soal) */}
          {activeMenu === 'status_tes' && !selectedPackage && (
            <div className="bg-white p-8 rounded-xl border border-slate-200/80 shadow-2xs text-center space-y-2">
              <FolderTree className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">
                Belum Ada Mata Pelajaran Terdaftar
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Belum ada mata pelajaran yang didaftarkan oleh Administrator pada menu Pengaturan.
              </p>
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
                        Daftar mata pelajaran dikelompokkan berdasarkan masing-masing kelas (Kelas X, XI IPA, XI IPS, XII IPA, XII IPS).
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
                    {/* Input File Soal Tersembunyi (Mendukung Semua Format & Semua Tipe Soal) */}
                    <input
                      ref={wordQuestionInputRef}
                      type="file"
                      accept=".docx,.doc,.xlsx,.xls,.csv,.txt,.rtf,.json,.html,.htm"
                      onChange={handleUploadWordQuestions}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={triggerUploadWordFile}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-2xs transition-colors"
                      title="Upload file soal (.docx, .doc, .xlsx, .xls, .csv, .txt, .rtf, .json) — otomatis mengenali semua jenis/tipe soal"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Word / File Soal (Otomatis Kenali Tipe Soal)
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

                    {/* Dropdown Tipe Soal + Tombol Pratinjau Soal di bawahnya */}
                    <div className="flex flex-col items-start gap-1.5">
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
                          <option value="menjodohkan">Menjodohkan</option>
                          <option value="isian_singkat">Isian Singkat / Uraian</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewQuestionIdx(0);
                          setShowQuestionPreviewModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#001a6e] hover:bg-[#00124d] text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-2xs transition-colors"
                        title="Lihat tampilan pratinjau soal seperti pada layar ujian siswa"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Pratinjau Soal ({selectedPackage.questions.length})</span>
                      </button>
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
                      Kalimat Pertanyaan{' '}
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-600">
                            Kunci:
                          </span>
                          <select
                            value={correctOpt}
                            onChange={(e) => setCorrectOpt(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-[#0095ff]"
                          >
                            {['A', 'B', 'C', 'D', 'E'].map((k) => (
                              <option key={k} value={k}>
                                Opsi {k}
                              </option>
                            ))}
                          </select>
                        </div>
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
                        Manajemen Paket Tes & Bank Soal — {getPkgClass(selectedPackage)} ({
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

                    {/* Dropdown Tipe Soal (Semua Tipe Soal) + Tombol Pratinjau Soal di bawahnya */}
                    <div className="flex flex-col items-start gap-1.5 text-xs">
                      <div className="flex items-center gap-1.5">
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
                          <option value="menjodohkan">Menjodohkan</option>
                          <option value="isian_singkat">Isian Singkat / Uraian</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewQuestionIdx(0);
                          setShowQuestionPreviewModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-[#001a6e] text-[#001a6e] hover:text-white border border-blue-200 hover:border-[#001a6e] text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs"
                        title="Pratinjau butir soal pada mata pelajaran ini"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>
                          Pratinjau Soal (
                          {
                            selectedPackage.questions.filter((q) => {
                              if (statusTesTipeSoal === 'Semua Tipe Soal') return true;
                              return q.type === statusTesTipeSoal;
                            }).length
                          }
                          )
                        </span>
                      </button>
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

                {/* Question List */}
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
                  {selectedPackage.questions.filter((q) => {
                    if (statusTesTipeSoal === 'Semua Tipe Soal') return true;
                    return q.type === statusTesTipeSoal;
                  }).length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 italic">
                      Belum ada butir soal pada mata pelajaran ini. Silakan klik tombol <strong>Upload Word / File Soal</strong> atau tambahkan soal baru di atas.
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
                              Soal No. {q.number}
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
                            {q.statements && q.statements.length > 0 && (
                              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                                Kunci B/S: {q.statements.map((s) => s.correctValue).join(', ')}
                              </span>
                            )}
                            {q.premises && q.premises.length > 0 && (
                              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                                {q.premises.length} Pasangan Menjodohkan
                              </span>
                            )}
                            {q.correctShortAnswers && q.correctShortAnswers.length > 0 && (
                              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                                Kunci: {q.correctShortAnswers.join(' / ')}
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
                          onClick={() =>
                            handleDeleteQuestion(
                              selectedPackage.id,
                              q.id,
                              q.number,
                              q
                            )
                          }
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

          {/* VIEW 4: STATUS PESERTA / DAFTAR PESERTA / DAFTAR LOGIN / REQUEST RESET */}
          {(activeMenu === 'status_peserta' ||
            activeMenu === 'daftar_peserta' ||
            activeMenu === 'daftar_login' ||
            activeMenu === 'request_reset') && (
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
                        SMA Islam Diponegoro Wagir · Proktor Server: <strong>{proctorName}</strong> · Total Peserta: <strong>{participants.length} Siswa</strong>
                      </p>
                    </div>
                  </div>

                  {/* Tombol Unduh Kartu Peserta dengan Format PDF */}
                  <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        generateParticipantCardsPDF(
                          participants,
                          'Kartu_Peserta_SAS_2026_SMA_Islam_Diponegoro_Wagir.pdf',
                          'SMA ISLAM DIPONEGORO WAGIR',
                          'ROMEO GALISTRA, S.Pd.'
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

              <div className="bg-white rounded-xl shadow-xs border border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-800">
                      {currentMenuMeta.label} — Ruang Server SMA Islam Diponegoro Wagir
                    </h3>
                    {activeMenu === 'request_reset' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                        {
                          participants.filter((p) =>
                            isParticipantLockedByViolation(p)
                          ).length
                        }{' '}
                        Permintaan Reset
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {activeMenu === 'request_reset' &&
                      participants.some((p) =>
                        isParticipantLockedByViolation(p)
                      ) && (
                        <button
                          type="button"
                          onClick={handleResetAllLockedParticipants}
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
                        <th className="py-3.5 px-4">Nama Peserta</th>
                        <th className="py-3.5 px-4">Kode Tes</th>
                        <th className="py-3.5 px-4">Status Assign</th>
                        <th className="py-3.5 px-4">Status Sesi Login</th>
                        <th className="py-3.5 px-4 text-right">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const visibleParticipants = participants.filter((p) =>
                          activeMenu === 'request_reset'
                            ? isParticipantLockedByViolation(p)
                            : true
                        );

                        if (visibleParticipants.length === 0) {
                          return (
                            <tr>
                              <td
                                colSpan={6}
                                className="py-10 px-5 text-center text-slate-500"
                              >
                                {activeMenu === 'request_reset'
                                  ? 'Tidak ada pelanggaran atau permintaan Reset Login saat ini. Seluruh sesi peserta berjalan normal.'
                                  : 'Belum ada data peserta.'}
                              </td>
                            </tr>
                          );
                        }

                        return visibleParticipants.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-3.5 px-5 font-mono">{p.username}</td>
                            <td className="py-3.5 px-4 font-semibold text-slate-800">
                              {p.namaPeserta}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              {p.kodeTes}
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
                            <td className="py-3.5 px-4 font-medium text-slate-700">
                              {isParticipantLockedByViolation(p) ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-100 text-rose-700 font-bold text-[11px]">
                                    Terkunci (Pelanggaran Keluar CBT)
                                  </span>
                                  {p.violationReason && (
                                    <div className="text-[11px] text-rose-600">
                                      {p.violationReason}
                                      {p.violationAt ? ` (${p.violationAt})` : ''}
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
                                onClick={() =>
                                  handleResetParticipantLogin(
                                    p.id,
                                    p.namaPeserta,
                                    p.username
                                  )
                                }
                                className="px-3 py-1.5 rounded-lg bg-[#f04452] hover:bg-[#d93240] text-white text-[11px] font-semibold cursor-pointer"
                              >
                                Reset Login
                              </button>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 5: LAPORAN PENGOLAHAN (Rekap Nilai Hasil Ujian) */}
          {activeMenu === 'laporan_pengolahan' && (
            <div className="space-y-6">
              {/* Header Kop & Tombol Unduh Semua Kelas */}
              <div className="bg-white rounded-xl p-6 shadow-xs border border-slate-200 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-blue-50 text-[#001a6e] border border-blue-200 mb-1.5">
                      Dokumen Resmi PDF Setiap Kelas
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900">
                      LAPORAN NILAI HASIL UJIAN — SMA ISLAM DIPONEGORO WAGIR
                    </h3>
                    <p className="text-xs font-semibold text-slate-600 mt-0.5">
                      TAHUN AJARAN 2026/2027 • SEMESTER 1
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        generateExamReportPDF(
                          'ALL',
                          resultsHistory,
                          participants
                        )
                      }
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#001a6e] hover:bg-[#00124d] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Unduh Laporan Semua Kelas (PDF)</span>
                    </button>
                    {resultsHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={onClearHistory}
                        className="px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 transition-colors cursor-pointer"
                      >
                        Bersihkan Riwayat
                      </button>
                    )}
                  </div>
                </div>

                {/* Daftar Kartu Unduh Cepat Setiap Kelas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {STATUS_TES_CLASS_GROUPS.map((cls) => {
                    const classResults = resultsHistory.filter((r) =>
                      doesKelasMatch(
                        resolveResultClass(r, participants),
                        cls
                      )
                    );
                    const classStudents = participants.filter((p) =>
                      doesKelasMatch(p.kelas, cls)
                    );
                    return (
                      <div
                        key={cls}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-slate-900">
                              Kelas {cls}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                              {classResults.length} Nilai
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Terdaftar: {classStudents.length} Peserta
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            generateExamReportPDF(
                              cls,
                              resultsHistory,
                              participants
                            )
                          }
                          className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#0066ff] hover:bg-[#0052cc] text-white text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 shrink-0" />
                          <span>Unduh Laporan Hasil Ujian</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tabel Laporan Nilai Hasil Ujian Per Kelas */}
              {STATUS_TES_CLASS_GROUPS.map((cls) => {
                const classResults = resultsHistory.filter((r) =>
                  doesKelasMatch(resolveResultClass(r, participants), cls)
                );
                const classStudents = participants.filter((p) =>
                  doesKelasMatch(p.kelas, cls)
                );

                return (
                  <div
                    key={cls}
                    className="bg-white rounded-xl p-6 shadow-xs border border-slate-200 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">
                          Laporan Pengolahan Nilai — Kelas {cls}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {classResults.length} hasil ujian selesai dari{' '}
                          {classStudents.length} peserta terdaftar di Kelas{' '}
                          {cls}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          generateExamReportPDF(
                            cls,
                            resultsHistory,
                            participants
                          )
                        }
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
                      >
                        <Download className="w-4 h-4" />
                        <span>
                          Unduh Laporan Hasil Ujian Kelas {cls} (PDF)
                        </span>
                      </button>
                    </div>

                    {classResults.length === 0 ? (
                      <div className="py-8 text-center rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
                        Belum ada peserta Kelas {cls} yang menyelesaikan ujian.
                        Klik tombol{' '}
                        <strong className="text-slate-700">
                          Unduh Laporan Hasil Ujian Kelas {cls} (PDF)
                        </strong>{' '}
                        di atas untuk mengunduh rekap daftar peserta Kelas {cls}.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                              <th className="py-3 px-4 w-12">No</th>
                              <th className="py-3 px-4">Username</th>
                              <th className="py-3 px-4">Nama Peserta</th>
                              <th className="py-3 px-4">Kelas</th>
                              <th className="py-3 px-4">Mata Ujian</th>
                              <th className="py-3 px-4">Jawaban Benar</th>
                              <th className="py-3 px-4">Nilai Akhir</th>
                              <th className="py-3 px-4">Waktu Selesai</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {classResults.map((r, idx) => (
                              <tr key={r.id} className="hover:bg-slate-50/80">
                                <td className="py-3 px-4 font-mono text-slate-500">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                                  {r.participant.username}
                                </td>
                                <td className="py-3 px-4 font-semibold text-slate-800">
                                  {r.participant.fullName}
                                </td>
                                <td className="py-3 px-4 font-semibold text-slate-700">
                                  Kelas {cls}
                                </td>
                                <td className="py-3 px-4 text-slate-600">
                                  {r.packageTitle}
                                </td>
                                <td className="py-3 px-4 font-mono">
                                  {r.correctCount} / {r.totalQuestions}
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-[#0066ff]">
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
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Pop Up Konfirmasi Keluar Proktor */}
      {showLogoutConfirmModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="proctor-logout-modal-title"
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
                  id="proctor-logout-modal-title"
                  className="text-sm font-bold text-slate-800"
                >
                  Konfirmasi Keluar Proktor
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
                <strong>Proktor CBT</strong>? Anda dapat masuk kembali dengan akun
                dan kode enkripsi yang sama.
              </p>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                <span className="font-bold">Info:</span>
                <span>
                  Pastikan ujian yang sedang berlangsung tetap dipantau oleh pengawas/proktor pengganti bila diperlukan.
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
                  onLogoutProctor();
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

      {/* Modal Pratinjau Soal CBT */}
      {showQuestionPreviewModal && selectedPackage && (
        <QuestionPreviewModal
          pkg={selectedPackage}
          filterType={statusTesTipeSoal}
          initialIndex={previewQuestionIdx}
          onClose={() => setShowQuestionPreviewModal(false)}
          onDeleteQuestion={(q) =>
            handleDeleteQuestion(selectedPackage.id, q.id, q.number, q)
          }
        />
      )}
    </div>
  );
};
