import { jsPDF } from 'jspdf';
import { AdminScheduleItem } from '../types/cbt';

export interface ProctorCardData {
  id: string;
  proctorId: string;
  fullName: string;
  roomName: string;
  rombel: string;
  encryptionCode: string;
  password: string;
  status: 'Active' | 'Non Active';
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

  // Fill pentagon with Kemendikbud Blue (#297bbf) using triangles from center
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
  doc.setLineWidth(0.4);
  for (let i = 0; i < 5; i++) {
    const next = (i + 1) % 5;
    doc.line(pts[i][0], pts[i][1], pts[next][0], pts[next][1]);
  }

  // White Garuda wings & tail feathers
  doc.setDrawColor(255, 255, 255);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.55);
  // Left wing arcs
  doc.line(cx - r * 0.56, cy - r * 0.06, cx - r * 0.16, cy + r * 0.18);
  doc.line(cx - r * 0.48, cy + r * 0.12, cx - r * 0.14, cy + r * 0.3);
  doc.line(cx - r * 0.38, cy + r * 0.28, cx - r * 0.12, cy + r * 0.4);
  // Right wing arcs
  doc.line(cx + r * 0.56, cy - r * 0.06, cx + r * 0.16, cy + r * 0.18);
  doc.line(cx + r * 0.48, cy + r * 0.12, cx + r * 0.14, cy + r * 0.3);
  doc.line(cx + r * 0.38, cy + r * 0.28, cx + r * 0.12, cy + r * 0.4);

  // Yellow/Gold Flame (#fbd206) in center
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

  // White Open Book at bottom
  doc.setFillColor(255, 255, 255);
  doc.rect(cx - r * 0.34, cy + r * 0.42, r * 0.68, r * 0.16, 'F');

  // Top text "TUT WURI HANDAYANI"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.1);
  doc.setTextColor(255, 255, 255);
  doc.text('TUT WURI HANDAYANI', cx, cy - r * 0.48, { align: 'center' });
}

export function generateProctorCardsPDF(
  proctors: ProctorCardData[],
  filename = 'Kartu_Proktor_CBT_SMA_Islam_Diponegoro_Wagir.pdf',
  _schedules: AdminScheduleItem[] = []
): void {
  if (!proctors || proctors.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Render up to 2 cards per A4 page
  proctors.forEach((pr, index) => {
    if (index > 0 && index % 2 === 0) {
      doc.addPage();
    }

    const slotInPage = index % 2;
    const startY = slotInPage === 0 ? 16 : 150;
    const cardX = 22;
    const cardW = 166;
    const cardH = 98;

    // Subtle outer border of the card sheet
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.25);
    doc.rect(cardX, startY, cardW, cardH, 'S');

    // Top & Bottom horizontal rules of Header
    const headerTopY = startY + 2;
    const headerBottomY = startY + 26;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.line(cardX + 1, headerTopY, cardX + cardW - 1, headerTopY);
    doc.line(cardX + 1, headerBottomY, cardX + cardW - 1, headerBottomY);

    // Left: Kementerian Pendidikan (Tut Wuri Handayani) Colored Logo
    drawKemendikbudLogo(doc, cardX + 13, startY + 14.5, 9);

    // Center: Header Title (3 lines, bold, SUMATIF AKHIR SEMESTER)
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('KARTU PROKTOR', cardX + cardW / 2, startY + 10.5, {
      align: 'center',
    });
    doc.text('SUMATIF AKHIR SEMESTER', cardX + cardW / 2, startY + 15.5, {
      align: 'center',
    });
    doc.text('TAHUN 2026', cardX + cardW / 2, startY + 20.5, {
      align: 'center',
    });

    // Body Fields (Nama Proktor, ID Proktor, Rombel yang Dipegang, Kode Enkripsi, Kata Sandi, Nama Sekolah)
    const bodyStartY = startY + 35;
    const labelX = cardX + 4;
    const colonX = cardX + 55;
    const valX = cardX + 59;
    const lineStep = 9.2;

    const rows: [string, string][] = [
      ['Nama Proktor', pr.fullName],
      ['ID Proktor', pr.proctorId],
      ['Rombel yang Dipegang', pr.rombel || '-'],
      ['Kode Enkripsi', pr.encryptionCode],
      ['Kata Sandi', pr.password],
      ['Nama Sekolah', 'SMA ISLAM DIPONEGORO WAGIR'],
    ];

    doc.setTextColor(0, 0, 0);
    rows.forEach(([label, val], rIdx) => {
      const y = bodyStartY + rIdx * lineStep;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(label, labelX, y);
      doc.text(':', colonX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(val, valX, y);
    });

    // Bottom horizontal rule of card
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.line(
      cardX + 1,
      startY + cardH - 2,
      cardX + cardW - 1,
      startY + cardH - 2
    );
  });

  doc.save(filename);
}
