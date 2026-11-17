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
  SCHEDULES: 'pusmendik_cbt_schedules_v1',
  SCHEDULES_BACKUP: 'pusmendik_cbt_schedules_backup_v1',
  PARTICIPANTS: 'pusmendik_cbt_participants_v1',
  PARTICIPANTS_BACKUP: 'pusmendik_cbt_participants_backup_v1',
  PROCTORS: 'pusmendik_cbt_proctors_v1',
  TOKEN: 'pusmendik_cbt_token_v1',
  HISTORY: 'pusmendik_cbt_history_v1',
  DRAFTS: 'pusmendik_cbt_student_drafts_v1',
};

const DEFAULT_DEMO_SCHEDULE_IDS = new Set(['s1', 's2', 's3', 's4', 's5']);

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
      let isCustomMapelConfigured = false;
      const deletedCodes = new Set<string>();
      const deletedNames = new Set<string>();
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
        // ignore settings parse error
      }

      const saved = localStorage.getItem(STORAGE_KEYS.PACKAGES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const list = parsed
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
    } catch {
      // Fallback to initial packages
    }
    return INITIAL_EXAM_PACKAGES;
  });

  const TOKEN_DURATION_SECONDS = 300; // 5 menit (300 detik)

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
      lastLocalMutationAt.current = Date.now();
      activeTokenRef.current = cleanToken;
      tokenEndTimeRef.current = Date.now() + TOKEN_DURATION_SECONDS * 1000;
      setActiveToken(cleanToken);
      setTokenSecondsLeft(TOKEN_DURATION_SECONDS);
      try {
        localStorage.setItem(STORAGE_KEYS.TOKEN, cleanToken);
      } catch {
        // ignore
      }
      pendingPushCount.current += 1;
      saveVercelStorage({ activeToken: cleanToken })
        .then((res) => {
          if (res.ok) markSyncedSuccess(res.engine);
        })
        .finally(() => {
          pendingPushCount.current = Math.max(0, pendingPushCount.current - 1);
        });
    },
    [markSyncedSuccess]
  );

  // Automatic 5-minute token countdown timer (wall-clock based, never rotates early)
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
        try {
          localStorage.setItem(
            STORAGE_KEYS.PACKAGES,
            JSON.stringify(nextPackages)
          );
        } catch {
          // ignore
        }
        pendingPushCount.current += 1;
        saveVercelStorage({
          packages: nextPackages,
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
      lastLocalMutationAt.current = Date.now();
      setParticipants((prev) => {
        const rawNext =
          typeof updater === 'function' ? updater(prev) : updater;
        const nextParticipants = sanitizeParticipantRows(rawNext);
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
          const prevByUser = new Map<string, ProctorParticipantRow>();
          prev.forEach((p) => {
            prevByUser.set(p.username.trim().toUpperCase(), p);
          });
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
        const deletedParticipantIds = prev
          .filter((p) => !nextIdSet.has(p.id))
          .map((p) => p.id);

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
      lastLocalMutationAt.current = Date.now();
      setSchedules((prev) => {
        const nextSchedules =
          typeof updater === 'function' ? updater(prev) : updater;
        schedulesRef.current = nextSchedules;
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
          forceReplaceSchedules: true,
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
  // Uses stable refs so polling runs strictly on a 6s interval without re-triggering on state updates
  const syncFromVercelCloud = useCallback(async () => {
    if (
      pendingPushCount.current > 0 ||
      Date.now() - lastLocalMutationAt.current < 5000
    ) {
      return;
    }
    const fetchStartedAt = Date.now();
    const res = await fetchVercelStorage();
    if (!res.ok) return;
    if (
      pendingPushCount.current > 0 ||
      lastLocalMutationAt.current >= fetchStartedAt ||
      Date.now() - lastLocalMutationAt.current < 5000
    ) {
      return;
    }
    setStorageEngine(res.engine);

    if (res.data) {
      const serverUpdatedAt =
        typeof res.data.updatedAt === 'number'
          ? res.data.updatedAt
          : typeof res.updatedAt === 'number'
          ? res.updatedAt
          : 0;

      // Always keep activeToken synchronized from server even if updatedAt matches a local participant mutation
      if (
        typeof res.data.activeToken === 'string' &&
        res.data.activeToken &&
        res.data.activeToken !== activeTokenRef.current
      ) {
        activeTokenRef.current = res.data.activeToken;
        tokenEndTimeRef.current = Date.now() + TOKEN_DURATION_SECONDS * 1000;
        setActiveToken(res.data.activeToken);
        setTokenSecondsLeft(TOKEN_DURATION_SECONDS);
      }

      // Self-healing & Anti-Downgrade Guard:
      // 1) If this browser holds real uploaded participants (e.g., 127 students) in localStorage,
      //    and the server returned only the 8 default demo students (or empty after a serverless cold start),
      //    NEVER overwrite our 127 uploaded students with the 8 demo students!
      // 2) If this browser holds active/custom schedules (so the exam token is active),
      //    and the server returned default inactive schedules, NEVER deactivate our schedules or hide our token!
      const localHasRealParticipants = !isDefaultDemoParticipantsList(
        participantsRef.current
      );
      const remoteHasParticipants =
        Array.isArray(res.data.participants) &&
        res.data.participants.length > 0;
      const remoteIsDemoOnly =
        !remoteHasParticipants ||
        isDefaultDemoParticipantsList(res.data.participants);

      const localHasActiveOrCustomSchedules = !isDefaultInactiveSchedulesList(
        schedulesRef.current
      );
      const remoteHasSchedules =
        Array.isArray(res.data.schedules) && res.data.schedules.length > 0;
      const remoteIsDefaultInactiveSchedules =
        !remoteHasSchedules ||
        isDefaultInactiveSchedulesList(res.data.schedules);

      if (
        (localHasRealParticipants && remoteIsDemoOnly) ||
        (localHasActiveOrCustomSchedules && remoteIsDefaultInactiveSchedules)
      ) {
        saveVercelStorage({
          packages: packagesRef.current,
          schedules: schedulesRef.current,
          participants: sanitizeParticipantRows(participantsRef.current),
          proctors: proctorsRef.current,
          activeToken: activeTokenRef.current,
          resultsHistory: resultsHistoryRef.current,
          forceReplaceParticipants: localHasRealParticipants,
          forceReplaceSchedules: localHasActiveOrCustomSchedules,
        }).then((healRes) => {
          if (healRes.ok && typeof healRes.updatedAt === 'number') {
            latestUpdatedAtRef.current = Math.max(
              latestUpdatedAtRef.current,
              healRes.updatedAt
            );
          }
        });
        // Still apply any non-downgrading remote updates (e.g. if remote has real participants while we healed schedules, or vice versa)
        if (!remoteIsDemoOnly && Array.isArray(res.data.participants)) {
          setParticipants(sanitizeParticipantRows(res.data.participants));
        }
        if (
          !remoteIsDefaultInactiveSchedules &&
          Array.isArray(res.data.schedules)
        ) {
          setSchedules(res.data.schedules);
        }
        isHydratedFromCloud.current = true;
        return;
      }

      // Never overwrite newer client state with a stale serverless instance response
      if (
        isHydratedFromCloud.current &&
        latestUpdatedAtRef.current > 0 &&
        serverUpdatedAt > 0
      ) {
        if (serverUpdatedAt < latestUpdatedAtRef.current) {
          return;
        }
        if (serverUpdatedAt === latestUpdatedAtRef.current) {
          return;
        }
      }

      if (serverUpdatedAt > 0) {
        latestUpdatedAtRef.current = Math.max(
          latestUpdatedAtRef.current,
          serverUpdatedAt
        );
      }

      isApplyingRemoteUpdate.current = true;
      if (Array.isArray(res.data.packages) && res.data.packages.length > 0) {
        const cleanedPackages = filterOutSimulasiTka(res.data.packages);
        setPackages(cleanedPackages);
      }
      if (Array.isArray(res.data.schedules) && res.data.schedules.length > 0) {
        if (
          localHasActiveOrCustomSchedules &&
          isDefaultInactiveSchedulesList(res.data.schedules)
        ) {
          // Keep local active schedules and heal server
          saveVercelStorage({
            schedules: schedulesRef.current,
            forceReplaceSchedules: true,
          });
        } else {
          setSchedules(res.data.schedules);
        }
      }
      if (
        Array.isArray(res.data.participants) &&
        res.data.participants.length > 0
      ) {
        // Merge local lastResetAt and local selected state so UI selections never flicker
        const localResetMap = new Map<string, number>();
        const localSelectedMap = new Map<string, boolean>();
        participantsRef.current.forEach((p) => {
          const u = p.username.trim().toUpperCase();
          if (typeof p.lastResetAt === 'number' && p.lastResetAt > 0) {
            localResetMap.set(u, p.lastResetAt);
          }
          localSelectedMap.set(u, Boolean(p.selected));
        });
        let mergedRemoteParticipants = sanitizeParticipantRows(
          res.data.participants.map((row) => {
            const u = (row.username || '').trim().toUpperCase();
            const localReset = localResetMap.get(u);
            const localSelected = localSelectedMap.get(u);
            const maxReset = Math.max(
              typeof row.lastResetAt === 'number' ? row.lastResetAt : 0,
              localReset || 0
            );
            return {
              ...row,
              ...(typeof localSelected === 'boolean'
                ? { selected: localSelected }
                : {}),
              ...(maxReset > 0 ? { lastResetAt: maxReset } : {}),
            };
          })
        );

        // Additive protection: if this browser holds more real custom students (e.g. 127 students)
        // than what returned from a split-brain serverless instance, preserve all local non-demo students
        let shouldHealParticipantsToServer =
          res.data.participants.length > mergedRemoteParticipants.length;

        if (localHasRealParticipants) {
          const remoteUserSet = new Set(
            mergedRemoteParticipants.map((p) =>
              (p.username || '').trim().toUpperCase()
            )
          );
          const remoteIdSet = new Set(
            mergedRemoteParticipants.map((p) => String(p.id || '').trim())
          );
          const remoteNameKelasSet = new Set(
            mergedRemoteParticipants
              .map((p) => getParticipantNameKelasKey(p))
              .filter(Boolean)
          );
          const missingLocalCustom = participantsRef.current.filter((p) => {
            if (isDefaultDemoParticipantRow(p)) return false;
            const u = (p.username || '').trim().toUpperCase();
            const id = String(p.id || '').trim();
            const nk = getParticipantNameKelasKey(p);
            return (
              !remoteUserSet.has(u) &&
              !remoteIdSet.has(id) &&
              (!nk || !remoteNameKelasSet.has(nk))
            );
          });
          if (missingLocalCustom.length > 0) {
            mergedRemoteParticipants = sanitizeParticipantRows([
              ...mergedRemoteParticipants,
              ...missingLocalCustom,
            ]);
            shouldHealParticipantsToServer = true;
          }
        }

        if (shouldHealParticipantsToServer) {
          saveVercelStorage({
            participants: mergedRemoteParticipants,
            forceReplaceParticipants: true,
          });
        }

        setParticipants(mergedRemoteParticipants);
      }
      if (Array.isArray(res.data.proctors) && res.data.proctors.length > 0) {
        setProctors(res.data.proctors);
      }
      if (
        typeof res.data.activeToken === 'string' &&
        res.data.activeToken &&
        res.data.activeToken !== activeTokenRef.current
      ) {
        activeTokenRef.current = res.data.activeToken;
        tokenEndTimeRef.current = Date.now() + TOKEN_DURATION_SECONDS * 1000;
        setActiveToken(res.data.activeToken);
        setTokenSecondsLeft(TOKEN_DURATION_SECONDS);
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
      // Cold-start / empty server: Only seed if this browser holds real uploaded students
      // or active/custom schedules. NEVER let a fresh browser (even on Admin Dashboard) seed 8 demo rows or default inactive schedules!
      const localHasRealParticipants = !isDefaultDemoParticipantsList(
        participantsRef.current
      );
      const localHasActiveOrCustomSchedules = !isDefaultInactiveSchedulesList(
        schedulesRef.current
      );

      if (localHasRealParticipants || localHasActiveOrCustomSchedules) {
        const seedRes = await saveVercelStorage({
          packages: packagesRef.current,
          schedules: schedulesRef.current,
          ...(localHasRealParticipants
            ? {
                participants: sanitizeParticipantRows(participantsRef.current),
                forceReplaceParticipants: true,
              }
            : {}),
          proctors: proctorsRef.current,
          activeToken: activeTokenRef.current,
          resultsHistory: resultsHistoryRef.current,
          forceReplaceSchedules: localHasActiveOrCustomSchedules,
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
  }, [filterOutSimulasiTka]);

  useEffect(() => {
    syncFromVercelCloud();
    const pollTimer = window.setInterval(() => {
      syncFromVercelCloud();
    }, 6000);
    return () => window.clearInterval(pollTimer);
  }, [syncFromVercelCloud]);

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

  const selectedPackage: ExamPackage =
    (matchedStudentSchedule
      ? resolvePackageForSchedule(matchedStudentSchedule, packages)
      : packages.find((p) => p.id === participant.selectedPackageId)) ||
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
              violationCount: effectiveViolationCount,
              draftPackageId: currentPkgId,
              draftAnswers: restoredAnswers,
              draftRemainingSeconds: restoredRemainingSecs,
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

        handleUpdateParticipants((prev) =>
          prev.map((row) =>
            row.username.trim().toUpperCase() === cleanUser
              ? {
                  ...row,
                  draftPackageId: currentPkgId,
                  draftAnswers: nextMap,
                  draftRemainingSeconds: examRemainingSecondsRef.current,
                }
              : row
          )
        );

        return nextMap;
      });
    },
    [handleUpdateParticipants, participant.username, selectedPackage?.id]
  );

  const handleFinishExam = useCallback(
    (usedSeconds: number) => {
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

      handleUpdateParticipants((prev) =>
        prev.map((row) =>
          row.username.trim().toUpperCase() === cleanUser
            ? {
                ...row,
                loginState: 'Selesai',
                requestReset: false,
                violationReason: undefined,
                violationAt: undefined,
                violationCount: 0,
                draftAnswers: undefined,
                draftPackageId: undefined,
                draftRemainingSeconds: undefined,
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
