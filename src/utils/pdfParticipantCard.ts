import { jsPDF } from 'jspdf';
import { ProctorParticipantRow } from '../components/ProctorDashboardView';

export interface ParticipantCardExportData {
  id: string;
  username: string;
  password?: string;
  namaPeserta: string;
  kodeTes: string;
  kelas?: string;
  ruang?: string;
  sesi?: string;
  kelompok?: string;
  sekolah?: string;
}

/**
 * Draws the colored Kementerian Pendidikan (Tut Wuri Handayani) emblem at (cx, cy) with radius r.
 */
function drawKemendikbudLogo(doc: jsPDF, cx: number, cy: number, r: number) {
  // Pentagon vertices (top, upper-right, lower-right, lower-left, upper-left)
  const pts: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const angle = ((-90 + i * 72) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }

  // Fill pentagon with Kemendikbud Blue (#297bbf)
  doc.setFillColor(41, 123, 191);
  doc.setDrawColor(41, 123, 191);
  for (let i = 0; i < 5; i++) {
    const next = (i + 1) % 5;
    doc.triangle(
      cx,
      cy,
      pts[i][0],
      pts[i][1],
      pts[next][0],
      pts[next][1],
      'F'
    );
  }

  // Outer black border of pentagon
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  for (let i = 0; i < 5; i++) {
    const next = (i + 1) % 5;
    doc.line(pts[i][0], pts[i][1], pts[next][0], pts[next][1]);
  }

  // White Garuda wings & tail feathers
  doc.setDrawColor(255, 255, 255);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.45);
  // Left wing
  doc.line(cx - r * 0.56, cy - r * 0.06, cx - r * 0.16, cy + r * 0.18);
  doc.line(cx - r * 0.48, cy + r * 0.12, cx - r * 0.14, cy + r * 0.3);
  doc.line(cx - r * 0.38, cy + r * 0.28, cx - r * 0.12, cy + r * 0.4);
  // Right wing
  doc.line(cx + r * 0.56, cy - r * 0.06, cx + r * 0.16, cy + r * 0.18);
  doc.line(cx + r * 0.48, cy + r * 0.12, cx + r * 0.14, cy + r * 0.3);
  doc.line(cx + r * 0.38, cy + r * 0.28, cx + r * 0.12, cy + r * 0.4);

  // Yellow/Gold Flame in center
  doc.setFillColor(251, 210, 6);
  doc.circle(cx, cy + r * 0.04, r * 0.16, 'F');
  doc.triangle(
    cx - r * 0.12,
    cy + r * 0.02,
    cx + r * 0.12,
    cy + r * 0.02,
    cx,
    cy - r * 0.36,
    'F'
  );

  // White Open Book
  doc.setFillColor(255, 255, 255);
  doc.rect(cx - r * 0.34, cy + r * 0.42, r * 0.68, r * 0.16, 'F');

  // Top Text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.8);
  doc.setTextColor(255, 255, 255);
  doc.text('TUT WURI HANDAYANI', cx, cy - r * 0.48, { align: 'center' });
}

export function generateParticipantCardsPDF(
  participants: (ProctorParticipantRow | ParticipantCardExportData)[],
  filename = 'Kartu_Peserta_Ujian_SAS_SMA_Islam_Diponegoro_Wagir.pdf',
  schoolName = 'SMA ISLAM DIPONEGORO WAGIR',
  headmasterName = 'ROMEO GALISTRA, S.Pd.'
): void {
  if (!participants || participants.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Layout: 4 cards per A4 page (2 columns x 2 rows)
  const cardsPerPage = 4;
  const colWidth = 92;
  const colHeight = 130;
  const marginX = 9;
  const marginY = 12;
  const gapX = 8;
  const gapY = 10;

  participants.forEach((p, index) => {
    if (index > 0 && index % cardsPerPage === 0) {
      doc.addPage();
    }

    const slot = index % cardsPerPage;
    const col = slot % 2; // 0 (left) or 1 (right)
    const row = Math.floor(slot / 2); // 0 (top) or 1 (bottom)

    const cardX = marginX + col * (colWidth + gapX);
    const cardY = marginY + row * (colHeight + gapY);

    // Card outer border
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.25);
    doc.rect(cardX, cardY, colWidth, colHeight, 'S');

    // Header Lines (Double horizontal line)
    const headerTopY = cardY + 2.5;
    const headerBottomY = cardY + 24;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(cardX + 1.5, headerTopY, cardX + colWidth - 1.5, headerTopY);
    doc.line(cardX + 1.5, headerBottomY, cardX + colWidth - 1.5, headerBottomY);

    // Header Text (Centered across card)
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('KARTU LOGIN PESERTA', cardX + colWidth / 2, cardY + 8.5, {
      align: 'center',
    });
    doc.setFontSize(8.5);
    doc.text('SUMATIF AKHIR SEMESTER', cardX + colWidth / 2, cardY + 13, {
      align: 'center',
    });
    doc.setFontSize(8);
    doc.text('TAHUN 2026', cardX + colWidth / 2, cardY + 17.5, {
      align: 'center',
    });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolName, cardX + colWidth / 2, cardY + 21.5, {
      align: 'center',
    });

    // Body Fields
    const labelX = cardX + 4;
    const colonX = cardX + 32;
    const valX = cardX + 34.5;
    let currY = cardY + 32;
    const lineStep = 7.2;

    const displayPassword = p.password || `SMADIP${1547 + (index % 50) * 9}*`;
    const displayKelas = p.kelas || (index % 2 === 0 ? 'X' : 'XI IPA');
    const displayRuang = (p as any).ruang || 'LAB KOMPUTER 1';

    const dataRows: [string, string, boolean][] = [
      ['Nama Peserta', p.namaPeserta, true],
      ['Username / ID', p.username, true],
      ['Kata Sandi', displayPassword, true],
      ['Kelas / Rombel', displayKelas, false],
      ['Ruang Ujian', displayRuang, false],
      ['Kode Ujian', p.kodeTes || 'GLDTKA25MAH2', false],
      ['Sekolah Asal', schoolName, false],
    ];

    dataRows.forEach(([lbl, val, isBold]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(50, 50, 50);
      doc.text(lbl, labelX, currY);
      doc.text(':', colonX, currY);

      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(0, 0, 0);

      // Truncate if too long
      const maxValW = colWidth - 38;
      const truncated = doc.splitTextToSize(val, maxValW)[0] || val;
      doc.text(truncated, valX, currY);

      currY += lineStep;
    });

    // Bottom section: Signature Box on right (tanpa tempat foto)
    const bottomY = cardY + colHeight - 32;

    // Signature Area on right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    const sigX = cardX + colWidth - 28;
    doc.text('Wagir, 07 Desember 2026', sigX, bottomY + 3, { align: 'center' });
    doc.text('Kepala Sekolah,', sigX, bottomY + 7.5, { align: 'center' });

    // Signature line
    doc.setLineWidth(0.3);
    doc.line(sigX - 18, bottomY + 23, sigX + 18, bottomY + 23);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(headmasterName, sigX, bottomY + 26.5, { align: 'center' });

    // Bottom decorative horizontal line of card
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.line(cardX + 1.5, cardY + colHeight - 2, cardX + colWidth - 1.5, cardY + colHeight - 2);
  });

  doc.save(filename);
}
