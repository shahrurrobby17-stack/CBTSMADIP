import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { AdminScheduleItem, ExamPackage } from '../types/cbt';
import {
  ProctorParticipantRow,
  doesKelasMatch,
} from './ProctorDashboardView';
import {
  AttendanceStatus,
  BeritaAcaraData,
  filterParticipantsByKelas,
  filterSingleClassParticipants,
  formatDisplayKelas,
  generateBeritaAcaraPDF,
  generateDaftarHadirPDF,
  generateGabunganBeritaAcaraPDF,
} from '../utils/pdfBeritaAcara';

interface BeritaAcaraViewProps {
  participants: ProctorParticipantRow[];
  packages: ExamPackage[];
  schedules?: AdminScheduleItem[];
  defaultProctorName?: string;
  defaultRoomName?: string;
  namaSekolah?: string;
  npsn?: string;
  namaKepalaSekolah?: string;
  namaUjian?: string;
  semester?: string;
  onShowNotice?: (msg: string) => void;
}

const ATTENDANCE_STATUS_OPTIONS: AttendanceStatus[] = [
  'Hadir',
  'Sakit',
  'Izin',
  'Tanpa Keterangan',
];

/**
 * Vector SVG Emblem of SMA Islam Diponegoro Wagir (Green Pentagon Shield)
 */
const SmadipGreenLogo: React.FC<{ className?: string }> = ({
  className = 'w-16 h-16',
}) => (
  <svg
    viewBox="0 0 120 120"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="smadipGreenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#92d050" />
        <stop offset="100%" stopColor="#68a23a" />
      </linearGradient>
    </defs>
    {/* Pentagon Shield */}
    <polygon
      points="60,6 112,39 96,105 24,105 8,39"
      fill="url(#smadipGreenGrad)"
      stroke="#385723"
      strokeWidth="3.5"
    />
    <polygon
      points="60,11 106,41 91,99 29,99 14,41"
      fill="none"
      stroke="#ffffff"
      strokeWidth="1.2"
    />
    {/* Top Arch Text Hint */}
    <path
      id="smadipArch"
      d="M 22,42 Q 60,18 98,42"
      fill="none"
      stroke="none"
    />
    <text
      fontSize="5.4"
      fontWeight="bold"
      fill="#1e293b"
      textAnchor="middle"
    >
      <textPath href="#smadipArch" startOffset="50%">
        SMA ISLAM DIPONEGORO WAGIR
      </textPath>
    </text>
    {/* Top Yellow Star */}
    <polygon
      points="60,24 62.5,30 69,30 63.8,34 65.8,40 60,36.2 54.2,40 56.2,34 51,30 57.5,30"
      fill="#ffd966"
      stroke="#b45309"
      strokeWidth="0.6"
    />
    {/* Globe & Lines */}
    <circle
      cx="60"
      cy="60"
      r="17"
      fill="none"
      stroke="#1e293b"
      strokeWidth="1.5"
    />
    <ellipse
      cx="60"
      cy="60"
      rx="9"
      ry="17"
      fill="none"
      stroke="#1e293b"
      strokeWidth="1"
    />
    <line
      x1="43"
      y1="60"
      x2="77"
      y2="60"
      stroke="#1e293b"
      strokeWidth="1"
    />
    {/* Red Flame Accent */}
    <polygon points="60,44 65,62 55,62" fill="#dc2626" />
    {/* Bottom White Scroll */}
    <rect
      x="26"
      y="83"
      width="68"
      height="11"
      rx="2"
      fill="#ffffff"
      stroke="#1e293b"
      strokeWidth="1.3"
    />
    <text
      x="60"
      y="90.5"
      fontSize="5.5"
      fontWeight="bold"
      fill="#0f172a"
      textAnchor="middle"
    >
      KABUPATEN MALANG
    </text>
  </svg>
);

