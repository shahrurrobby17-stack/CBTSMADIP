import { jsPDF } from 'jspdf';
import { ExamResultSummary } from '../types/cbt';
import {
  ProctorParticipantRow,
  doesKelasMatch,
  normalizeKelasCode,
} from '../components/ProctorDashboardView';
import { getTargetClassFromMapel } from '../components/AdminViews';


export interface ExamReportRow {
  username: string;
  fullName: string;
  kelas: string;
  packageTitle: string;
  correctText: string;
  finalScoreText: string;
  numericScore: number | null;
  completedAt: string;
}

export function resolveResultClass(
  result: ExamResultSummary,
  participants: ProctorParticipantRow[]
): string {
  if (result.participant?.kelas && result.participant.kelas.trim()) {
    return normalizeKelasCode(result.participant.kelas);
  }
  const cleanUser = (result.participant?.username || '').trim().toUpperCase();
  const matchedParticipant = participants.find(
    (p) =>
      p.username.trim().toUpperCase() === cleanUser ||
      p.namaPeserta.trim().toUpperCase() ===
        (result.participant?.fullName || '').trim().toUpperCase()
  );
  if (matchedParticipant?.kelas) {
    return normalizeKelasCode(matchedParticipant.kelas);
  }
  if (result.packageTitle) {
    return normalizeKelasCode(
      getTargetClassFromMapel({ nama: result.packageTitle })
    );
  }
  return 'X';
}

export function buildExamReportRowsForClass(
  targetKelas: string | 'ALL',
  resultsHistory: ExamResultSummary[],
  participants: ProctorParticipantRow[]
): ExamReportRow[] {
  const matchedResults = resultsHistory.filter((r) => {
    const rKelas = resolveResultClass(r, participants);
    if (targetKelas === 'ALL') return true;
    return doesKelasMatch(rKelas, targetKelas);
  });

  if (matchedResults.length > 0) {
    return matchedResults.map((r) => {
      const rKelas = resolveResultClass(r, participants);
      return {
        username: r.participant.username,
        fullName: r.participant.fullName,
        kelas: `Kelas ${rKelas}`,
        packageTitle: r.packageTitle,
        correctText: `${r.correctCount} / ${r.totalQuestions}`,
        finalScoreText: String(r.finalScore),
        numericScore: r.finalScore,
        completedAt: r.completedAt,
      };
    });
  }

  // Fallback jika belum ada riwayat ujian selesai di kelas tersebut:
  // tampilkan daftar peserta terdaftar di kelas tersebut
  const classParticipants = participants.filter((p) => {
    if (targetKelas === 'ALL') return true;
    return doesKelasMatch(p.kelas, targetKelas);
  });

  return classParticipants.map((p) => ({
    username: p.username,
    fullName: p.namaPeserta,
    kelas: `Kelas ${normalizeKelasCode(p.kelas)}`,
    packageTitle: '-',
    correctText: '- / -',
    finalScoreText: '-',
    numericScore: null,
    completedAt: 'Belum Mengikuti Ujian',
  }));
}

/**
 * Menghasilkan file PDF Laporan Nilai Hasil Ujian per kelas atau seluruh kelas
 * dengan judul resmi:
 * LAPORAN NILAI HASIL UJIAN
 * SMA ISLAM DIPONEGORO WAGIR
 * TAHUN AJARAN 2026/2027
 * SEMESTER 1
 */
