import { jsPDF } from 'jspdf';
import {
  ProctorParticipantRow,
  doesKelasMatch,
  normalizeKelasCode,
} from '../components/ProctorDashboardView';

export type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Tanpa Keterangan';

export interface BeritaAcaraData {
  namaSekolah: string;
  npsn: string;
  nss?: string;
  alamatSekolah?: string;
  statusAkreditasi?: string;
  namaKepalaSekolah: string;
  namaUjian: string;
  tahunAjaran: string;
  semester: string;
  hari?: string;
  tanggal?: string;
  bulan?: string;
  tahunTerbilang?: string;
  hariTanggal: string;
  waktuMulai?: string;
  waktuSelesai?: string;
  waktuPelaksanaan: string;
  ruangUjian: string;
  sesiKelompok: string;
  targetKelas: string; // Primary class ('ALL', 'X', 'XI IPA', etc.)
  targetKelas2?: string; // Optional second class in the same room ('NONE' or class code)
  mataPelajaran: string;
  jumlahEksemplarSoal?: string;
  namaProktor: string;
  idProktor?: string;
  namaPengawas: string; // Pengawas 1
  namaPengawas2?: string; // Pengawas 2
  catatanUjian: string;
  participants: ProctorParticipantRow[];
  attendanceMap: Record<string, AttendanceStatus>;
}

/**
 * Format display label for a class code
 */
export function formatDisplayKelas(raw?: string): string {
  if (!raw || raw === 'ALL' || raw === 'Semua Kelas') return 'Semua Kelas';
  if (raw === 'NONE') return '';
  const trimmed = raw.replace(/^Kelas\s+/i, '').trim();
  return trimmed || raw;
}

/**
 * Filter participants matching a single class code
 */
export function filterSingleClassParticipants(
  participants: ProctorParticipantRow[],
  kelasCode: string
): ProctorParticipantRow[] {
  if (!kelasCode || kelasCode === 'ALL' || kelasCode === 'Semua Kelas') {
    return participants;
  }
  if (kelasCode === 'NONE') return [];
  return participants.filter((p) => doesKelasMatch(p.kelas, kelasCode));
}

/**
 * Filter participants from Administrator's Daftar Peserta by selected class(es)
 */
export function filterParticipantsByKelas(
  participants: ProctorParticipantRow[],
  targetKelas: string,
  targetKelas2?: string
): ProctorParticipantRow[] {
  if (!targetKelas || targetKelas === 'ALL' || targetKelas === 'Semua Kelas') {
    return participants;
  }
  const list1 = filterSingleClassParticipants(participants, targetKelas);
  if (
    !targetKelas2 ||
    targetKelas2 === 'NONE' ||
    doesKelasMatch(targetKelas, targetKelas2)
  ) {
    return list1;
  }
  const list2 = filterSingleClassParticipants(participants, targetKelas2);
  const seen = new Set(list1.map((p) => p.id));
  const combined = [...list1];
  for (const item of list2) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      combined.push(item);
    }
  }
  return combined;
}

/**
 * Generates a high-resolution PNG Data URL of the SMA Islam Diponegoro Wagir green pentagon logo
 */
function createSmadipLogoDataUrl(): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Pentagon shield coordinates
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(120, 12);
    ctx.lineTo(222, 78);
    ctx.lineTo(192, 208);
    ctx.lineTo(48, 208);
    ctx.lineTo(18, 78);
    ctx.closePath();

    // Fill green gradient matching logo
    const grad = ctx.createLinearGradient(0, 12, 0, 210);
    grad.addColorStop(0, '#92d050');
    grad.addColorStop(1, '#70ad47');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#385723';
    ctx.stroke();

    // Inner border
    ctx.beginPath();
    ctx.moveTo(120, 22);
    ctx.lineTo(210, 82);
    ctx.lineTo(183, 198);
    ctx.lineTo(57, 198);
    ctx.lineTo(30, 82);
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Yellow star at top center
    ctx.fillStyle = '#ffd966';
    ctx.beginPath();
    ctx.arc(120, 56, 12, 0, Math.PI * 2);
    ctx.fill();

    // Center globe / emblem circle
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(120, 118, 34, 0, Math.PI * 2);
    ctx.stroke();

    // Red flame / torch accent in center
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(120, 86);
    ctx.lineTo(132, 122);
    ctx.lineTo(108, 122);
    ctx.closePath();
    ctx.fill();

    // White scroll banner at bottom
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.fillRect(56, 166, 128, 22);
    ctx.strokeRect(56, 166, 128, 22);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('KABUPATEN MALANG', 120, 181);

    ctx.restore();
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Draw the official Kop Surat Ma'arif NU SMA Islam Diponegoro Wagir
 */
