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

function getStoredCardLogoDataUrl(explicitLogo?: string): string {
  if (explicitLogo && explicitLogo.startsWith('data:image/')) {
    return explicitLogo;
  }
  try {
    const direct = localStorage.getItem('cbt_kartu_peserta_logo');
    if (direct && direct.startsWith('data:image/')) {
      return direct;
    }
    const rawSettings = localStorage.getItem('cbt_admin_settings');
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings);
      if (
        parsed &&
        typeof parsed.logoKartuPeserta === 'string' &&
        parsed.logoKartuPeserta.startsWith('data:image/')
      ) {
        return parsed.logoKartuPeserta;
      }
    }
  } catch {
    // ignore
  }
  return '';
}

export function generateParticipantCardsPDF(
  participants: (ProctorParticipantRow | ParticipantCardExportData)[],
  filename = 'Kartu_Peserta_Ujian_SAS_SMA_Islam_Diponegoro_Wagir.pdf',
  schoolName = 'SMA ISLAM DIPONEGORO WAGIR',
  headmasterName = 'ROMEO GALISTRA, S.Pd.',
  logoDataUrl?: string
): void {
  if (!participants || participants.length === 0) return;

  const resolvedLogo = getStoredCardLogoDataUrl(logoDataUrl);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const printedDate = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
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

    let textCenterX = cardX + colWidth / 2;

    // Draw uploaded Kop Logo on the left side of the header if available
    if (resolvedLogo) {
      try {
        const format = resolvedLogo.startsWith('data:image/jpeg') ||
          resolvedLogo.startsWith('data:image/jpg')
          ? 'JPEG'
          : 'PNG';
        doc.addImage(resolvedLogo, format, cardX + 3.5, cardY + 4.8, 16, 16);
        textCenterX = cardX + 20 + (colWidth - 22) / 2;
      } catch {
        // Fallback to centered text if image fails
      }
    }

    // Header Text
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('KARTU LOGIN PESERTA', textCenterX, cardY + 8.5, {
      align: 'center',
    });
    doc.setFontSize(8.5);
    doc.text('SUMATIF AKHIR SEMESTER', textCenterX, cardY + 13, {
      align: 'center',
    });
    doc.setFontSize(8);
    doc.text('TAHUN 2026', textCenterX, cardY + 17.5, {
      align: 'center',
    });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolName, textCenterX, cardY + 21.5, {
      align: 'center',
    });

    // Body Fields
    const labelX = cardX + 4;
    const colonX = cardX + 32;
    const valX = cardX + 34.5;
    let currY = cardY + 31;
    const lineStep = 6.8;

    const displayPassword = p.password || `SMADIP${1547 + (index % 50) * 9}*`;
    const displayKelas = p.kelas || (index % 2 === 0 ? 'X' : 'XI IPA');
    const displayRuang = (p as any).ruang || 'LAB KOMPUTER 1';

    const dataRows: [string, string, boolean][] = [
      ['Nama Peserta', p.namaPeserta, true],
      ['Username / ID', p.username, true],
      ['Kata Sandi', displayPassword, true],
      ['Kelas / Rombel', displayKelas, false],
      ['Ruang Ujian', displayRuang, false],
      ['Kode Ujian', p.kodeTes || 'SAS26SMADIP1', false],
      ['Sekolah Asal', schoolName, false],
      ['Tgl. Cetak Kartu', printedDate, false],
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
    const bottomY = cardY + colHeight - 31;

    // Signature Area on right (otomatis mengikuti tanggal saat kartu diunduh)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    const sigX = cardX + colWidth - 28;
    doc.text(`Wagir, ${printedDate}`, sigX, bottomY + 3, { align: 'center' });
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
    doc.line(
      cardX + 1.5,
      cardY + colHeight - 2,
      cardX + colWidth - 1.5,
      cardY + colHeight - 2
    );
  });

  doc.save(filename);
}
