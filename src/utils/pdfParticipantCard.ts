import { jsPDF } from 'jspdf';
import {
  ProctorParticipantRow,
  resolveParticipantRuang,
} from '../components/ProctorDashboardView';

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
  _headmasterName = 'ROMEO GALISTRA, S.Pd.',
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

  // Sort/group participants by Ruang Ujian so cards are ordered by room
  const sortedParticipants = [...participants].sort((a, b) => {
    const ruangA = resolveParticipantRuang(a as any);
    const ruangB = resolveParticipantRuang(b as any);
    return ruangA.localeCompare(ruangB, 'id', { numeric: true });
  });

  // Layout: 8 cards per A4 page (2 columns x 4 rows)
  const cardsPerPage = 8;
  const colWidth = 94;
  const colHeight = 68;
  const marginX = 8;
  const marginY = 7;
  const gapX = 6;
  const gapY = 3.5;

  sortedParticipants.forEach((p, index) => {
    if (index > 0 && index % cardsPerPage === 0) {
      doc.addPage();
    }

    const slot = index % cardsPerPage;
    const col = slot % 2; // 0 (left) or 1 (right)
    const row = Math.floor(slot / 2); // 0 to 3 (4 rows)

    const cardX = marginX + col * (colWidth + gapX);
    const cardY = marginY + row * (colHeight + gapY);

    // Card outer border
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.25);
    doc.rect(cardX, cardY, colWidth, colHeight, 'S');

    // Header Lines (Double horizontal line)
    const headerTopY = cardY + 1.5;
    const headerBottomY = cardY + 15.2;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.line(cardX + 1.5, headerTopY, cardX + colWidth - 1.5, headerTopY);
    doc.line(cardX + 1.5, headerBottomY, cardX + colWidth - 1.5, headerBottomY);

    let textCenterX = cardX + colWidth / 2;

    // Draw uploaded Kop Logo on the left side of the header if available
    if (resolvedLogo) {
      try {
        const format =
          resolvedLogo.startsWith('data:image/jpeg') ||
          resolvedLogo.startsWith('data:image/jpg')
            ? 'JPEG'
            : 'PNG';
        doc.addImage(resolvedLogo, format, cardX + 2.8, cardY + 2.6, 11, 11);
        textCenterX = cardX + 15 + (colWidth - 16.5) / 2;
      } catch {
        // Fallback to centered text if image fails
      }
    }

    // Header Text
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text('KARTU LOGIN PESERTA', textCenterX, cardY + 5.0, {
      align: 'center',
    });
    doc.setFontSize(6.8);
    doc.text('SUMATIF AKHIR SEMESTER', textCenterX, cardY + 8.0, {
      align: 'center',
    });
    doc.setFontSize(6.5);
    doc.text('TAHUN 2026', textCenterX, cardY + 10.9, {
      align: 'center',
    });
    doc.setFontSize(6.2);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolName, textCenterX, cardY + 13.7, {
      align: 'center',
    });

    // Body Fields
    const labelX = cardX + 3.2;
    const colonX = cardX + 26.5;
    const valX = cardX + 28.5;
    let currY = cardY + 19.2;
    const lineStep = 4.1;

    const displayPassword = p.password || `SMADIP${1547 + (index % 50) * 9}*`;
    const displayKelas = p.kelas || (index % 2 === 0 ? 'X' : 'XI IPA');
    const displayRuang = resolveParticipantRuang(p as any);

    const dataRows: [string, string, boolean][] = [
      ['Nama Peserta', p.namaPeserta, true],
      ['Username / ID', p.username, true],
      ['Kata Sandi', displayPassword, true],
      ['Kelas / Rombel', displayKelas, false],
      ['Ruang Ujian', displayRuang, true],
      ['Kode Ujian', p.kodeTes || 'SAS26SMADIP1', false],
      ['Sekolah Asal', schoolName, false],
      ['Tgl. Cetak Kartu', printedDate, false],
    ];

    dataRows.forEach(([lbl, val, isBold]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(50, 50, 50);
      doc.text(lbl, labelX, currY);
      doc.text(':', colonX, currY);

      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(0, 0, 0);

      // Truncate if too long
      const maxValW = colWidth - 31;
      const truncated = doc.splitTextToSize(String(val || '-'), maxValW)[0] || String(val || '-');
      doc.text(truncated, valX, currY);

      currY += lineStep;
    });

    // Bottom section: Signature Box on right
    const bottomY = cardY + 50.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(0, 0, 0);
    const sigX = cardX + colWidth - 24;
    doc.text('Mengetahui,', sigX, bottomY + 1.5, { align: 'center' });

    doc.text('Ttd.', sigX, bottomY + 11.5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.text('Panitia Ujian', sigX, bottomY + 14.3, { align: 'center' });

    // Bottom decorative horizontal line of card
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(
      cardX + 1.5,
      cardY + colHeight - 1.5,
      cardX + colWidth - 1.5,
      cardY + colHeight - 1.5
    );
  });

  doc.save(filename);
}