export const BeritaAcaraView: React.FC<BeritaAcaraViewProps> = ({
  participants,
  packages,
  schedules = [],
  defaultProctorName = 'DRS. H. AHMAD FAUZI, M.PD.',
  namaSekolah = 'SMA ISLAM DIPONEGORO WAGIR',
  npsn = '20517834',
  namaKepalaSekolah = 'ROMEO GALISTRA, S.Pd.',
  namaUjian = 'SUMATIF AKHIR SEMESTER',
  semester = 'Genap 2025/2026',
  onShowNotice,
}) => {
  // Discover all distinct classes from Daftar Peserta + standard classes
  const availableClasses = useMemo(() => {
    const base = ['X', 'XI IPA', 'XI IPS', 'XII IPA', 'XII IPS'];
    const customSet = new Set<string>();
    participants.forEach((p) => {
      const raw = (p.kelas || '').replace(/^Kelas\s+/i, '').trim();
      if (raw) customSet.add(raw);
    });
    const merged = [...base];
    customSet.forEach((c) => {
      if (!merged.some((b) => b.toUpperCase() === c.toUpperCase())) {
        merged.push(c);
      }
    });
    return merged;
  }, [participants]);

  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach((s) => {
      if (s.mapel && s.mapel.trim()) set.add(s.mapel.trim());
    });
    packages.forEach((p) => {
      const cleanTitle = String(p.title || '')
        .replace(/^Simulasi TKA\s*-\s*/i, '')
        .trim();
      if (cleanTitle) set.add(cleanTitle);
    });
    return Array.from(set);
  }, [schedules, packages]);

  const now = useMemo(() => new Date(), []);
  const defaultHari = useMemo(() => {
    try {
      return now.toLocaleDateString('id-ID', { weekday: 'long' });
    } catch {
      return 'Senin';
    }
  }, [now]);
  const defaultTanggal = useMemo(() => String(now.getDate()), [now]);
  const defaultBulan = useMemo(() => {
    try {
      return now.toLocaleDateString('id-ID', { month: 'long' });
    } catch {
      return 'Desember';
    }
  }, [now]);

  // States for Berita Acara & Daftar Hadir fields matching the screenshot
  const [targetKelas, setTargetKelas] = useState<string>('X');
  const [targetKelas2, setTargetKelas2] = useState<string>('NONE');
  const [ruangUjian, setRuangUjian] = useState<string>('1 (SATU)');
  const [mataPelajaran, setMataPelajaran] = useState<string>(() => {
    const activeSch = schedules.find((s) => s.isActive);
    if (activeSch?.mapel) return activeSch.mapel;
    return subjectOptions[0] || '';
  });
  const [hari, setHari] = useState<string>(defaultHari);
  const [tanggal, setTanggal] = useState<string>(defaultTanggal);
  const [bulan, setBulan] = useState<string>(defaultBulan);
  const [tahunTerbilang, setTahunTerbilang] = useState<string>(
    'dua ribu dua puluh lima'
  );
  const [tahunAjaran, setTahunAjaran] = useState<string>('2025-2026');
  const [waktuMulai, setWaktuMulai] = useState<string>('07.30');
  const [waktuSelesai, setWaktuSelesai] = useState<string>('09.00');
  const [jumlahEksemplarSoal, setJumlahEksemplarSoal] = useState<string>('');
  const [namaPengawas1, setNamaPengawas1] = useState<string>(defaultProctorName);
  const [namaPengawas2, setNamaPengawas2] = useState<string>('');

  const [attendanceMap, setAttendanceMap] = useState<
    Record<string, AttendanceStatus>
  >(() => {
    try {
      const saved = localStorage.getItem('cbt_berita_acara_attendance');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  });

  useEffect(() => {
    if (defaultProctorName && defaultProctorName.trim()) {
      setNamaPengawas1(defaultProctorName.trim());
    }
  }, [defaultProctorName]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'cbt_berita_acara_attendance',
        JSON.stringify(attendanceMap)
      );
    } catch {
      // ignore
    }
  }, [attendanceMap]);

  // Students filtered from Daftar Peserta (participants) according to selected class(es)
  const filteredParticipants = useMemo(
    () =>
      filterParticipantsByKelas(participants, targetKelas, targetKelas2),
    [participants, targetKelas, targetKelas2]
  );

  // Class 1 & Class 2 breakdown for the "Jumlah Peserta" rows in Berita Acara
  const classSummary = useMemo(() => {
    if (targetKelas === 'ALL') {
      const groups = new Map<string, ProctorParticipantRow[]>();
      participants.forEach((p) => {
        const k = formatDisplayKelas(p.kelas) || 'X';
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(p);
      });
      const entries = Array.from(groups.entries());
      const k1Name = entries[0]?.[0] || '......';
      const k1Count =
        entries.length > 0 ? String(entries[0][1].length) : '........';
      const k2Name =
        entries.length > 1
          ? entries
              .slice(1)
              .map((e) => e[0])
              .join(', ')
          : '......';
      const k2Count =
        entries.length > 1
          ? String(entries.slice(1).reduce((acc, e) => acc + e[1].length, 0))
          : '........';
      const headerLabel =
        entries.length > 0
          ? entries.map((e) => e[0]).join(' dan ')
          : 'Semua Kelas';
      return {
        kelasHeaderLabel: headerLabel,
        kelas1Name: k1Name,
        kelas1Count: k1Count,
        kelas2Name: k2Name,
        kelas2Count: k2Count,
      };
    }

    const list1 = filterSingleClassParticipants(participants, targetKelas);
    const k1Name = formatDisplayKelas(targetKelas);
    const hasK2 =
      Boolean(targetKelas2) &&
      targetKelas2 !== 'NONE' &&
      !doesKelasMatch(targetKelas, targetKelas2);
    const list2 = hasK2
      ? filterSingleClassParticipants(participants, targetKelas2)
      : [];
    const k2Name = hasK2 ? formatDisplayKelas(targetKelas2) : '......';

    return {
      kelasHeaderLabel: hasK2 ? `${k1Name} dan ${k2Name}` : k1Name,
      kelas1Name: k1Name,
      kelas1Count: String(list1.length),
      kelas2Name: k2Name,
      kelas2Count: hasK2 ? String(list2.length) : '........',
    };
  }, [participants, targetKelas, targetKelas2]);

  const absentStudents = useMemo(
    () =>
      filteredParticipants.filter(
        (p) => (attendanceMap[p.id] || 'Hadir') !== 'Hadir'
      ),
    [filteredParticipants, attendanceMap]
  );

  // Build rows for Daftar Hadir table (minimum 24 rows, always even count so 2-row merged signature cells align)
  const totalDisplayRows = useMemo(() => {
    const raw = Math.max(filteredParticipants.length, 24);
    return raw % 2 === 0 ? raw : raw + 1;
  }, [filteredParticipants.length]);

  const handleSetAttendance = (
    participantId: string,
    status: AttendanceStatus
  ) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [participantId]: status,
    }));
  };

  const handleMarkAllPresent = () => {
    const next = { ...attendanceMap };
    filteredParticipants.forEach((p) => {
      next[p.id] = 'Hadir';
    });
    setAttendanceMap(next);
    onShowNotice?.('Seluruh peserta pada kelas terpilih ditandai Hadir.');
  };

  const buildPdfData = (): BeritaAcaraData => ({
    namaSekolah: namaSekolah || 'SMA ISLAM DIPONEGORO WAGIR',
    npsn: npsn || '20517834',
    nss: '302051824001',
    statusAkreditasi: 'STATUS : TERAKREDITASI "B"',
    alamatSekolah:
      'Jl. Raya Gondowangi 144 Wagir Malang Telp. 0341 8201427',
    namaKepalaSekolah,
    namaUjian,
    tahunAjaran,
    semester,
    hari,
    tanggal,
    bulan,
    tahunTerbilang,
    hariTanggal: `${hari}, ${tanggal} ${bulan}`,
    waktuMulai,
    waktuSelesai,
    waktuPelaksanaan: `${waktuMulai} - ${waktuSelesai}`,
    ruangUjian,
    sesiKelompok: 'Semua Sesi',
    targetKelas,
    targetKelas2,
    mataPelajaran,
    jumlahEksemplarSoal:
      jumlahEksemplarSoal.trim() || String(filteredParticipants.length || ''),
    namaProktor: namaPengawas1,
    namaPengawas: namaPengawas1,
    namaPengawas2,
    catatanUjian: '',
    participants,
    attendanceMap,
  });

  const handleDownloadGabungan = () => {
    generateGabunganBeritaAcaraPDF(buildPdfData());
    onShowNotice?.(
      'File PDF Berita Acara & Daftar Hadir (Format Gabungan) berhasil diunduh!'
    );
  };

  const handleDownloadBeritaAcara = () => {
    generateBeritaAcaraPDF(buildPdfData());
    onShowNotice?.('File PDF Berita Acara berhasil diunduh!');
  };

  const handleDownloadDaftarHadir = () => {
    generateDaftarHadirPDF(buildPdfData());
    onShowNotice?.('File PDF Daftar Hadir Siswa berhasil diunduh!');
  };

  return (
    <div className="space-y-5">
      {/* PANEL KONTROL & TOMBOL UNDUH */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Format Resmi Ma&apos;arif NU — SMA Islam Diponegoro Wagir
            </div>
            <h2 className="text-base font-extrabold text-slate-800 tracking-tight">
              Berita Acara dan Daftar Hadir Peserta Sumatif Akhir Semester
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Nama peserta pada tabel Daftar Hadir diambil secara otomatis dari menu{' '}
              <strong className="text-slate-700">Daftar Peserta</strong> sesuai kelas yang dipilih ({filteredParticipants.length} siswa).
            </p>
          </div>

          {/* TOMBOL UNDUH BERITA ACARA & DAFTAR HADIR SISWA */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadBeritaAcara}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#001a6e] hover:bg-[#0028a3] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Unduh Berita Acara (PDF)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadDaftarHadir}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Daftar Hadir Siswa (PDF)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadGabungan}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Unduh 1 Lembar Gabungan Berita Acara (Kiri) & Daftar Hadir (Kanan) persis seperti contoh gambar"
            >
              <Printer className="w-4 h-4" />
              <span>Unduh Gabungan 1 Lembar (PDF)</span>
            </button>
          </div>
        </div>

        {/* FILTER PILIH KELAS DARI DAFTAR PESERTA */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-700 mr-1.5 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-[#0095ff]" />
              <span>Pilih Kelas (Daftar Peserta):</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setTargetKelas('ALL');
                setTargetKelas2('NONE');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                targetKelas === 'ALL'
                  ? 'bg-[#001a6e] text-white shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              Semua Kelas ({participants.length})
            </button>
            {availableClasses.map((cls) => {
              const count = filterSingleClassParticipants(
                participants,
                cls
              ).length;
              const isSelected =
                targetKelas !== 'ALL' && doesKelasMatch(targetKelas, cls);
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setTargetKelas(cls)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#001a6e] text-white shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  Kelas {cls} ({count})
                </button>
              );
            })}
          </div>

          {targetKelas !== 'ALL' && (
            <div className="flex items-center gap-2 text-xs">
              <label className="font-semibold text-slate-600 whitespace-nowrap">
                Kelas ke-2 di Ruang Ini (Opsional):
              </label>
              <select
                value={targetKelas2}
                onChange={(e) => setTargetKelas2(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 font-semibold focus:outline-none focus:border-[#0095ff]"
              >
                <option value="NONE">-- Hanya 1 Kelas ({targetKelas}) --</option>
                {availableClasses
                  .filter((c) => !doesKelasMatch(c, targetKelas))
                  .map((c) => (
                    <option key={c} value={c}>
                      + Gabung Kelas {c} (
                      {filterSingleClassParticipants(participants, c).length}{' '}
                      siswa)
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* FORM ISIAN CEPAT BERITA ACARA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              Ruang Ujian
            </label>
            <input
              type="text"
              value={ruangUjian}
              onChange={(e) => setRuangUjian(e.target.value)}
              placeholder="Contoh: 5 (LIMA)"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 font-semibold focus:outline-none focus:border-[#0095ff]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-600 mb-1">
              Mata Pelajaran
            </label>
            <input
              type="text"
              list="ba-mapel-options"
              value={mataPelajaran}
              onChange={(e) => setMataPelajaran(e.target.value)}
              placeholder="Ketik atau pilih mata pelajaran..."
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 font-semibold focus:outline-none focus:border-[#0095ff]"
            />
            <datalist id="ba-mapel-options">
              {subjectOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              Hari & Tanggal
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={hari}
                onChange={(e) => setHari(e.target.value)}
                placeholder="Hari"
                className="w-1/2 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-[#0095ff]"
              />
              <input
                type="text"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                placeholder="Tgl"
                className="w-1/2 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-[#0095ff]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              Dari Pukul — Sampai
            </label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={waktuMulai}
                onChange={(e) => setWaktuMulai(e.target.value)}
                placeholder="07.30"
                className="w-1/2 px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-[#0095ff]"
              />
              <span>-</span>
              <input
                type="text"
                value={waktuSelesai}
                onChange={(e) => setWaktuSelesai(e.target.value)}
                placeholder="09.00"
                className="w-1/2 px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-[#0095ff]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              Pengawas 1 & 2
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={namaPengawas1}
                onChange={(e) => setNamaPengawas1(e.target.value)}
                placeholder="Pengawas 1"
                className="w-1/2 px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-[#0095ff]"
              />
              <input
                type="text"
                value={namaPengawas2}
                onChange={(e) => setNamaPengawas2(e.target.value)}
                placeholder="Pengawas 2"
                className="w-1/2 px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-[#0095ff]"
              />
            </div>
          </div>
        </div>

        {/* BARIS PENGATURAN ABSENSI SISWA TIDAK HADIR */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="text-slate-600">
            Klik tombol status di samping nama siswa pada tabel di bawah jika ada siswa yang{' '}
            <strong className="text-rose-600">Tidak Hadir (Sakit / Izin / Alpa)</strong> agar otomatis masuk ke tabel Berita Acara.
          </div>
          {absentStudents.length > 0 && (
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold cursor-pointer hover:bg-emerald-100"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Reset Semua Hadir ({absentStudents.length} Tidak Hadir)</span>
            </button>
          )}
        </div>
      </div>

      {/* LEMBAR DOKUMEN PERSIS CONTOH GAMBAR (KOP SURAT + BERITA ACARA KIRI + DAFTAR HADIR KANAN) */}
      <div className="bg-white rounded-xl shadow-md border border-slate-300 p-6 sm:p-8 overflow-x-auto text-black">
        <div className="min-w-[980px] max-w-[1160px] mx-auto font-sans">
          {/* 1. KOP SURAT MA'ARIF NU SMA ISLAM DIPONEGORO WAGIR */}
          <div className="relative flex items-center justify-center pb-2.5 border-b-2 border-black">
            <div className="absolute left-6 top-0">
              <SmadipGreenLogo className="w-20 h-20" />
            </div>
            <div className="text-center leading-snug">
              <div className="text-sm font-bold tracking-wide uppercase">
                LEMBAGA PENDIDIKAN MAARIF NU
              </div>
              <div className="text-xl font-extrabold tracking-wide uppercase">
                {namaSekolah || 'SMA ISLAM DIPONEGORO WAGIR'}
              </div>
              <div className="text-xs font-bold uppercase">
                STATUS : TERAKREDITASI &quot;B&quot;
              </div>
              <div className="text-[11px] font-medium">
                NSS : 302051824001 &nbsp;&nbsp; NPSN : {npsn || '20517834'}
              </div>
              <div className="text-xs italic font-medium">
                Jl. Raya Gondowangi 144 Wagir Malang Telp. 0341 8201427
              </div>
            </div>
          </div>

          {/* 2. JUDUL TENGAH */}
          <div className="text-center mt-2 mb-3 leading-tight">
            <div className="text-xs font-bold uppercase">
              BERITA ACARA dan DAFTAR HADIR PESERTA
            </div>
            <div className="text-xs font-bold uppercase">
              SUMATIF AKHIR SEMESTER {tahunAjaran}
            </div>
          </div>

          {/* 3. BARIS RUANG, MATA PELAJARAN, DAN KELAS */}
          <div className="grid grid-cols-12 gap-6 mb-2 text-xs font-bold">
            <div className="col-span-5 space-y-0.5">
              <div className="grid grid-cols-[120px_1fr]">
                <span>RUANG</span>
                <span>: {ruangUjian}</span>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <span>MATA PELAJARAN</span>
                <span>: {mataPelajaran}</span>
              </div>
            </div>
            <div className="col-span-7 flex items-start">
              <div className="grid grid-cols-[65px_1fr]">
                <span>KELAS</span>
                <span>: {classSummary.kelasHeaderLabel}</span>
              </div>
            </div>
          </div>

          {/* 4. DUA KOLOM UTAMA: KIRI = BERITA ACARA, KANAN = DAFTAR HADIR */}
          <div className="grid grid-cols-12 gap-6 items-start">
            {/* KOLOM KIRI: KOTAK BERITA ACARA */}
            <div className="col-span-5">
              <div className="border border-black">
                {/* Header Hijau (#a9d08e) */}
                <div className="bg-[#a9d08e] border-b border-black py-2.5 px-3 text-center font-serif font-bold text-xs leading-snug">
                  <div>BERITA ACARA</div>
                  <div>SUMATIF AKHIR SEMESTER</div>
                  <div>TAHUN PELAJARAN {tahunAjaran}</div>
                </div>

                {/* Isi Berita Acara */}
                <div className="p-3 space-y-2 text-[11.5px] leading-relaxed">
                  <div>
                    Pada hari ini{' '}
                    <span className="underline decoration-dotted font-semibold px-1">
                      {hari || '.......................'}
                    </span>{' '}
                    tanggal{' '}
                    <span className="underline decoration-dotted font-semibold px-1">
                      {tanggal || '.........'}
                    </span>{' '}
                    bulan{' '}
                    <span className="underline decoration-dotted font-semibold px-1">
                      {bulan || 'Desember'}
                    </span>{' '}
                    tahun{' '}
                    <input
                      type="text"
                      value={tahunTerbilang}
                      onChange={(e) => setTahunTerbilang(e.target.value)}
                      className="border-b border-dotted border-slate-500 focus:outline-none w-40 font-medium bg-transparent"
                    />
                  </div>

                  <div>
                    Telah diselenggarakan Sumatif Akhir Semester TP.{' '}
                    {tahunAjaran}
                  </div>

                  <div className="grid grid-cols-[95px_1fr]">
                    <span>Dari pukul</span>
                    <span>
                      : {waktuMulai || '...............'} &nbsp;&nbsp;&nbsp;
                      sampai pukul &nbsp;&nbsp; {waktuSelesai || '...........'}
                    </span>
                  </div>

                  <div className="grid grid-cols-[95px_1fr]">
                    <span>Pada Sekolah</span>
                    <span>
                      :{' '}
                      <strong className="font-bold uppercase">
                        {namaSekolah || 'SMA ISLAM DIPONEGORO WAGIR'}
                      </strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-[95px_1fr]">
                    <span>Ruang</span>
                    <span>: {ruangUjian || '...............'}</span>
                  </div>

                  <div className="grid grid-cols-[95px_1fr]">
                    <span>Jumlah Peserta</span>
                    <div className="space-y-1">
                      <div className="grid grid-cols-[110px_1fr]">
                        <span>: Kelas {classSummary.kelas1Name}</span>
                        <span>: {classSummary.kelas1Count} siswa</span>
                      </div>
                      <div className="grid grid-cols-[110px_1fr] border-b border-black pb-0.5">
                        <span>: Kelas {classSummary.kelas2Name}</span>
                        <span>: {classSummary.kelas2Count} siswa</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span>
                      Jumlah Peserta yg tdk hadir :{' '}
                      <strong className="underline px-2">
                        {absentStudents.length > 0
                          ? absentStudents.length
                          : '........'}
                      </strong>
                    </span>
                    <span className="pr-8">orang</span>
                  </div>

                  <div className="grid grid-cols-[95px_1fr]">
                    <span>Yakni</span>
                    <span>:</span>
                  </div>

                  {/* Tabel 5 Baris Siswa Tidak Hadir */}
                  <div className="-mx-3">
                    <table className="w-full border-collapse border-y border-black text-[11px]">
                      <thead>
                        <tr className="border-b border-black text-center font-medium">
                          <th className="border-r border-black py-1 w-12 font-normal">
                            No
                          </th>
                          <th className="border-r border-black py-1 font-normal">
                            Nama
                          </th>
                          <th className="border-r border-black py-1 w-16 font-normal">
                            Kelas
                          </th>
                          <th className="py-1 w-20 font-normal">Alasan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[0, 1, 2, 3, 4].map((rowIndex) => {
                          const abs = absentStudents[rowIndex];
                          return (
                            <tr
                              key={rowIndex}
                              className="border-b border-black h-6"
                            >
                              <td className="border-r border-black text-center">
                                {rowIndex + 1}
                              </td>
                              <td className="border-r border-black px-2 font-medium truncate max-w-[160px]">
                                {abs ? abs.namaPeserta : ''}
                              </td>
                              <td className="border-r border-black text-center">
                                {abs ? formatDisplayKelas(abs.kelas) : ''}
                              </td>
                              <td className="text-center">
                                {abs ? attendanceMap[abs.id] || 'Sakit' : ''}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Paragraf Penutup Berita Acara */}
                  <div className="pt-2 space-y-1 text-[11px]">
                    <div>
                      Telah dibuka soal Sumatif Akhir Semester mata pelajaran{' '}
                      <span className="underline decoration-dotted font-semibold">
                        {mataPelajaran ||
                          '..........................................'}
                      </span>
                    </div>
                    <div>
                      di ruang ulangan dengan disaksikan oleh peserta SAS
                    </div>
                    <div>
                      yang berisi soal{' '}
                      <input
                        type="text"
                        value={jumlahEksemplarSoal}
                        onChange={(e) =>
                          setJumlahEksemplarSoal(e.target.value)
                        }
                        placeholder={String(
                          filteredParticipants.length || '............'
                        )}
                        className="border-b border-dotted border-black w-16 text-center font-semibold focus:outline-none bg-transparent"
                      />{' '}
                      Eksemplar, Berita acara 1 lembar,
                    </div>
                    <div>daftar kehadiran 1 lembar.</div>
                  </div>
                </div>
              </div>

              {/* Tanda Tangan Yang Membuat Berita Acara */}
              <div className="mt-4 text-xs">
                <div className="text-center font-bold underline mb-2">
                  Yang Membuat Berita Acara
                </div>
                <div className="flex justify-between px-4">
                  <div className="text-center">
                    <div>Pengawas 1</div>
                    <div className="h-14" />
                    <div className="font-bold underline">
                      {namaPengawas1 || '........................'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div>Pengawas 2</div>
                    <div className="h-14" />
                    <div className="font-bold underline">
                      {namaPengawas2 || '........................'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* KOLOM KANAN: TABEL DAFTAR HADIR PESERTA (OTOMATIS DARI DAFTAR PESERTA SESUAI KELAS) */}
            <div className="col-span-7">
              <table className="w-full border-collapse border border-black text-[11px]">
                <thead>
                  <tr className="bg-[#a9d08e] border-b border-black font-bold text-center">
                    <th className="border-r border-black py-1.5 px-1 w-9">
                      No.
                    </th>
                    <th className="border-r border-black py-1.5 px-1.5 w-28">
                      No. PESERTA
                    </th>
                    <th className="border-r border-black py-1.5 px-2">NAMA</th>
                    <th className="border-r border-black py-1.5 px-1.5 w-16">
                      KELAS
                    </th>
                    <th colSpan={2} className="py-1.5 px-2 w-40">
                      TANDA TANGAN
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: totalDisplayRows }).map((_, idx) => {
                    const student = filteredParticipants[idx];
                    const attStatus = student
                      ? attendanceMap[student.id] || 'Hadir'
                      : 'Hadir';
                    const isAbsent = Boolean(student && attStatus !== 'Hadir');

                    return (
                      <tr
                        key={student ? student.id : `empty_${idx}`}
                        className={`border-b border-black h-6 ${
                          isAbsent ? 'bg-rose-50/70' : ''
                        }`}
                      >
                        <td className="border-r border-black text-center font-medium">
                          {student ? idx + 1 : ''}
                        </td>
                        <td className="border-r border-black text-center font-mono text-[10.5px]">
                          {student ? student.username : ''}
                        </td>
                        <td className="border-r border-black px-2 font-medium">
                          {student ? (
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={
                                  isAbsent
                                    ? 'line-through text-rose-700'
                                    : 'uppercase'
                                }
                              >
                                {student.namaPeserta}
                              </span>
                              {/* Tombol Mini Pilih Hadir/Sakit/Izin/Alpa */}
                              <div className="inline-flex items-center gap-0.5 shrink-0 print:hidden">
                                {ATTENDANCE_STATUS_OPTIONS.map((st) => {
                                  const active = attStatus === st;
                                  const label =
                                    st === 'Hadir'
                                      ? 'H'
                                      : st === 'Sakit'
                                      ? 'S'
                                      : st === 'Izin'
                                      ? 'I'
                                      : 'A';
                                  const badgeStyle = active
                                    ? st === 'Hadir'
                                      ? 'bg-emerald-600 text-white'
                                      : st === 'Sakit'
                                      ? 'bg-amber-500 text-white'
                                      : st === 'Izin'
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-rose-600 text-white'
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200';
                                  return (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() =>
                                        handleSetAttendance(student.id, st)
                                      }
                                      title={`Tandai ${student.namaPeserta}: ${st}`}
                                      className={`w-4 h-4 rounded-xs text-[9px] font-bold flex items-center justify-center cursor-pointer transition-colors ${badgeStyle}`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            ''
                          )}
                        </td>
                        <td className="border-r border-black text-center">
                          {student ? formatDisplayKelas(student.kelas) : ''}
                        </td>

                        {/* Kolom Tanda Tangan Merged 2 Baris Persis Contoh Gambar */}
                        {idx % 2 === 0 ? (
                          <>
                            <td
                              rowSpan={2}
                              className="border-r border-black px-1.5 align-middle w-20 text-[10.5px]"
                            >
                              {filteredParticipants[idx] ? idx + 1 : ''}
                            </td>
                            <td
                              rowSpan={2}
                              className="px-1.5 align-middle w-20 text-[10.5px]"
                            >
                              {filteredParticipants[idx + 1] ? idx + 2 : ''}
                            </td>
                          </>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
