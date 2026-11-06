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
  PARTICIPANTS: 'pusmendik_cbt_participants_v1',
  PROCTORS: 'pusmendik_cbt_proctors_v1',
  TOKEN: 'pusmendik_cbt_token_v1',
  HISTORY: 'pusmendik_cbt_history_v1',
};

export default function App() {
  const [stage, setStage] = useState<AppStage>('login');
  const [isAuthSpinning, setIsAuthSpinning] = useState<boolean>(false);
  const authSpinTimerRef = useRef<number | null>(null);
  const [proctorSession, setProctorSession] = useState<{
    name: string;
    encryptionCode: string;
  }>({
    name: 'K05060108-KB6K',
    encryptionCode: 'GLDTKASMA',
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
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
          return sanitizeParticipantRows(parsed);
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
      const saved = localStorage.getItem(STORAGE_KEYS.PACKAGES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .filter((pkg: ExamPackage) => pkg && typeof pkg === 'object')
            .map((pkg: ExamPackage) => ({
              ...pkg,
              title: String(pkg.title || '').replace(/^Simulasi TKA\s*-\s*/i, ''),
              questions: Array.isArray(pkg.questions)
                ? pkg.questions.filter(
                    (q) => !String(q?.id || '').startsWith('q_default_')
                  )
                : [],
            }));
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
        } catch {
          // ignore
        }
        pendingPushCount.current += 1;
        saveVercelStorage({
          participants: nextParticipants,
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
        } catch {
          // ignore
        }
        pendingPushCount.current += 1;
        saveVercelStorage({
          schedules: nextSchedules,
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
        setSchedules(res.data.schedules);
      }
      if (
        Array.isArray(res.data.participants) &&
        res.data.participants.length > 0
      ) {
        // Merge local lastResetAt so a reset participant never flickers back to locked
        const localResetMap = new Map<string, number>();
        participantsRef.current.forEach((p) => {
          if (typeof p.lastResetAt === 'number' && p.lastResetAt > 0) {
            localResetMap.set(p.username.trim().toUpperCase(), p.lastResetAt);
          }
        });
        const mergedRemoteParticipants = sanitizeParticipantRows(
          res.data.participants.map((row) => {
            const localReset = localResetMap.get(
              (row.username || '').trim().toUpperCase()
            );
            const maxReset = Math.max(
              typeof row.lastResetAt === 'number' ? row.lastResetAt : 0,
              localReset || 0
            );
            return maxReset > 0 ? { ...row, lastResetAt: maxReset } : row;
          })
        );
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
      // First boot on Vercel Storage: seed cloud storage with current sanitized state
      const seedRes = await saveVercelStorage({
        packages: packagesRef.current,
        schedules: schedulesRef.current,
        participants: sanitizeParticipantRows(participantsRef.current),
        proctors: proctorsRef.current,
        activeToken: activeTokenRef.current,
        resultsHistory: resultsHistoryRef.current,
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
      const res = await saveVercelStorage({
        packages,
        schedules,
        participants,
        proctors,
        activeToken,
        resultsHistory,
      });
      if (res.ok) {
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

  const selectedPackage =
    (matchedStudentSchedule
      ? resolvePackageForSchedule(matchedStudentSchedule, packages)
      : packages.find((p) => p.id === participant.selectedPackageId)) ||
    packages[0];

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

  const lockStudentByViolation = useCallback(
    (reason: string) => {
      const nowTs = Date.now();
      const timeStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      handleUpdateParticipants((prev) => {
        const exists = prev.some(
          (row) =>
            row.username.toUpperCase() === participant.username.toUpperCase()
        );
        const nextList: ProctorParticipantRow[] = exists
          ? prev.map((row) =>
              row.username.toUpperCase() === participant.username.toUpperCase()
                ? {
                    ...row,
                    loginState: 'Terkunci (Pelanggaran)',
                    requestReset: true,
                    violationReason: reason,
                    violationAt: timeStr,
                    violationSchema: 3,
                    violationTimestamp: nowTs,
                  }
                : row
            )
          : [
              {
                id: `p_viol_${nowTs}`,
                selected: false,
                status: 'Active',
                kodeTes: 'SAS26SMADIP1',
                username: participant.username.toUpperCase(),
                namaPeserta: participant.fullName,
                kelompok: '1',
                kelas: 'XII IPA',
                loginState: 'Terkunci (Pelanggaran)',
                requestReset: true,
                violationReason: reason,
                violationAt: timeStr,
                violationSchema: 3,
                violationTimestamp: nowTs,
              },
              ...prev,
            ];
        return nextList;
      });

      setLastViolationInfo({
        username: participant.username.toUpperCase(),
        fullName: participant.fullName,
        reason,
        timestamp: timeStr,
      });
      setStage('login');
    },
    [handleUpdateParticipants, participant.fullName, participant.username]
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
    handleUpdateParticipants((prev) =>
      prev.map((row) =>
        row.username.toUpperCase() === participant.username.toUpperCase()
          ? {
              ...row,
              loginState: 'Sedang Mengerjakan',
              requestReset: false,
              violationReason: undefined,
              violationAt: undefined,
            }
          : row
      )
    );
    setAnswers({});
    setTimeUsedSeconds(0);
    setStage('exam_running');
  };

  const handleUpdateAnswer = useCallback(
    (questionId: string, updater: (prev: StudentAnswer) => StudentAnswer) => {
      setAnswers((prevMap) => {
        const current = prevMap[questionId] || { questionId };
        return {
          ...prevMap,
          [questionId]: updater(current),
        };
      });
    },
    []
  );

  const handleFinishExam = useCallback(
    (usedSeconds: number) => {
      setTimeUsedSeconds(usedSeconds);

      // Compute summary for Proctor History
      const questions = selectedPackage.questions;
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
        packageTitle: selectedPackage.title,
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

      handleUpdateParticipants((prev) =>
        prev.map((row) =>
          row.username.toUpperCase() === participant.username.toUpperCase()
            ? {
                ...row,
                loginState: 'Selesai',
                requestReset: false,
                violationReason: undefined,
                violationAt: undefined,
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
      setAnswers({});
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
    setStage('login');
  };

  // Dedicated Full-Screen Proctor Dashboard (matches the reference image)
  if (stage === 'proctor_dashboard') {
    return (
      <ProctorDashboardView
        proctorName={proctorSession.name}
        encryptionCode={proctorSession.encryptionCode}
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
        compact={stage === 'exam_running'}
      />

      {/* Stage 1: Login Card (Peserta) */}
      {stage === 'login' && (
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          onOpenProctorModal={() => setStage('proctor_login')}
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
            setProctorSession({
              name: 'K05060108-KB6K',
              encryptionCode: 'GLDTKASMA',
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
    </div>
  );
}
