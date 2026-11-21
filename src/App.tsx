/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PusmendikHeader } from './components/PusmendikHeader';
import { LoginView, ViolationAlertInfo } from './components/LoginView';
import {
  ParticipantConfirmationView,
  TestConfirmationView,
  resolvePackageForSchedule,
  cleanMapelTitle,
} from './components/ConfirmationViews';
import { ExamRunnerView } from './components/ExamRunnerView';
import { ExamResultView } from './components/ExamResultView';
import { ProctorLoginView } from './components/ProctorLoginView';
import {
  ProctorDashboardView,
  ProctorParticipantRow,
  doesKelasMatch,
  getParticipantNameKelasKey,
  isDefaultDemoParticipantRow,
  isDefaultDemoParticipantsList,
  isParticipantLockedByViolation,
  isParticipantStatusActive,
  mergeParticipantLists,
  normalizeKelasCode,
  sanitizeParticipantRows,
  shortenStudentUsername,
} from './components/ProctorDashboardView';
import {
  AdminLoginView,
  AdminDashboardView,
  AdminProctorItem,
  INITIAL_ADMIN_SCHEDULES,
  INITIAL_ADMIN_PARTICIPANTS,
  INITIAL_ADMIN_PROCTORS,
} from './components/AdminViews';
import {
  DEFAULT_EXAM_TOKEN,
  INITIAL_EXAM_PACKAGES,
  evaluateQuestionScore,
  isQuestionAnswered,
} from './data/cbtData';
import {
  AdminScheduleItem,
  ExamPackage,
  ExamResultSummary,
  ParticipantProfile,
  StudentAnswer,
} from './types/cbt';
import {
  clearAuthSessionToken,
  fetchVercelStorage,
  getAuthSessionRole,
  requestResetFromServer,
  saveVercelStorage,
  submitExamToServer,
} from './utils/vercelStorage';
import { Power } from 'lucide-react';

type AppStage =
  | 'login'
  | 'proctor_login'
  | 'proctor_dashboard'
  | 'admin_login'
  | 'admin_dashboard'
  | 'confirm_participant'
  | 'confirm_test'
  | 'exam_running'
  | 'exam_result';

const STORAGE_KEYS = {
  PACKAGES: 'pusmendik_cbt_packages_v1',
  PACKAGES_BACKUP: 'pusmendik_cbt_packages_backup_v1',
  SCHEDULES: 'pusmendik_cbt_schedules_v1',
  SCHEDULES_BACKUP: 'pusmendik_cbt_schedules_backup_v1',
  DELETED_SCHEDULES: 'pusmendik_cbt_deleted_schedules_v1',
  PARTICIPANTS: 'pusmendik_cbt_participants_v1',
  PARTICIPANTS_BACKUP: 'pusmendik_cbt_participants_backup_v1',
  DELETED_PARTICIPANTS: 'pusmendik_cbt_deleted_participants_v1',
  PROCTORS: 'pusmendik_cbt_proctors_v1',
  TOKEN: 'pusmendik_cbt_token_v1',
  TOKEN_UPDATED_AT: 'pusmendik_cbt_token_updated_at_v1',
  HISTORY: 'pusmendik_cbt_history_v1',
  DRAFTS: 'pusmendik_cbt_student_drafts_v1',
  PENDING_RESULTS: 'pusmendik_cbt_pending_results_v1',
};

interface PendingExamSubmission {
  localResultId: string;
  packageId: string;
  packageTitle: string;
  answers: Record<string, StudentAnswer>;
  timeUsedSeconds: number;
  participant: ParticipantProfile;
  clientFallbackSummary: ExamResultSummary;
  queuedAt: number;
}

function readPendingExamSubmissions(): PendingExamSubmission[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_RESULTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingExamSubmissions(items: PendingExamSubmission[]): void {
  try {
    if (items.length === 0) {
      localStorage.removeItem(STORAGE_KEYS.PENDING_RESULTS);
    } else {
      localStorage.setItem(STORAGE_KEYS.PENDING_RESULTS, JSON.stringify(items));
    }
  } catch {
    // ignore storage quota errors
  }
}

function enqueuePendingExamSubmission(item: PendingExamSubmission): void {
  const existing = readPendingExamSubmissions().filter(
    (x) => x.localResultId !== item.localResultId
  );
  existing.push(item);
  writePendingExamSubmissions(existing);
}

function removePendingExamSubmission(localResultId: string): void {
  const remaining = readPendingExamSubmissions().filter(
    (x) => x.localResultId !== localResultId
  );
  writePendingExamSubmissions(remaining);
}

const DEFAULT_DEMO_SCHEDULE_IDS = new Set([
  'sch1',
  'sch2',
  'sch3',
  'sch4',
  'sch5',
  'sch_1',
  'sch_2',
  'sch_3',
  'sch_4',
  'sch_5',
  's1',
  's2',
  's3',
  's4',
  's5',
]);

function readLocalDeletedSet(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(
        parsed.map((id) => String(id || '').trim()).filter(Boolean)
      );
    }
  } catch {
    // ignore
  }
  return new Set();
}

function addLocalDeletedIds(storageKey: string, ids: Iterable<string>): string[] {
  const set = readLocalDeletedSet(storageKey);
  for (const id of ids) {
    const clean = String(id || '').trim();
    if (clean) set.add(clean);
  }
  const arr = Array.from(set);
  try {
    localStorage.setItem(storageKey, JSON.stringify(arr));
  } catch {
    // ignore
  }
  return arr;
}

function isDefaultInactiveSchedulesList(
  rows?: AdminScheduleItem[] | null
): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return true;
  const hasAnyActive = rows.some((s) => Boolean(s && s.isActive));
  if (hasAnyActive) return false;
  if (rows.length > 5) return false;
  return rows.every((s) =>
    DEFAULT_DEMO_SCHEDULE_IDS.has(String(s?.id || '').trim())
  );
}

function mergeSchedulesByTimestamp(
  remoteList: AdminScheduleItem[],
  localList: AdminScheduleItem[],
  deletedIdsInput?: Iterable<string>
): AdminScheduleItem[] {
  const deletedSet = readLocalDeletedSet(STORAGE_KEYS.DELETED_SCHEDULES);
  if (deletedIdsInput) {
    for (const id of deletedIdsInput) {
      const clean = String(id || '').trim();
      if (clean) deletedSet.add(clean);
    }
  }

  const localById = new Map<string, AdminScheduleItem>();
  for (const lSch of localList) {
    if (!lSch || typeof lSch !== 'object') continue;
    const id = String(lSch.id || '').trim();
    if (id && !deletedSet.has(id)) {
      localById.set(id, lSch);
    }
  }

  const matchedIds = new Set<string>();
  const merged = remoteList
    .filter((rSch) => {
      if (!rSch || typeof rSch !== 'object') return false;
      const id = String(rSch.id || '').trim();
      return !id || !deletedSet.has(id);
    })
    .map((rSch) => {
      const id = String(rSch.id || '').trim();
      const lSch = id ? localById.get(id) : undefined;
      if (!lSch) return rSch;
      matchedIds.add(id);

      const rTs = typeof rSch.updatedAt === 'number' ? rSch.updatedAt : 0;
      const lTs = typeof lSch.updatedAt === 'number' ? lSch.updatedAt : 0;

      if (rTs > 0 || lTs > 0) {
        return lTs > rTs ? lSch : rSch;
      }

      // If neither has a timestamp yet, preserve active state if either is active
      if (lSch.isActive && !rSch.isActive) {
        return { ...rSch, isActive: true };
      }
      return rSch;
    });

  // Preserve custom local schedules (not default demo IDs and not deleted) missing from remote
  for (const lSch of localList) {
    if (!lSch || typeof lSch !== 'object') continue;
    const id = String(lSch.id || '').trim();
    if (!id || deletedSet.has(id) || matchedIds.has(id)) continue;
    if (!DEFAULT_DEMO_SCHEDULE_IDS.has(id)) {
      merged.push(lSch);
    }
  }

  return merged;
}

function getRealQuestionsCount(pkg?: ExamPackage | null): number {
  if (!pkg || !Array.isArray(pkg.questions)) return 0;
  return pkg.questions.filter(
    (q) => !String(q?.id || '').startsWith('q_default_')
  ).length;
}

function getTotalUploadedQuestionsCount(pkgs?: ExamPackage[] | null): number {
  if (!Array.isArray(pkgs)) return 0;
  return pkgs.reduce((acc, pkg) => acc + getRealQuestionsCount(pkg), 0);
}

function hasAnyUploadedQuestions(pkgs?: ExamPackage[] | null): boolean {
  return getTotalUploadedQuestionsCount(pkgs) > 0;
}

function getPkgMatchKey(pkg: ExamPackage): string {
  const title = String(pkg.title || '')
    .replace(/^Simulasi TKA\s*-\s*/i, '')
    .trim()
    .toLowerCase();
  const cls = normalizeKelasCode(pkg.targetClass || '');
  return `${title}__${cls}`;
}

function readLocalDeletedMapelSets(): {
  deletedCodes: Set<string>;
  deletedNames: Set<string>;
  isCustomMapelConfigured: boolean;
} {
  const deletedCodes = new Set<string>();
  const deletedNames = new Set<string>();
  let isCustomMapelConfigured = false;
  try {
    const rawSettings = localStorage.getItem('cbt_admin_settings');
    if (rawSettings) {
      const parsedSettings = JSON.parse(rawSettings);
      if (parsedSettings && typeof parsedSettings === 'object') {
        if (parsedSettings.customMapelConfigured) {
          isCustomMapelConfigured = true;
        }
        if (Array.isArray(parsedSettings.deletedMapelCodes)) {
          parsedSettings.deletedMapelCodes.forEach((c: any) => {
            if (typeof c === 'string' && c.trim()) {
              deletedCodes.add(c.trim().toUpperCase());
            }
          });
        }
        if (Array.isArray(parsedSettings.deletedMapelNames)) {
          parsedSettings.deletedMapelNames.forEach((n: any) => {
            if (typeof n === 'string' && n.trim()) {
              deletedNames.add(n.trim().toLowerCase());
            }
          });
        }
      }
    }
  } catch {
    // ignore
  }
  return { deletedCodes, deletedNames, isCustomMapelConfigured };
}

function mergePackagesPreservingQuestions(
  incomingList: ExamPackage[],
  localList: ExamPackage[]
): ExamPackage[] {
  const { deletedCodes, deletedNames } = readLocalDeletedMapelSets();

  const localById = new Map<string, ExamPackage>();
  const localByCode = new Map<string, ExamPackage>();
  const localByTitleClass = new Map<string, ExamPackage>();

  for (const lPkg of localList) {
    if (!lPkg || typeof lPkg !== 'object') continue;
    const id = String(lPkg.id || '').trim();
    const code = String(lPkg.code || '')
      .trim()
      .toUpperCase();
    const tk = getPkgMatchKey(lPkg);
    if (id) localById.set(id, lPkg);
    if (code) localByCode.set(code, lPkg);
    if (tk) localByTitleClass.set(tk, lPkg);
  }

  const matchedLocalIds = new Set<string>();

  const merged = incomingList
    .filter((pkg) => {
      if (!pkg || typeof pkg !== 'object') return false;
      const pCode = String(pkg.code || '')
        .trim()
        .toUpperCase();
      const pTitle = String(pkg.title || '')
        .replace(/^Simulasi TKA\s*-\s*/i, '')
        .trim()
        .toLowerCase();
      if (pCode && deletedCodes.has(pCode)) return false;
      if (pTitle && deletedNames.has(pTitle)) return false;
      return true;
    })
    .map((pkg) => {
      const id = String(pkg.id || '').trim();
      const code = String(pkg.code || '')
        .trim()
        .toUpperCase();
      const tk = getPkgMatchKey(pkg);

      const localMatch =
        (id ? localById.get(id) : undefined) ||
        (code ? localByCode.get(code) : undefined) ||
        (tk ? localByTitleClass.get(tk) : undefined);

      if (localMatch) {
        if (localMatch.id) matchedLocalIds.add(localMatch.id);
        const incQCount = getRealQuestionsCount(pkg);
        const localQCount = getRealQuestionsCount(localMatch);
        // Never overwrite local uploaded questions with an empty/smaller remote question list
        if (localQCount > 0 && incQCount < localQCount) {
          return {
            ...pkg,
            questions: localMatch.questions.filter(
              (q) => !String(q?.id || '').startsWith('q_default_')
            ),
          };
        }
      }
      return pkg;
    });

  // Also preserve any local packages that have uploaded questions (or custom mapel) missing from incomingList
  for (const lPkg of localList) {
    if (!lPkg || typeof lPkg !== 'object') continue;
    const lCode = String(lPkg.code || '')
      .trim()
      .toUpperCase();
    const lTitle = String(lPkg.title || '')
      .replace(/^Simulasi TKA\s*-\s*/i, '')
      .trim()
      .toLowerCase();
    if (lCode && deletedCodes.has(lCode)) continue;
    if (lTitle && deletedNames.has(lTitle)) continue;
    if (lPkg.id && matchedLocalIds.has(lPkg.id)) continue;

    const tk = getPkgMatchKey(lPkg);
    const alreadyExists = merged.some((m) => {
      const mCode = String(m.code || '')
        .trim()
        .toUpperCase();
      return (lCode && mCode === lCode) || (tk && getPkgMatchKey(m) === tk);
    });
    if (!alreadyExists && getRealQuestionsCount(lPkg) > 0) {
      merged.push(lPkg);
    }
  }

  return merged;
}

const MAX_VIOLATION_LIMIT = 6;

const FALLBACK_EMPTY_PACKAGE: ExamPackage = {
  id: 'pkg_empty_fallback',
  code: 'MAPEL-00',
  title: 'Belum Ada Mata Pelajaran',
  level: 'SMA / MA / SMK / Sederajat',
  subtest: 'Wajib Umum',
  durationMinutes: 90,
  targetClass: 'Kelas X',
  questions: [],
};

interface StudentExamDraft {
  username: string;
  packageId: string;
  answers: Record<string, StudentAnswer>;
  remainingSeconds?: number;
  violationCount: number;
  updatedAt: number;
}

function getDraftKey(username: string, packageId: string): string {
  return `${username.trim().toUpperCase()}__${packageId.trim()}`;
}

function readAllStudentDrafts(): Record<string, StudentExamDraft> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DRAFTS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readStudentDraftFromLocal(
  username: string,
  packageId: string
): StudentExamDraft | null {
  if (!username || !packageId) return null;
  const all = readAllStudentDrafts();
  return all[getDraftKey(username, packageId)] || null;
}