export const generateExamReportPDF = (
  targetKelas: string | 'ALL',
  resultsHistory: ExamResultSummary[],
  participants: ProctorParticipantRow[]
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182 mm

  const rows = buildExamReportRowsForClass(
    targetKelas,
    resultsHistory,
    participants
  );

  const kelasLabel =
    targetKelas === 'ALL'
      ? 'Semua Kelas (X, XI IPA, XI IPS, XII IPA, XII IPS)'
      : `Kelas ${normalizeKelasCode(targetKelas)}`;

  const scoredRows = rows.filter((r) => r.numericScore !== null);
  const avgScore =
    scoredRows.length > 0
      ? (
          scoredRows.reduce((acc, cur) => acc + (cur.numericScore || 0), 0) /
          scoredRows.length
        ).toFixed(1)
      : '-';

  const printedDate = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const drawPageHeader = (pageNumber: number) => {
    // 4 baris judul wajib sesuai instruksi
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.text('LAPORAN NILAI HASIL UJIAN', pageWidth / 2, 14, {
      align: 'center',
    });

    doc.setFontSize(13.5);
    doc.text('SMA ISLAM DIPONEGORO WAGIR', pageWidth / 2, 20, {
      align: 'center',
    });

    doc.setFontSize(11);
    doc.text('TAHUN AJARAN 2026/2027', pageWidth / 2, 25.5, {
      align: 'center',
    });

    doc.setFontSize(11);
    doc.text('SEMESTER 1', pageWidth / 2, 30.5, {
      align: 'center',
    });

    // Garis ganda Kop Laporan
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.7);
    doc.line(marginX, 34.5, pageWidth - marginX, 34.5);
    doc.setLineWidth(0.25);
    doc.line(marginX, 35.5, pageWidth - marginX, 35.5);

    if (pageNumber === 1) {
      // Info Kelas & Ringkasan
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(`Kelas : ${kelasLabel}`, marginX, 42);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Tanggal Cetak : ${printedDate}`,
        pageWidth - marginX,
        42,
        { align: 'right' }
      );

      doc.text(
        `Jumlah Data : ${rows.length} Peserta (${scoredRows.length} Selesai Ujian)`,
        marginX,
        47
      );
      doc.text(
        `Rata-Rata Nilai : ${avgScore}`,
        pageWidth - marginX,
        47,
        { align: 'right' }
      );
      return 52;
    }

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Lanjutan Laporan Nilai Hasil Ujian - ${kelasLabel} (Halaman ${pageNumber})`,
      marginX,
      41
    );
    return 45;
  };

  // Definisi kolom tabel (Total = 182 mm)
  const cols = [
    { header: 'No', width: 9, align: 'center' as const },
    { header: 'Username', width: 28, align: 'left' as const },
    { header: 'Nama Peserta', width: 45, align: 'left' as const },
    { header: 'Kelas', width: 20, align: 'center' as const },
    { header: 'Mata Pelajaran', width: 35, align: 'left' as const },
    { header: 'Benar', width: 14, align: 'center' as const },
    { header: 'Nilai', width: 13, align: 'center' as const },
    { header: 'Waktu Selesai', width: 18, align: 'center' as const },
  ];

  const drawTableHeader = (startY: number) => {
    const rowH = 8;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.25);
    doc.rect(marginX, startY, contentWidth, rowH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    let curX = marginX;
    cols.forEach((col, i) => {
      if (i > 0) {
        doc.line(curX, startY, curX, startY + rowH);
      }
      const textX =
        col.align === 'center' ? curX + col.width / 2 : curX + 2;
      doc.text(col.header, textX, startY + 5.3, {
        align: col.align === 'center' ? 'center' : 'left',
      });
      curX += col.width;
    });

    return startY + rowH;
  };

  let pageNumber = 1;
  let currentY = drawPageHeader(pageNumber);
  currentY = drawTableHeader(currentY);

  if (rows.length === 0) {
    const emptyH = 12;
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);
    doc.rect(marginX, currentY, contentWidth, emptyH, 'S');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Belum ada data peserta atau nilai hasil ujian untuk kelas ini.',
      pageWidth / 2,
      currentY + 7.5,
      { align: 'center' }
    );
    currentY += emptyH;
  } else {
    rows.forEach((row, idx) => {
      const rowH = 7.5;
      if (currentY + rowH > pageHeight - 36) {
        doc.addPage();
        pageNumber += 1;
        currentY = drawPageHeader(pageNumber);
        currentY = drawTableHeader(currentY);
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, currentY, contentWidth, rowH, 'F');
      }

      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      doc.rect(marginX, currentY, contentWidth, rowH, 'S');

      const cellValues = [
        String(idx + 1),
        row.username,
        row.fullName,
        row.kelas.replace(/^Kelas\s+/i, ''),
        row.packageTitle,
        row.correctText,
        row.finalScoreText,
        row.completedAt,
      ];

      let curX = marginX;
      cols.forEach((col, colIdx) => {
        if (colIdx > 0) {
          doc.line(curX, currentY, curX, currentY + rowH);
        }

        doc.setFont(
          'helvetica',
          colIdx === 6 && row.numericScore !== null ? 'bold' : 'normal'
        );
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);

        const rawVal = cellValues[colIdx] || '-';
        const maxWidth = col.width - 3;
        const truncated = doc.splitTextToSize(rawVal, maxWidth)[0] || '';

        const textX =
          col.align === 'center' ? curX + col.width / 2 : curX + 1.8;
        doc.text(truncated, textX, currentY + 5, {
          align: col.align === 'center' ? 'center' : 'left',
        });

        curX += col.width;
      });

      currentY += rowH;
    });
  }

  const safeClassSlug =
    targetKelas === 'ALL'
      ? 'Semua_Kelas'
      : `Kelas_${normalizeKelasCode(targetKelas).replace(/\s+/g, '_')}`;

  doc.save(
    `Laporan_Nilai_Hasil_Ujian_${safeClassSlug}_SMA_Islam_Diponegoro_Wagir.pdf`
  );
};
