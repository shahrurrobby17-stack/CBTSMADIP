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
} from 'lucide-react';
import { TutWuriLogo } from './PusmendikHeader';
import {
  AdminScheduleItem,
  ExamPackage,
  ExamResultSummary,
  Question,
} from '../types/cbt';
import { getQuestionTypeLabel } from '../data/cbtData';

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
  loginState: 'Belum Login' | 'Sedang Mengerjakan' | 'Selesai';
  requestReset?: boolean;
}

const INITIAL_PARTICIPANT_ROWS: ProctorParticipantRow[] = [
  {
    id: 'p1',
    selected: true,
    status: 'Non Active',
    kodeTes: 'GLDTKA25MAH2',
    username: 'TK0506010801547',
    namaPeserta: 'ANDRIAN FAJARICO PRASETYA',
    kelompok: '1',
    loginState: 'Belum Login',
  },
  {
    id: 'p2',
    selected: true,
    status: 'Non Active',
    kodeTes: 'GLDTKA25MAH2',
    username: 'TK0506010801556',
    namaPeserta: 'AHMAD RIZKI NOVANSYAH',
    kelompok: '1',
    loginState: 'Belum Login',
  },
  {
    id: 'p3',
    selected: true,
    status: 'Non Active',
    kodeTes: 'GLDTKA25MAH2',
    username: 'TK0506010801565',
    namaPeserta: 'ARYA RESTU KUSUMA',
    kelompok: '1',
    loginState: 'Sedang Mengerjakan',
    requestReset: true,
  },
  {
    id: 'p4',
    selected: true,
    status: 'Non Active',
    kodeTes: 'GLDTKA25MAH2',
    username: 'TK0506010801574',
    namaPeserta: 'AUREL RIZKY ADI PRATAMA',
    kelompok: '1',
    loginState: 'Belum Login',
  },
  {
    id: 'p5',
    selected: true,
    status: 'Non Active',
    kodeTes: 'GLDTKA25MAH2',
    username: 'TK0506010801583',
    namaPeserta: 'AHMAD DENY FIKRUDIN',
    kelompok: '1',
    loginState: 'Belum Login',
  },
  {
    id: 'p6',
    selected: true,
    status: 'Non Active',
    kodeTes: 'GLDTKA25MAH2',
    username: 'TK0506010801592',
    namaPeserta: 'ALDISA FRANDIKA LIAN PRATAMA',
    kelompok: '1',
    loginState: 'Belum Login',
  },
  {
    id: 'p7',
    selected: false,
    status: 'Active',
    kodeTes: 'GLDTKA25MAH2',
    username: 'P130100240',
    namaPeserta: 'NADIA PUTRI PRATAMA',
    kelompok: '1',
    loginState: 'Sedang Mengerjakan',
  },
  {
    id: 'p8',
    selected: false,
    status: 'Active',
    kodeTes: 'GLDTKA25MAH2',
    username: 'K020500118',
    namaPeserta: 'BAGAS ADITYA NUGRAHA',
    kelompok: '2',
    loginState: 'Selesai',
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
  packages: ExamPackage[];
  onUpdatePackages: (nextPackages: ExamPackage[]) => void;
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
  const [participants, setParticipants] = useState<ProctorParticipantRow[]>(
    INITIAL_PARTICIPANT_ROWS
  );

  // Filter states for Kelompok Tes (matching 1, 2, 3, 4 in screenshot)
  const [filterStatus, setFilterStatus] = useState<string>('Non Aktif');
  const [filterKodeTes, setFilterKodeTes] = useState<string>('GLDTKA25MAH2');
  const [filterKelompok, setFilterKelompok] = useState<string>('1');

  // Applied filters when clicking "Apply"
  const [appliedStatus, setAppliedStatus] = useState<string>('Non Aktif');
  const [appliedKodeTes, setAppliedKodeTes] = useState<string>('GLDTKA25MAH2');
  const [appliedKelompok, setAppliedKelompok] = useState<string>('1');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string>('');

  // Bank Soal & Status Tes state
  const [selectedPkgId, setSelectedPkgId] = useState(packages[0]?.id || '');
  const tokenMinutes = String(Math.floor(tokenSecondsLeft / 60)).padStart(2, '0');
  const tokenSeconds = String(tokenSecondsLeft % 60).padStart(2, '0');
  const tokenCountdownLabel = `${tokenMinutes}:${tokenSeconds}`;
  const tokenProgressPct = Math.max(
    0,
    Math.min(100, (tokenSecondsLeft / 300) * 100)
  );
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
    setFilterKodeTes('GLDTKA25MAH2');
    setFilterKelompok('1');
    setAppliedStatus('Non Aktif');
    setAppliedKodeTes('GLDTKA25MAH2');
    setAppliedKelompok('1');
    setSearchQuery('');
    setParticipants(INITIAL_PARTICIPANT_ROWS);
    showNotice('Data filter dan pilihan peserta telah di-reset.');
  };

  const handleResetParticipantLogin = (id: string, name: string) => {
    setParticipants((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, loginState: 'Belum Login', requestReset: false }
          : r
      )
    );
    showNotice(`Sesi login peserta ${name} berhasil di-reset.`);
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
      id: `custom_${Date.now()}`,
      number: nextNumber,
      type: 'pilihan_ganda',
      category: newCategory.trim() || 'Penalaran Umum',
      stimulusTitle: newStimulusTitle.trim() || 'Wacana Soal',
      stimulusText:
        newStimulusText.trim() ||
        'Perhatikan informasi berikut dengan saksama untuk menjawab pertanyaan.',
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
      explanation:
        newExplanation.trim() || `Kunci jawaban yang benar adalah ${correctOpt}.`,
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
    setNewExplanation('');
    showNotice(`Soal No. ${nextNumber} berhasil ditambahkan ke bank soal.`);
  };

  const handleDeleteQuestion = (pkgId: string, qId: string) => {
    const nextPackages = packages.map((pkg) => {
      if (pkg.id !== pkgId) return pkg;
      const filtered = pkg.questions
        .filter((q) => q.id !== qId)
        .map((q, idx) => ({ ...q, number: idx + 1 }));
      return { ...pkg, questions: filtered };
    });
    onUpdatePackages(nextPackages);
    showNotice('Butir soal berhasil dihapus.');
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

        {/* Bottom Logout Proctor Button */}
        <div className="relative z-10 shrink-0 p-4 border-t border-white/10 bg-[#00155a]/90">
          <button
            type="button"
            onClick={onLogoutProctor}
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
              ASSESMENT NASIONAL BERBASIS KOMPUTER
            </h1>
            <p className="text-[11px] font-semibold text-blue-600">
              CBT SMA ISLAM DIPONEGORO WAGIR · APLIKASI SUMATIF AKHIR SEMESTER
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-right">
              <div className="leading-tight">
                <div className="text-xs font-medium text-slate-500">
                  Hi, {proctorName || 'K05060108-KB6K'}
                </div>
                <div className="text-xs font-bold text-slate-700">
                  {encryptionCode || 'GLDTKASMA'}
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#0095ff] text-white font-bold text-sm flex items-center justify-center shadow-xs">
                {(proctorName || 'K').charAt(0).toUpperCase()}
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

          {/* VIEW 3: STATUS TES (Question Bank Management) */}
          {activeMenu === 'status_tes' && selectedPackage && (
            <div className="space-y-6">
              {/* Bank Soal Management Card */}
              <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#0095ff]" />
                    <h3 className="text-sm font-bold text-slate-800">
                      Manajemen Paket Tes & Bank Soal
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
                          {p.title} ({p.questions.length} Soal)
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

                {/* Question List */}
                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                  {selectedPackage.questions.map((q) => (
                    <div
                      key={q.id}
                      className="p-3.5 flex items-start justify-between gap-3 hover:bg-slate-50 text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-[#0095ff]">
                          Soal No. {q.number}
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
                          onClick={() =>
                            handleDeleteQuestion(selectedPackage.id, q.id)
                          }
                          className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Question Form */}
                <form
                  onSubmit={handleAddQuestion}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Plus className="w-4 h-4 text-[#0095ff]" />
                    <span>Tambah Butir Soal Pilihan Ganda Baru</span>
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
                      placeholder="Judul Wacana / Stimulus"
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={newStimulusText}
                    onChange={(e) => setNewStimulusText(e.target.value)}
                    placeholder="Isi Wacana / Bacaan Soal..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    required
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Kalimat Pertanyaan *"
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-600">
                        Kunci:
                      </span>
                      <select
                        value={correctOpt}
                        onChange={(e) => setCorrectOpt(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                      >
                        {['A', 'B', 'C', 'D', 'E'].map((k) => (
                          <option key={k} value={k}>
                            Opsi {k}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-[#0095ff] hover:bg-[#007acc] text-white text-xs font-semibold cursor-pointer"
                  >
                    Simpan Soal ke Paket
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* VIEW 4: STATUS PESERTA / DAFTAR PESERTA / DAFTAR LOGIN / REQUEST RESET */}
          {(activeMenu === 'status_peserta' ||
            activeMenu === 'daftar_peserta' ||
            activeMenu === 'daftar_login' ||
            activeMenu === 'request_reset') && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  {currentMenuMeta.label} — Ruang Server SMA Islam Diponegoro Wagir
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
                      <th className="py-3.5 px-4">Nama Peserta</th>
                      <th className="py-3.5 px-4">Kode Tes</th>
                      <th className="py-3.5 px-4">Status Assign</th>
                      <th className="py-3.5 px-4">Status Sesi Login</th>
                      <th className="py-3.5 px-4 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {participants
                      .filter((p) =>
                        activeMenu === 'request_reset' ? p.requestReset : true
                      )
                      .map((p) => (
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
                            {p.loginState}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                handleResetParticipantLogin(p.id, p.namaPeserta)
                              }
                              className="px-3 py-1.5 rounded-lg bg-[#f04452] hover:bg-[#d93240] text-white text-[11px] font-semibold cursor-pointer"
                            >
                              Reset Login
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 5: LAPORAN PENGOLAHAN (Rekap Nilai Hasil Ujian) */}
          {activeMenu === 'laporan_pengolahan' && (
            <div className="bg-white rounded-xl p-6 shadow-xs border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Laporan Pengolahan Nilai Sumatif Akhir Semester
                  </h3>
                  <p className="text-xs text-slate-500">
                    Rekapitulasi nilai peserta yang telah menyelesaikan ujian pada sesi ini.
                  </p>
                </div>
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
                  Belum ada data hasil ujian peserta yang masuk. Silakan kerjakan simulasi melalui halaman Login Peserta untuk melihat hasil pengolahan nilai.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                        <th className="py-3 px-4">Username</th>
                        <th className="py-3 px-4">Nama Peserta</th>
                        <th className="py-3 px-4">Mata Ujian</th>
                        <th className="py-3 px-4">Jawaban Benar</th>
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
                          <td className="py-3 px-4 text-slate-600">
                            {r.packageTitle}
                          </td>
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