function writeStudentDraftToLocal(draft: StudentExamDraft): void {
  if (!draft.username || !draft.packageId) return;
  try {
    const all = readAllStudentDrafts();
    all[getDraftKey(draft.username, draft.packageId)] = draft;
    localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(all));
  } catch {
    // ignore
  }
}

function clearStudentDraftInLocal(username: string, packageId: string): void {
  if (!username || !packageId) return;
  try {
    const all = readAllStudentDrafts();
    delete all[getDraftKey(username, packageId)];
    localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(all));
  } catch {
    // ignore
  }
}

function loadNormalizedAdminSettings(): Record<string, any> {
  const defaults: Record<string, any> = {
    tokenIntervalMenit: 10,
    enforceMinFinishTime: false,
    acakSoal: true,
    acakOpsi: true,
    wajibFullscreen: true,
    kunciKeluarSistem: true,
    tampilkanNilaiPeserta: false,
    minMinutesBeforeFinish: 45,
    pesanPelanggaran:
      'Anda terdeteksi keluar dari layar CBT! Harap lapor ke Proktor / Pengawas untuk reset login.',
    updatedAt: 0,
  };
  try {
    const raw = localStorage.getItem('cbt_admin_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const normalized = { ...defaults, ...parsed };
        if (!parsed.updatedAt && parsed.tokenIntervalMenit === 15) {
          normalized.tokenIntervalMenit = 10;
        }
        return normalized;
      }
    }
  } catch {
    // ignore
  }
  return defaults;
}