function drawKopSurat(
  doc: jsPDF,
  data: BeritaAcaraData,
  marginX: number,
  pageWidth: number,
  startY: number
): number {
  const logoUrl = createSmadipLogoDataUrl();
  if (logoUrl) {
    try {
      doc.addImage(logoUrl, 'PNG', marginX + 6, startY - 1, 22, 22);
    } catch {
      // ignore logo error
    }
  }

  const centerX = pageWidth / 2;
  doc.setTextColor(0, 0, 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('LEMBAGA PENDIDIKAN MAARIF NU', centerX, startY + 3.5, {
    align: 'center',
  });

  doc.setFontSize(13.5);
  doc.text(
    (data.namaSekolah || 'SMA ISLAM DIPONEGORO WAGIR').toUpperCase(),
    centerX,
    startY + 9,
    { align: 'center' }
  );

  doc.setFontSize(9.5);
  doc.text(
    data.statusAkreditasi || 'STATUS : TERAKREDITASI "B"',
    centerX,
    startY + 13.5,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `NSS : ${data.nss || '302051824001'}   NPSN : ${data.npsn || '20517834'}`,
    centerX,
    startY + 17.5,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.text(
    data.alamatSekolah ||
      'Jl. Raya Gondowangi 144 Wagir Malang Telp. 0341 8201427',
    centerX,
    startY + 21.5,
    { align: 'center' }
  );

  // Horizontal solid line under Kop
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.line(marginX, startY + 23.5, pageWidth - marginX, startY + 23.5);

  return startY + 28;
}

/**
 * Compute class summary info for Berita Acara
 */
function getClassSummary(data: BeritaAcaraData) {
  const isAll =
    !data.targetKelas ||
    data.targetKelas === 'ALL' ||
    data.targetKelas === 'Semua Kelas';

  if (isAll) {
    // Group by distinct normalized classes present in participants
    const groups = new Map<string, ProctorParticipantRow[]>();
    data.participants.forEach((p) => {
      const k = p.kelas?.trim() || 'X';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    });
    const entries = Array.from(groups.entries());
    const k1Label = entries[0]?.[0] || 'X';
    const k1Count = entries[0]?.[1]?.length ?? data.participants.length;
    const k2Label =
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
    const combinedLabel =
      entries.length > 0
        ? entries.map((e) => e[0]).join(' dan ')
        : 'Semua Kelas';
    return {
      kelasHeaderLabel: combinedLabel,
      kelas1Name: k1Label,
      kelas1Count: String(k1Count),
      kelas2Name: k2Label,
      kelas2Count: k2Count,
    };
  }

  const list1 = filterSingleClassParticipants(
    data.participants,
    data.targetKelas
  );
  const k1Name = formatDisplayKelas(data.targetKelas);
  const hasK2 =
    Boolean(data.targetKelas2) &&
    data.targetKelas2 !== 'NONE' &&
    !doesKelasMatch(data.targetKelas, data.targetKelas2);
  const list2 = hasK2
    ? filterSingleClassParticipants(data.participants, data.targetKelas2!)
    : [];
  const k2Name = hasK2 ? formatDisplayKelas(data.targetKelas2) : '......';

  return {
    kelasHeaderLabel: hasK2 ? `${k1Name} dan ${k2Name}` : k1Name,
    kelas1Name: k1Name,
    kelas1Count: String(list1.length),
    kelas2Name: k2Name,
    kelas2Count: hasK2 ? String(list2.length) : '........',
  };
}

/**
 * Draw Berita Acara box (Left section in combined sheet or full section in standalone Berita Acara PDF)
 */
function drawBeritaAcaraBox(
  doc: jsPDF,
  data: BeritaAcaraData,
  boxX: number,
  boxY: number,
  boxW: number
): number {
  const classSummary = getClassSummary(data);
  const filteredParticipants = filterParticipantsByKelas(
    data.participants,
    data.targetKelas,
    data.targetKelas2
  );
  const absentStudents = filteredParticipants.filter(
    (p) => (data.attendanceMap[p.id] || 'Hadir') !== 'Hadir'
  );

  // 1. Green Header Box (#A9D08E)
  const headerH = 16;
  doc.setFillColor(169, 208, 142); // Exact #A9D08E green from screenshot
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(boxX, boxY, boxW, headerH, 'FD');

  doc.setTextColor(0, 0, 0);
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text('BERITA ACARA', boxX + boxW / 2, boxY + 5, { align: 'center' });
  doc.text('SUMATIF AKHIR SEMESTER', boxX + boxW / 2, boxY + 10, {
    align: 'center',
  });
  doc.text(
    `TAHUN PELAJARAN ${data.tahunAjaran || '2025-2026'}`,
    boxX + boxW / 2,
    boxY + 14.5,
    { align: 'center' }
  );

  let curY = boxY + headerH + 6;
  const padX = boxX + 2.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const hariStr = data.hari?.trim() || '..................';
  const tglStr = data.tanggal?.trim() || '.......';
  const blnStr = data.bulan?.trim() || 'Desember';
  const thnStr = data.tahunTerbilang?.trim() || 'dua ribu dua puluh lima';

  doc.text(
    `Pada hari ini ${hariStr} tanggal ${tglStr} bulan ${blnStr} tahun ${thnStr}`,
    padX,
    curY
  );
  curY += 5.2;

  doc.text(
    `Telah diselenggarakan Sumatif Akhir Semester TP. ${
      data.tahunAjaran || '2025-2026'
    }`,
    padX,
    curY
  );
  curY += 5.2;

  const mulaiStr = data.waktuMulai?.trim() || '...............';
  const selesaiStr = data.waktuSelesai?.trim() || '...........';
  doc.text('Dari pukul', padX, curY);
  doc.text(`: ${mulaiStr}`, padX + 26, curY);
  doc.text('sampai pukul', padX + 52, curY);
  doc.text(`: ${selesaiStr}`, padX + 74, curY);
  curY += 5.2;

  doc.text('Pada Sekolah', padX, curY);
  doc.text(':', padX + 26, curY);
  doc.setFont('helvetica', 'bold');
  doc.text(
    (data.namaSekolah || 'SMA ISLAM DIPONEGORO WAGIR').toUpperCase(),
    padX + 28.5,
    curY
  );
  doc.setFont('helvetica', 'normal');
  curY += 5.2;

  doc.text('Ruang', padX, curY);
  doc.text(`: ${data.ruangUjian || '...............'}`, padX + 26, curY);
  curY += 5.2;

  // Jumlah Peserta Kelas 1 & Kelas 2
  doc.text('Jumlah Peserta', padX, curY);
  doc.text(`: Kelas ${classSummary.kelas1Name}`, padX + 26, curY);
  doc.text(`: ${classSummary.kelas1Count} siswa`, padX + 54, curY);
  curY += 5.2;

  doc.text(`: Kelas ${classSummary.kelas2Name}`, padX + 26, curY);
  doc.text(`: ${classSummary.kelas2Count} siswa`, padX + 54, curY);
  // Underline under second class count as in screenshot
  doc.setLineWidth(0.25);
  doc.line(padX + 26, curY + 1.2, padX + 76, curY + 1.2);
  curY += 6;

  const absentCountStr =
    absentStudents.length > 0 ? String(absentStudents.length) : '........';
  doc.text(`Jumlah Peserta yg tdk hadir : ${absentCountStr}`, padX, curY);
  doc.text('orang', padX + 76, curY);
  curY += 4.8;

  doc.text('Yakni', padX, curY);
  doc.text(':', padX + 26, curY);
  curY += 2.5;

  // 5-row Table for Absent Students (No | Nama | Kelas | Alasan)
  const tblX = boxX;
  const colNoW = 14;
  const colAlasanW = 20;
  const colKelasW = 18;
  const colNamaW = boxW - colNoW - colKelasW - colAlasanW;
  const rowH = 5.4;

  // Header row
  doc.setLineWidth(0.25);
  doc.rect(tblX, curY, boxW, rowH, 'S');
  doc.line(tblX + colNoW, curY, tblX + colNoW, curY + rowH);
  doc.line(
    tblX + colNoW + colNamaW,
    curY,
    tblX + colNoW + colNamaW,
    curY + rowH
  );
  doc.line(
    tblX + colNoW + colNamaW + colKelasW,
    curY,
    tblX + colNoW + colNamaW + colKelasW,
    curY + rowH
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text('No', tblX + colNoW / 2, curY + 3.8, { align: 'center' });
  doc.text('Nama', tblX + colNoW + colNamaW / 2, curY + 3.8, {
    align: 'center',
  });
  doc.text(
    'Kelas',
    tblX + colNoW + colNamaW + colKelasW / 2,
    curY + 3.8,
    { align: 'center' }
  );
  doc.text(
    'Alasan',
    tblX + colNoW + colNamaW + colKelasW + colAlasanW / 2,
    curY + 3.8,
    { align: 'center' }
  );
  curY += rowH;

  // 5 numbered rows
  for (let i = 0; i < 5; i++) {
    doc.rect(tblX, curY, boxW, rowH, 'S');
    doc.line(tblX + colNoW, curY, tblX + colNoW, curY + rowH);
    doc.line(
      tblX + colNoW + colNamaW,
      curY,
      tblX + colNoW + colNamaW,
      curY + rowH
    );
    doc.line(
      tblX + colNoW + colNamaW + colKelasW,
      curY,
      tblX + colNoW + colNamaW + colKelasW,
      curY + rowH
    );

    doc.text(String(i + 1), tblX + colNoW / 2, curY + 3.8, {
      align: 'center',
    });

    const absStudent = absentStudents[i];
    if (absStudent) {
      const truncName =
        doc.splitTextToSize(absStudent.namaPeserta, colNamaW - 3)[0] || '';
      doc.text(truncName, tblX + colNoW + 1.5, curY + 3.8);
      doc.text(
        formatDisplayKelas(absStudent.kelas),
        tblX + colNoW + colNamaW + colKelasW / 2,
        curY + 3.8,
        { align: 'center' }
      );
      doc.text(
        data.attendanceMap[absStudent.id] || 'Sakit',
        tblX + colNoW + colNamaW + colKelasW + colAlasanW / 2,
        curY + 3.8,
        { align: 'center' }
      );
    }
    curY += rowH;
  }

  curY += 5.5;

  // Closing text inside Berita Acara box
  const mapelStr =
    data.mataPelajaran?.trim() || '.................................';
  const eksStr =
    data.jumlahEksemplarSoal?.trim() ||
    String(filteredParticipants.length || '....................');

  doc.setFontSize(7.8);
  doc.text(
    `Telah dibuka soal Sumatif Akhir Semester mata pelajaran ${mapelStr}`,
    padX,
    curY
  );
  curY += 4.8;
  doc.text('di ruang ulangan dengan disaksikan oleh peserta SAS', padX, curY);
  curY += 4.8;
  doc.text(
    `yang berisi soal ${eksStr} Eksemplar, Berita acara 1 lembar,`,
    padX,
    curY
  );
  curY += 4.8;
  doc.text('daftar kehadiran 1 lembar.', padX, curY);
  curY += 3.5;

  // Outer border of Berita Acara box
  const boxHeight = curY - boxY;
  doc.setLineWidth(0.4);
  doc.rect(boxX, boxY, boxW, boxHeight, 'S');

  // Signature block below Berita Acara box
  let signY = curY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  const titleSign = 'Yang Membuat Berita Acara';
  doc.text(titleSign, boxX + boxW / 2, signY, { align: 'center' });
  const titleW = doc.getTextWidth(titleSign);
  doc.setLineWidth(0.25);
  doc.line(
    boxX + boxW / 2 - titleW / 2,
    signY + 0.8,
    boxX + boxW / 2 + titleW / 2,
    signY + 0.8
  );

  signY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Pengawas 1', boxX + 14, signY, { align: 'center' });
  doc.text('Pengawas 2', boxX + boxW - 14, signY, { align: 'center' });

  signY += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  if (data.namaPengawas?.trim()) {
    doc.text(data.namaPengawas.trim(), boxX + 14, signY, { align: 'center' });
  }
  if (data.namaPengawas2?.trim()) {
    doc.text(data.namaPengawas2.trim(), boxX + boxW - 14, signY, {
      align: 'center',
    });
  }

  return signY + 4;
}

/**
 * Draw Daftar Hadir Table matching exact screenshot format
 * (No. | No. PESERTA | NAMA | KELAS | TANDA TANGAN 2-row merged pairs)
 */
function drawDaftarHadirTable(
  doc: jsPDF,
  participantsList: ProctorParticipantRow[],
  tableX: number,
  tableY: number,
  tableW: number,
  minRows: number = 24
) {
  const colNoW = 8;
  const colPesertaW = 24;
  const colKelasW = 16;
  const colSign1W = 19;
  const colSign2W = 19;
  const colNamaW =
    tableW - colNoW - colPesertaW - colKelasW - colSign1W - colSign2W;

  const headerH = 7;

  // Green Header (#A9D08E)
  doc.setFillColor(169, 208, 142);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(tableX, tableY, tableW, headerH, 'FD');

  let cx = tableX;
  const colWidths = [colNoW, colPesertaW, colNamaW, colKelasW];
  colWidths.forEach((w) => {
    cx += w;
    doc.line(cx, tableY, cx, tableY + headerH);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(0, 0, 0);

  doc.text('No.', tableX + colNoW / 2, tableY + 4.8, { align: 'center' });
  doc.text(
    'No. PESERTA',
    tableX + colNoW + colPesertaW / 2,
    tableY + 4.8,
    { align: 'center' }
  );
  doc.text(
    'NAMA',
    tableX + colNoW + colPesertaW + colNamaW / 2,
    tableY + 4.8,
    { align: 'center' }
  );
  doc.text(
    'KELAS',
    tableX + colNoW + colPesertaW + colNamaW + colKelasW / 2,
    tableY + 4.8,
    { align: 'center' }
  );
  doc.text(
    'TANDA TANGAN',
    tableX +
      colNoW +
      colPesertaW +
      colNamaW +
      colKelasW +
      (colSign1W + colSign2W) / 2,
    tableY + 4.8,
    { align: 'center' }
  );

  // Ensure even number of rows so 2-row merged signature cells align cleanly
  const rawTotal = Math.max(participantsList.length, minRows);
  const totalRows = rawTotal % 2 === 0 ? rawTotal : rawTotal + 1;
  const rowH = 5.2;
  let curY = tableY + headerH;

  const signStartX = tableX + colNoW + colPesertaW + colNamaW + colKelasW;
  const signMidX = signStartX + colSign1W;
  const signEndX = signMidX + colSign2W;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setLineWidth(0.22);

  for (let i = 0; i < totalRows; i++) {
    const student = participantsList[i];

    // Draw cells for No, No. PESERTA, NAMA, KELAS
    doc.rect(tableX, curY, signStartX - tableX, rowH, 'S');
    let xCursor = tableX;
    colWidths.slice(0, 3).forEach((w) => {
      xCursor += w;
      doc.line(xCursor, curY, xCursor, curY + rowH);
    });

    if (student) {
      doc.text(String(i + 1), tableX + colNoW / 2, curY + 3.7, {
        align: 'center',
      });
      const truncCode =
        doc.splitTextToSize(student.username || '', colPesertaW - 2)[0] || '';
      doc.text(
        truncCode,
        tableX + colNoW + colPesertaW / 2,
        curY + 3.7,
        { align: 'center' }
      );
      const truncNama =
        doc.splitTextToSize(
          (student.namaPeserta || '').toUpperCase(),
          colNamaW - 3
        )[0] || '';
      doc.text(
        truncNama,
        tableX + colNoW + colPesertaW + 1.5,
        curY + 3.7
      );
      doc.text(
        formatDisplayKelas(student.kelas),
        tableX + colNoW + colPesertaW + colNamaW + colKelasW / 2,
        curY + 3.7,
        { align: 'center' }
      );
    }

    // Draw 2-row merged signature cells on every even index (i = 0, 2, 4, ...)
    if (i % 2 === 0) {
      const pairH = rowH * 2;
      doc.rect(signStartX, curY, colSign1W, pairH, 'S');
      doc.rect(signMidX, curY, colSign2W, pairH, 'S');

      const hasOddStudent = Boolean(participantsList[i]);
      const hasEvenStudent = Boolean(participantsList[i + 1]);

      if (hasOddStudent) {
        doc.text(String(i + 1), signStartX + 1.5, curY + pairH / 2 + 1);
      }
      if (hasEvenStudent) {
        doc.text(String(i + 2), signMidX + 1.5, curY + pairH / 2 + 1);
      }
    }

    curY += rowH;
  }

  // Outer border for the whole Daftar Hadir table
  doc.setLineWidth(0.35);
  doc.rect(tableX, tableY, tableW, curY - tableY, 'S');
  doc.line(signEndX, tableY, signEndX, curY);
}

/**
 * 1. UNDUH GABUNGAN BERITA ACARA & DAFTAR HADIR (1 Lembar Persis Contoh Gambar)
 */
export const generateGabunganBeritaAcaraPDF = (data: BeritaAcaraData) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const marginX = 12;
  const classSummary = getClassSummary(data);
  const filteredParticipants = filterParticipantsByKelas(
    data.participants,
    data.targetKelas,
    data.targetKelas2
  );

  // Draw Kop Surat
  let y = drawKopSurat(doc, data, marginX, pageWidth, 8);

  // Title: BERITA ACARA dan DAFTAR HADIR PESERTA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('BERITA ACARA dan DAFTAR HADIR PESERTA', pageWidth / 2, y, {
    align: 'center',
  });
  y += 4.2;
  doc.text(
    `SUMATIF AKHIR SEMESTER ${data.tahunAjaran || '2025-2026'}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 5.5;

  const leftBoxW = 114;
  const gapW = 8;
  const rightTableX = marginX + leftBoxW + gapW;
  const rightTableW = pageWidth - marginX - rightTableX;

  // RUANG, MATA PELAJARAN, KELAS bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('RUANG', marginX, y);
  doc.text(`: ${data.ruangUjian || '1 (SATU)'}`, marginX + 34, y);

  doc.text('KELAS', rightTableX, y);
  doc.text(`: ${classSummary.kelasHeaderLabel}`, rightTableX + 18, y);

  y += 4.5;
  doc.text('MATA PELAJARAN', marginX, y);
  doc.text(`: ${data.mataPelajaran || ''}`, marginX + 34, y);

  y += 3;

  // Left: Berita Acara Box
  drawBeritaAcaraBox(doc, data, marginX, y, leftBoxW);

  // Right: Daftar Hadir Table (Up to 26 rows per page; if more, paginates cleanly)
  const firstPageRows = filteredParticipants.slice(0, 26);
  drawDaftarHadirTable(
    doc,
    firstPageRows,
    rightTableX,
    y,
    rightTableW,
    Math.min(Math.max(firstPageRows.length, 22), 26)
  );

  // If more than 26 students, add continuation page for remaining Daftar Hadir
  if (filteredParticipants.length > 26) {
    let offset = 26;
    while (offset < filteredParticipants.length) {
      doc.addPage();
      let nextY = drawKopSurat(doc, data, marginX, pageWidth, 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(
        `LANJUTAN DAFTAR HADIR PESERTA — KELAS ${classSummary.kelasHeaderLabel}`,
        pageWidth / 2,
        nextY,
        { align: 'center' }
      );
      nextY += 6;
      const chunk = filteredParticipants.slice(offset, offset + 28);
      drawDaftarHadirTable(
        doc,
        chunk,
        marginX,
        nextY,
        pageWidth - marginX * 2,
        chunk.length
      );
      offset += 28;
    }
  }

  const safeSlug = classSummary.kelasHeaderLabel.replace(/[^a-zA-Z0-9]+/g, '_');
  doc.save(`Berita_Acara_dan_Daftar_Hadir_SAS_${safeSlug}_SMADIP.pdf`);
};

/**
 * 2. UNDUH BERITA ACARA SAJA (Format Sesuai Contoh Gambar)
 */
export const generateBeritaAcaraPDF = (data: BeritaAcaraData) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2;
  const classSummary = getClassSummary(data);

  let y = drawKopSurat(doc, data, marginX, pageWidth, 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('BERITA ACARA PELAKSANAAN PESERTA', pageWidth / 2, y, {
    align: 'center',
  });
  y += 4.5;
  doc.text(
    `SUMATIF AKHIR SEMESTER ${data.tahunAjaran || '2025-2026'}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 6;

  doc.setFontSize(8.8);
  doc.text('RUANG', marginX, y);
  doc.text(`: ${data.ruangUjian || '1 (SATU)'}`, marginX + 36, y);
  doc.text('KELAS', pageWidth - marginX - 55, y);
  doc.text(
    `: ${classSummary.kelasHeaderLabel}`,
    pageWidth - marginX - 38,
    y
  );
  y += 4.8;

  doc.text('MATA PELAJARAN', marginX, y);
  doc.text(`: ${data.mataPelajaran || ''}`, marginX + 36, y);
  y += 4;

  drawBeritaAcaraBox(doc, data, marginX, y, contentWidth);

  const safeSlug = classSummary.kelasHeaderLabel.replace(/[^a-zA-Z0-9]+/g, '_');
  doc.save(`Berita_Acara_SAS_${safeSlug}_SMADIP.pdf`);
};

/**
 * 3. UNDUH DAFTAR HADIR SISWA SAJA (Format Sesuai Contoh Gambar, Nama dari Daftar Peserta sesuai Kelas)
 */
export const generateDaftarHadirPDF = (data: BeritaAcaraData) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  const classSummary = getClassSummary(data);

  const filteredParticipants = filterParticipantsByKelas(
    data.participants,
    data.targetKelas,
    data.targetKelas2
  );

  const chunkSize = 34;
  const totalChunks = Math.max(
    1,
    Math.ceil(filteredParticipants.length / chunkSize)
  );

  for (let pageIdx = 0; pageIdx < totalChunks; pageIdx++) {
    if (pageIdx > 0) doc.addPage();

    let y = drawKopSurat(doc, data, marginX, pageWidth, 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('DAFTAR HADIR PESERTA', pageWidth / 2, y, {
      align: 'center',
    });
    y += 4.5;
    doc.text(
      `SUMATIF AKHIR SEMESTER ${data.tahunAjaran || '2025-2026'}`,
      pageWidth / 2,
      y,
      { align: 'center' }
    );
    y += 6;

    doc.setFontSize(8.8);
    doc.text('RUANG', marginX, y);
    doc.text(`: ${data.ruangUjian || '1 (SATU)'}`, marginX + 36, y);
    doc.text('KELAS', pageWidth - marginX - 60, y);
    doc.text(
      `: ${classSummary.kelasHeaderLabel}`,
      pageWidth - marginX - 42,
      y
    );
    y += 4.8;

    doc.text('MATA PELAJARAN', marginX, y);
    doc.text(`: ${data.mataPelajaran || ''}`, marginX + 36, y);
    y += 4;

    const slice = filteredParticipants.slice(
      pageIdx * chunkSize,
      (pageIdx + 1) * chunkSize
    );
    drawDaftarHadirTable(
      doc,
      slice,
      marginX,
      y,
      contentWidth,
      Math.max(slice.length, 24)
    );
  }

  const safeSlug = classSummary.kelasHeaderLabel.replace(/[^a-zA-Z0-9]+/g, '_');
  doc.save(`Daftar_Hadir_Siswa_SAS_${safeSlug}_SMADIP.pdf`);
};
