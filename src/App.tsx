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
  fetchVercelStorage,
  saveVercelStorage,
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
};

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

  const TOKEN_DURATION_SECONDS = 600; // 10 menit (600 detik)

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

  const tokenEndTimeRef = useRef<number>(
    Date.now() + TOKEN_DURATION_SECONDS * 1000
  );

  const [tokenSecondsLeft, setTokenSecondsLeft] = useState<number>(
    TOKEN_DURATION_SECONDS
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
  const draftSyncTimerRef = useRef<number | null>(null);
  const isSyncInFlightRef = useRef<boolean>(false);
  const lastSyncAttemptAtRef = useRef<number>(0);

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

  const handleUpdateToken = useCallback(
    (nextToken: string) => {
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
      saveVercelStorage({ activeToken: cleanToken, tokenUpdatedAt: nowTs })
        .then((res) => {
          if (res.ok) markSyncedSuccess(res.engine);
        })
        .finally(() => {
          pendingPushCount.current = Math.max(0, pendingPushCount.current - 1);
        });
    },
    [markSyncedSuccess]
  );

  // Automatic 10-minute token countdown timer (wall-clock based, never rotates early)
  useEffect(() => {
    const tick = () => {
      const diffMs = tokenEndTimeRef.current - Date.now();
      const secsLeft = Math.max(0, Math.ceil(diffMs / 1000));
      setTokenSecondsLeft(secsLeft);

      if (secsLeft <= 0) {
        tokenEndTimeRef.current = Date.now() + TOKEN_DURATION_SECONDS * 1000;
        setTokenSecondsLeft(TOKEN_DURATION_SECONDS);
        // Only rotate token on server when schedule is active and user is in Admin/Proctor dashboard
        if (
          isScheduleActive &&
          (stage === 'admin_dashboard' || stage === 'proctor_dashboard')
        ) {
          const next = generateRandomToken();
          handleUpdateToken(next);
        }
      }
    };

    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [generateRandomToken, handleUpdateToken, isScheduleActive, stage]);

  const [participant, setParticipant] = useState<ParticipantProfile>({
    username: 'SA20266475',
    nik: '3273011805080002',
    fullName: 'NADIA PUTRI PRATAMA',
    schoolName: 'SMA ISLAM DIPONEGORO WAGIR',
    gender: 'Perempuan',
    birthDay: '18',
    birthMonth: '05',
    birthYear: '2008',
    selectedPackageId: INITIAL_EXAM_PACKAGES[0].id,
    enteredToken: DEFAULT_EXAM_TOKEN,
  });

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
        pendingPushCount.current += 1;
        saveVercelStorage({
          packages: nextPackages,
          deletedPackageIds,
          forceReplacePackages: explicitDeleteOrReduce,
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
      lastLocalMutationAt.current = nowTs;
      setParticipants((prev) => {
        const rawNext =
          typeof updater === 'function' ? updater(prev) : updater;

        const prevByUser = new Map<string, ProctorParticipantRow>();
        const prevById = new Map<string, ProctorParticipantRow>();
        prev.forEach((p) => {
          prevByUser.set(p.username.trim().toUpperCase(), p);
          prevById.set(p.id, p);
        });

        // Stamp monotonic CRDT timestamps on any modified fields so concurrent polls never revert changes
        const stampedNext = rawNext.map((row) => {
          const prevRow =
            prevById.get(row.id) ||
            prevByUser.get(row.username.trim().toUpperCase());
          if (!prevRow) {
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
          const loginChanged = prevRow.loginState !== row.loginState;
          const draftChanged =
            prevRow.draftAnswers !== row.draftAnswers ||
            prevRow.draftPackageId !== row.draftPackageId ||
            prevRow.draftRemainingSeconds !== row.draftRemainingSeconds;

          return {
            ...row,
            ...(metaChanged
              ? { metaUpdatedAt: Math.max(row.metaUpdatedAt || 0, nowTs) }
              : {}),
            ...(loginChanged
              ? { loginUpdatedAt: Math.max(row.loginUpdatedAt || 0, nowTs) }
              : {}),
            ...(draftChanged
              ? { draftUpdatedAt: Math.max(row.draftUpdatedAt || 0, nowTs) }
              : {}),
          };
        });

        const nextParticipants = sanitizeParticipantRows(stampedNext);
        participantsRef.current = nextParticipants;
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

        if (!isAdminOrProctor) {
          // Student-side mutation: NEVER push the full participants array from a student browser.
          // Only send a partial patch for the specific student row(s) that changed.
          const changedPatches = nextParticipants
            .filter((row) => {
              const prevRow = prevByUser.get(row.username.trim().toUpperCase());
              if (!prevRow) return true;
              return (
                prevRow.loginState !== row.loginState ||
                prevRow.requestReset !== row.requestReset ||
                prevRow.violationReason !== row.violationReason ||
                prevRow.violationTimestamp !== row.violationTimestamp ||
                prevRow.violationCount !== row.violationCount ||
                prevRow.draftAnswers !== row.draftAnswers ||
                prevRow.draftPackageId !== row.draftPackageId ||
                prevRow.draftRemainingSeconds !== row.draftRemainingSeconds ||
                prevRow.status !== row.status
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
              draftAnswers: (row.draftAnswers ?? null) as any,
              draftPackageId: (row.draftPackageId ?? null) as any,
              draftRemainingSeconds: (row.draftRemainingSeconds ?? null) as any,
              lastResetAt: row.lastResetAt,
              loginUpdatedAt: row.loginUpdatedAt,
              metaUpdatedAt: row.metaUpdatedAt,
              draftUpdatedAt: row.draftUpdatedAt,
            }));

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

        pendingPushCount.current += 1;
        saveVercelStorage({
          participants: nextParticipants,
          deletedParticipantIds,
          forceReplaceParticipants: true,
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
      lastLocalMutationAt.current = Date.now();
      setResultsHistory((prev) => {
        const nextHistory =
          typeof updater === 'function' ? updater(prev) : updater;
        resultsHistoryRef.current = nextHistory;
        try {
          localStorage.setItem(
            STORAGE_KEYS.HISTORY,
            JSON.stringify(nextHistory)
          );
        } catch {
          // ignore
        }
        pendingPushCount.current += 1;
        saveVercelStorage({
          resultsHistory: nextHistory,
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

        const isAdminOrProctorStage =
          stageRef.current === 'admin_dashboard' ||
          stageRef.current === 'proctor_dashboard';

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

          // 1. Token CRDT reconciliation by tokenUpdatedAt
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
              tokenEndTimeRef.current =
                Date.now() + TOKEN_DURATION_SECONDS * 1000;
              setActiveToken(res.data.activeToken);
              setTokenSecondsLeft(TOKEN_DURATION_SECONDS);
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
              res.data.deletedParticipantIds
            );
            participantsRef.current = mergedParticipants;
            setParticipants(mergedParticipants);

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
          if (Array.isArray(res.data.resultsHistory)) {
            setResultsHistory(res.data.resultsHistory);
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
      const res = await saveVercelStorage({
        packages,
        schedules,
        forceReplaceSchedules: hasActiveOrCustomSchedules,
        ...(hasRealParticipants || isHydratedFromCloud.current
          ? { participants, forceReplaceParticipants: hasRealParticipants }
          : {}),
        proctors,
        activeToken,
        resultsHistory,
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

  const exactClassSchedules = activeSchedules.filter((s) =>
    doesKelasMatch(currentStudentKelas, s.kelas)
  );
  const currentStudentActiveSchedules =
    exactClassSchedules.length > 0 ? exactClassSchedules : activeSchedules;

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
    (pkgBySchedule && getRealQuestionsCount(pkgBySchedule) > 0
      ? pkgBySchedule
      : pkgBySelectedId && getRealQuestionsCount(pkgBySelectedId) > 0
      ? {
          ...pkgBySelectedId,
          title:
            matchedStudentSchedule?.mapel?.trim() || pkgBySelectedId.title,
        }
      : pkgBySchedule ||
        pkgBySelectedId ||
        packages.find((p) => getRealQuestionsCount(p) > 0)) ||
    packages[0] ||
    INITIAL_EXAM_PACKAGES[0] ||
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

    if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement) {
      setIsFullscreenActive(true);
      return;
    }

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

      const prevRowVCount =
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
        if (
          stage === 'exam_running' &&
          Date.now() - examStartedAtRef.current > 3000
        ) {
          lockStudentByViolation(
            'Keluar dari halaman soal ujian CBT (Menekan tombol Esc pada keyboard laptop)'
          );
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
  ]);

  // Detect student exit violation ONLY when inside active question page (exam_running)
  // and student genuinely hides the tab / switches application
  useEffect(() => {
    if (stage !== 'exam_running') return;

    const handleVisibilityViolation = () => {
      if (
        document.visibilityState === 'hidden' &&
        Date.now() - examStartedAtRef.current > 3000
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
  }, [stage, lockStudentByViolation]);

  const handleRequestResetFromLogin = useCallback(
    (username: string) => {
      const cleanUser = username.trim().toUpperCase();
      const nowTs = Date.now();
      const timeStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
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
    const matchedRow = participants.find(
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
    if (matchedRow.status !== 'Active') {
      return;
    }

    // Block login if student is locked due to exit violation
    if (isParticipantLockedByViolation(matchedRow)) {
      return;
    }

    requestCbtFullscreen();

    const resolvedUsername = matchedRow.username.trim().toUpperCase();
    const isSainsPreset = resolvedUsername.startsWith('K02');
    const resolvedFullName =
      matchedRow?.namaPeserta ||
      (isSainsPreset ? 'BAGAS ADITYA NUGRAHA' : cleanUser);
    const resolvedKelas =
      normalizeKelasCode(matchedRow?.kelas) ||
      (activeSchedules[0] ? normalizeKelasCode(activeSchedules[0].kelas) : 'X') ||
      'X';

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

    const studentClassSchedules = activeSchedules.filter((s) =>
      doesKelasMatch(resolvedKelas, s.kelas)
    );
    const scheduledPkg =
      studentClassSchedules.length > 0
        ? resolvePackageForSchedule(studentClassSchedules[0], packages)
        : undefined;

    setLastViolationInfo(null);
    setParticipant((prev) => ({
      ...prev,
      username: resolvedUsername,
      nik: isSainsPreset ? '3174052209080004' : '3273011805080002',
      fullName: resolvedFullName,
      kelas: resolvedKelas,
      activeSubjectTitle: studentClassSchedules[0]?.mapel,
      gender: isSainsPreset ? 'Laki-Laki' : 'Perempuan',
      selectedPackageId:
        scheduledPkg?.id ||
        (isSainsPreset ? packages[1]?.id || packages[0]?.id : packages[0]?.id) ||
        '',
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
    examStartedAtRef.current = Date.now();
    requestCbtFullscreen();

    const cleanUser = participant.username.trim().toUpperCase();
    const currentPkgId = selectedPackage?.id || FALLBACK_EMPTY_PACKAGE.id;
    const matchedRow = participantsRef.current.find(
      (r) => r.username.trim().toUpperCase() === cleanUser
    );
    const localDraft = readStudentDraftFromLocal(cleanUser, currentPkgId);

    const rowVCount =
      typeof matchedRow?.violationCount === 'number'
        ? matchedRow.violationCount
        : 0;
    const localVCount =
      typeof localDraft?.violationCount === 'number'
        ? localDraft.violationCount
        : 0;
    const mergedViolationCount = Math.max(rowVCount, localVCount);

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
        localDraft &&
        localDraft.packageId === currentPkgId &&
        localDraft.answers &&
        Object.keys(localDraft.answers).length > 0;
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

  const handleFinishExam = useCallback(
    (usedSeconds: number) => {
      if (draftSyncTimerRef.current) {
        window.clearTimeout(draftSyncTimerRef.current);
        draftSyncTimerRef.current = null;
      }
      setTimeUsedSeconds(usedSeconds);

      // Compute summary for Proctor History
      const questions = Array.isArray(selectedPackage?.questions)
        ? selectedPackage.questions
        : [];
      let totalPoints = 0;
      let maxPoints = 0;
      let correctCount = 0;
      let answeredCount = 0;

      questions.forEach((q) => {
        const ans = answers[q.id];
        maxPoints += q.points;
        if (isQuestionAnswered(q, ans)) answeredCount += 1;
        const { isCorrect, earnedPoints } = evaluateQuestionScore(q, ans);
        if (isCorrect) correctCount += 1;
        totalPoints += earnedPoints;
      });

      const finalScore =
        maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

      const summary: ExamResultSummary = {
        id: `res_${Date.now()}`,
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
      clearStudentDraftInLocal(cleanUser, selectedPackage?.id || FALLBACK_EMPTY_PACKAGE.id);
      examRemainingSecondsRef.current = undefined;
      setExamInitialRemainingSeconds(undefined);
      const nowTs = Date.now();

      handleUpdateParticipants((prev) =>
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
                loginUpdatedAt: nowTs,
                draftAnswers: undefined,
                draftPackageId: undefined,
                draftRemainingSeconds: undefined,
                draftUpdatedAt: nowTs,
              }
            : row
        )
      );
      handleUpdateResultsHistory((prev) => [summary, ...prev]);
      setStage('exam_result');
    },
    [
      answers,
      handleUpdateParticipants,
      handleUpdateResultsHistory,
      participant,
      selectedPackage,
    ]
  );

  const handleLogout = () => {
    if (stage === 'exam_running') {
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
        onUpdateToken={handleUpdateToken}
        isScheduleActive={isScheduleActive}
        activeSchedules={activeSchedules}
        participants={participants}
        onUpdateParticipants={handleUpdateParticipants}
        packages={packages}
        onUpdatePackages={handleUpdatePackages}
        onResetDefaultPackages={() => handleUpdatePackages(INITIAL_EXAM_PACKAGES)}
        resultsHistory={resultsHistory}
        onClearHistory={() => handleUpdateResultsHistory([])}
        onLogoutProctor={() => setStage('login')}
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
        onUpdateToken={handleUpdateToken}
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
        onLogoutAdmin={() => setStage('login')}
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
          lastViolationInfo={lastViolationInfo}
          onRequestResetLogin={handleRequestResetFromLogin}
          onRefreshParticipants={() => syncFromVercelCloud({ force: true })}
          onQuickLoginAdmin={() => {
            requestCbtFullscreen();
            setAdminUsername('K05060108-KB6K');
            if (authSpinTimerRef.current) {
              window.clearTimeout(authSpinTimerRef.current);
            }
            setIsAuthSpinning(true);
            authSpinTimerRef.current = window.setTimeout(() => {
              setIsAuthSpinning(false);
              setStage('admin_dashboard');
            }, 5000);
          }}
          onQuickLoginProctor={() => {
            requestCbtFullscreen();
            const activeProctorName =
              proctors[0]?.fullName || proctorSession.name || 'DRS. H. AHMAD FAUZI, M.PD.';
            const activeProctorEnc =
              proctors[0]?.encryptionCode || proctorSession.encryptionCode || 'GLDTKASMA';
            setProctorSession({
              name: activeProctorName,
              encryptionCode: activeProctorEnc,
            });
            if (authSpinTimerRef.current) {
              window.clearTimeout(authSpinTimerRef.current);
            }
            setIsAuthSpinning(true);
            authSpinTimerRef.current = window.setTimeout(() => {
              setIsAuthSpinning(false);
              setStage('proctor_dashboard');
            }, 5000);
          }}
        />
      )}

      {/* Stage 1B: Halaman Login Khusus Proktor */}
      {stage === 'proctor_login' && (
        <ProctorLoginView
          onProctorLoginSuccess={(proctorName, encryptionCode) => {
            requestCbtFullscreen();
            setProctorSession({ name: proctorName, encryptionCode });
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
          onAdminLoginSuccess={(adminUser) => {
            requestCbtFullscreen();
            setAdminUsername(adminUser);
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
          activeToken={activeToken}
          isScheduleActive={isScheduleActive}
          activeSchedules={activeSchedules}
          onRefreshToken={handleRefreshToken}
          onSyncRemoteData={({ packages: remotePkgs, schedules: remoteSchs, activeToken: remoteTok }) => {
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
          answers={answers}
          onUpdateAnswer={handleUpdateAnswer}
          onFinishExam={handleFinishExam}
          initialRemainingSeconds={examInitialRemainingSeconds}
          onRemainingSecondsChange={handleRemainingSecondsChange}
          violationCount={
            participants.find(
              (p) =>
                p.username.trim().toUpperCase() ===
                participant.username.trim().toUpperCase()
            )?.violationCount || 0
          }
        />
      )}

      {/* Stage 5: Laporan Hasil & Pembahasan */}
      {stage === 'exam_result' && (
        <ExamResultView
          profile={participant}
          examPackage={selectedPackage}
          answers={answers}
          timeUsedSeconds={timeUsedSeconds}
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