export default function App() {
  const [stage, setStage] = useState<AppStage>('login');
  const stageRef = useRef<AppStage>(stage);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);
  const [isAuthSpinning, setIsAuthSpinning] = useState<boolean>(false);
  const authSpinTimerRef = useRef<number | null>(null);
  const [proctorSession, setProctorSession] = useState<{
    name: string;
    encryptionCode: string;
  }>(() => {
    try {
      const saved = localStorage.getItem('cbt_proctor_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.name === 'string' && parsed.name.trim()) {
          return {
            name: parsed.name.trim().toUpperCase(),
            encryptionCode: (parsed.encryptionCode || 'GLDTKASMA').trim().toUpperCase(),
          };
        }
      }
    } catch {
      // ignore
    }
    return {
      name: 'DRS. H. AHMAD FAUZI, M.PD.',
      encryptionCode: 'GLDTKASMA',
    };
  });
  const [adminUsername, setAdminUsername] = useState<string>('ADMIN_SMADIP');

  useEffect(() => {
    return () => {
      if (authSpinTimerRef.current) {
        window.clearTimeout(authSpinTimerRef.current);
      }
    };
  }, []);

  const [schedules, setSchedules] = useState<AdminScheduleItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!isDefaultInactiveSchedulesList(parsed)) {
            return parsed;
          }
          // Check backup if primary schedule list is all-inactive default
          const backupRaw = localStorage.getItem(STORAGE_KEYS.SCHEDULES_BACKUP);
          if (backupRaw) {
            const backupParsed = JSON.parse(backupRaw);
            if (
              Array.isArray(backupParsed) &&
              backupParsed.length > 0 &&
              !isDefaultInactiveSchedulesList(backupParsed)
            ) {
              return backupParsed;
            }
          }
          return parsed;
        }
      }
      const backupRaw = localStorage.getItem(STORAGE_KEYS.SCHEDULES_BACKUP);
      if (backupRaw) {
        const backupParsed = JSON.parse(backupRaw);
        if (Array.isArray(backupParsed) && backupParsed.length > 0) {
          return backupParsed;
        }
      }
    } catch {
      // Fallback to initial schedules
    }
    return INITIAL_ADMIN_SCHEDULES;
  });

  const [participants, setParticipants] = useState<ProctorParticipantRow[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = sanitizeParticipantRows(parsed);
          if (!isDefaultDemoParticipantsList(sanitized)) {
            return sanitized;
          }
          // If primary storage only has the 8 demo students, check automatic backup of real uploaded students
          const backupRaw = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS_BACKUP);
          if (backupRaw) {
            const backupParsed = JSON.parse(backupRaw);
            if (
              Array.isArray(backupParsed) &&
              backupParsed.length > 0 &&
              !isDefaultDemoParticipantsList(backupParsed)
            ) {
              return sanitizeParticipantRows(backupParsed);
            }
          }
          return sanitized;
        }
      }
      const backupRaw = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS_BACKUP);
      if (backupRaw) {
        const backupParsed = JSON.parse(backupRaw);
        if (Array.isArray(backupParsed) && backupParsed.length > 0) {
          return sanitizeParticipantRows(backupParsed);
        }
      }
    } catch {
      // Fallback to initial participants
    }
    return sanitizeParticipantRows(INITIAL_ADMIN_PARTICIPANTS);
  });

  const [proctors, setProctors] = useState<AdminProctorItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROCTORS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to initial proctors
    }
    return INITIAL_ADMIN_PROCTORS;
  });

  const activeSchedules = schedules.filter((s) => s.isActive);
  const isScheduleActive = activeSchedules.length > 0;

  const filterOutSimulasiTka = useCallback((list: ExamPackage[]): ExamPackage[] => {
    if (!Array.isArray(list)) return [];
    return list
      .filter((pkg) => pkg && typeof pkg === 'object')
      .map((pkg) => ({
        ...pkg,
        title: String(pkg.title || '').replace(/^Simulasi TKA\s*-\s*/i, ''),
        questions: Array.isArray(pkg.questions)
          ? pkg.questions.filter(
              (q) => !String(q?.id || '').startsWith('q_default_')
            )
          : [],
      }));
  }, []);

  const [packages, setPackages] = useState<ExamPackage[]>(() => {
    try {
      const { deletedCodes, deletedNames, isCustomMapelConfigured } =
        readLocalDeletedMapelSets();

      let backupList: ExamPackage[] = [];
      try {
        const backupRaw = localStorage.getItem(STORAGE_KEYS.PACKAGES_BACKUP);
        if (backupRaw) {
          const parsedBackup = JSON.parse(backupRaw);
          if (Array.isArray(parsedBackup)) {
            backupList = parsedBackup.filter(
              (pkg: ExamPackage) => pkg && typeof pkg === 'object'
            );
          }
        }
      } catch {
        // ignore backup parse error
      }

      const saved = localStorage.getItem(STORAGE_KEYS.PACKAGES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          let list = parsed
            .filter((pkg: ExamPackage) => pkg && typeof pkg === 'object')
            .map((pkg: ExamPackage) => ({
              ...pkg,
              title: String(pkg.title || '').replace(/^Simulasi TKA\s*-\s*/i, ''),
              questions: Array.isArray(pkg.questions)
                ? pkg.questions.filter(
                    (q) => !String(q?.id || '').startsWith('q_default_')
                  )
                : [],
            }))
            .filter((pkg: ExamPackage) => {
              const pCode = (pkg.code || '').trim().toUpperCase();
              const pTitle = (pkg.title || '').trim().toLowerCase();
              if (pCode && deletedCodes.has(pCode)) return false;
              if (pTitle && deletedNames.has(pTitle)) return false;
              return true;
            });

          // Restore any uploaded questions from PACKAGES_BACKUP if primary was overwritten with 0 questions
          if (backupList.length > 0) {
            list = mergePackagesPreservingQuestions(list, backupList);
          }

          if (isCustomMapelConfigured || deletedCodes.size > 0 || deletedNames.size > 0) {
            return list;
          }

          if (list.length > 0) {
            // Jika belum pernah dikustomisasi dan jumlah paket kurang dari 10 (migrasi versi lama),
            // lengkapi dengan paket standar yang belum ada
            if (list.length < 10) {
              const existingCodes = new Set(
                list.map((p) => (p.code || '').trim().toUpperCase())
              );
              INITIAL_EXAM_PACKAGES.forEach((initPkg) => {
                const initCode = (initPkg.code || '').trim().toUpperCase();
                if (initCode && !existingCodes.has(initCode)) {
                  list.push(initPkg);
                  existingCodes.add(initCode);
                }
              });
            }
            return list;
          }
        }
      }
      if (backupList.length > 0) {
        return mergePackagesPreservingQuestions(
          INITIAL_EXAM_PACKAGES,
          backupList
        );
      }
    } catch {
      // Fallback to initial packages
    }
    return INITIAL_EXAM_PACKAGES;
  });

  const [adminSettings, setAdminSettings] = useState<Record<string, any>>(
    loadNormalizedAdminSettings
  );
  const adminSettingsRef = useRef<Record<string, any>>(adminSettings);
  useEffect(() => {
    adminSettingsRef.current = adminSettings;
  }, [adminSettings]);

  const tokenIntervalMins = Math.min(
    60,
    Math.max(5, Number(adminSettings.tokenIntervalMenit) || 10)
  );
  const TOKEN_DURATION_SECONDS = tokenIntervalMins * 60;
  const tokenDurationSecondsRef = useRef<number>(TOKEN_DURATION_SECONDS);
  useEffect(() => {
    tokenDurationSecondsRef.current = TOKEN_DURATION_SECONDS;
  }, [TOKEN_DURATION_SECONDS]);

  const generateRandomToken = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let next = '';
    for (let i = 0; i < 6; i++) {
      next += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return next;
  }, []);

  const [activeToken, setActiveToken] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.TOKEN) || DEFAULT_EXAM_TOKEN;
    } catch {
      return DEFAULT_EXAM_TOKEN;
    }
  });

  const activeTokenRef = useRef<string>(activeToken);
  useEffect(() => {
    activeTokenRef.current = activeToken;
  }, [activeToken]);

  const tokenUpdatedAtRef = useRef<number>((() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEYS.TOKEN_UPDATED_AT));
      return Number.isFinite(saved) && saved > 0 ? saved : 0;
    } catch {
      return 0;
    }
  })());

  const initialTokenEndMs =
    tokenUpdatedAtRef.current > 0 &&
    tokenUpdatedAtRef.current + TOKEN_DURATION_SECONDS * 1000 > Date.now()
      ? tokenUpdatedAtRef.current + TOKEN_DURATION_SECONDS * 1000
      : Date.now() + TOKEN_DURATION_SECONDS * 1000;

  const tokenEndTimeRef = useRef<number>(initialTokenEndMs);

  const [tokenSecondsLeft, setTokenSecondsLeft] = useState<number>(() =>
    Math.max(0, Math.ceil((initialTokenEndMs - Date.now()) / 1000))
  );

  const [resultsHistory, setResultsHistory] = useState<ExamResultSummary[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [storageEngine, setStorageEngine] = useState<
    'vercel-kv' | 'vercel-serverless' | 'local'
  >('vercel-serverless');
  const [lastSyncedLabel, setLastSyncedLabel] = useState<string>(
    'Tersimpan Otomatis'
  );
  const isHydratedFromCloud = useRef(false);
  const isApplyingRemoteUpdate = useRef(false);
  const lastLocalMutationAt = useRef<number>(0);
  const latestUpdatedAtRef = useRef<number>(0);
  const pendingPushCount = useRef<number>(0);
  const examStartedAtRef = useRef<number>(0);
  const lastFullscreenRequestAtRef = useRef<number>(0);
  const draftSyncTimerRef = useRef<number | null>(null);
  const isSyncInFlightRef = useRef<boolean>(false);
  const lastSyncAttemptAtRef = useRef<number>(0);
  const resultsClearedAtRef = useRef<number>(0);

  const packagesRef = useRef<ExamPackage[]>(packages);
  useEffect(() => {
    packagesRef.current = packages;
  }, [packages]);

  const schedulesRef = useRef<AdminScheduleItem[]>(schedules);
  useEffect(() => {
    schedulesRef.current = schedules;
  }, [schedules]);

  const participantsRef = useRef<ProctorParticipantRow[]>(participants);
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const proctorsRef = useRef<AdminProctorItem[]>(proctors);
  useEffect(() => {
    proctorsRef.current = proctors;
  }, [proctors]);

  const resultsHistoryRef = useRef<ExamResultSummary[]>(resultsHistory);
  useEffect(() => {
    resultsHistoryRef.current = resultsHistory;
  }, [resultsHistory]);

  const markSyncedSuccess = useCallback(
    (engine: 'vercel-kv' | 'vercel-serverless' | 'local') => {
      setStorageEngine(engine);
      setLastSyncedLabel(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    },
    []
  );

  const handleUpdateAdminSettings = useCallback(
    (nextCfg: Record<string, any>) => {
      const nowTs = Date.now();
      const stamped: Record<string, any> = {
        ...nextCfg,
        updatedAt: Math.max(Number(nextCfg.updatedAt) || 0, nowTs),
      };
      lastLocalMutationAt.current = nowTs;
      adminSettingsRef.current = stamped;
      setAdminSettings(stamped);
      try {
        localStorage.setItem('cbt_admin_settings', JSON.stringify(stamped));
      } catch {
        // ignore
      }
      pendingPushCount.current += 1;
      saveVercelStorage({ adminSettings: stamped })
        .then((res) => {
          if (res.ok) {
            if (typeof res.updatedAt === 'number') {
              latestUpdatedAtRef.current = Math.max(
                latestUpdatedAtRef.current,
                res.updatedAt
              );
            }
            markSyncedSuccess(res.engine);
          }
        })
        .finally(() => {
          pendingPushCount.current = Math.max(0, pendingPushCount.current - 1);
        });
    },
    [markSyncedSuccess]
  );

  const handleUpdateToken = useCallback(
    (nextToken: string, isManualUpdate = true) => {
      const cleanToken = nextToken.trim().toUpperCase() || DEFAULT_EXAM_TOKEN;
      const nowTs = Date.now();
      lastLocalMutationAt.current = nowTs;
      activeTokenRef.current = cleanToken;
      tokenUpdatedAtRef.current = nowTs;
      tokenEndTimeRef.current = nowTs + TOKEN_DURATION_SECONDS * 1000;
      setActiveToken(cleanToken);
      setTokenSecondsLeft(TOKEN_DURATION_SECONDS);
      try {
        localStorage.setItem(STORAGE_KEYS.TOKEN, cleanToken);
        localStorage.setItem(STORAGE_KEYS.TOKEN_UPDATED_AT, String(nowTs));
      } catch {
        // ignore
      }
      pendingPushCount.current += 1;
      saveVercelStorage({
        activeToken: cleanToken,
        tokenUpdatedAt: nowTs,
        forceTokenUpdate: isManualUpdate,
      })
        .then((res) => {
          if (res.ok) markSyncedSuccess(res.engine);
        })
        .finally(() => {
          pendingPushCount.current = Math.max(0, pendingPushCount.current - 1);
        });
    },
    [markSyncedSuccess, TOKEN_DURATION_SECONDS]
  );

  useEffect(() => {
    if (tokenUpdatedAtRef.current > 0) {
      const nextEndMs =
        tokenUpdatedAtRef.current + TOKEN_DURATION_SECONDS * 1000;
      tokenEndTimeRef.current = nextEndMs;
      setTokenSecondsLeft(
        Math.max(0, Math.ceil((nextEndMs - Date.now()) / 1000))
      );
    }
  }, [TOKEN_DURATION_SECONDS]);

  // Automatic token countdown timer (wall-clock based, single primary authority on Admin)
  useEffect(() => {
    const tick = () => {
      const diffMs = tokenEndTimeRef.current - Date.now();
      const secsLeft = Math.max(0, Math.ceil(diffMs / 1000));
      setTokenSecondsLeft(secsLeft);

      if (isScheduleActive) {
        // Admin rotates immediately when countdown hits 0; Proctor only acts as fallback 15s later if Admin is offline
        const shouldAdminRotate =
          stage === 'admin_dashboard' && diffMs <= 0;
        const shouldProctorFallbackRotate =
          stage === 'proctor_dashboard' && diffMs <= -15_000;

        if (shouldAdminRotate || shouldProctorFallbackRotate) {
          tokenEndTimeRef.current = Date.now() + TOKEN_DURATION_SECONDS * 1000;
          setTokenSecondsLeft(TOKEN_DURATION_SECONDS);
          const next = generateRandomToken();
          handleUpdateToken(next, false);
        }
      }
    };

    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [
    generateRandomToken,
    handleUpdateToken,
    isScheduleActive,
    stage,
    TOKEN_DURATION_SECONDS,
  ]);

  const [participant, setParticipant] = useState<ParticipantProfile>({
    username: 'SA20266475',
    nik: '3273011805080002',
    fullName: 'NADIA PUTRI PRATAMA',
    schoolName: 'SMA ISLAM DIPONEGORO WAGIR',
    gender: 'Perempuan',
    birthDay: '18',
    birthMonth: '05',
    birthYear: '2008',
    selectedPackageId: '',
    enteredToken: DEFAULT_EXAM_TOKEN,
  });
  const participantRef = useRef<ParticipantProfile>(participant);
  useEffect(() => {
    participantRef.current = participant;
  }, [participant]);

  const [latestExamSummary, setLatestExamSummary] =
    useState<ExamResultSummary | null>(null);
  const [isSubmittingExamResult, setIsSubmittingExamResult] =
    useState<boolean>(false);

  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const answersRef = useRef<Record<string, StudentAnswer>>(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  const [examInitialRemainingSeconds, setExamInitialRemainingSeconds] =
    useState<number | undefined>(undefined);
  const examRemainingSecondsRef = useRef<number | undefined>(undefined);
  const [timeUsedSeconds, setTimeUsedSeconds] = useState(0);
  const [lastViolationInfo, setLastViolationInfo] =
    useState<ViolationAlertInfo | null>(null);

  // Automatically clear lastViolationInfo when participant is unlocked via Reset Login
  useEffect(() => {
    if (!lastViolationInfo) return;
    const matched = participants.find(
      (p) =>
        p.username.trim().toUpperCase() ===
        lastViolationInfo.username.trim().toUpperCase()
    );
    if (!matched || !isParticipantLockedByViolation(matched)) {
      setLastViolationInfo(null);
    }
  }, [participants, lastViolationInfo]);

  // Sync localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(packages));
      if (hasAnyUploadedQuestions(packages)) {
        localStorage.setItem(
          STORAGE_KEYS.PACKAGES_BACKUP,
          JSON.stringify(packages)
        );
      }
    } catch {
      // ignore
    }
  }, [packages]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
      if (!isDefaultInactiveSchedulesList(schedules)) {
        localStorage.setItem(
          STORAGE_KEYS.SCHEDULES_BACKUP,
          JSON.stringify(schedules)
        );
      }
    } catch {
      // ignore
    }
  }, [schedules]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.PARTICIPANTS,
        JSON.stringify(participants)
      );
      if (!isDefaultDemoParticipantsList(participants)) {
        localStorage.setItem(
          STORAGE_KEYS.PARTICIPANTS_BACKUP,
          JSON.stringify(participants)
        );
      }
    } catch {
      // ignore
    }
  }, [participants]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROCTORS, JSON.stringify(proctors));
    } catch {
      // ignore
    }
  }, [proctors]);

  useEffect(() => {
    try {
      localStorage.setItem('cbt_proctor_session', JSON.stringify(proctorSession));
    } catch {
      // ignore
    }
  }, [proctorSession]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TOKEN, activeToken);
    } catch {
      // ignore
    }
  }, [activeToken]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(resultsHistory));
    } catch {
      // ignore
    }
  }, [resultsHistory]);

  const handleUpdatePackages = useCallback(
    (
      updater:
        | ExamPackage[]
        | ((prevPackages: ExamPackage[]) => ExamPackage[])
    ) => {
      lastLocalMutationAt.current = Date.now();
      setPackages((prev) => {
        const rawNext =
          typeof updater === 'function' ? updater(prev) : updater;
        const nextPackages = filterOutSimulasiTka(rawNext);
        packagesRef.current = nextPackages;

        const nextIds = new Set(
          nextPackages.map((p) => String(p.id || '').trim().toUpperCase())
        );
        const nextCodes = new Set(
          nextPackages.map((p) => String(p.code || '').trim().toUpperCase())
        );
        const deletedPackageIds: string[] = [];
        prev.forEach((p) => {
          const pId = String(p.id || '').trim().toUpperCase();
          const pCode = String(p.code || '').trim().toUpperCase();
          if (pId && !nextIds.has(pId)) deletedPackageIds.push(pId);
          if (pCode && !nextCodes.has(pCode)) deletedPackageIds.push(pCode);
        });

        const prevQuestionsTotal = getTotalUploadedQuestionsCount(prev);
        const nextQuestionsTotal = getTotalUploadedQuestionsCount(nextPackages);
        const explicitDeleteOrReduce =
          deletedPackageIds.length > 0 || nextQuestionsTotal < prevQuestionsTotal;

        try {
          localStorage.setItem(
            STORAGE_KEYS.PACKAGES,
            JSON.stringify(nextPackages)
          );
          localStorage.setItem(
            STORAGE_KEYS.PACKAGES_BACKUP,
            JSON.stringify(nextPackages)
          );
        } catch {
          // ignore
        }
        let adminSettingsSnapshot:
          | (Record<string, unknown> & { updatedAt?: number })
          | undefined;
        if (
          stageRef.current === 'admin_dashboard' ||
          stageRef.current === 'proctor_dashboard'
        ) {
          try {
            const rawCfg = localStorage.getItem('cbt_admin_settings');
            if (rawCfg) {
              const parsedCfg = JSON.parse(rawCfg);
              if (parsedCfg && typeof parsedCfg === 'object') {
                adminSettingsSnapshot = {
                  ...parsedCfg,
                  updatedAt: Date.now(),
                };
                localStorage.setItem(
                  'cbt_admin_settings',
                  JSON.stringify(adminSettingsSnapshot)
                );
              }
            }
          } catch {
            // ignore
          }
        }

        pendingPushCount.current += 1;
        saveVercelStorage({
          packages: nextPackages,
          deletedPackageIds,
          forceReplacePackages: explicitDeleteOrReduce,
          ...(adminSettingsSnapshot
            ? { adminSettings: adminSettingsSnapshot }
            : {}),
        })
          .then((res) => {
            if (res.ok) {
              if (typeof res.updatedAt === 'number') {
                latestUpdatedAtRef.current = Math.max(
                  latestUpdatedAtRef.current,
                  res.updatedAt
                );
              }
              markSyncedSuccess(res.engine);
            }
          })
          .finally(() => {
            pendingPushCount.current = Math.max(
              0,
              pendingPushCount.current - 1
            );
          });
        return nextPackages;
      });
    },
    [filterOutSimulasiTka, markSyncedSuccess]
  );

  const handleUpdateParticipants = useCallback(
    (
      updater:
        | ProctorParticipantRow[]
        | ((prevRows: ProctorParticipantRow[]) => ProctorParticipantRow[])
    ) => {
      const nowTs = Date.now();
      setParticipants((prev) => {
        const rawNext =
          typeof updater === 'function' ? updater(prev) : updater;

        const prevByUser = new Map<string, ProctorParticipantRow>();
        const prevById = new Map<string, ProctorParticipantRow>();
        prev.forEach((p) => {
          prevByUser.set(p.username.trim().toUpperCase(), p);
          prevById.set(p.id, p);
        });

        let hasAnyRealFieldOrRowChange = rawNext.length !== prev.length;

        // Stamp monotonic CRDT timestamps on any modified fields so concurrent polls never revert changes
        const stampedNext = rawNext.map((row) => {
          const prevRow =
            prevById.get(row.id) ||
            prevByUser.get(row.username.trim().toUpperCase());
          if (!prevRow) {
            hasAnyRealFieldOrRowChange = true;
            return {
              ...row,
              metaUpdatedAt: row.metaUpdatedAt || nowTs,
            };
          }
          const metaChanged =
            prevRow.status !== row.status ||
            prevRow.ruang !== row.ruang ||
            prevRow.kelompok !== row.kelompok ||
            prevRow.kelas !== row.kelas ||
            prevRow.namaPeserta !== row.namaPeserta;
          const loginChanged =
            prevRow.loginState !== row.loginState ||
            Boolean(prevRow.requestReset) !== Boolean(row.requestReset) ||
            prevRow.violationTimestamp !== row.violationTimestamp ||
            prevRow.lastResetAt !== row.lastResetAt;
          const draftChanged =
            prevRow.draftAnswers !== row.draftAnswers ||
            prevRow.draftPackageId !== row.draftPackageId ||
            prevRow.draftRemainingSeconds !== row.draftRemainingSeconds;

          if (metaChanged || loginChanged || draftChanged) {
            hasAnyRealFieldOrRowChange = true;
          }

          return {
            ...row,
            ...(metaChanged
              ? {
                  metaUpdatedAt: Math.max(
                    (prevRow.metaUpdatedAt || 0) + 1,
                    row.metaUpdatedAt || 0,
                    nowTs
                  ),
                }
              : {}),
            ...(loginChanged
              ? {
                  loginUpdatedAt: Math.max(
                    (prevRow.loginUpdatedAt || 0) + 1,
                    row.loginUpdatedAt || 0,
                    nowTs
                  ),
                }
              : {}),
            ...(draftChanged
              ? {
                  draftUpdatedAt: Math.max(
                    (prevRow.draftUpdatedAt || 0) + 1,
                    row.draftUpdatedAt || 0,
                    nowTs
                  ),
                }
              : {}),
          };
        });

        const nextParticipants = sanitizeParticipantRows(stampedNext);
        participantsRef.current = nextParticipants;

        // If ONLY UI checkbox `selected` state changed, keep it purely local without flooding /api/storage
        if (!hasAnyRealFieldOrRowChange) {
          return nextParticipants;
        }

        lastLocalMutationAt.current = nowTs;
        try {
          localStorage.setItem(
            STORAGE_KEYS.PARTICIPANTS,
            JSON.stringify(nextParticipants)
          );
          if (!isDefaultDemoParticipantsList(nextParticipants)) {
            localStorage.setItem(
              STORAGE_KEYS.PARTICIPANTS_BACKUP,
              JSON.stringify(nextParticipants)
            );
          }
        } catch {
          // ignore
        }

        const isAdminOrProctor =
          stageRef.current === 'admin_dashboard' ||
          stageRef.current === 'proctor_dashboard';

        const changedPatches = nextParticipants
          .filter((row) => {
            const prevRow =
              prevById.get(row.id) ||
              prevByUser.get(row.username.trim().toUpperCase());
            if (!prevRow) return true;
            return (
              prevRow.loginState !== row.loginState ||
              prevRow.requestReset !== row.requestReset ||
              prevRow.violationReason !== row.violationReason ||
              prevRow.violationTimestamp !== row.violationTimestamp ||
              prevRow.violationCount !== row.violationCount ||
              prevRow.violationPackageId !== row.violationPackageId ||
              prevRow.lastResetAt !== row.lastResetAt ||
              prevRow.draftAnswers !== row.draftAnswers ||
              prevRow.draftPackageId !== row.draftPackageId ||
              prevRow.draftRemainingSeconds !== row.draftRemainingSeconds ||
              prevRow.status !== row.status ||
              prevRow.ruang !== row.ruang ||
              prevRow.kelompok !== row.kelompok ||
              prevRow.kelas !== row.kelas ||
              prevRow.namaPeserta !== row.namaPeserta
            );
          })
          .map((row) => ({
            id: row.id,
            username: row.username.trim().toUpperCase(),
            namaPeserta: row.namaPeserta,
            kelas: row.kelas,
            kelompok: row.kelompok,
            ruang: row.ruang,
            kodeTes: row.kodeTes,
            status: row.status,
            loginState: row.loginState,
            requestReset: Boolean(row.requestReset),
            violationReason: (row.violationReason ?? null) as any,
            violationAt: (row.violationAt ?? null) as any,
            violationSchema: (row.violationSchema ?? null) as any,
            violationTimestamp: (row.violationTimestamp ?? null) as any,
            violationCount: row.violationCount ?? 0,
            violationPackageId: (row.violationPackageId ?? null) as any,
            draftAnswers: (row.draftAnswers ?? null) as any,
            draftPackageId: (row.draftPackageId ?? null) as any,
            draftRemainingSeconds: (row.draftRemainingSeconds ?? null) as any,
            lastResetAt: row.lastResetAt,
            loginUpdatedAt: row.loginUpdatedAt,
            metaUpdatedAt: row.metaUpdatedAt,
            draftUpdatedAt: row.draftUpdatedAt,
          }));

        if (!isAdminOrProctor) {
          // Student-side mutation: NEVER push the full participants array from a student browser.
          if (changedPatches.length > 0) {
            pendingPushCount.current += 1;
            saveVercelStorage({
              participantPatch: changedPatches,
            })
              .then((res) => {
                if (res.ok) {
                  if (typeof res.updatedAt === 'number') {
                    latestUpdatedAtRef.current = Math.max(
                      latestUpdatedAtRef.current,
                      res.updatedAt
                    );
                  }
                  markSyncedSuccess(res.engine);
                }
              })
              .finally(() => {
                pendingPushCount.current = Math.max(
                  0,
                  pendingPushCount.current - 1
                );
              });
          }
          return nextParticipants;
        }

        // Admin / Proctor mutation: block pushing 8 demo rows if initial cloud hydration hasn't completed
        if (
          !isHydratedFromCloud.current &&
          isDefaultDemoParticipantsList(nextParticipants)
        ) {
          return nextParticipants;
        }

        const nextIdSet = new Set(nextParticipants.map((p) => p.id));
        const newlyDeletedIds = prev
          .filter((p) => !nextIdSet.has(p.id))
          .map((p) => p.id);
        const deletedParticipantIds = addLocalDeletedIds(
          STORAGE_KEYS.DELETED_PARTICIPANTS,
          newlyDeletedIds
        );

        // If no rows were added/deleted and only <= 10 rows changed (e.g. Reset Login 1 student, Assign/Move a few),
        // use lightweight delta participantPatch so we never overwrite concurrent student drafts/finishes
        const hasAddedRow = nextParticipants.some(
          (p) => !prevById.has(p.id) && !prevByUser.has(p.username.trim().toUpperCase())
        );

        pendingPushCount.current += 1;
        const payloadToSave =
          newlyDeletedIds.length === 0 &&
          !hasAddedRow &&
          changedPatches.length > 0 &&
          changedPatches.length <= 10
            ? { participantPatch: changedPatches }
            : {
                participants: nextParticipants,
                deletedParticipantIds,
                forceReplaceParticipants: true,
              };

        saveVercelStorage(payloadToSave)
          .then((res) => {
            if (res.ok) {
              if (typeof res.updatedAt === 'number') {
                latestUpdatedAtRef.current = Math.max(
                  latestUpdatedAtRef.current,
                  res.updatedAt
                );
              }
              markSyncedSuccess(res.engine);
            }
          })
          .finally(() => {
            pendingPushCount.current = Math.max(
              0,
              pendingPushCount.current - 1
            );
          });
        return nextParticipants;
      });
    },
    [markSyncedSuccess]
  );

  const handleUpdateSchedules = useCallback(
    (
      updater:
        | AdminScheduleItem[]
        | ((prevSchedules: AdminScheduleItem[]) => AdminScheduleItem[])
    ) => {
      const nowTs = Date.now();
      lastLocalMutationAt.current = nowTs;
      setSchedules((prev) => {
        const rawNext =
          typeof updater === 'function' ? updater(prev) : updater;
        const prevById = new Map<string, AdminScheduleItem>();
        prev.forEach((s) => prevById.set(s.id, s));

        const nextSchedules = rawNext.map((s) => {
          const prevItem = prevById.get(s.id);
          if (
            !prevItem ||
            prevItem.isActive !== s.isActive ||
            prevItem.mapel !== s.mapel ||
            prevItem.kelas !== s.kelas ||
            prevItem.hariTanggal !== s.hariTanggal ||
            prevItem.waktuMulai !== s.waktuMulai ||
            prevItem.durasi !== s.durasi
          ) {
            return {
              ...s,
              updatedAt: Math.max(s.updatedAt || 0, nowTs),
            };
          }
          return s;
        });

        schedulesRef.current = nextSchedules;

        const nextIdSet = new Set(nextSchedules.map((s) => s.id));
        const newlyDeletedIds = prev
          .filter((s) => !nextIdSet.has(s.id))
          .map((s) => s.id);
        const deletedScheduleIds = addLocalDeletedIds(
          STORAGE_KEYS.DELETED_SCHEDULES,
          newlyDeletedIds
        );

        try {
          localStorage.setItem(
            STORAGE_KEYS.SCHEDULES,
            JSON.stringify(nextSchedules)
          );
          localStorage.setItem(
            STORAGE_KEYS.SCHEDULES_BACKUP,
            JSON.stringify(nextSchedules)
          );
        } catch {
          // ignore
        }
        pendingPushCount.current += 1;
        saveVercelStorage({
          schedules: nextSchedules,
          deletedScheduleIds,
          forceReplaceSchedules: true,
          schedulesUpdatedAt: nowTs,
        })
          .then((res) => {
            if (res.ok) {
              if (typeof res.updatedAt === 'number') {
                latestUpdatedAtRef.current = Math.max(
                  latestUpdatedAtRef.current,
                  res.updatedAt
                );
              }
              markSyncedSuccess(res.engine);
            }
          })
          .finally(() => {
            pendingPushCount.current = Math.max(
              0,
              pendingPushCount.current - 1
            );
          });
        return nextSchedules;
      });
    },
    [markSyncedSuccess]
  );

  const handleUpdateProctors = useCallback(
    (
      updater:
        | AdminProctorItem[]
        | ((prevProctors: AdminProctorItem[]) => AdminProctorItem[])
    ) => {
      lastLocalMutationAt.current = Date.now();
      setProctors((prev) => {
        const nextProctors =
          typeof updater === 'function' ? updater(prev) : updater;
        proctorsRef.current = nextProctors;
        try {
          localStorage.setItem(
            STORAGE_KEYS.PROCTORS,
            JSON.stringify(nextProctors)
          );
        } catch {
          // ignore
        }
        pendingPushCount.current += 1;
        saveVercelStorage({
          proctors: nextProctors,
        })
          .then((res) => {
            if (res.ok) {
              if (typeof res.updatedAt === 'number') {
                latestUpdatedAtRef.current = Math.max(
                  latestUpdatedAtRef.current,
                  res.updatedAt
                );
              }
              markSyncedSuccess(res.engine);
            }
          })
          .finally(() => {
            pendingPushCount.current = Math.max(
              0,
              pendingPushCount.current - 1
            );
          });
        return nextProctors;
      });
    },
    [markSyncedSuccess]
  );

  const handleUpdateResultsHistory = useCallback(
    (
      updater:
        | ExamResultSummary[]
        | ((prevHistory: ExamResultSummary[]) => ExamResultSummary[])
    ) => {
      const nowTs = Date.now();
      lastLocalMutationAt.current = nowTs;
      setResultsHistory((prev) => {
        const nextHistory =
          typeof updater === 'function' ? updater(prev) : updater;
        resultsHistoryRef.current = nextHistory;
        const isExplicitClear = nextHistory.length === 0;
        if (isExplicitClear) {
          resultsClearedAtRef.current = nowTs;
        }
        try {
          localStorage.setItem(
            STORAGE_KEYS.HISTORY,
            JSON.stringify(nextHistory)
          );
        } catch {
          // ignore
        }
        pendingPushCount.current += 1;
        saveVercelStorage(
          isExplicitClear
            ? { resultsHistory: [], resultsClearedAt: nowTs }
            : { resultsHistory: nextHistory }
        )
          .then((res) => {
            if (res.ok) {
              if (typeof res.updatedAt === 'number') {
                latestUpdatedAtRef.current = Math.max(
                  latestUpdatedAtRef.current,
                  res.updatedAt
                );
              }
              markSyncedSuccess(res.engine);
            }
          })
          .finally(() => {
            pendingPushCount.current = Math.max(
              0,
              pendingPushCount.current - 1
            );
          });
        return nextHistory;
      });
    },
    [markSyncedSuccess]
  );

  // Initial Hydration & Background Polling from Vercel Storage (/api/storage)
  // Uses conflict-free per-entity timestamp resolution so multi-instance serverless split-brain
  // or 131 concurrent students never cause schedules or reset requests to flicker.
  const syncFromVercelCloud = useCallback(
    async (options?: { force?: boolean }): Promise<ProctorParticipantRow[]> => {
      const isForced = Boolean(options?.force);
      if (
        !isForced &&
        (isSyncInFlightRef.current ||
          pendingPushCount.current > 0 ||
          Date.now() - lastLocalMutationAt.current < 2500)
      ) {
        return participantsRef.current;
      }

      isSyncInFlightRef.current = true;
      lastSyncAttemptAtRef.current = Date.now();
      const fetchStartedAt = Date.now();

      try {
        const res = await fetchVercelStorage({
          since:
            !isForced && isHydratedFromCloud.current
              ? latestUpdatedAtRef.current
              : undefined,
          force: isForced,
        });
        if (!res.ok) return participantsRef.current;
        if (
          !isForced &&
          (pendingPushCount.current > 0 ||
            lastLocalMutationAt.current >= fetchStartedAt ||
            Date.now() - lastLocalMutationAt.current < 2500)
        ) {
          return participantsRef.current;
        }
        setStorageEngine(res.engine);

        if (res.unchanged) {
          setLastSyncedLabel(
            new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
          isHydratedFromCloud.current = true;
          return participantsRef.current;
        }

        const authRole = getAuthSessionRole();
        const isAdminOrProctorStage =
          stageRef.current === 'admin_dashboard' ||
          stageRef.current === 'proctor_dashboard' ||
          authRole === 'admin' ||
          authRole === 'proctor';

        if (res.data) {
          const serverUpdatedAt =
            typeof res.data.updatedAt === 'number'
              ? res.data.updatedAt
              : typeof res.updatedAt === 'number'
              ? res.updatedAt
              : 0;
          if (serverUpdatedAt > 0) {
            latestUpdatedAtRef.current = Math.max(
              latestUpdatedAtRef.current,
              serverUpdatedAt
            );
          }

          if (Array.isArray(res.data.deletedScheduleIds)) {
            addLocalDeletedIds(
              STORAGE_KEYS.DELETED_SCHEDULES,
              res.data.deletedScheduleIds
            );
          }
          if (Array.isArray(res.data.deletedParticipantIds)) {
            addLocalDeletedIds(
              STORAGE_KEYS.DELETED_PARTICIPANTS,
              res.data.deletedParticipantIds
            );
          }

          // 1. Token CRDT reconciliation by tokenUpdatedAt (preserving remaining 10-minute window)
          const remoteTokenTs =
            typeof res.data.tokenUpdatedAt === 'number'
              ? res.data.tokenUpdatedAt
              : 0;
          if (
            typeof res.data.activeToken === 'string' &&
            res.data.activeToken &&
            res.data.activeToken !== activeTokenRef.current
          ) {
            if (
              remoteTokenTs >= tokenUpdatedAtRef.current ||
              tokenUpdatedAtRef.current === 0
            ) {
              activeTokenRef.current = res.data.activeToken;
              tokenUpdatedAtRef.current = Math.max(
                tokenUpdatedAtRef.current,
                remoteTokenTs
              );
              const syncedEndMs =
                remoteTokenTs > 0 &&
                remoteTokenTs + tokenDurationSecondsRef.current * 1000 > Date.now()
                  ? remoteTokenTs + tokenDurationSecondsRef.current * 1000
                  : Date.now() + tokenDurationSecondsRef.current * 1000;
              tokenEndTimeRef.current = syncedEndMs;
              setActiveToken(res.data.activeToken);
              setTokenSecondsLeft(
                Math.max(0, Math.ceil((syncedEndMs - Date.now()) / 1000))
              );
              try {
                localStorage.setItem(STORAGE_KEYS.TOKEN, res.data.activeToken);
                if (remoteTokenTs > 0) {
                  localStorage.setItem(
                    STORAGE_KEYS.TOKEN_UPDATED_AT,
                    String(remoteTokenTs)
                  );
                }
              } catch {
                // ignore
              }
            } else if (isAdminOrProctorStage) {
              saveVercelStorage({
                activeToken: activeTokenRef.current,
                tokenUpdatedAt: tokenUpdatedAtRef.current,
              });
            }
          }

          // Sync remote adminSettings (deleted/custom mapel config & exam settings) if newer than local
          if (
            res.data.adminSettings &&
            typeof res.data.adminSettings === 'object'
          ) {
            try {
              const rawLocalCfg = localStorage.getItem('cbt_admin_settings');
              const localCfg = rawLocalCfg ? JSON.parse(rawLocalCfg) : null;
              const localCfgTs = Math.max(
                typeof localCfg?.updatedAt === 'number' ? localCfg.updatedAt : 0,
                typeof adminSettingsRef.current?.updatedAt === 'number'
                  ? adminSettingsRef.current.updatedAt
                  : 0
              );
              const remoteRaw = res.data.adminSettings as Record<string, any>;
              const remoteCfgTs =
                typeof remoteRaw.updatedAt === 'number'
                  ? remoteRaw.updatedAt
                  : 0;
              const normalizedRemoteCfg: Record<string, any> = {
                ...adminSettingsRef.current,
                ...remoteRaw,
              };
              if (!remoteRaw.updatedAt && remoteRaw.tokenIntervalMenit === 15) {
                normalizedRemoteCfg.tokenIntervalMenit = 10;
              }
              if (
                !localCfg ||
                remoteCfgTs > localCfgTs ||
                (isForced && isAdminOrProctorStage)
              ) {
                adminSettingsRef.current = normalizedRemoteCfg;
                setAdminSettings(normalizedRemoteCfg);
                localStorage.setItem(
                  'cbt_admin_settings',
                  JSON.stringify(normalizedRemoteCfg)
                );
              }
            } catch {
              // ignore
            }
          }

          isApplyingRemoteUpdate.current = true;

          // 2. Packages CRDT reconciliation (preserving uploaded questions)
          let healPackagesPayload: ExamPackage[] | undefined;
          if (Array.isArray(res.data.packages) && res.data.packages.length > 0) {
            const cleanedRemotePackages = filterOutSimulasiTka(
              res.data.packages
            );
            const mergedPackages = mergePackagesPreservingQuestions(
              cleanedRemotePackages,
              packagesRef.current
            );
            packagesRef.current = mergedPackages;
            setPackages(mergedPackages);

            if (
              isAdminOrProctorStage &&
              getTotalUploadedQuestionsCount(mergedPackages) >
                getTotalUploadedQuestionsCount(cleanedRemotePackages)
            ) {
              healPackagesPayload = mergedPackages;
            }
          } else if (
            isAdminOrProctorStage &&
            hasAnyUploadedQuestions(packagesRef.current)
          ) {
            healPackagesPayload = packagesRef.current;
          }

          // 3. Schedules CRDT reconciliation by per-schedule updatedAt
          let healSchedulesPayload: AdminScheduleItem[] | undefined;
          const localHasActiveOrCustomSchedules =
            !isDefaultInactiveSchedulesList(schedulesRef.current);
          const remoteHasSchedules =
            Array.isArray(res.data.schedules) && res.data.schedules.length > 0;

          if (remoteHasSchedules) {
            const mergedSchedules = mergeSchedulesByTimestamp(
              res.data.schedules!,
              schedulesRef.current,
              res.data.deletedScheduleIds
            );
            schedulesRef.current = mergedSchedules;
            setSchedules(mergedSchedules);

            // If local had newer schedule state (e.g. active toggle or custom schedule) than the polled server instance, heal the server
            if (isAdminOrProctorStage) {
              const remoteById = new Map<string, AdminScheduleItem>();
              res.data.schedules!.forEach((s) => {
                if (s && s.id) remoteById.set(s.id, s);
              });
              const serverNeedsScheduleHeal =
                mergedSchedules.length !== res.data.schedules!.length ||
                mergedSchedules.some((m) => {
                  const r = remoteById.get(m.id);
                  return (
                    !r ||
                    r.isActive !== m.isActive ||
                    (m.updatedAt || 0) > (r.updatedAt || 0)
                  );
                });
              if (serverNeedsScheduleHeal) {
                healSchedulesPayload = mergedSchedules;
              }
            }
          } else if (isAdminOrProctorStage && localHasActiveOrCustomSchedules) {
            healSchedulesPayload = schedulesRef.current;
          }

          // 4. Participants CRDT reconciliation (violationTimestamp vs lastResetAt vs loginUpdatedAt vs metaUpdatedAt)
          let healParticipantsPayload: ProctorParticipantRow[] | undefined;
          const localHasRealParticipants = !isDefaultDemoParticipantsList(
            participantsRef.current
          );
          const remoteHasParticipants =
            Array.isArray(res.data.participants) &&
            res.data.participants.length > 0;
          const remoteIsDemoOnly =
            !remoteHasParticipants ||
            isDefaultDemoParticipantsList(res.data.participants);

          if (localHasRealParticipants && remoteIsDemoOnly) {
            // Server instance cold-started or only has 8 demo students: keep our 131 real students and heal server
            healParticipantsPayload = sanitizeParticipantRows(
              participantsRef.current
            );
          } else if (remoteHasParticipants) {
            const mergedParticipants = mergeParticipantLists(
              res.data.participants!,
              participantsRef.current,
              res.data.deletedParticipantIds,
              { serverAuthoritativeStatus: !isAdminOrProctorStage }
            );
            participantsRef.current = mergedParticipants;
            setParticipants(mergedParticipants);

            // Jika siswa sedang berada di halaman konfirmasi lalu dinonaktifkan di Kelompok Tes, segera keluarkan ke halaman login
            if (
              !isAdminOrProctorStage &&
              (stageRef.current === 'confirm_participant' ||
                stageRef.current === 'confirm_test')
            ) {
              const activeUserUpper = String(
                participantRef.current?.username || ''
              )
                .trim()
                .toUpperCase();
              const activeStudentRow = mergedParticipants.find(
                (p) => p.username.trim().toUpperCase() === activeUserUpper
              );
              if (
                activeStudentRow &&
                !isParticipantStatusActive(activeStudentRow.status)
              ) {
                clearAuthSessionToken();
                setStage('login');
              }
            }

            // Check if the polled serverless instance was missing students, resets, or violations that we just reconciled
            if (isAdminOrProctorStage) {
              const remoteByUser = new Map<string, ProctorParticipantRow>();
              res.data.participants!.forEach((r) => {
                if (r && r.username) {
                  remoteByUser.set(r.username.trim().toUpperCase(), r);
                }
              });
              const serverNeedsParticipantHeal =
                mergedParticipants.length !== res.data.participants!.length ||
                mergedParticipants.some((m) => {
                  const r = remoteByUser.get(m.username.trim().toUpperCase());
                  if (!r) return true;
                  return (
                    Boolean(r.requestReset) !== Boolean(m.requestReset) ||
                    r.loginState !== m.loginState ||
                    r.status !== m.status ||
                    (m.lastResetAt || 0) > (r.lastResetAt || 0) ||
                    (m.violationTimestamp || 0) > (r.violationTimestamp || 0) ||
                    (m.metaUpdatedAt || 0) > (r.metaUpdatedAt || 0)
                  );
                });
              if (serverNeedsParticipantHeal) {
                healParticipantsPayload = mergedParticipants;
              }
            }
          }

          // Heal stale serverless instance if needed (only Admin/Proctor pushes schedules/packages, or real participants on cold start)
          if (
            healPackagesPayload ||
            healSchedulesPayload ||
            healParticipantsPayload
          ) {
            saveVercelStorage({
              ...(healPackagesPayload
                ? { packages: healPackagesPayload }
                : {}),
              ...(healSchedulesPayload
                ? {
                    schedules: healSchedulesPayload,
                    deletedScheduleIds: Array.from(
                      readLocalDeletedSet(STORAGE_KEYS.DELETED_SCHEDULES)
                    ),
                    forceReplaceSchedules: true,
                  }
                : {}),
              ...(healParticipantsPayload
                ? {
                    participants: healParticipantsPayload,
                    deletedParticipantIds: Array.from(
                      readLocalDeletedSet(STORAGE_KEYS.DELETED_PARTICIPANTS)
                    ),
                    forceReplaceParticipants: true,
                  }
                : {}),
            }).then((healRes) => {
              if (healRes.ok && typeof healRes.updatedAt === 'number') {
                latestUpdatedAtRef.current = Math.max(
                  latestUpdatedAtRef.current,
                  healRes.updatedAt
                );
              }
            });
          }

          if (
            Array.isArray(res.data.proctors) &&
            res.data.proctors.length > 0
          ) {
            setProctors(res.data.proctors);
          }

          const remoteClearedAt =
            typeof res.data.resultsClearedAt === 'number'
              ? res.data.resultsClearedAt
              : 0;
          if (remoteClearedAt > resultsClearedAtRef.current) {
            resultsClearedAtRef.current = remoteClearedAt;
            resultsHistoryRef.current = [];
            setResultsHistory([]);
          } else if (Array.isArray(res.data.resultsHistory)) {
            const seenIds = new Set<string>();
            const mergedHistory: ExamResultSummary[] = [];
            for (const item of [
              ...res.data.resultsHistory,
              ...resultsHistoryRef.current,
            ]) {
              if (!item || !item.id || seenIds.has(item.id)) continue;
              seenIds.add(item.id);
              mergedHistory.push(item);
            }
            resultsHistoryRef.current = mergedHistory;
            setResultsHistory(mergedHistory);
          }
          setLastSyncedLabel(
            new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
          setTimeout(() => {
            isApplyingRemoteUpdate.current = false;
          }, 150);
        } else if (!isHydratedFromCloud.current) {
          // Cold-start / empty server: Only seed from Admin/Proctor or if local holds real data.
          const localHasRealParticipants = !isDefaultDemoParticipantsList(
            participantsRef.current
          );
          const localHasActiveOrCustomSchedules =
            !isDefaultInactiveSchedulesList(schedulesRef.current);
          const localHasQuestions = hasAnyUploadedQuestions(
            packagesRef.current
          );

          if (
            localHasRealParticipants ||
            (isAdminOrProctorStage &&
              (localHasActiveOrCustomSchedules || localHasQuestions))
          ) {
            const seedRes = await saveVercelStorage({
              ...(isAdminOrProctorStage && localHasQuestions
                ? { packages: packagesRef.current }
                : {}),
              ...(isAdminOrProctorStage && localHasActiveOrCustomSchedules
                ? {
                    schedules: schedulesRef.current,
                    forceReplaceSchedules: true,
                  }
                : {}),
              ...(localHasRealParticipants
                ? {
                    participants: sanitizeParticipantRows(
                      participantsRef.current
                    ),
                    forceReplaceParticipants: true,
                  }
                : {}),
              ...(isAdminOrProctorStage
                ? {
                    proctors: proctorsRef.current,
                    activeToken: activeTokenRef.current,
                    tokenUpdatedAt: tokenUpdatedAtRef.current || Date.now(),
                    resultsHistory: resultsHistoryRef.current,
                  }
                : {}),
            });
            if (seedRes.ok) {
              if (typeof seedRes.updatedAt === 'number') {
                latestUpdatedAtRef.current = Math.max(
                  latestUpdatedAtRef.current,
                  seedRes.updatedAt
                );
              }
              setStorageEngine(seedRes.engine);
            }
          }
        }
        isHydratedFromCloud.current = true;
        return participantsRef.current;
      } finally {
        isSyncInFlightRef.current = false;
      }
    },
    [filterOutSimulasiTka]
  );

  // Stage-aware adaptive polling with random jitter & visibility pause so 131+ students
  // on a single school Wi-Fi IP do not trigger Vercel Edge Firewall 403/429 blocks.
  const hasActiveViolationBanner = Boolean(lastViolationInfo);
  useEffect(() => {
    let cancelled = false;
    let pollTimeoutId: number | null = null;

    const getNextPollDelayMs = (): number | null => {
      if (stage === 'admin_dashboard' || stage === 'proctor_dashboard') {
        return 10_000 + Math.floor(Math.random() * 4_000); // 10–14s
      }
      if (stage === 'login') {
        return hasActiveViolationBanner
          ? 12_000 + Math.floor(Math.random() * 5_000) // 12–17s when waiting Reset Login
          : 25_000 + Math.floor(Math.random() * 10_000); // 25–35s normal login screen
      }
      if (stage === 'confirm_participant' || stage === 'confirm_test') {
        return 20_000 + Math.floor(Math.random() * 8_000); // 20–28s
      }
      if (stage === 'exam_running') {
        return 75_000 + Math.floor(Math.random() * 30_000); // 75–105s (saves >93% GETs during exam)
      }
      // exam_result / proctor_login / admin_login: no background polling needed
      return null;
    };

    const scheduleNext = () => {
      if (cancelled) return;
      const delayMs = getNextPollDelayMs();
      if (delayMs === null) return;
      pollTimeoutId = window.setTimeout(async () => {
        if (cancelled) return;
        if (document.visibilityState !== 'hidden') {
          await syncFromVercelCloud();
        }
        scheduleNext();
      }, delayMs);
    };

    if (!isHydratedFromCloud.current) {
      syncFromVercelCloud().finally(() => {
        scheduleNext();
      });
    } else {
      scheduleNext();
    }

    const handleVisibilityResume = () => {
      if (
        document.visibilityState === 'visible' &&
        getNextPollDelayMs() !== null &&
        Date.now() - lastSyncAttemptAtRef.current > 8_000
      ) {
        syncFromVercelCloud();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityResume);

    return () => {
      cancelled = true;
      if (pollTimeoutId !== null) {
        window.clearTimeout(pollTimeoutId);
      }
      document.removeEventListener('visibilitychange', handleVisibilityResume);
    };
  }, [syncFromVercelCloud, stage, hasActiveViolationBanner]);

  // Manual Force Sync from Admin Dashboard
  const pushToVercelCloud = useCallback(async () => {
    lastLocalMutationAt.current = Date.now();
    pendingPushCount.current += 1;
    try {
      const hasRealParticipants = !isDefaultDemoParticipantsList(participants);
      const hasActiveOrCustomSchedules =
        !isDefaultInactiveSchedulesList(schedules);
      let localAdminSettings:
        | (Record<string, unknown> & { updatedAt?: number })
        | undefined;
      try {
        const rawCfg = localStorage.getItem('cbt_admin_settings');
        if (rawCfg) {
          const parsedCfg = JSON.parse(rawCfg);
          if (parsedCfg && typeof parsedCfg === 'object') {
            localAdminSettings = parsedCfg;
          }
        }
      } catch {
        // ignore
      }
      const res = await saveVercelStorage({
        packages,
        schedules,
        forceReplaceSchedules: hasActiveOrCustomSchedules,
        ...(hasRealParticipants || isHydratedFromCloud.current
          ? { participants, forceReplaceParticipants: hasRealParticipants }
          : {}),
        proctors,
        activeToken,
        tokenUpdatedAt: tokenUpdatedAtRef.current || Date.now(),
        resultsHistory,
        ...(localAdminSettings ? { adminSettings: localAdminSettings } : {}),
      });
      if (res.ok) {
        if (
          res.data?.participants &&
          Array.isArray(res.data.participants) &&
          !hasRealParticipants &&
          !isDefaultDemoParticipantsList(res.data.participants)
        ) {
          setParticipants(sanitizeParticipantRows(res.data.participants));
        }
        markSyncedSuccess(res.engine);
      }
    } finally {
      pendingPushCount.current = Math.max(0, pendingPushCount.current - 1);
    }
  }, [
    activeToken,
    markSyncedSuccess,
    packages,
    participants,
    proctors,
    resultsHistory,
    schedules,
  ]);

  const currentStudentKelas =
    normalizeKelasCode(
      participant.kelas ||
        participants.find(
          (p) =>
            p.username.trim().toUpperCase() ===
            participant.username.trim().toUpperCase()
        )?.kelas
    ) || 'X';

  const currentStudentActiveSchedules = activeSchedules.filter((s) =>
    doesKelasMatch(currentStudentKelas, s.kelas)
  );

  const matchedStudentSchedule =
    (participant.activeSubjectTitle
      ? currentStudentActiveSchedules.find(
          (s) =>
            s.mapel.trim().toLowerCase() ===
            participant.activeSubjectTitle?.trim().toLowerCase()
        )
      : undefined) || currentStudentActiveSchedules[0];

  const pkgBySelectedId = packages.find(
    (p) => p.id === participant.selectedPackageId
  );
  const pkgBySchedule = matchedStudentSchedule
    ? resolvePackageForSchedule(matchedStudentSchedule, packages)
    : undefined;

  const selectedPackage: ExamPackage =
    pkgBySchedule ||
    pkgBySelectedId ||
    FALLBACK_EMPTY_PACKAGE;

  const [isFullscreenActive, setIsFullscreenActive] = useState<boolean>(false);

  const requestCbtFullscreen = useCallback(() => {
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      msFullscreenElement?: Element | null;
    };

    // Request wakeLock to keep exam active and suppress system idle/status overlays
    try {
      if ('wakeLock' in navigator && navigator.wakeLock) {
        navigator.wakeLock.request('screen').catch(() => {});
      }
    } catch {
      // Ignore
    }

    if (adminSettingsRef.current?.wajibFullscreen === false) {
      return;
    }

    if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement) {
      setIsFullscreenActive(true);
      return;
    }

    lastFullscreenRequestAtRef.current = Date.now();
    if (docEl.requestFullscreen) {
      docEl
        .requestFullscreen({ navigationUI: 'hide' })
        .then(() => setIsFullscreenActive(true))
        .catch(() => {
          // Deferred to subsequent user click gesture
        });
    } else if (docEl.webkitRequestFullscreen) {
      try {
        docEl.webkitRequestFullscreen();
        setIsFullscreenActive(true);
      } catch {
        // Ignore
      }
    }
  }, []);

  const exitCbtFullscreen = useCallback(() => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      msFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void>;
    };

    if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement) {
      if (document.exitFullscreen) {
        document
          .exitFullscreen()
          .then(() => setIsFullscreenActive(false))
          .catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        try {
          doc.webkitExitFullscreen();
          setIsFullscreenActive(false);
        } catch {
          // Ignore
        }
      }
    } else {
      setIsFullscreenActive(false);
    }
  }, []);

  // On laptop/desktop, keep the installed PWA app window title bar visible on login, admin, and proctor pages
  useEffect(() => {
    const isMobileDevice =
      window.innerWidth < 768 ||
      Boolean(window.matchMedia?.('(pointer: coarse)').matches) ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (
      !isMobileDevice &&
      (stage === 'login' ||
        stage === 'admin_login' ||
        stage === 'proctor_login' ||
        stage === 'admin_dashboard' ||
        stage === 'proctor_dashboard')
    ) {
      exitCbtFullscreen();
    }
  }, [stage, exitCbtFullscreen]);

  const [showExitAppConfirmModal, setShowExitAppConfirmModal] = useState(false);

  const handleExitApp = useCallback(() => {
    setShowExitAppConfirmModal(true);
  }, []);

  const handleConfirmExitApp = useCallback(() => {
    // 1. Keluar dari mode fullscreen
    exitCbtFullscreen();

    // 2. Coba tutup jendela browser (window.close)
    try {
      window.close();
    } catch {
      // Ignore
    }

    // 3. Fallback jika browser membatasi window.close: arahkan ke blank atau riwayat sebelumnya
    try {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'about:blank';
      }
    } catch {
      // Ignore
    }
  }, [exitCbtFullscreen]);

  const lockStudentByViolation = useCallback(
    (reason: string) => {
      if (draftSyncTimerRef.current) {
        window.clearTimeout(draftSyncTimerRef.current);
        draftSyncTimerRef.current = null;
      }
      const nowTs = Date.now();
      const timeStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const cleanUser = participant.username.trim().toUpperCase();
      const currentPkgId = selectedPackage?.id || FALLBACK_EMPTY_PACKAGE.id;

      // Hitung jumlah pelanggaran siswa pada mata pelajaran aktif (maksimal 6x)
      const existingRow = participantsRef.current.find(
        (r) => r.username.trim().toUpperCase() === cleanUser
      );
      const localDraft = readStudentDraftFromLocal(cleanUser, currentPkgId);
      const sameViolationPkg =
        !existingRow?.violationPackageId ||
        existingRow.violationPackageId === currentPkgId;

      const prevRowVCount =
        sameViolationPkg &&
        typeof existingRow?.violationCount === 'number' &&
        existingRow.violationCount > 0 &&
        existingRow.violationCount < MAX_VIOLATION_LIMIT
          ? existingRow.violationCount
          : 0;
      const prevLocalVCount =
        typeof localDraft?.violationCount === 'number' &&
        localDraft.violationCount > 0 &&
        localDraft.violationCount < MAX_VIOLATION_LIMIT
          ? localDraft.violationCount
          : 0;

      const nextViolationCount = Math.max(prevRowVCount, prevLocalVCount) + 1;
      const shouldWipeAnswers = nextViolationCount >= MAX_VIOLATION_LIMIT;

      const currentAnswersSnapshot = { ...answersRef.current };
      const currentRemainingSecs = examRemainingSecondsRef.current;

      if (shouldWipeAnswers) {
        // Pelanggaran mencapai 6x: hapus seluruh jawaban dan reset sisa waktu ujian
        setAnswers({});
        answersRef.current = {};
        examRemainingSecondsRef.current = undefined;
        setExamInitialRemainingSeconds(undefined);
        clearStudentDraftInLocal(cleanUser, currentPkgId);
      } else {
        // Pelanggaran 1x s/d 5x: simpan draft jawaban dan sisa waktu agar tidak hilang saat Reset Login
        writeStudentDraftToLocal({
          username: cleanUser,
          packageId: currentPkgId,
          answers: currentAnswersSnapshot,
          remainingSeconds: currentRemainingSecs,
          violationCount: nextViolationCount,
          updatedAt: nowTs,
        });
      }

      const formattedReason = shouldWipeAnswers
        ? `Pelanggaran ${nextViolationCount}/${MAX_VIOLATION_LIMIT} (Batas Maksimal — Seluruh Jawaban Dihapus Otomatis): ${reason}`
        : `Pelanggaran ${nextViolationCount}/${MAX_VIOLATION_LIMIT}: ${reason}`;

      handleUpdateParticipants((prev) => {
        const exists = prev.some(
          (row) => row.username.trim().toUpperCase() === cleanUser
        );
        const nextList: ProctorParticipantRow[] = exists
          ? prev.map((row) =>
              row.username.trim().toUpperCase() === cleanUser
                ? {
                    ...row,
                    loginState: 'Terkunci (Pelanggaran)',
                    requestReset: true,
                    violationReason: formattedReason,
                    violationAt: timeStr,
                    violationSchema: 3,
                    violationTimestamp: nowTs,
                    violationCount: nextViolationCount,
                    violationPackageId: currentPkgId,
                    draftAnswers: shouldWipeAnswers
                      ? undefined
                      : currentAnswersSnapshot,
                    draftPackageId: shouldWipeAnswers
                      ? undefined
                      : currentPkgId,
                    draftRemainingSeconds: shouldWipeAnswers
                      ? undefined
                      : currentRemainingSecs,
                  }
                : row
            )
          : [
              {
                id: `p_viol_${nowTs}`,
                selected: false,
                status: 'Active',
                kodeTes: 'SAS26SMADIP1',
                username: cleanUser,
                namaPeserta: participant.fullName,
                kelompok: '1',
                kelas: 'XII IPA',
                loginState: 'Terkunci (Pelanggaran)',
                requestReset: true,
                violationReason: formattedReason,
                violationAt: timeStr,
                violationSchema: 3,
                violationTimestamp: nowTs,
                violationCount: nextViolationCount,
                violationPackageId: currentPkgId,
                draftAnswers: shouldWipeAnswers
                  ? undefined
                  : currentAnswersSnapshot,
                draftPackageId: shouldWipeAnswers ? undefined : currentPkgId,
                draftRemainingSeconds: shouldWipeAnswers
                  ? undefined
                  : currentRemainingSecs,
              },
              ...prev,
            ];
        return nextList;
      });

      setLastViolationInfo({
        username: cleanUser,
        fullName: participant.fullName,
        reason: formattedReason,
        timestamp: timeStr,
        violationCount: nextViolationCount,
        answersWiped: shouldWipeAnswers,
      });
      setStage('login');
    },
    [
      handleUpdateParticipants,
      participant.fullName,
      participant.username,
      selectedPackage?.id,
    ]
  );

  // Automatically enter fullscreen on laptop and mobile when in active exam
  useEffect(() => {
    const updateFullscreenState = () => {
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
        msFullscreenElement?: Element | null;
      };
      const active = Boolean(
        doc.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.msFullscreenElement
      );
      setIsFullscreenActive(active);
      return active;
    };

    const suppressIncomingNotifications = () => {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker?.getRegistrations) {
          navigator.serviceWorker
            .getRegistrations()
            .then((regs) => {
              regs.forEach((reg) => {
                if (reg.getNotifications) {
                  reg.getNotifications().then((notifications) => {
                    notifications.forEach((n) => n.close());
                  });
                }
              });
            })
            .catch(() => {});
        }
      } catch {
        // Ignore
      }
    };

    const handleActiveExamUserInteraction = () => {
      suppressIncomingNotifications();
      if (stage === 'exam_running') {
        requestCbtFullscreen();
      }
    };

    window.addEventListener('load', handleActiveExamUserInteraction, { passive: true });
    window.addEventListener('pageshow', handleActiveExamUserInteraction, { passive: true });
    document.addEventListener('pointerdown', handleActiveExamUserInteraction, { capture: true, passive: true });
    document.addEventListener('click', handleActiveExamUserInteraction, { capture: true, passive: true });

    // Handle Esc key on keyboard to exit CBT on laptop
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
        exitCbtFullscreen();

        // Hanya catat pelanggaran jika siswa sudah berada di halaman soal (exam_running)
        // dengan paket yang sudah memiliki butir soal dan pengaturan kunciKeluarSistem aktif
        if (
          stage === 'exam_running' &&
          (selectedPackage?.questions?.length || 0) > 0 &&
          adminSettingsRef.current?.kunciKeluarSistem !== false &&
          Date.now() - examStartedAtRef.current > 4500
        ) {
          lockStudentByViolation(
            'Keluar dari halaman soal ujian CBT (Menekan tombol Esc pada keyboard laptop)'
          );
        } else if (stage === 'exam_running' && (selectedPackage?.questions?.length || 0) === 0) {
          handleUpdateParticipants((prev) =>
            prev.map((row) =>
              row.username.trim().toUpperCase() === participant.username.trim().toUpperCase() &&
              row.loginState === 'Sedang Mengerjakan'
                ? {
                    ...row,
                    loginState: 'Belum Login',
                    requestReset: false,
                    draftAnswers: undefined,
                    draftPackageId: undefined,
                    draftRemainingSeconds: undefined,
                  }
                : row
            )
          );
          setStage('login');
        } else if (
          stage === 'confirm_participant' ||
          stage === 'confirm_test' ||
          stage === 'exam_result'
        ) {
          if (stage === 'confirm_participant' || stage === 'confirm_test') {
            handleUpdateParticipants((prev) =>
              prev.map((row) =>
                row.username.toUpperCase() === participant.username.toUpperCase() &&
                row.loginState === 'Sedang Mengerjakan'
                  ? { ...row, loginState: 'Belum Login', requestReset: false }
                  : row
              )
            );
          }
          setStage('login');
        }
      }
    };

    const handleFullscreenChange = () => {
      updateFullscreenState();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('load', handleActiveExamUserInteraction);
      window.removeEventListener('pageshow', handleActiveExamUserInteraction);
      document.removeEventListener('pointerdown', handleActiveExamUserInteraction, { capture: true });
      document.removeEventListener('click', handleActiveExamUserInteraction, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [
    requestCbtFullscreen,
    exitCbtFullscreen,
    stage,
    lockStudentByViolation,
    handleUpdateParticipants,
    participant.username,
    selectedPackage?.questions?.length,
  ]);

  // Detect student exit violation ONLY when inside active question page (exam_running)
  // with non-empty questions and student genuinely hides the tab / switches application
  useEffect(() => {
    if (stage !== 'exam_running') return;
    if ((selectedPackage?.questions?.length || 0) === 0) return;

    const handleVisibilityViolation = () => {
      if (adminSettingsRef.current?.kunciKeluarSistem === false) return;
      const now = Date.now();
      if (
        document.visibilityState === 'hidden' &&
        now - examStartedAtRef.current > 4500 &&
        now - lastFullscreenRequestAtRef.current > 1500
      ) {
        lockStudentByViolation(
          'Keluar dari halaman soal CBT / berpindah tab atau aplikasi saat ujian berlangsung'
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityViolation);

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityViolation
      );
    };
  }, [stage, lockStudentByViolation, selectedPackage?.questions?.length]);

  const handleRequestResetFromLogin = useCallback(
    (username: string) => {
      const cleanUser = username.trim().toUpperCase();
      const nowTs = Date.now();
      const timeStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      requestResetFromServer(cleanUser).catch(() => {});
      handleUpdateParticipants((prev) =>
        prev.map((row) =>
          row.username.toUpperCase() === cleanUser
            ? {
                ...row,
                loginState: 'Terkunci (Pelanggaran)',
                requestReset: true,
                violationReason:
                  row.violationReason ||
                  'Siswa mengajukan permintaan Reset Login ke Proktor/Administrator',
                violationAt: row.violationAt || timeStr,
                violationSchema: 3,
                violationTimestamp: nowTs,
              }
            : row
        )
      );
    },
    [handleUpdateParticipants]
  );

  const handleLoginSuccess = (username: string) => {
    const cleanUser = username.trim().toUpperCase();
    const shortUser = shortenStudentUsername(cleanUser);
    const matchedRow = participantsRef.current.find(
      (p) =>
        p.username.trim().toUpperCase() === cleanUser ||
        shortenStudentUsername(p.username) === shortUser ||
        p.namaPeserta.trim().toUpperCase() === cleanUser
    );

    // Block login if username is not registered
    if (!matchedRow) {
      return;
    }

    // Block login if student status is Non Active in Kelompok Tes
    if (!isParticipantStatusActive(matchedRow.status)) {
      return;
    }

    // Block login if student is locked due to exit violation
    if (isParticipantLockedByViolation(matchedRow)) {
      return;
    }

    const resolvedUsername = matchedRow.username.trim().toUpperCase();
    const resolvedFullName = matchedRow.namaPeserta || cleanUser;
    const resolvedKelas = normalizeKelasCode(matchedRow.kelas) || 'X';

    const studentClassSchedules = activeSchedules.filter((s) =>
      doesKelasMatch(resolvedKelas, s.kelas)
    );

    const completedSubjects = new Set(
      resultsHistoryRef.current
        .filter(
          (r) =>
            (r.participant?.username || '').trim().toUpperCase() ===
            resolvedUsername
        )
        .map((r) => cleanMapelTitle(r.packageTitle || '').toLowerCase())
        .filter(Boolean)
    );

    const firstUncompletedSchedule =
      studentClassSchedules.find(
        (s) => !completedSubjects.has(cleanMapelTitle(s.mapel).toLowerCase())
      ) || studentClassSchedules[0];

    if (
      matchedRow.loginState === 'Selesai' &&
      (studentClassSchedules.length === 0 ||
        studentClassSchedules.every((s) =>
          completedSubjects.has(cleanMapelTitle(s.mapel).toLowerCase())
        ))
    ) {
      return;
    }

    requestCbtFullscreen();

    // Update or register participant in shared Vercel Storage (without locking or marking exam running yet)
    handleUpdateParticipants((prev) => {
      const exists = prev.some(
        (row) => row.username.trim().toUpperCase() === resolvedUsername
      );
      if (exists) {
        return prev.map((row) =>
          row.username.trim().toUpperCase() === resolvedUsername
            ? {
                ...row,
                requestReset: false,
                violationReason: undefined,
                violationAt: undefined,
                violationSchema: undefined,
                violationTimestamp: undefined,
              }
            : row
        );
      }
      return [
        {
          id: `p_${Date.now()}`,
          selected: false,
          status: 'Active',
          kodeTes: 'SAS26SMADIP1',
          username: resolvedUsername,
          namaPeserta: resolvedFullName,
          kelompok: '1',
          kelas: resolvedKelas,
          loginState: 'Belum Login',
          requestReset: false,
        },
        ...prev,
      ];
    });

    const scheduledPkg = firstUncompletedSchedule
      ? resolvePackageForSchedule(firstUncompletedSchedule, packages)
      : undefined;

    setLastViolationInfo(null);
    setParticipant((prev) => ({
      ...prev,
      username: resolvedUsername,
      fullName: resolvedFullName,
      kelas: resolvedKelas,
      activeSubjectTitle: firstUncompletedSchedule?.mapel || '',
      selectedPackageId: scheduledPkg?.id || '',
    }));
    setStage('confirm_participant');
  };

  const handleRefreshToken = () => {
    handleUpdateToken(generateRandomToken());
  };

  const handleConfirmParticipant = (updatedProfile: ParticipantProfile) => {
    requestCbtFullscreen();
    setParticipant(updatedProfile);
    setStage('confirm_test');
  };

  const handleStartExam = () => {
    if (getRealQuestionsCount(selectedPackage) === 0) {
      return;
    }
    const cleanUser = participant.username.trim().toUpperCase();
    const currentPkgId = selectedPackage?.id || FALLBACK_EMPTY_PACKAGE.id;
    const matchedRow = participantsRef.current.find(
      (r) => r.username.trim().toUpperCase() === cleanUser
    );
    if (!matchedRow || !isParticipantStatusActive(matchedRow.status)) {
      clearAuthSessionToken();
      setStage('login');
      return;
    }
    examStartedAtRef.current = Date.now();
    requestCbtFullscreen();
    const localDraft = readStudentDraftFromLocal(cleanUser, currentPkgId);

    const sameViolationPkg =
      !matchedRow?.violationPackageId ||
      matchedRow.violationPackageId === currentPkgId;
    const rowVCount =
      sameViolationPkg && typeof matchedRow?.violationCount === 'number'
        ? matchedRow.violationCount
        : 0;
    const localVCount =
      sameViolationPkg && typeof localDraft?.violationCount === 'number'
        ? localDraft.violationCount
        : 0;
    const mergedViolationCount = Math.max(rowVCount, localVCount);

    const isRemoteResetNewerThanLocalDraft = Boolean(
      matchedRow &&
        !matchedRow.draftAnswers &&
        (matchedRow.lastResetAt || 0) > (localDraft?.updatedAt || 0)
    );
    if (isRemoteResetNewerThanLocalDraft) {
      clearStudentDraftInLocal(cleanUser, currentPkgId);
    }

    let restoredAnswers: Record<string, StudentAnswer> = {};
    let restoredRemainingSecs: number | undefined = undefined;
    let effectiveViolationCount = mergedViolationCount;

    if (mergedViolationCount >= MAX_VIOLATION_LIMIT) {
      // Siswa sebelumnya telah mencapai 6x pelanggaran: jawaban sudah dihapus, mulai dari awal (0/6)
      effectiveViolationCount = 0;
      clearStudentDraftInLocal(cleanUser, currentPkgId);
    } else {
      // Pulihkan jawaban dan sisa waktu jika siswa kembali masuk setelah Reset Login (pelanggaran 1x-5x)
      const hasLocalAnswers =
        !isRemoteResetNewerThanLocalDraft &&
        Boolean(
          localDraft &&
            localDraft.packageId === currentPkgId &&
            localDraft.answers &&
            Object.keys(localDraft.answers).length > 0
        );
      const hasRemoteAnswers =
        matchedRow?.draftPackageId === currentPkgId &&
        matchedRow?.draftAnswers &&
        Object.keys(matchedRow.draftAnswers).length > 0;

      if (hasLocalAnswers && hasRemoteAnswers) {
        restoredAnswers = {
          ...matchedRow!.draftAnswers!,
          ...localDraft!.answers,
        };
      } else if (hasLocalAnswers) {
        restoredAnswers = { ...localDraft!.answers };
      } else if (hasRemoteAnswers) {
        restoredAnswers = { ...matchedRow!.draftAnswers! };
      }

      if (
        !isRemoteResetNewerThanLocalDraft &&
        typeof localDraft?.remainingSeconds === 'number' &&
        localDraft.remainingSeconds > 0
      ) {
        restoredRemainingSecs = localDraft.remainingSeconds;
      } else if (
        matchedRow?.draftPackageId === currentPkgId &&
        typeof matchedRow?.draftRemainingSeconds === 'number' &&
        matchedRow.draftRemainingSeconds > 0
      ) {
        restoredRemainingSecs = matchedRow.draftRemainingSeconds;
      }
    }

    setAnswers(restoredAnswers);
    answersRef.current = restoredAnswers;
    setExamInitialRemainingSeconds(restoredRemainingSecs);
    examRemainingSecondsRef.current = restoredRemainingSecs;
    setTimeUsedSeconds(0);

    handleUpdateParticipants((prev) =>
      prev.map((row) =>
        row.username.trim().toUpperCase() === cleanUser
          ? {
              ...row,
              loginState: 'Sedang Mengerjakan',
              requestReset: false,
              violationReason: undefined,
              violationAt: undefined,
              violationSchema: undefined,
              violationTimestamp: undefined,
              violationCount: effectiveViolationCount,
              violationPackageId:
                effectiveViolationCount > 0 ? currentPkgId : undefined,
              loginUpdatedAt: Date.now(),
              draftPackageId: currentPkgId,
              draftAnswers: restoredAnswers,
              draftRemainingSeconds: restoredRemainingSecs,
              draftUpdatedAt: Date.now(),
            }
          : row
      )
    );
    setStage('exam_running');
  };

  const handleRemainingSecondsChange = useCallback(
    (secsLeft: number) => {
      examRemainingSecondsRef.current = secsLeft;
      const cleanUser = participant.username.trim().toUpperCase();
      const currentPkgId = selectedPackage?.id || FALLBACK_EMPTY_PACKAGE.id;
      const matchedRow = participantsRef.current.find(
        (r) => r.username.trim().toUpperCase() === cleanUser
      );
      const currentVCount =
        typeof matchedRow?.violationCount === 'number'
          ? matchedRow.violationCount
          : 0;
      writeStudentDraftToLocal({
        username: cleanUser,
        packageId: currentPkgId,
        answers: answersRef.current,
        remainingSeconds: secsLeft,
        violationCount: currentVCount,
        updatedAt: Date.now(),
      });
    },
    [participant.username, selectedPackage?.id]
  );

  const handleUpdateAnswer = useCallback(
    (questionId: string, updater: (prev: StudentAnswer) => StudentAnswer) => {
      const cleanUser = participant.username.trim().toUpperCase();
      const currentPkgId = selectedPackage?.id || FALLBACK_EMPTY_PACKAGE.id;
      setAnswers((prevMap) => {
        const current = prevMap[questionId] || { questionId };
        const nextMap = {
          ...prevMap,
          [questionId]: updater(current),
        };
        answersRef.current = nextMap;

        const matchedRow = participantsRef.current.find(
          (r) => r.username.trim().toUpperCase() === cleanUser
        );
        const currentVCount =
          typeof matchedRow?.violationCount === 'number'
            ? matchedRow.violationCount
            : 0;

        writeStudentDraftToLocal({
          username: cleanUser,
          packageId: currentPkgId,
          answers: nextMap,
          remainingSeconds: examRemainingSecondsRef.current,
          violationCount: currentVCount,
          updatedAt: Date.now(),
        });

        // Debounce remote server sync by 5000ms so 131 concurrent students answering/typing
        // do not flood /api/storage (or trigger Vercel 403 rate limits) while keeping localStorage 0ms instant
        if (draftSyncTimerRef.current) {
          window.clearTimeout(draftSyncTimerRef.current);
        }
        draftSyncTimerRef.current = window.setTimeout(() => {
          draftSyncTimerRef.current = null;
          handleUpdateParticipants((prev) =>
            prev.map((row) =>
              row.username.trim().toUpperCase() === cleanUser
                ? {
                    ...row,
                    draftPackageId: currentPkgId,
                    draftAnswers: answersRef.current,
                    draftRemainingSeconds: examRemainingSecondsRef.current,
                    draftUpdatedAt: Date.now(),
                  }
                : row
            )
          );
        }, 5000);

        return nextMap;
      });
    },
    [handleUpdateParticipants, participant.username, selectedPackage?.id]
  );

  const applyAuthoritativeResultSummary = useCallback(
    (localResultId: string, serverSummary: ExamResultSummary) => {
      setResultsHistory((prev) => {
        let replaced = false;
        const nextHistory = prev.map((item) => {
          if (item.id === localResultId || item.id === serverSummary.id) {
            replaced = true;
            return serverSummary;
          }
          return item;
        });
        const finalHistory = replaced
          ? nextHistory
          : [serverSummary, ...nextHistory];
        resultsHistoryRef.current = finalHistory;
        try {
          localStorage.setItem(
            STORAGE_KEYS.HISTORY,
            JSON.stringify(finalHistory)
          );
        } catch {
          // ignore
        }
        return finalHistory;
      });
    },
    []
  );

  const flushPendingExamSubmissions = useCallback(async () => {
    const queue = readPendingExamSubmissions();
    if (queue.length === 0) return;

    for (const item of queue) {
      try {
        const res = await submitExamToServer({
          packageId: item.packageId,
          packageTitle: item.packageTitle,
          answers: item.answers,
          timeUsedSeconds: item.timeUsedSeconds,
          participant: item.participant,
          clientFallbackSummary: item.clientFallbackSummary,
        });
        if (res.ok) {
          removePendingExamSubmission(item.localResultId);
          if (res.summary) {
            applyAuthoritativeResultSummary(item.localResultId, res.summary);
          }
          if (typeof res.updatedAt === 'number') {
            latestUpdatedAtRef.current = Math.max(
              latestUpdatedAtRef.current,
              res.updatedAt
            );
          }
          markSyncedSuccess(res.engine || 'vercel-serverless');
        }
      } catch {
        // Keep in queue until next online/retry cycle
      }
    }
  }, [applyAuthoritativeResultSummary, markSyncedSuccess]);

  useEffect(() => {
    flushPendingExamSubmissions().catch(() => {});
    const onOnline = () => {
      flushPendingExamSubmissions().catch(() => {});
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushPendingExamSubmissions]);

  const handleFinishExam = useCallback(
    (usedSeconds: number) => {
      if (draftSyncTimerRef.current) {
        window.clearTimeout(draftSyncTimerRef.current);
        draftSyncTimerRef.current = null;
      }
      setTimeUsedSeconds(usedSeconds);

      // Compute local fallback summary (server will grade authoritatively with answer keys)
      const latestAnswers = answersRef.current || answers;
      const questions = Array.isArray(selectedPackage?.questions)
        ? selectedPackage.questions
        : [];
      let totalPoints = 0;
      let maxPoints = 0;
      let correctCount = 0;
      let answeredCount = 0;

      questions.forEach((q) => {
        const ans = latestAnswers[q.id];
        maxPoints += q.points;
        if (isQuestionAnswered(q, ans)) answeredCount += 1;
        const { isCorrect, earnedPoints } = evaluateQuestionScore(q, ans);
        if (isCorrect) correctCount += 1;
        totalPoints += earnedPoints;
      });

      const finalScore =
        maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

      const nowTs = Date.now();
      const summary: ExamResultSummary = {
        id: `res_${nowTs}_${Math.random().toString(36).slice(2, 6)}`,
        participant,
        packageTitle: selectedPackage?.title || FALLBACK_EMPTY_PACKAGE.title,
        completedAt: new Date().toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        timeUsedSeconds: usedSeconds,
        totalQuestions: questions.length,
        answeredCount,
        correctCount,
        totalPoints,
        maxPoints,
        finalScore,
      };

      const cleanUser = participant.username.trim().toUpperCase();
      const pkgId = selectedPackage?.id || FALLBACK_EMPTY_PACKAGE.id;
      clearStudentDraftInLocal(cleanUser, pkgId);
      examRemainingSecondsRef.current = undefined;
      setExamInitialRemainingSeconds(undefined);
      lastLocalMutationAt.current = nowTs;

      setParticipants((prev) => {
        const nextList = sanitizeParticipantRows(
          prev.map((row) =>
            row.username.trim().toUpperCase() === cleanUser
              ? {
                  ...row,
                  loginState: 'Selesai',
                  requestReset: false,
                  violationReason: undefined,
                  violationAt: undefined,
                  violationSchema: undefined,
                  violationTimestamp: undefined,
                  violationCount: 0,
                  violationPackageId: undefined,
                  loginUpdatedAt: Math.max(
                    (row.loginUpdatedAt || 0) + 1,
                    nowTs
                  ),
                  draftAnswers: undefined,
                  draftPackageId: undefined,
                  draftRemainingSeconds: undefined,
                  draftUpdatedAt: Math.max(
                    (row.draftUpdatedAt || 0) + 1,
                    nowTs
                  ),
                }
              : row
          )
        );
        participantsRef.current = nextList;
        try {
          localStorage.setItem(
            STORAGE_KEYS.PARTICIPANTS,
            JSON.stringify(nextList)
          );
        } catch {
          // ignore
        }
        return nextList;
      });

      setResultsHistory((prev) => {
        const nextHistory = [summary, ...prev];
        resultsHistoryRef.current = nextHistory;
        try {
          localStorage.setItem(
            STORAGE_KEYS.HISTORY,
            JSON.stringify(nextHistory)
          );
        } catch {
          // ignore
        }
        return nextHistory;
      });

      const submissionPayload: PendingExamSubmission = {
        localResultId: summary.id,
        packageId: pkgId,
        packageTitle: summary.packageTitle,
        answers: latestAnswers,
        timeUsedSeconds: usedSeconds,
        participant,
        clientFallbackSummary: summary,
        queuedAt: nowTs,
      };
      enqueuePendingExamSubmission(submissionPayload);
      setLatestExamSummary(null);
      setIsSubmittingExamResult(true);

      // Authoritative server grading & persistence with automatic retry backoff
      pendingPushCount.current += 1;
      const attemptSubmit = async (retryIdx: number) => {
        try {
          const res = await submitExamToServer({
            packageId: submissionPayload.packageId,
            packageTitle: submissionPayload.packageTitle,
            answers: submissionPayload.answers,
            timeUsedSeconds: submissionPayload.timeUsedSeconds,
            participant: submissionPayload.participant,
            clientFallbackSummary: submissionPayload.clientFallbackSummary,
          });
          if (res.ok) {
            removePendingExamSubmission(submissionPayload.localResultId);
            const authoritative = res.summary || summary;
            applyAuthoritativeResultSummary(
              submissionPayload.localResultId,
              authoritative
            );
            setLatestExamSummary(authoritative);
            setIsSubmittingExamResult(false);
            if (typeof res.updatedAt === 'number') {
              latestUpdatedAtRef.current = Math.max(
                latestUpdatedAtRef.current,
                res.updatedAt
              );
            }
            markSyncedSuccess(res.engine || 'vercel-serverless');
            pendingPushCount.current = Math.max(0, pendingPushCount.current - 1);
            return;
          }
        } catch {
          // Fall through to retry schedule
        }

        const backoffMs = [2500, 6000, 12000][retryIdx];
        if (typeof backoffMs === 'number') {
          window.setTimeout(() => {
            attemptSubmit(retryIdx + 1);
          }, backoffMs);
        } else {
          // Remain persisted in PENDING_RESULTS queue for auto-flush on online/reconnect
          setIsSubmittingExamResult(false);
          pendingPushCount.current = Math.max(0, pendingPushCount.current - 1);
        }
      };

      attemptSubmit(0);
      setStage('exam_result');
    },
    [
      answers,
      applyAuthoritativeResultSummary,
      markSyncedSuccess,
      participant,
      selectedPackage,
    ]
  );

  const handleCancelEmptyExam = useCallback(() => {
    if (draftSyncTimerRef.current) {
      window.clearTimeout(draftSyncTimerRef.current);
      draftSyncTimerRef.current = null;
    }
    const cleanUser = participant.username.trim().toUpperCase();
    clearStudentDraftInLocal(
      cleanUser,
      selectedPackage?.id || FALLBACK_EMPTY_PACKAGE.id
    );
    examRemainingSecondsRef.current = undefined;
    setExamInitialRemainingSeconds(undefined);
    handleUpdateParticipants((prev) =>
      prev.map((row) =>
        row.username.trim().toUpperCase() === cleanUser
          ? {
              ...row,
              loginState:
                row.loginState === 'Sedang Mengerjakan'
                  ? 'Belum Login'
                  : row.loginState,
              requestReset: false,
              draftAnswers: undefined,
              draftPackageId: undefined,
              draftRemainingSeconds: undefined,
            }
          : row
      )
    );
    exitCbtFullscreen();
    setAnswers({});
    answersRef.current = {};
    setStage('login');
  }, [
    exitCbtFullscreen,
    handleUpdateParticipants,
    participant.username,
    selectedPackage?.id,
  ]);

  const handleLogout = () => {
    if (stage === 'exam_running') {
      if ((selectedPackage?.questions?.length || 0) === 0) {
        handleCancelEmptyExam();
        return;
      }
      // Jangan panggil setAnswers({}) di sini agar lockStudentByViolation
      // menyimpan jawaban untuk pelanggaran 1..5 dan hanya menghapus jika mencapai 6x
      lockStudentByViolation(
        'Keluar dari halaman soal CBT sebelum menyelesaikan ujian'
      );
      return;
    }
    if (stage === 'confirm_participant' || stage === 'confirm_test') {
      handleUpdateParticipants((prev) =>
        prev.map((row) =>
          row.username.toUpperCase() === participant.username.toUpperCase() &&
          row.loginState === 'Sedang Mengerjakan'
            ? { ...row, loginState: 'Belum Login', requestReset: false }
            : row
        )
      );
    }
    exitCbtFullscreen();
    clearAuthSessionToken();
    setLatestExamSummary(null);
    setAnswers({});
    answersRef.current = {};
    setStage('login');
  };

  // Dedicated Full-Screen Proctor Dashboard (matches the reference image)
  if (stage === 'proctor_dashboard') {
    return (
      <ProctorDashboardView
        proctorName={proctorSession.name}
        encryptionCode={proctorSession.encryptionCode}
        onUpdateProctorName={(newName: string) => {
          setProctorSession((prev) => ({ ...prev, name: newName }));
        }}
        proctors={proctors}
        onUpdateProctors={handleUpdateProctors}
        activeToken={activeToken}
        tokenSecondsLeft={tokenSecondsLeft}
        tokenDurationSeconds={TOKEN_DURATION_SECONDS}
        onUpdateToken={handleUpdateToken}
        adminSettings={adminSettings}
        onUpdateAdminSettings={handleUpdateAdminSettings}
        isScheduleActive={isScheduleActive}
        activeSchedules={activeSchedules}
        participants={participants}
        onUpdateParticipants={handleUpdateParticipants}
        packages={packages}
        onUpdatePackages={handleUpdatePackages}
        onResetDefaultPackages={() => handleUpdatePackages(INITIAL_EXAM_PACKAGES)}
        resultsHistory={resultsHistory}
        onClearHistory={() => handleUpdateResultsHistory([])}
        onLogoutProctor={() => {
          clearAuthSessionToken();
          exitCbtFullscreen();
          setStage('login');
        }}
      />
    );
  }

  // Dedicated Full-Screen Administrator Dashboard
  if (stage === 'admin_dashboard') {
    return (
      <AdminDashboardView
        adminUsername={adminUsername}
        activeToken={activeToken}
        tokenSecondsLeft={tokenSecondsLeft}
        tokenDurationSeconds={TOKEN_DURATION_SECONDS}
        onUpdateToken={handleUpdateToken}
        adminSettings={adminSettings}
        onUpdateAdminSettings={handleUpdateAdminSettings}
        schedules={schedules}
        onUpdateSchedules={handleUpdateSchedules}
        participants={participants}
        onUpdateParticipants={handleUpdateParticipants}
        proctors={proctors}
        onUpdateProctors={handleUpdateProctors}
        packages={packages}
        onUpdatePackages={handleUpdatePackages}
        onResetDefaultPackages={() => handleUpdatePackages(INITIAL_EXAM_PACKAGES)}
        resultsHistory={resultsHistory}
        onClearHistory={() => handleUpdateResultsHistory([])}
        storageEngine={storageEngine}
        lastSyncedLabel={lastSyncedLabel}
        onForceSyncStorage={pushToVercelCloud}
        onLogoutAdmin={() => {
          clearAuthSessionToken();
          exitCbtFullscreen();
          setStage('login');
        }}
      />
    );
  }

  const isAuthScreen =
    stage === 'login' || stage === 'proctor_login' || stage === 'admin_login';

  return (
    <div className="min-h-dvh flex flex-col bg-[#eef1f6] text-slate-800">
      {/* Top Official Geometric Blue Header */}
      <PusmendikHeader
        participantName={!isAuthScreen ? participant.fullName : undefined}
        participantCode={!isAuthScreen ? participant.username : undefined}
        onLogout={!isAuthScreen ? handleLogout : undefined}
        onOpenAdminLogin={
          stage !== 'exam_running' ? () => setStage('admin_login') : undefined
        }
        onOpenProctorModal={
          stage !== 'exam_running' ? () => setStage('proctor_login') : undefined
        }
        onExitApp={stage === 'login' ? handleExitApp : undefined}
        compact={stage === 'exam_running'}
      />

      {/* Stage 1: Login Card (Peserta) */}
      {stage === 'login' && (
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          onOpenProctorModal={() => setStage('proctor_login')}
          onExitApp={handleExitApp}
          participants={participants}
          activeSchedules={activeSchedules}
          resultsHistory={resultsHistory}
          lastViolationInfo={lastViolationInfo}
          violationMessage={
            typeof adminSettings.pesanPelanggaran === 'string'
              ? adminSettings.pesanPelanggaran
              : undefined
          }
          onRequestResetLogin={handleRequestResetFromLogin}
          onRefreshParticipants={() => syncFromVercelCloud({ force: true })}
        />
      )}

      {/* Stage 1B: Halaman Login Khusus Proktor */}
      {stage === 'proctor_login' && (
        <ProctorLoginView
          proctors={proctors}
          onRefreshProctors={async () => {
            await syncFromVercelCloud({ force: true });
            return proctorsRef.current;
          }}
          onProctorLoginSuccess={(proctorName, encryptionCode) => {
            setProctorSession({ name: proctorName, encryptionCode });
            syncFromVercelCloud({ force: true }).catch(() => {});
            if (authSpinTimerRef.current) {
              window.clearTimeout(authSpinTimerRef.current);
            }
            setIsAuthSpinning(true);
            authSpinTimerRef.current = window.setTimeout(() => {
              setIsAuthSpinning(false);
              setStage('proctor_dashboard');
            }, 5000);
          }}
          onBackToStudentLogin={() => setStage('login')}
          onGoToAdminLogin={() => setStage('admin_login')}
        />
      )}

      {/* Stage 1C: Halaman Login Khusus Administrator */}
      {stage === 'admin_login' && (
        <AdminLoginView
          adminSettings={adminSettings}
          onRefreshAdminSettings={async () => {
            await syncFromVercelCloud({ force: true });
            return adminSettingsRef.current;
          }}
          onAdminLoginSuccess={(adminUser) => {
            setAdminUsername(adminUser);
            syncFromVercelCloud({ force: true }).catch(() => {});
            if (authSpinTimerRef.current) {
              window.clearTimeout(authSpinTimerRef.current);
            }
            setIsAuthSpinning(true);
            authSpinTimerRef.current = window.setTimeout(() => {
              setIsAuthSpinning(false);
              setStage('admin_dashboard');
            }, 5000);
          }}
          onBackToStudentLogin={() => setStage('login')}
          onGoToProctorLogin={() => setStage('proctor_login')}
        />
      )}

      {/* Overlay Animasi Berputar 5 Detik (Background Blur, Tanpa Tulisan Apapun) */}
      {isAuthSpinning && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-900/35 backdrop-blur-md flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-white/25" />
            <div className="w-16 h-16 rounded-full border-4 border-transparent border-t-[#0088ff] border-r-[#0088ff] animate-spin" />
          </div>
        </div>
      )}

      {/* Stage 2: Konfirmasi Data Peserta & Token */}
      {stage === 'confirm_participant' && (
        <ParticipantConfirmationView
          initialProfile={participant}
          packages={packages}
          participants={participants}
          resultsHistory={resultsHistory}
          activeToken={activeToken}
          isScheduleActive={isScheduleActive}
          activeSchedules={activeSchedules}
          onRefreshToken={handleRefreshToken}
          onSyncRemoteData={({
            packages: remotePkgs,
            schedules: remoteSchs,
            activeToken: remoteTok,
            tokenUpdatedAt: remoteTokenTs,
          }) => {
            if (Array.isArray(remotePkgs) && remotePkgs.length > 0) {
              const cleaned = filterOutSimulasiTka(remotePkgs);
              const merged = mergePackagesPreservingQuestions(
                cleaned,
                packagesRef.current
              );
              packagesRef.current = merged;
              setPackages(merged);
            }
            if (Array.isArray(remoteSchs) && remoteSchs.length > 0) {
              const mergedSchs = mergeSchedulesByTimestamp(
                remoteSchs,
                schedulesRef.current
              );
              schedulesRef.current = mergedSchs;
              setSchedules(mergedSchs);
            }
            if (typeof remoteTok === 'string' && remoteTok) {
              activeTokenRef.current = remoteTok;
              setActiveToken(remoteTok);
              if (typeof remoteTokenTs === 'number' && remoteTokenTs > 0) {
                tokenUpdatedAtRef.current = Math.max(
                  tokenUpdatedAtRef.current,
                  remoteTokenTs
                );
                const nextEndMs =
                  remoteTokenTs + TOKEN_DURATION_SECONDS * 1000 > Date.now()
                    ? remoteTokenTs + TOKEN_DURATION_SECONDS * 1000
                    : Date.now() + TOKEN_DURATION_SECONDS * 1000;
                tokenEndTimeRef.current = nextEndMs;
                setTokenSecondsLeft(
                  Math.max(0, Math.ceil((nextEndMs - Date.now()) / 1000))
                );
              }
            }
          }}
          onSubmitProfile={handleConfirmParticipant}
        />
      )}

      {/* Stage 3: Konfirmasi Tes */}
      {stage === 'confirm_test' && (
        <TestConfirmationView
          profile={participant}
          examPackage={selectedPackage}
          onStartExam={handleStartExam}
          onBackToProfile={() => setStage('confirm_participant')}
        />
      )}

      {/* Stage 4: Lembar Ujian CBT */}
      {stage === 'exam_running' && (
        <ExamRunnerView
          examPackage={selectedPackage}
          participantUsername={participant.username}
          answers={answers}
          onUpdateAnswer={handleUpdateAnswer}
          onFinishExam={handleFinishExam}
          onCancelEmptyExam={handleCancelEmptyExam}
          initialRemainingSeconds={examInitialRemainingSeconds}
          onRemainingSecondsChange={handleRemainingSecondsChange}
          shuffleQuestions={adminSettings.acakSoal !== false}
          shuffleOptions={adminSettings.acakOpsi !== false}
          minMinutesBeforeFinish={
            adminSettings.enforceMinFinishTime
              ? Number(adminSettings.minMinutesBeforeFinish) || 0
              : 0
          }
          showResultScore={Boolean(adminSettings.tampilkanNilaiPeserta)}
          violationCount={(() => {
            const vRow = participants.find(
              (p) =>
                p.username.trim().toUpperCase() ===
                participant.username.trim().toUpperCase()
            );
            if (
              !vRow ||
              (vRow.violationPackageId &&
                vRow.violationPackageId !== selectedPackage.id)
            ) {
              return 0;
            }
            return vRow.violationCount || 0;
          })()}
        />
      )}

      {/* Stage 5: Laporan Hasil & Pembahasan */}
      {stage === 'exam_result' && (
        <ExamResultView
          profile={participant}
          examPackage={selectedPackage}
          answers={answers}
          timeUsedSeconds={timeUsedSeconds}
          showResultScore={Boolean(adminSettings.tampilkanNilaiPeserta)}
          serverSummary={latestExamSummary}
          isSyncingResult={isSubmittingExamResult}
          onRetakeOrChangePackage={() => setStage('confirm_participant')}
          onLogout={handleLogout}
        />
      )}

      {/* Modal Konfirmasi Tutup / Keluar Aplikasi CBT */}
      {showExitAppConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-cbt-slide-up">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
              <Power className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Tutup Aplikasi CBT?
              </h3>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin keluar dan menutup aplikasi CBT SMA Islam Diponegoro Wagir?
              </p>
            </div>
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowExitAppConfirmModal(false)}
                className="flex-1 py-2 px-3 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitAppConfirmModal(false);
                  handleConfirmExitApp();
                }}
                className="flex-1 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Ya, Keluar CBT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
