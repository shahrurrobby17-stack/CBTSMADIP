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
  Archive,
  Edit,
  Check,
} from 'lucide-react';
import { TutWuriLogo } from './PusmendikHeader';
import {
  AdminScheduleItem,
  ExamPackage,
  ExamResultSummary,
  Question,
  QuestionType,
  StudentAnswer,
} from '../types/cbt';
import { getQuestionTypeLabel } from '../data/cbtData';
import {
  AdminProctorItem,
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
  downloadWordQuestionArchive,
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
  ruang?: string;
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
  violationResetAt?: number;
  loginUpdatedAt?: number;
  metaUpdatedAt?: number;
  draftUpdatedAt?: number;
  violationCount?: number;
  violationPackageId?: string;
  draftAnswers?: Record<string, StudentAnswer>;
  draftPackageId?: string;
  draftRemainingSeconds?: number;
}

export function normalizeKelasCode(raw?: string | number | null): string {
  if (raw === null || raw === undefined) return '';
  const s = String(raw)
    .replace(/^kelas\s+/i, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (!s) return '';
  if (/^(XII|12)\b/.test(s)) {
    if (s.includes('IPS')) return 'XII IPS';
    if (s.includes('IPA') || s.includes('MIPA')) return 'XII IPA';
    return s.replace(/^12\b/, 'XII');
  }
  if (/^(XI|11)\b/.test(s)) {
    if (s.includes('IPS')) return 'XI IPS';
    if (s.includes('IPA') || s.includes('MIPA')) return 'XI IPA';
    return s.replace(/^11\b/, 'XI');
  }
  if (/^(X|10)\b/.test(s)) {
    return 'X';
  }
  return s;
}

export function doesKelasMatch(
  studentKelas?: string | number | null,
  scheduleKelas?: string | number | null
): boolean {
  const rawA = String(studentKelas ?? '')
    .replace(/^kelas\s+/i, '')
    .trim()
    .toUpperCase();
  const rawB = String(scheduleKelas ?? '')
    .replace(/^kelas\s+/i, '')
    .trim()
    .toUpperCase();
  if (!rawA || !rawB) return false;
  if (rawB === 'SEMUA' || rawB === 'SEMUA KELAS') return true;
  if (rawA === rawB) return true;
  const normA = normalizeKelasCode(studentKelas);
  const normB = normalizeKelasCode(scheduleKelas);
  return Boolean(normA && normB && normA === normB);
}

export function isParticipantLockedByViolation(
  p?: Partial<ProctorParticipantRow> | null
): boolean {
  if (!p || typeof p !== 'object') return false;
  const vTs = typeof p.violationTimestamp === 'number' ? p.violationTimestamp : 0;
  const resetTs = Math.max(
    typeof p.lastResetAt === 'number' ? p.lastResetAt : 0,
    typeof p.violationResetAt === 'number' ? p.violationResetAt : 0
  );
  return (
    p.violationSchema === 3 &&
    vTs > 0 &&
    vTs > resetTs &&
    Boolean(p.requestReset || p.loginState === 'Terkunci (Pelanggaran)')
  );
}

export const DEFAULT_EXAM_ROOMS = [
  'Ruang 1',
  'Ruang 2',
  'Ruang 3',
  'Ruang 4',
  'Ruang 5',
  'LAB KOMPUTER 1',
  'LAB KOMPUTER 2',
  'LAB KOMPUTER 3',
] as const;

export function resolveParticipantRuang(
  row?: Partial<ProctorParticipantRow> | null
): string {
  if (!row || typeof row !== 'object') return 'Ruang 1';
  const rawRuang = String(row.ruang ?? '').trim();
  if (rawRuang) {
    if (/^[1-9]\d*$/.test(rawRuang)) return `Ruang ${rawRuang}`;
    return rawRuang;
  }
  const rawKelompok = String(row.kelompok ?? '').trim();
  // Ensure legacy demo row p8 ('kelompok: 2' without explicit ruang) starts in Ruang 1 so Ruang 2 is empty initially
  if (
    (row.id === 'p8' || row.id === 'ap8' || row.username === 'SA20261839') &&
    rawKelompok === '2'
  ) {
    return 'Ruang 1';
  }
  if (rawKelompok) {
    if (/^[1-9]\d*$/.test(rawKelompok)) return `Ruang ${rawKelompok}`;
    return rawKelompok;
  }
  return 'Ruang 1';
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

export function shortenStudentUsername(raw?: string | number | null): string {
  if (raw === null || raw === undefined) return '';
  const clean = String(raw).trim().toUpperCase();
  if (!clean) return '';
  if (LEGACY_USERNAME_MAP[clean]) {
    return LEGACY_USERNAME_MAP[clean];
  }
  const longMatch = clean.match(/^TK(?:050601080)?(\d{4,})$/);
  if (longMatch) {
    return `SA2026${longMatch[1].slice(-4)}`;
  }
  return clean;
}

export function isParticipantStatusActive(status?: string): boolean {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return s === 'active' || s === 'aktif';
}

export const DEFAULT_DEMO_PARTICIPANT_IDS = new Set([
  'ap1',
  'ap2',
  'ap3',
  'ap4',
  'ap5',
  'ap6',
  'ap7',
  'ap8',
  'p1',
  'p2',
  'p3',
  'p4',
  'p5',
  'p6',
  'p7',
  'p8',
]);

export const DEFAULT_DEMO_USERNAMES = new Set([
  'SA20264821',
  'SA20267394',
  'SA20262918',
  'SA20268563',
  'SA20265147',
  'SA20269302',
  'SA20266475',
  'SA20261839',
  'P130100240',
  'K020500118',
  'TK1601',
  'TK1610',
]);

export function isDefaultDemoParticipantRow(
  row?: Partial<ProctorParticipantRow> | null
): boolean {
  if (!row || typeof row !== 'object') return false;
  const id = String(row.id || '').trim();
  if (id.startsWith('excel_') || /^ap_\d+$/.test(id)) return false;
  const username = shortenStudentUsername(String(row.username || ''));
  return (
    DEFAULT_DEMO_PARTICIPANT_IDS.has(id) ||
    DEFAULT_DEMO_USERNAMES.has(username)
  );
}

export function isCustomUploadedParticipantRow(
  row?: Partial<ProctorParticipantRow> | null
): boolean {
  if (!row || typeof row !== 'object') return false;
  const id = String(row.id || '').trim();
  const username = String(row.username || '').trim();
  if (!id && !username) return false;
  return !isDefaultDemoParticipantRow(row);
}

export function isDefaultDemoParticipantsList(
  rows?: ProctorParticipantRow[] | null
): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return true;
  if (rows.length > 8) return false;
  return rows.every((r) => isDefaultDemoParticipantRow(r));
}

export function getParticipantNameKelasKey(
  row?: Partial<ProctorParticipantRow> | null
): string {
  if (!row || typeof row !== 'object') return '';
  const name = String(row.namaPeserta || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
  if (!name) return '';
  const kelas =
    normalizeKelasCode(row.kelas) ||
    String(row.kelas || '')
      .trim()
      .toUpperCase();
  return `${name}__${kelas}`;
}

function getLoginStatePriority(
  state?: ProctorParticipantRow['loginState']
): number {
  if (state === 'Selesai') return 4;
  if (state === 'Terkunci (Pelanggaran)') return 3;
  if (state === 'Sedang Mengerjakan') return 2;
  return 1;
}

export function reconcileParticipantRow(
  existing: ProctorParticipantRow,
  incoming: ProctorParticipantRow
): ProctorParticipantRow {
  const existingPriority = getLoginStatePriority(existing.loginState);
  const incomingPriority = getLoginStatePriority(incoming.loginState);
  const existingDraftCount = existing.draftAnswers
    ? Object.keys(existing.draftAnswers).length
    : 0;
  const incomingDraftCount = incoming.draftAnswers
    ? Object.keys(incoming.draftAnswers).length
    : 0;

  const existingIsActive = isParticipantStatusActive(existing.status);
  const incomingIsActive = isParticipantStatusActive(incoming.status);

  const existMetaTs =
    typeof existing.metaUpdatedAt === 'number' ? existing.metaUpdatedAt : 0;
  const incMetaTs =
    typeof incoming.metaUpdatedAt === 'number' ? incoming.metaUpdatedAt : 0;
  const maxMetaUpdatedAt = Math.max(existMetaTs, incMetaTs);

  const existLoginTs =
    typeof existing.loginUpdatedAt === 'number' ? existing.loginUpdatedAt : 0;
  const incLoginTs =
    typeof incoming.loginUpdatedAt === 'number' ? incoming.loginUpdatedAt : 0;
  const maxLoginUpdatedAt = Math.max(existLoginTs, incLoginTs);

  const existDraftTs =
    typeof existing.draftUpdatedAt === 'number' ? existing.draftUpdatedAt : 0;
  const incDraftTs =
    typeof incoming.draftUpdatedAt === 'number' ? incoming.draftUpdatedAt : 0;
  const maxDraftUpdatedAt = Math.max(existDraftTs, incDraftTs);

  const existViolationTs =
    existing.violationSchema === 3 &&
    typeof existing.violationTimestamp === 'number'
      ? existing.violationTimestamp
      : 0;
  const incViolationTs =
    incoming.violationSchema === 3 &&
    typeof incoming.violationTimestamp === 'number'
      ? incoming.violationTimestamp
      : 0;
  const maxViolationTs = Math.max(existViolationTs, incViolationTs);

  const existResetAt =
    typeof existing.lastResetAt === 'number' ? existing.lastResetAt : 0;
  const incResetAt =
    typeof incoming.lastResetAt === 'number' ? incoming.lastResetAt : 0;
  const maxResetAt = Math.max(existResetAt, incResetAt);

  const existViolationResetAt =
    typeof existing.violationResetAt === 'number' ? existing.violationResetAt : 0;
  const incViolationResetAt =
    typeof incoming.violationResetAt === 'number' ? incoming.violationResetAt : 0;
  const maxViolationResetAt = Math.max(existViolationResetAt, incViolationResetAt);
  const effectiveResetAt = Math.max(maxResetAt, maxViolationResetAt);

  // Prefer the identity (id/username/password) of whichever record has newer timestamps, exam progress, or Active status
  const preferIncomingIdentity =
    incMetaTs > existMetaTs ||
    incLoginTs > existLoginTs ||
    incViolationTs > existViolationTs ||
    incomingPriority > existingPriority ||
    (incomingPriority === existingPriority &&
      incomingDraftCount > existingDraftCount) ||
    (incomingPriority === existingPriority &&
      !existingIsActive &&
      incomingIsActive);

  const primary = preferIncomingIdentity ? incoming : existing;
  const secondary = preferIncomingIdentity ? existing : incoming;

  // Resolve status & ruang by metaUpdatedAt
  let resolvedStatus: 'Active' | 'Non Active';
  if (incMetaTs !== existMetaTs) {
    resolvedStatus =
      incMetaTs > existMetaTs ? incoming.status : existing.status;
  } else {
    resolvedStatus =
      existingIsActive || incomingIsActive ? 'Active' : primary.status;
  }

  const existingRuang = resolveParticipantRuang(existing);
  const incomingRuang = resolveParticipantRuang(incoming);
  let resolvedRuang: string;
  if (incMetaTs !== existMetaTs) {
    resolvedRuang = incMetaTs > existMetaTs ? incomingRuang : existingRuang;
  } else {
    resolvedRuang =
      existingRuang !== 'Ruang 1'
        ? existingRuang
        : incomingRuang !== 'Ruang 1'
        ? incomingRuang
        : primary.ruang || 'Ruang 1';
  }

  // Resolve draft answers by draftUpdatedAt or answer count
  const preferIncomingDraft =
    incDraftTs > existDraftTs ||
    (incDraftTs === existDraftTs && incomingDraftCount >= existingDraftCount);
  const draftSource = preferIncomingDraft ? incoming : existing;
  const fallbackDraftSource = preferIncomingDraft ? existing : incoming;

  const bestDraftAnswers =
    draftSource.draftAnswers &&
    Object.keys(draftSource.draftAnswers).length > 0
      ? draftSource.draftAnswers
      : fallbackDraftSource.draftAnswers;
  const bestDraftPackageId =
    draftSource.draftPackageId || fallbackDraftSource.draftPackageId;
  const bestDraftRemainingSeconds =
    typeof draftSource.draftRemainingSeconds === 'number'
      ? draftSource.draftRemainingSeconds
      : fallbackDraftSource.draftRemainingSeconds;

  // Resolve violation lock vs reset login vs normal login state
  const finishedAfterViolation =
    (existing.loginState === 'Selesai' && existLoginTs > maxViolationTs) ||
    (incoming.loginState === 'Selesai' && incLoginTs > maxViolationTs);

  const isLocked =
    !finishedAfterViolation &&
    maxViolationTs > 0 &&
    maxViolationTs > effectiveResetAt;

  let resolvedLoginState: ProctorParticipantRow['loginState'] = 'Belum Login';
  let resolvedRequestReset = false;
  let resolvedViolationReason: string | undefined = undefined;
  let resolvedViolationAt: string | undefined = undefined;
  let resolvedViolationSchema: number | undefined = undefined;
  let resolvedViolationTimestamp: number | undefined = undefined;
  let resolvedViolationCount: number | undefined = undefined;
  let resolvedViolationPackageId: string | undefined = undefined;

  if (isLocked) {
    const vSource = incViolationTs >= existViolationTs ? incoming : existing;
    const vFallback = incViolationTs >= existViolationTs ? existing : incoming;
    resolvedLoginState = 'Terkunci (Pelanggaran)';
    resolvedRequestReset = true;
    resolvedViolationSchema = 3;
    resolvedViolationTimestamp = maxViolationTs;
    resolvedViolationReason =
      vSource.violationReason ||
      vFallback.violationReason ||
      'Pelanggaran keamanan ujian CBT';
    resolvedViolationAt = vSource.violationAt || vFallback.violationAt;
    resolvedViolationPackageId =
      vSource.violationPackageId || vFallback.violationPackageId;
    const existValidCount =
      maxViolationResetAt === 0 || existViolationTs > maxViolationResetAt
        ? typeof existing.violationCount === 'number'
          ? existing.violationCount
          : 0
        : 0;
    const incValidCount =
      maxViolationResetAt === 0 || incViolationTs > maxViolationResetAt
        ? typeof incoming.violationCount === 'number'
          ? incoming.violationCount
          : 0
        : 0;
    resolvedViolationCount = Math.max(existValidCount, incValidCount, 1);
  } else {
    // Unlocked (either never violated, or Reset Login occurred at effectiveResetAt >= maxViolationTs)
    resolvedRequestReset = false;
    if (maxResetAt > 0 && maxResetAt >= maxLoginUpdatedAt) {
      resolvedLoginState = 'Belum Login';
    } else if (maxLoginUpdatedAt > 0) {
      const loginSource = incLoginTs >= existLoginTs ? incoming : existing;
      const loginFallback = incLoginTs >= existLoginTs ? existing : incoming;
      const candidateState =
        loginSource.loginState !== 'Terkunci (Pelanggaran)'
          ? loginSource.loginState
          : loginFallback.loginState !== 'Terkunci (Pelanggaran)'
          ? loginFallback.loginState
          : 'Belum Login';
      resolvedLoginState = candidateState;
    } else {
      const candidateA =
        incoming.loginState === 'Terkunci (Pelanggaran)'
          ? 'Belum Login'
          : incoming.loginState;
      const candidateB =
        existing.loginState === 'Terkunci (Pelanggaran)'
          ? 'Belum Login'
          : existing.loginState;
      resolvedLoginState =
        getLoginStatePriority(candidateA) >= getLoginStatePriority(candidateB)
          ? candidateA
          : candidateB;
    }
    const maxVCount = Math.max(
      typeof existing.violationCount === 'number' ? existing.violationCount : 0,
      typeof incoming.violationCount === 'number' ? incoming.violationCount : 0
    );
    const violationsExplicitlyCleared =
      maxViolationResetAt > 0 && maxViolationResetAt >= maxViolationTs;
    if (resolvedLoginState === 'Selesai' || violationsExplicitlyCleared) {
      resolvedViolationCount = 0;
      resolvedViolationPackageId = undefined;
    } else if (maxVCount > 0) {
      resolvedViolationCount = maxVCount;
      const vPkgSource = incViolationTs >= existViolationTs ? incoming : existing;
      const vPkgFallback = incViolationTs >= existViolationTs ? existing : incoming;
      resolvedViolationPackageId =
        vPkgSource.violationPackageId || vPkgFallback.violationPackageId;
    }
  }

  return {
    ...secondary,
    ...primary,
    id: primary.id || secondary.id,
    username: primary.username || secondary.username,
    password: primary.password || secondary.password,
    selected: Boolean(existing.selected || incoming.selected),
    status: resolvedStatus,
    ruang: resolvedRuang,
    kelompok:
      resolvedRuang !== 'Ruang 1'
        ? resolvedRuang
        : primary.kelompok || secondary.kelompok || 'Ruang 1',
    loginState: resolvedLoginState,
    requestReset: resolvedRequestReset,
    violationReason: resolvedViolationReason,
    violationAt: resolvedViolationAt,
    violationSchema: resolvedViolationSchema,
    violationTimestamp: resolvedViolationTimestamp,
    violationCount: resolvedViolationCount,
    violationPackageId: resolvedViolationPackageId,
    draftAnswers:
      resolvedLoginState === 'Selesai' ? undefined : bestDraftAnswers,
    draftPackageId:
      resolvedLoginState === 'Selesai' ? undefined : bestDraftPackageId,
    draftRemainingSeconds:
      resolvedLoginState === 'Selesai' ? undefined : bestDraftRemainingSeconds,
    ...(maxResetAt > 0 ? { lastResetAt: maxResetAt } : {}),
    ...(maxViolationResetAt > 0 ? { violationResetAt: maxViolationResetAt } : {}),
    ...(maxLoginUpdatedAt > 0 ? { loginUpdatedAt: maxLoginUpdatedAt } : {}),
    ...(maxMetaUpdatedAt > 0 ? { metaUpdatedAt: maxMetaUpdatedAt } : {}),
    ...(maxDraftUpdatedAt > 0 ? { draftUpdatedAt: maxDraftUpdatedAt } : {}),
  };
}

function mergeDuplicateParticipantRows(
  existing: ProctorParticipantRow,
  incoming: ProctorParticipantRow
): ProctorParticipantRow {
  return reconcileParticipantRow(existing, incoming);
}

export function mergeParticipantLists(
  remoteRows: ProctorParticipantRow[],
  localRows: ProctorParticipantRow[],
  deletedIdsInput?: Iterable<string>,
  options?: { serverAuthoritativeStatus?: boolean }
): ProctorParticipantRow[] {
  const deletedSet = new Set<string>(
    deletedIdsInput
      ? Array.from(deletedIdsInput)
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      : []
  );

  const localById = new Map<string, ProctorParticipantRow>();
  const localByUser = new Map<string, ProctorParticipantRow>();
  const localByNameKelas = new Map<string, ProctorParticipantRow>();

  for (const lRow of localRows) {
    if (!lRow || typeof lRow !== 'object') continue;
    const id = String(lRow.id || '').trim();
    const u = shortenStudentUsername(lRow.username);
    const nk = getParticipantNameKelasKey(lRow);
    if (id && deletedSet.has(id)) continue;
    if (id) localById.set(id, lRow);
    if (u) localByUser.set(u, lRow);
    if (nk) localByNameKelas.set(nk, lRow);
  }

  const matchedLocalUsers = new Set<string>();
  const matchedLocalIds = new Set<string>();
  const matchedLocalNameKelas = new Set<string>();

  const mergedRemote = remoteRows
    .filter((rRow) => {
      if (!rRow || typeof rRow !== 'object') return false;
      const id = String(rRow.id || '').trim();
      return !id || !deletedSet.has(id);
    })
    .map((rRow) => {
      const id = String(rRow.id || '').trim();
      const u = shortenStudentUsername(rRow.username);
      const nk = getParticipantNameKelasKey(rRow);

      const localMatch =
        (u ? localByUser.get(u) : undefined) ||
        (id ? localById.get(id) : undefined) ||
        (nk ? localByNameKelas.get(nk) : undefined);

      if (localMatch) {
        if (localMatch.id) matchedLocalIds.add(String(localMatch.id).trim());
        const lu = shortenStudentUsername(localMatch.username);
        if (lu) matchedLocalUsers.add(lu);
        const lnk = getParticipantNameKelasKey(localMatch);
        if (lnk) matchedLocalNameKelas.add(lnk);

        const reconciled = reconcileParticipantRow(localMatch, rRow);
        const authoritativeStatus: 'Active' | 'Non Active' =
          options?.serverAuthoritativeStatus
            ? isParticipantStatusActive(rRow.status)
              ? 'Active'
              : 'Non Active'
            : reconciled.status;
        return {
          ...reconciled,
          status: authoritativeStatus,
          selected: Boolean(localMatch.selected),
        };
      }
      return rRow;
    });

  // Preserve any custom/uploaded local students that were missing from a split-brain serverless response and not deleted
  const localHasReal = !isDefaultDemoParticipantsList(localRows);
  if (localHasReal) {
    for (const lRow of localRows) {
      if (!lRow || isDefaultDemoParticipantRow(lRow)) continue;
      const id = String(lRow.id || '').trim();
      if (id && deletedSet.has(id)) continue;
      const u = shortenStudentUsername(lRow.username);
      const nk = getParticipantNameKelasKey(lRow);
      if (
        (id && matchedLocalIds.has(id)) ||
        (u && matchedLocalUsers.has(u)) ||
        (nk && matchedLocalNameKelas.has(nk))
      ) {
        continue;
      }
      mergedRemote.push(lRow);
    }
  }

  return sanitizeParticipantRows(mergedRemote);
}

export function sanitizeParticipantRows(
  rows: ProctorParticipantRow[]
): ProctorParticipantRow[] {
  if (!Array.isArray(rows)) return [];
  const validObjects = rows.filter(
    (r): r is ProctorParticipantRow => Boolean(r && typeof r === 'object')
  );
  const hasCustomRows = validObjects.some((r) => isCustomUploadedParticipantRow(r));
  let changed = validObjects.length !== rows.length;
  const filtered = hasCustomRows
    ? validObjects.filter((r) => {
        if (isDefaultDemoParticipantRow(r)) {
          changed = true;
          return false;
        }
        return true;
      })
    : validObjects;

  const normalizedRows = filtered.map((row, idx) => {
    const validLock = isParticipantLockedByViolation(row);
    const rawKelasStr = String(row.kelas ?? '').trim();
    const resolvedKelas =
      rawKelasStr
        ? rawKelasStr
        : FALLBACK_KELAS_CYCLE[idx % FALLBACK_KELAS_CYCLE.length];
    const rawKodeTesStr = String(row.kodeTes ?? '').trim();
    const resolvedKodeTes =
      !rawKodeTesStr || rawKodeTesStr === 'GLDTKA25MAH2'
        ? 'SAS26SMADIP1'
        : rawKodeTesStr;
    const resolvedId = String(row.id ?? '').trim() || `row_${idx}_${Date.now()}`;
    const resolvedNama = String(row.namaPeserta ?? '').trim() || 'PESERTA CBT';
    const resolvedUsername = shortenStudentUsername(row.username);
    const resolvedRuang = resolveParticipantRuang(row);
    const needsIdFix = row.id !== resolvedId;
    const needsNamaFix = row.namaPeserta !== resolvedNama;
    const needsKelasFill = row.kelas !== resolvedKelas;
    const needsKodeTesFix = row.kodeTes !== resolvedKodeTes;
    const needsUsernameFix = row.username !== resolvedUsername;
    const needsRuangFill = row.ruang !== resolvedRuang;
    const needsUnlock =
      !validLock &&
      (row.requestReset || row.loginState === 'Terkunci (Pelanggaran)');

    if (
      needsUnlock ||
      needsIdFix ||
      needsNamaFix ||
      needsKelasFill ||
      needsKodeTesFix ||
      needsUsernameFix ||
      needsRuangFill
    ) {
      changed = true;
      return {
        ...row,
        id: resolvedId,
        namaPeserta: resolvedNama,
        username: resolvedUsername,
        kodeTes: resolvedKodeTes,
        kelas: resolvedKelas,
        ruang: resolvedRuang,
        loginState:
          needsUnlock && row.loginState === 'Terkunci (Pelanggaran)'
            ? ('Belum Login' as const)
            : row.loginState || ('Belum Login' as const),
        requestReset: needsUnlock ? false : Boolean(row.requestReset),
        violationReason: needsUnlock ? undefined : row.violationReason,
        violationAt: needsUnlock ? undefined : row.violationAt,
        violationSchema: needsUnlock ? undefined : row.violationSchema,
        violationTimestamp: needsUnlock ? undefined : row.violationTimestamp,
      };
    }
    return row;
  });

  // Deduplicate by (namaPeserta + kelas) and by username so re-uploaded Excel lists never create 245 duplicate students
  const dedupedList: ProctorParticipantRow[] = [];
  const indexByNameKelas = new Map<string, number>();
  const indexByUsername = new Map<string, number>();

  for (const row of normalizedRows) {
    const nameKelasKey = getParticipantNameKelasKey(row);
    const userKey = String(row.username || '')
      .trim()
      .toUpperCase();

    const existingIdxByName =
      nameKelasKey && indexByNameKelas.has(nameKelasKey)
        ? indexByNameKelas.get(nameKelasKey)
        : undefined;
    const existingIdxByUser =
      userKey && indexByUsername.has(userKey)
        ? indexByUsername.get(userKey)
        : undefined;

    const matchIdx =
      existingIdxByName !== undefined ? existingIdxByName : existingIdxByUser;

    if (matchIdx !== undefined) {
      changed = true;
      const merged = mergeDuplicateParticipantRows(dedupedList[matchIdx], row);
      dedupedList[matchIdx] = merged;
      const mergedNameKey = getParticipantNameKelasKey(merged);
      const mergedUserKey = String(merged.username || '')
        .trim()
        .toUpperCase();
      if (mergedNameKey) indexByNameKelas.set(mergedNameKey, matchIdx);
      if (mergedUserKey) indexByUsername.set(mergedUserKey, matchIdx);
    } else {
      const newIdx = dedupedList.length;
      dedupedList.push(row);
      if (nameKelasKey) indexByNameKelas.set(nameKelasKey, newIdx);
      if (userKey) indexByUsername.set(userKey, newIdx);
    }
  }

  return changed ? dedupedList : rows;
}

const INITIAL_PARTICIPANT_ROWS: ProctorParticipantRow[] = [
  {
    id: 'p1',
    selected: false,
    status: 'Non Active',
    kodeTes: 'SAS26SMADIP1',
    username: 'SA20264821',
    password: 'SMADIP1547*',
    namaPeserta: 'ANDRIAN FAJARICO PRASETYA',
    kelompok: 'Ruang 1',
    ruang: 'Ruang 1',
    kelas: 'X',
    loginState: 'Belum Login',
    requestReset: false,
  },
  {
    id: 'p2',
    selected: false,
    status: 'Non Active',
    kodeTes: 'SAS26SMADIP1',
    username: 'SA20267394',
    password: 'SMADIP1556*',
    namaPeserta: 'AHMAD RIZKI NOVANSYAH',
    kelompok: 'Ruang 1',
    ruang: 'Ruang 1',
    kelas: 'XI IPA',
    loginState: 'Belum Login',
    requestReset: false,
  },
  {
    id: 'p3',
    selected: false,
    status: 'Non Active',
    kodeTes: 'SAS26SMADIP1',
    username: 'SA20262918',
    password: 'SMADIP1565*',
    namaPeserta: 'ARYA RESTU KUSUMA',
    kelompok: 'Ruang 1',
    ruang: 'Ruang 1',
    kelas: 'XI IPS',
    loginState: 'Belum Login',
    requestReset: false,
  },
  {
    id: 'p4',
    selected: false,
    status: 'Non Active',
    kodeTes: 'SAS26SMADIP1',
    username: 'SA20268563',
    password: 'SMADIP1574*',
    namaPeserta: 'AUREL RIZKY ADI PRATAMA',
    kelompok: 'Ruang 1',
    ruang: 'Ruang 1',
    kelas: 'XII IPA',
    loginState: 'Belum Login',
    requestReset: false,
  },
  {
    id: 'p5',
    selected: false,
    status: 'Non Active',
    kodeTes: 'SAS26SMADIP1',
    username: 'SA20265147',
    password: 'SMADIP1583*',
    namaPeserta: 'AHMAD DENY FIKRUDIN',
    kelompok: 'Ruang 1',
    ruang: 'Ruang 1',
    kelas: 'XII IPS',
    loginState: 'Belum Login',
    requestReset: false,
  },
  {
    id: 'p6',
    selected: false,
    status: 'Non Active',
    kodeTes: 'SAS26SMADIP1',
    username: 'SA20269302',
    password: 'SMADIP1592*',
    namaPeserta: 'ALDISA FRANDIKA LIAN PRATAMA',
    kelompok: 'Ruang 1',
    ruang: 'Ruang 1',
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
    password: 'ANBKTKA26*',
    namaPeserta: 'NADIA PUTRI PRATAMA',
    kelompok: 'Ruang 1',
    ruang: 'Ruang 1',
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
    password: 'SAINSTKA*',
    namaPeserta: 'BAGAS ADITYA NUGRAHA',
    kelompok: 'Ruang 1',
    ruang: 'Ruang 1',
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
  tokenDurationSeconds?: number;
  onUpdateToken: (newToken: string) => void;
  isScheduleActive: boolean;
  activeSchedules: AdminScheduleItem[];
  participants?: ProctorParticipantRow[];
  onUpdateParticipants?: React.Dispatch<
    React.SetStateAction<ProctorParticipantRow[]>
  >;
  proctors?: AdminProctorItem[];
  onUpdateProctors?: (
    updater: AdminProctorItem[] | ((prev: AdminProctorItem[]) => AdminProctorItem[])
  ) => void;
  onUpdateProctorName?: (newName: string) => void;
  packages: ExamPackage[];
  onUpdatePackages: (
    updater:
      | ExamPackage[]
      | ((prevPackages: ExamPackage[]) => ExamPackage[])
  ) => void;
  onResetDefaultPackages: () => void;
  resultsHistory: ExamResultSummary[];
  onClearHistory: () => void;
  adminSettings?: Record<string, any>;
  onUpdateAdminSettings?: (nextCfg: Record<string, any>) => void;
  onLogoutProctor: () => void;
}

export const ProctorDashboardView: React.FC<ProctorDashboardViewProps> = ({
  proctorName,
  encryptionCode,
  activeToken,
  tokenSecondsLeft,
  tokenDurationSeconds = 600,
  isScheduleActive,
  activeSchedules,
  participants: externalParticipants,
  onUpdateParticipants,
  proctors,
  onUpdateProctors,
  onUpdateProctorName,
  packages,
  onUpdatePackages,
  onResetDefaultPackages,
  resultsHistory,
  onClearHistory,
  adminSettings,
  onUpdateAdminSettings,
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
  const [filterStatus, setFilterStatus] = useState<string>('Semua Status');
  const [filterKodeTes, setFilterKodeTes] = useState<string>('SEMUA');
  const [filterKelompok, setFilterKelompok] = useState<string>('SEMUA');
  const [targetMoveRuang, setTargetMoveRuang] = useState<string>('Ruang 2');

  // Applied filters when clicking "Apply"
  const [appliedStatus, setAppliedStatus] = useState<string>('Semua Status');
  const [appliedKodeTes, setAppliedKodeTes] = useState<string>('SEMUA');
  const [appliedKelompok, setAppliedKelompok] = useState<string>('SEMUA');

  const availableExamRooms = useMemo(() => {
    const roomSet = new Set<string>(DEFAULT_EXAM_ROOMS);
    participants.forEach((p) => {
      const r = resolveParticipantRuang(p);
      if (r) roomSet.add(r);
    });
    return Array.from(roomSet);
  }, [participants]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string>('');
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState<boolean>(false);
  const [showEditProctorModal, setShowEditProctorModal] = useState<boolean>(false);
  const [editProctorNameInput, setEditProctorNameInput] = useState<string>('');

  // Bank Soal & Status Tes state
  const [selectedPkgId, setSelectedPkgId] = useState(packages[0]?.id || '');
  const [statusTesKelas, setStatusTesKelas] = useState('Semua Kelas');
  const [statusTesTipeSoal, setStatusTesTipeSoal] = useState('Semua Tipe Soal');
  const [showQuestionPreviewModal, setShowQuestionPreviewModal] = useState(false);
  const [previewQuestionIdx, setPreviewQuestionIdx] = useState(0);
  const effectiveTokenDurationSecs = Math.max(60, tokenDurationSeconds || 600);
  const tokenIntervalMinutes = Math.round(effectiveTokenDurationSecs / 60);
  const tokenMinutes = String(Math.floor(tokenSecondsLeft / 60)).padStart(2, '0');
  const tokenSeconds = String(tokenSecondsLeft % 60).padStart(2, '0');
  const tokenCountdownLabel = `${tokenMinutes}:${tokenSeconds}`;
  const tokenProgressPct = Math.max(
    0,
    Math.min(100, (tokenSecondsLeft / effectiveTokenDurationSecs) * 100)
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

  // Filtered rows for Kelompok Tes table (sorted by Ruang Ujian)
  const filteredRows = useMemo(() => {
    return participants
      .filter((row) => {
        const isAktif = isParticipantStatusActive(row.status);
        if (appliedStatus === 'Non Aktif' && isAktif) {
          return false;
        }
        if (appliedStatus === 'Aktif' && !isAktif) {
          return false;
        }
        if (appliedKodeTes !== 'SEMUA' && row.kodeTes && row.kodeTes !== appliedKodeTes) {
          return false;
        }
        if (
          appliedKelompok !== 'SEMUA' &&
          resolveParticipantRuang(row) !== appliedKelompok
        ) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchUser = (row.username || '').toLowerCase().includes(q);
          const matchName = (row.namaPeserta || '').toLowerCase().includes(q);
          const matchRuang = resolveParticipantRuang(row).toLowerCase().includes(q);
          if (!matchUser && !matchName && !matchRuang) return false;
        }
        return true;
      })
      .sort((a, b) =>
        resolveParticipantRuang(a).localeCompare(resolveParticipantRuang(b), 'id', {
          numeric: true,
        })
      );
  }, [
    participants,
    appliedStatus,
    appliedKodeTes,
    appliedKelompok,
    searchQuery,
  ]);

  const [selectedParticipantIds, setSelectedParticipantIds] = useState<
    Set<string>
  >(() => new Set());

  const allVisibleSelected =
    filteredRows.length > 0 &&
    filteredRows.every((r) => selectedParticipantIds.has(r.id));

  const selectedVisibleCount = useMemo(
    () => participants.filter((r) => selectedParticipantIds.has(r.id)).length,
    [participants, selectedParticipantIds]
  );

  const handleApplyFilter = () => {
    setAppliedStatus(filterStatus);
    setAppliedKodeTes(filterKodeTes);
    setAppliedKelompok(filterKelompok);
    showNotice('Filter Ruang Ujian pada Kelompok Tes berhasil diterapkan.');
  };

  const handleMoveSelectedToRuang = (explicitRuang?: string) => {
    const selectedRows = participants.filter((r) =>
      selectedParticipantIds.has(r.id)
    );
    if (selectedRows.length === 0) {
      showNotice(
        'Klik tombol centang biru untuk memilih minimal satu siswa terlebih dahulu.'
      );
      return;
    }
    const destinationRuang =
      explicitRuang && explicitRuang !== 'SEMUA'
        ? explicitRuang
        : targetMoveRuang || 'Ruang 2';

    const selectedIdSet = new Set(selectedRows.map((r) => r.id));
    const nowTs = Date.now();
    setParticipants((prev) =>
      prev.map((r) =>
        selectedIdSet.has(r.id)
          ? {
              ...r,
              ruang: destinationRuang,
              kelompok: destinationRuang,
              selected: false,
              metaUpdatedAt: nowTs,
            }
          : r
      )
    );
    setSelectedParticipantIds((prev) => {
      const next = new Set(prev);
      selectedIdSet.forEach((id) => next.delete(id));
      return next;
    });
    showNotice(
      `${selectedRows.length} siswa berhasil dipindahkan ke ${destinationRuang} (juga diperbarui pada Kartu Login Peserta).`
    );
  };

  const handleToggleSelectAll = () => {
    const targetVal = !allVisibleSelected;
    setSelectedParticipantIds((prev) => {
      const next = new Set(prev);
      filteredRows.forEach((r) => {
        if (targetVal) {
          next.add(r.id);
        } else {
          next.delete(r.id);
        }
      });
      return next;
    });
  };

  const handleToggleRow = (id: string) => {
    setSelectedParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAssignSelected = () => {
    const visibleSelectedIds = new Set(
      filteredRows.filter((r) => selectedParticipantIds.has(r.id)).map((r) => r.id)
    );
    const selectedCount = visibleSelectedIds.size;
    if (selectedCount === 0) {
      showNotice('Pilih minimal satu peserta terlebih dahulu.');
      return;
    }
    const nowTs = Date.now();
    setParticipants((prev) =>
      prev.map((r) =>
        visibleSelectedIds.has(r.id)
          ? {
              ...r,
              status: 'Active',
              metaUpdatedAt: Math.max((r.metaUpdatedAt || 0) + 1, nowTs),
            }
          : r
      )
    );
    // Switch filter view to Semua Status or Aktif so user sees the updated status
    setFilterStatus('Semua Status');
    setAppliedStatus('Semua Status');
    showNotice(`${selectedCount} peserta berhasil di-Assign (Status: Active).`);
  };

  const handleUnassignSelected = () => {
    const visibleSelectedIds = new Set(
      filteredRows.filter((r) => selectedParticipantIds.has(r.id)).map((r) => r.id)
    );
    const selectedCount = visibleSelectedIds.size;
    if (selectedCount === 0) {
      showNotice('Pilih minimal satu peserta terlebih dahulu.');
      return;
    }
    const nowTs = Date.now();
    setParticipants((prev) =>
      prev.map((r) =>
        visibleSelectedIds.has(r.id)
          ? {
              ...r,
              status: 'Non Active',
              metaUpdatedAt: Math.max((r.metaUpdatedAt || 0) + 1, nowTs),
            }
          : r
      )
    );
    setFilterStatus('Semua Status');
    setAppliedStatus('Semua Status');
    showNotice(
      `${selectedCount} peserta berhasil di-Unassign (Status: Non Active).`
    );
  };

  const handleResetFiltersAndSelection = () => {
    setFilterStatus('Semua Status');
    setFilterKodeTes('SEMUA');
    setFilterKelompok('SEMUA');
    setAppliedStatus('Semua Status');
    setAppliedKodeTes('SEMUA');
    setAppliedKelompok('SEMUA');
    setSearchQuery('');
    showNotice('Data filter telah di-reset ke Semua Status dan Semua Kelompok.');
  };

  const handleResetParticipantLogin = (id: string, name: string, username?: string) => {
    const cleanUser = (username || '').trim().toUpperCase();
    const nowTs = Date.now();
    setParticipants((prev) =>
      prev.map((r) => {
        if (
          r.id !== id &&
          (!cleanUser || r.username.trim().toUpperCase() !== cleanUser)
        ) {
          return r;
        }
        const wasFinished = r.loginState === 'Selesai';
        return {
          ...r,
          loginState: 'Belum Login',
          requestReset: false,
          violationReason: undefined,
          violationAt: undefined,
          violationSchema: undefined,
          violationTimestamp: undefined,
          lastResetAt: nowTs,
          loginUpdatedAt: nowTs,
          ...(wasFinished
            ? {
                violationCount: 0,
                violationPackageId: undefined,
                draftAnswers: undefined,
                draftPackageId: undefined,
                draftRemainingSeconds: undefined,
                draftUpdatedAt: nowTs,
              }
            : {}),
        };
      })
    );
    showNotice(`Sesi login peserta ${name} berhasil di-reset. Siswa kini dapat login kembali.`);
  };

  const handleResetAllLockedParticipants = () => {
    const nowTs = Date.now();
    setParticipants((prev) =>
      prev.map((r) => {
        const needsReset =
          isParticipantLockedByViolation(r) ||
          Boolean(r.requestReset) ||
          r.loginState === 'Terkunci (Pelanggaran)';
        if (!needsReset) return r;
        return {
          ...r,
          loginState:
            r.loginState === 'Terkunci (Pelanggaran)' ? 'Belum Login' : r.loginState,
          requestReset: false,
          violationReason: undefined,
          violationAt: undefined,
          violationSchema: undefined,
          violationTimestamp: undefined,
          lastResetAt: nowTs,
          loginUpdatedAt:
            r.loginState === 'Terkunci (Pelanggaran)' ? nowTs : r.loginUpdatedAt,
        };
      })
    );
    showNotice('Seluruh permintaan Reset Login peserta telah dibersihkan.');
  };

  const handleResetAllViolations = () => {
    const hasAnyViolation = participants.some(
      (r) =>
        isParticipantLockedByViolation(r) ||
        Boolean(r.requestReset) ||
        r.loginState === 'Terkunci (Pelanggaran)' ||
        (typeof r.violationCount === 'number' && r.violationCount > 0) ||
        Boolean(r.violationReason || r.violationTimestamp)
    );
    if (!hasAnyViolation) {
      showNotice('Tidak ada catatan pelanggaran peserta yang perlu di-reset saat ini.');
      return;
    }
    const nowTs = Date.now();
    let resetCount = 0;
    setParticipants((prev) =>
      prev.map((r) => {
        const hasViolation =
          isParticipantLockedByViolation(r) ||
          Boolean(r.requestReset) ||
          r.loginState === 'Terkunci (Pelanggaran)' ||
          (typeof r.violationCount === 'number' && r.violationCount > 0) ||
          Boolean(r.violationReason || r.violationTimestamp);
        if (!hasViolation) return r;
        resetCount += 1;
        const wasLocked = r.loginState === 'Terkunci (Pelanggaran)';
        return {
          ...r,
          loginState: wasLocked ? 'Belum Login' : r.loginState,
          requestReset: false,
          violationReason: undefined,
          violationAt: undefined,
          violationSchema: undefined,
          violationTimestamp: undefined,
          violationCount: 0,
          violationPackageId: undefined,
          violationResetAt: nowTs,
          lastResetAt: wasLocked ? nowTs : r.lastResetAt,
          loginUpdatedAt: wasLocked ? nowTs : r.loginUpdatedAt,
        };
      })
    );
    showNotice(
      `Berhasil mereset pelanggaran untuk ${resetCount > 0 ? `${resetCount} peserta` : 'seluruh peserta'}. Hitungan pelanggaran kembali ke 0/6.`
    );
  };

  const displayPackages = useMemo(() => {
    let currentMapelList: any[] = [...DEFAULT_MAPEL_LIST];
    const deletedCodesSet = new Set<string>();
    const deletedNamesSet = new Set<string>();
    let isCustomMapelConfigured = false;
    try {
      let parsed: Record<string, any> | null =
        adminSettings && typeof adminSettings === 'object' ? adminSettings : null;
      if (!parsed) {
        const saved = localStorage.getItem('cbt_admin_settings');
        if (saved) {
          parsed = JSON.parse(saved);
        }
      }
      if (parsed && typeof parsed === 'object') {
          isCustomMapelConfigured = Boolean(parsed.customMapelConfigured);
          if (Array.isArray(parsed.deletedMapelCodes)) {
            parsed.deletedMapelCodes.forEach((c: any) => {
              if (typeof c === 'string' && c.trim()) {
                deletedCodesSet.add(c.trim().toUpperCase());
              }
            });
          }
          if (Array.isArray(parsed.deletedMapelNames)) {
            parsed.deletedMapelNames.forEach((n: any) => {
              if (typeof n === 'string' && n.trim()) {
                deletedNamesSet.add(n.trim().toLowerCase());
              }
            });
          }
          if (Array.isArray(parsed.mapelList)) {
            currentMapelList = parsed.mapelList
              .filter((m: any) => m && typeof m === 'object')
              .map((m: any) => ({
                ...m,
                tingkat: getTargetClassFromMapel(m),
              }))
              .filter((m: any) => {
                const mKode = String(m.kode || '').trim().toUpperCase();
                const mNama = String(m.nama || '').trim().toLowerCase();
                if (mKode && deletedCodesSet.has(mKode)) return false;
                if (mNama && deletedNamesSet.has(mNama)) return false;
                return true;
              });
            if (
              !isCustomMapelConfigured &&
              deletedCodesSet.size === 0 &&
              deletedNamesSet.size === 0 &&
              currentMapelList.length < 10
            ) {
              const existingCodes = new Set(
                currentMapelList.map((m: any) => (m.kode || '').trim().toUpperCase())
              );
              DEFAULT_MAPEL_LIST.forEach((defM: any) => {
                const defCode = (defM.kode || '').trim().toUpperCase();
                if (defCode && !existingCodes.has(defCode)) {
                  currentMapelList.push({
                    ...defM,
                    tingkat: getTargetClassFromMapel(defM),
                  });
                  existingCodes.add(defCode);
                }
              });
            }
          }
      }
    } catch {
      // fallback
    }

    const result: ExamPackage[] = [];
    const processedPkgIds = new Set<string>();

    currentMapelList.forEach((mapel: any) => {
      if (!mapel || typeof mapel !== 'object') return;
      const cleanKode = (mapel.kode || '').trim().toUpperCase();
      const cleanNama = (mapel.nama || '')
        .replace(/^Simulasi TKA\s*-\s*/i, '')
        .trim()
        .toLowerCase();
      if (cleanKode && deletedCodesSet.has(cleanKode)) return;
      if (cleanNama && deletedNamesSet.has(cleanNama)) return;

      const newPkgId = 'mapel_pkg_' + cleanKode.toLowerCase().replace(/[^a-z0-9]/g, '_');

      const targetClass = getTargetClassFromMapel(mapel);

      const existing = packages.find((p) => {
        if (!p || processedPkgIds.has(p.id)) return false;
        if (p.id === newPkgId) return true;
        const pCode = (p.code || '').trim().toUpperCase();
        const pTitle = (p.title || '')
          .replace(/^Simulasi TKA\s*-\s*/i, '')
          .trim()
          .toLowerCase();
        if (cleanKode.length > 0 && pCode === cleanKode) return true;
        if (
          cleanNama.length > 0 &&
          pTitle === cleanNama &&
          getPkgClass(p) === targetClass
        ) {
          return true;
        }
        return false;
      });

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
      if (!pkg || typeof pkg !== 'object') return;
      if (!processedPkgIds.has(pkg.id)) {
        const pCode = (pkg.code || '').trim().toUpperCase();
        const pTitle = (pkg.title || '')
          .replace(/^Simulasi TKA\s*-\s*/i, '')
          .trim()
          .toLowerCase();
        if (pCode && deletedCodesSet.has(pCode)) return;
        if (pTitle && deletedNamesSet.has(pTitle)) return;

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
  }, [packages, adminSettings]);

  const visiblePackagesForKelas = useMemo(() => {
    if (statusTesKelas === 'Semua Kelas') return displayPackages;
    return displayPackages.filter((p) => getPkgClass(p) === statusTesKelas);
  }, [displayPackages, statusTesKelas]);

  const fallbackEmptyPackage: ExamPackage = useMemo(
    () => ({
      id: 'pkg_empty_fallback',
      code: 'MAPEL-00',
      title: 'Belum Ada Mata Pelajaran',
      level: 'SMA / MA / SMK / Sederajat',
      subtest: 'Wajib Umum',
      durationMinutes: 90,
      targetClass: statusTesKelas !== 'Semua Kelas' ? statusTesKelas : 'Kelas X',
      questions: [],
    }),
    [statusTesKelas]
  );

  const selectedPackage: ExamPackage =
    visiblePackagesForKelas.find((p) => p.id === selectedPkgId) ||
    visiblePackagesForKelas[0] ||
    fallbackEmptyPackage;

  const [lastUploadedWordFile, setLastUploadedWordFile] = useState<string>('');

  const syncSelectedPackageQuestions = (nextQuestions: Question[]) => {
    if (!selectedPackage || selectedPackage.id === 'pkg_empty_fallback') return;
    const renumbered = nextQuestions.map((q, idx) => ({
      ...q,
      number: idx + 1,
    }));
    const preservedClass = getPkgClass(selectedPackage);
    const updatedSelectedPackage: ExamPackage = {
      ...selectedPackage,
      targetClass: preservedClass,
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
        const isExactMatch =
          !matched &&
          (pkg.id === selectedPackage.id ||
            (cleanSelectedKode.length > 0 && pCode === cleanSelectedKode) ||
            (cleanSelectedNama.length > 0 &&
              pTitle === cleanSelectedNama &&
              getPkgClass(pkg) === preservedClass));

        if (isExactMatch) {
          matched = true;
          nextList.push({
            ...updatedSelectedPackage,
            id: pkg.id,
            targetClass: preservedClass,
          });
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
      const isMobileDevice =
        window.innerWidth < 768 ||
        Boolean(window.matchMedia?.('(pointer: coarse)').matches) ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (!isMobileDevice) return;

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
        imageCount,
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
        tableCount > 0 ? `, ${tableCount} tabel soal` : '';
      const imageInfo =
        imageCount > 0 ? `, ${imageCount} gambar terbaca` : '';
      showNotice(
        `Berhasil mengunggah "${file.name}": ${importedQuestions.length} soal dikenali otomatis (${breakdownSummary}; ${redDetectedCount} kunci jawaban${tableInfo}${imageInfo}).`
      );
    } catch {
      showNotice(
        'Gagal membaca file soal. Pastikan file berformat .docx, .doc, .pdf, .xlsx, .xls, .csv, .txt, .rtf, atau .json yang valid.'
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

  const handleDeleteMapelPackage = (pkgToDelete: ExamPackage) => {
    const pkgTitle = pkgToDelete.title.replace(/^Simulasi TKA\s*-\s*/i, '').replace(/\s*\(SMA\/MA\/SMK\)/i, '');
    const cleanTargetKode = (pkgToDelete.code || '').trim().toUpperCase();
    const cleanTargetNama = (pkgToDelete.title || '')
      .replace(/^Simulasi TKA\s*-\s*/i, '')
      .trim()
      .toLowerCase();

    // 1. Hapus dari packages
    onUpdatePackages((prevPackages) => {
      const baseList = Array.isArray(prevPackages) ? prevPackages : packages;
      return baseList.filter((p) => {
        if (p.id === pkgToDelete.id) return false;
        const pCode = (p.code || '').trim().toUpperCase();
        const pTitle = (p.title || '')
          .replace(/^Simulasi TKA\s*-\s*/i, '')
          .trim()
          .toLowerCase();
        if (cleanTargetKode && pCode === cleanTargetKode) return false;
        if (cleanTargetNama && pTitle === cleanTargetNama) return false;
        return true;
      });
    });

    // 2. Hapus dari mapelList di cbt_admin_settings & sinkronkan
    try {
      const baseCfg =
        adminSettings && typeof adminSettings === 'object'
          ? { ...adminSettings }
          : (() => {
              const saved = localStorage.getItem('cbt_admin_settings');
              return saved ? JSON.parse(saved) : {};
            })();
      const baseMapelList = Array.isArray(baseCfg.mapelList)
        ? baseCfg.mapelList
        : DEFAULT_MAPEL_LIST;
      const updatedList = baseMapelList.filter((m: any) => {
        const mKode = (m?.kode || '').trim().toUpperCase();
        const mNama = (m?.nama || '')
          .replace(/^Simulasi TKA\s*-\s*/i, '')
          .trim()
          .toLowerCase();
        if (cleanTargetKode && mKode === cleanTargetKode) return false;
        if (cleanTargetNama && mNama === cleanTargetNama) return false;
        return true;
      });
      const nextDeletedCodes = Array.from(
        new Set([
          ...(Array.isArray(baseCfg.deletedMapelCodes)
            ? baseCfg.deletedMapelCodes
            : []),
          ...(cleanTargetKode ? [cleanTargetKode] : []),
        ])
      );
      const nextDeletedNames = Array.from(
        new Set([
          ...(Array.isArray(baseCfg.deletedMapelNames)
            ? baseCfg.deletedMapelNames
            : []),
          ...(cleanTargetNama ? [cleanTargetNama] : []),
        ])
      );
      const updatedCfg = {
        ...baseCfg,
        mapelList: updatedList,
        customMapelConfigured: true,
        deletedMapelCodes: nextDeletedCodes,
        deletedMapelNames: nextDeletedNames,
        updatedAt: Date.now(),
      };
      localStorage.setItem('cbt_admin_settings', JSON.stringify(updatedCfg));
      onUpdateAdminSettings?.(updatedCfg);
    } catch {
      // ignore
    }

    // 3. Update selectedPkgId jika yang dihapus sedang dipilih
    const remainingVisible = displayPackages.filter((p) => p.id !== pkgToDelete.id);
    if (selectedPkgId === pkgToDelete.id) {
      setSelectedPkgId(
        remainingVisible.length > 0 ? remainingVisible[0].id : 'pkg_empty_fallback'
      );
    }

    showNotice(`Mata pelajaran "${pkgTitle}" (${pkgToDelete.code}) berhasil dihapus.`);
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
              const currentProctorList =
                Array.isArray(proctors) && proctors.length > 0
                  ? proctors
                  : [
                      {
                        id: 'pr1',
                        proctorId: 'K05060108-KB6K',
                        fullName: 'DRS. H. AHMAD FAUZI, M.PD.',
                        roomName: 'LAB KOMPUTER 1 (UTAMA)',
                        rombel: 'Kelas X & XI IPA',
                        encryptionCode: 'GLDTKASMA',
                        password: 'SMADIP2026*',
                        status: 'Active' as const,
                      },
                    ];
              const cleanInput = (proctorName || '').trim().toUpperCase();
              const cleanEnc = (encryptionCode || '').trim().toUpperCase();

              const matched =
                currentProctorList.find(
                  (p) =>
                    (p.proctorId || '').toUpperCase() === cleanInput ||
                    (p.fullName || '').toUpperCase() === cleanInput
                ) ||
                currentProctorList.find(
                  (p) => (p.encryptionCode || '').toUpperCase() === cleanEnc
                );

              const displayFullName = matched
                ? matched.fullName
                : cleanInput && !cleanInput.startsWith('K05060108')
                  ? proctorName.trim().toUpperCase()
                  : currentProctorList[0]?.fullName || 'DRS. H. AHMAD FAUZI, M.PD.';
              const displayProctorId = matched
                ? matched.proctorId
                : cleanInput.startsWith('K05060108')
                  ? cleanInput
                  : currentProctorList[0]?.proctorId || 'K05060108-KB6K';

              return (
                <div className="flex items-center gap-3 text-right">
                  <div className="leading-tight">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-xs font-bold text-slate-800">
                        {displayFullName}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditProctorNameInput(displayFullName);
                          setShowEditProctorModal(true);
                        }}
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-[#0095ff] cursor-pointer transition-colors"
                        title="Ubah & Simpan Nama Proktor"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
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
                      onChange={(e) => {
                        const val = e.target.value;
                        setFilterStatus(val);
                        setAppliedStatus(val);
                      }}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm text-slate-700 bg-white border border-slate-200 rounded-lg shadow-2xs focus:outline-none focus:border-[#0095ff]"
                    >
                      <option value="Semua Status">Semua Status</option>
                      <option value="Aktif">Aktif</option>
                      <option value="Non Aktif">Non Aktif</option>
                    </select>
                  </div>

                  {/* 2. Kode Tes Dropdown */}
                  <div className="lg:col-span-3 space-y-1.5">
                    <label className="block text-xs font-medium text-slate-500">
                      Kode Tes
                    </label>
                    <select
                      value={filterKodeTes}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFilterKodeTes(val);
                        setAppliedKodeTes(val);
                      }}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm text-slate-700 bg-white border border-slate-200 rounded-lg shadow-2xs focus:outline-none focus:border-[#0095ff]"
                    >
                      <option value="SEMUA">Semua Kode Tes</option>
                      <option value="SAS26SMADIP1">SAS26SMADIP1</option>
                    </select>
                  </div>

                  {/* 3. Ruang Ujian Dropdown */}
                  <div className="lg:col-span-3 space-y-1.5">
                    <label className="block text-xs font-medium text-slate-500">
                      Ruang Ujian
                    </label>
                    <select
                      value={filterKelompok}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFilterKelompok(val);
                        setAppliedKelompok(val);
                        if (val !== 'SEMUA') {
                          setTargetMoveRuang(val);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm text-slate-700 bg-white border border-slate-200 rounded-lg shadow-2xs focus:outline-none focus:border-[#0095ff]"
                    >
                      <option value="SEMUA">Semua Ruang Ujian</option>
                      {availableExamRooms.map((room) => (
                        <option key={room} value={room}>
                          {room}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 4. Apply Button */}
                  <div className="lg:col-span-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleApplyFilter}
                      className="px-6 py-2.5 rounded-lg bg-[#0095ff] hover:bg-[#007acc] text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                {/* Tab Pengelompokan Siswa per Ruang Ujian */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterKelompok('SEMUA');
                      setAppliedKelompok('SEMUA');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      appliedKelompok === 'SEMUA'
                        ? 'bg-[#001a6e] text-white border-[#001a6e] shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Semua Ruang ({participants.length})
                  </button>
                  {availableExamRooms.map((room) => {
                    const countInRoom = participants.filter(
                      (p) => resolveParticipantRuang(p) === room
                    ).length;
                    const isSelectedRoom = appliedKelompok === room;
                    return (
                      <button
                        key={room}
                        type="button"
                        onClick={() => {
                          setFilterKelompok(room);
                          setAppliedKelompok(room);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelectedRoom
                            ? 'bg-[#0095ff] text-white border-[#0095ff] shadow-2xs'
                            : countInRoom > 0
                            ? 'bg-blue-50/70 text-[#001a6e] border-blue-200 hover:bg-blue-100/70'
                            : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>{room}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isSelectedRoom
                              ? 'bg-white/20 text-white'
                              : countInRoom > 0
                              ? 'bg-[#0095ff] text-white'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {countInRoom > 0 ? `${countInRoom} Siswa` : 'Kosong'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Table Card */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-100 overflow-hidden">
                {/* Search & Move Room / Unassign / Assign Toolbar */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Search Box & Selected Counter */}
                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="relative w-full sm:w-72">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search Username, Nama, atau Ruang..."
                        className="w-full pl-10 pr-4 py-2 text-xs text-slate-700 placeholder:text-slate-400 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#0095ff]"
                      />
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-[#0095ff] text-xs font-bold">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>{selectedVisibleCount} Siswa Terpilih</span>
                    </span>
                  </div>

                  {/* Action Buttons: Pindahkan Ruang Ujian | Unassign | Assign */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="inline-flex items-center gap-1.5 bg-blue-50/60 border border-blue-200 rounded-lg p-1">
                      <span className="text-[11px] font-bold text-[#001a6e] pl-2">
                        Pindahkan ke:
                      </span>
                      <select
                        value={targetMoveRuang}
                        onChange={(e) => setTargetMoveRuang(e.target.value)}
                        aria-label="Pilih Ruang Ujian Tujuan"
                        className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0095ff]"
                      >
                        {availableExamRooms.map((room) => (
                          <option key={room} value={room}>
                            {room}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleMoveSelectedToRuang(targetMoveRuang)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0095ff] hover:bg-[#007acc] text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Pindahkan Ruang</span>
                      </button>
                    </div>

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
                  </div>
                </div>

                {/* Participant Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f8f9fc] border-y border-slate-100 text-[12px] font-bold text-slate-600">
                        <th className="py-3.5 px-5 w-14">
                          <button
                            type="button"
                            onClick={handleToggleSelectAll}
                            aria-label="Pilih Semua Peserta"
                            title="Pilih / Batal Pilih Semua Siswa"
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                              allVisibleSelected
                                ? 'bg-[#0095ff] border-2 border-[#0095ff] text-white shadow-2xs ring-2 ring-blue-100'
                                : 'bg-blue-50/50 hover:bg-blue-100/80 border-2 border-[#0095ff]/60 text-[#0095ff]/40 hover:text-[#0095ff]'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
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
                            <span>Ruang Ujian</span>
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
                      {appliedKelompok !== 'SEMUA' ? (
                        filteredRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="py-12 text-center text-slate-500 space-y-2"
                            >
                              <div className="text-sm font-bold text-slate-700">
                                Tidak ada data
                              </div>
                              <p className="text-xs text-slate-500">
                                Belum ada peserta yang ditempatkan pada{' '}
                                <strong>{appliedKelompok}</strong>. Pilih siswa
                                dengan tombol centang biru lalu klik{' '}
                                <strong>Pindahkan Ruang</strong>.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setFilterStatus('Semua Status');
                                  setAppliedStatus('Semua Status');
                                  setFilterKodeTes('SEMUA');
                                  setAppliedKodeTes('SEMUA');
                                  setFilterKelompok('SEMUA');
                                  setAppliedKelompok('SEMUA');
                                  setSearchQuery('');
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#0095ff] text-xs font-semibold cursor-pointer"
                              >
                                Tampilkan Semua Ruang Ujian
                              </button>
                            </td>
                          </tr>
                        ) : (
                          filteredRows.map((row) => {
                            const isRowSelected = selectedParticipantIds.has(row.id);
                            return (
                            <tr
                              key={row.id}
                              onClick={() => handleToggleRow(row.id)}
                              className={`transition-colors cursor-pointer ${
                                isRowSelected
                                  ? 'bg-blue-50/35 hover:bg-blue-50/60'
                                  : 'hover:bg-slate-50/90'
                              }`}
                            >
                              <td
                                className="py-4 px-5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleRow(row.id)}
                                  aria-label={`Pilih ${row.namaPeserta}`}
                                  title={
                                    isRowSelected
                                      ? `Batal pilih ${row.namaPeserta}`
                                      : `Pilih ${row.namaPeserta}`
                                  }
                                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                                    isRowSelected
                                      ? 'bg-[#0095ff] border-2 border-[#0095ff] text-white shadow-2xs ring-2 ring-blue-100'
                                      : 'bg-blue-50/50 hover:bg-blue-100/80 border-2 border-[#0095ff]/60 text-[#0095ff]/35 hover:text-[#0095ff]'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </button>
                              </td>
                              <td className="py-4 px-4">
                                {isParticipantStatusActive(row.status) ? (
                                  <span className="inline-block min-w-[110px] text-center px-3 py-1 rounded-md bg-emerald-100 text-emerald-700 font-semibold text-[11.5px]">
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-block min-w-[110px] text-center px-3 py-1 rounded-md bg-[#ffe4e6] text-[#f43f5e] font-semibold text-[11.5px]">
                                    Non Active
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-4 font-medium text-slate-600">
                                {row.kodeTes}
                              </td>
                              <td className="py-4 px-4">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-[#001a6e] border border-blue-200 font-bold text-[11px]">
                                  {resolveParticipantRuang(row)}
                                </span>
                              </td>
                              <td className="py-4 px-4 font-mono text-slate-600">
                                {row.username}
                              </td>
                              <td className="py-4 px-4 font-medium text-slate-700">
                                {row.namaPeserta}
                              </td>
                            </tr>
                            );
                          })
                        )
                      ) : (
                        availableExamRooms.map((room) => {
                          const roomRows = filteredRows.filter(
                            (r) => resolveParticipantRuang(r) === room
                          );
                          return (
                            <React.Fragment key={room}>
                              <tr className="bg-slate-100/85 border-y border-slate-200">
                                <td
                                  colSpan={6}
                                  className="py-2.5 px-5 font-extrabold text-xs text-[#001a6e]"
                                >
                                  <div className="flex items-center justify-between">
                                    <span>KELOMPOK RUANG UJIAN: {room}</span>
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                        roomRows.length > 0
                                          ? 'bg-blue-100 text-[#001a6e]'
                                          : 'bg-slate-200 text-slate-600'
                                      }`}
                                    >
                                      {roomRows.length > 0
                                        ? `${roomRows.length} Peserta`
                                        : 'Tidak ada data (0 Peserta)'}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                              {roomRows.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={6}
                                    className="py-4 px-5 text-center text-slate-400 italic bg-slate-50/40"
                                  >
                                    Tidak ada data peserta pada {room}.
                                  </td>
                                </tr>
                              ) : (
                                roomRows.map((row) => {
                                  const isRowSelected = selectedParticipantIds.has(row.id);
                                  return (
                                  <tr
                                    key={row.id}
                                    onClick={() => handleToggleRow(row.id)}
                                    className={`transition-colors cursor-pointer ${
                                      isRowSelected
                                        ? 'bg-blue-50/35 hover:bg-blue-50/60'
                                        : 'hover:bg-slate-50/90'
                                    }`}
                                  >
                                    <td
                                      className="py-4 px-5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => handleToggleRow(row.id)}
                                        aria-label={`Pilih ${row.namaPeserta}`}
                                        title={
                                          isRowSelected
                                            ? `Batal pilih ${row.namaPeserta}`
                                            : `Pilih ${row.namaPeserta}`
                                        }
                                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                                          isRowSelected
                                            ? 'bg-[#0095ff] border-2 border-[#0095ff] text-white shadow-2xs ring-2 ring-blue-100'
                                            : 'bg-blue-50/50 hover:bg-blue-100/80 border-2 border-[#0095ff]/60 text-[#0095ff]/35 hover:text-[#0095ff]'
                                        }`}
                                      >
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      </button>
                                    </td>
                                    <td className="py-4 px-4">
                                      {isParticipantStatusActive(row.status) ? (
                                        <span className="inline-block min-w-[110px] text-center px-3 py-1 rounded-md bg-emerald-100 text-emerald-700 font-semibold text-[11.5px]">
                                          Active
                                        </span>
                                      ) : (
                                        <span className="inline-block min-w-[110px] text-center px-3 py-1 rounded-md bg-[#ffe4e6] text-[#f43f5e] font-semibold text-[11.5px]">
                                          Non Active
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-4 px-4 font-medium text-slate-600">
                                      {row.kodeTes}
                                    </td>
                                    <td className="py-4 px-4">
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-[#001a6e] border border-blue-200 font-bold text-[11px]">
                                        {resolveParticipantRuang(row)}
                                      </span>
                                    </td>
                                    <td className="py-4 px-4 font-mono text-slate-600">
                                      {row.username}
                                    </td>
                                    <td className="py-4 px-4 font-medium text-slate-700">
                                      {row.namaPeserta}
                                    </td>
                                  </tr>
                                  );
                                })
                              )}
                            </React.Fragment>
                          );
                        })
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
                  Selamat datang di Dashboard Proktor Aplikasi Sumatif Akhir Semester. Kartu <strong>Token Ujian Aktif</strong> kini berada di menu <strong>Beranda</strong> ini dan diperbarui otomatis setiap {tokenIntervalMinutes} menit dari server Administrator. Gunakan menu <strong>Kelompok Tes</strong> untuk mengaktifkan (Assign) peserta ujian, menu <strong>Status Tes</strong> untuk mengelola Bank Soal, dan menu <strong>Laporan Pengolahan</strong> untuk memantau nilai akhir peserta.
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
                                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start justify-between gap-2 group ${
                                    isSelected
                                      ? 'bg-blue-50/90 border-[#0095ff] ring-1 ring-[#0095ff]/30 shadow-xs'
                                      : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/60'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
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
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteMapelPackage(pkg);
                                    }}
                                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer shrink-0"
                                    title={`Hapus mata pelajaran ${cleanTitle}`}
                                    aria-label={`Hapus mata pelajaran ${cleanTitle}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
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
                      accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.rtf,.json,.html,.htm"
                      onChange={handleUploadWordQuestions}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={triggerUploadWordFile}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-2xs transition-colors"
                      title="Upload file soal (.pdf, .docx, .doc, .xlsx, .xls, .csv, .txt, .rtf, .json) — otomatis mengenali semua jenis/tipe soal"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Word / PDF / File Soal (Otomatis Kenali Tipe Soal)
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
                    <button
                      type="button"
                      onClick={() => {
                        downloadWordQuestionArchive(selectedPackage, 'Semua Tipe Soal');
                        showNotice(`Arsip soal mata pelajaran ${selectedPackage.title} berhasil diunduh (.docx).`);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-2xs transition-colors"
                      title="Unduh seluruh butir soal mata pelajaran ini beserta kunci jawaban ke format Word (.docx) sebagai cadangan/arsip"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Arsip Soal</span>
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
                      <strong>Format Upload Word (.docx / .doc), PDF (.pdf) & Tabel:</strong> Beri{' '}
                      <span className="font-bold text-rose-600 underline">
                        warna merah
                      </span>{' '}
                      pada tulisan opsi jawaban yang benar atau sertakan ringkasan kunci jawaban di dalam file Word/PDF (otomatis membaca <strong>gambar soal/opsi/stimulus</strong> dari Word .docx & PDF, tabel, Stimulus/Wacana, PG Kompleks, Benar/Salah, serta Menjodohkan). Jika sudah Upload File Soal, kolom Pertanyaan Soal dan Jawaban di bawah <strong>tidak harus diisi</strong>.
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
                        {displayPackages.length === 0 && (
                          <option value="pkg_empty_fallback">
                            Belum Ada Mata Pelajaran Terdaftar
                          </option>
                        )}
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

                    <button
                      type="button"
                      onClick={() => {
                        downloadWordQuestionArchive(selectedPackage, statusTesTipeSoal);
                        showNotice(`Arsip soal (${statusTesTipeSoal}) mata pelajaran ${selectedPackage.title} berhasil diunduh (.docx).`);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 hover:border-emerald-600 text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs"
                      title="Unduh butir soal yang sedang ditampilkan ke dalam dokumen Word (.docx) untuk arsip bank soal"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Arsip Soal</span>
                    </button>

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
                    {(activeMenu === 'daftar_peserta' ||
                      activeMenu === 'status_peserta') && (() => {
                      const violationTotalCount = participants.filter(
                        (p) =>
                          isParticipantLockedByViolation(p) ||
                          Boolean(p.requestReset) ||
                          p.loginState === 'Terkunci (Pelanggaran)' ||
                          (typeof p.violationCount === 'number' && p.violationCount > 0)
                      ).length;
                      return (
                        <button
                          type="button"
                          onClick={handleResetAllViolations}
                          className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          title="Reset seluruh catatan dan hitungan pelanggaran (kembali ke 0/6)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>
                            Reset Pelanggaran
                            {violationTotalCount > 0 ? ` (${violationTotalCount})` : ''}
                          </span>
                        </button>
                      );
                    })()}
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
                        <th className="py-3.5 px-4">Ruang Ujian</th>
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
                                colSpan={7}
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
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-blue-50 text-[#001a6e] border border-blue-200 font-bold text-[11px]">
                                {resolveParticipantRuang(p)}
                              </span>
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
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-100 text-rose-700 font-bold text-[11px]">
                                      Terkunci (Pelanggaran Keluar CBT)
                                    </span>
                                    {typeof p.violationCount === 'number' &&
                                      p.violationCount > 0 && (
                                        <span
                                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-extrabold ${
                                            p.violationCount >= 6
                                              ? 'bg-rose-600 text-white'
                                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                                          }`}
                                        >
                                          Pelanggaran {p.violationCount}/6
                                          {p.violationCount >= 6
                                            ? ' (Jawaban Dihapus)'
                                            : ''}
                                        </span>
                                      )}
                                  </div>
                                  {p.violationReason && (
                                    <div className="text-[11px] text-rose-600">
                                      {p.violationReason}
                                      {p.violationAt ? ` (${p.violationAt})` : ''}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>{p.loginState}</span>
                                  {typeof p.violationCount === 'number' &&
                                    p.violationCount > 0 && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                        Pelanggaran {p.violationCount}/6
                                      </span>
                                    )}
                                </div>
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
                              <tr key={r.id || idx} className="hover:bg-slate-50/80">
                                <td className="py-3 px-4 font-mono text-slate-500">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                                  {r?.participant?.username || '-'}
                                </td>
                                <td className="py-3 px-4 font-semibold text-slate-800">
                                  {r?.participant?.fullName || '-'}
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

      {/* Modal Ubah & Simpan Nama Proktor */}
      {showEditProctorModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#0095ff] flex items-center justify-center shrink-0">
                <Edit className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Ubah & Simpan Nama Proktor
                </h3>
                <p className="text-[11px] text-slate-500">
                  Nama proktor akan tersimpan di sistem dan ditampilkan pada sesi login & laporan.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const clean = editProctorNameInput.trim().toUpperCase();
                if (!clean) return;
                onUpdateProctorName?.(clean);
                if (onUpdateProctors) {
                  onUpdateProctors((prev) => {
                    if (prev.length === 0) return prev;
                    return prev.map((pr, idx) =>
                      idx === 0 || pr.proctorId === (proctorName || '').trim().toUpperCase()
                        ? { ...pr, fullName: clean }
                        : pr
                    );
                  });
                }
                setShowEditProctorModal(false);
                showNotice(`Nama Proktor berhasil diubah dan disimpan: ${clean}`);
              }}
              className="p-6 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Nama Lengkap Proktor Beserta Gelar *
                </label>
                <input
                  type="text"
                  required
                  value={editProctorNameInput}
                  onChange={(e) => setEditProctorNameInput(e.target.value)}
                  placeholder="Contoh: DRS. H. AHMAD FAUZI, M.PD."
                  className="w-full px-3.5 py-2.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#0095ff] shadow-2xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowEditProctorModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#0095ff] hover:bg-[#007acc] rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Simpan Nama Proktor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
