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
} from './components/ConfirmationViews';
import { ExamRunnerView } from './components/ExamRunnerView';
import { ExamResultView } from './components/ExamResultView';
import { ProctorLoginView } from './components/ProctorLoginView';
import {
  ProctorDashboardView,
  ProctorParticipantRow,
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
  const [proctorSession, setProctorSession] = useState<{
    name: string;
    encryptionCode: string;
  }>({
    name: 'K05060108-KB6K',
    encryptionCode: 'GLDTKASMA',
  });
  const [adminUsername, setAdminUsername] = useState<string>('ADMIN_SMADIP');

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
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to initial participants
    }
    return INITIAL_ADMIN_PARTICIPANTS;
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
    const cleaned = list.filter(
      (pkg) =>
        !pkg.title.toLowerCase().includes('simulasi tka') &&
        !pkg.code.toUpperCase().startsWith('TKA-')
    );
    return cleaned.length > 0 ? cleaned : INITIAL_EXAM_PACKAGES;
  }, []);

  const [packages, setPackages] = useState<ExamPackage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PACKAGES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.filter(
            (pkg: ExamPackage) =>
              pkg &&
              typeof pkg.title === 'string' &&
              !pkg.title.toLowerCase().includes('simulasi tka') &&
              !String(pkg.code || '').toUpperCase().startsWith('TKA-')
          );
          if (cleaned.length > 0) return cleaned;
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

  const [tokenSecondsLeft, setTokenSecondsLeft] = useState<number>(
    TOKEN_DURATION_SECONDS
  );

  const handleUpdateToken = useCallback((nextToken: string) => {
    setActiveToken(nextToken);
    setTokenSecondsLeft(TOKEN_DURATION_SECONDS);
  }, []);

  // Automatic 5-minute token rotation timer
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTokenSecondsLeft((prev) => {
        if (prev <= 1) {
          const next = generateRandomToken();
          setActiveToken(next);
          return TOKEN_DURATION_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [generateRandomToken]);

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
  const pendingPushCount = useRef<number>(0);

  const [participant, setParticipant] = useState<ParticipantProfile>({
    username: 'P130100240',
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
        const nextPackages =
          typeof updater === 'function' ? updater(prev) : updater;
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
              setStorageEngine(res.engine);
              setLastSyncedLabel(
                new Date().toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              );
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
    []
  );

  // Initial Hydration & Background Polling from Vercel Storage (/api/storage)
  const syncFromVercelCloud = useCallback(async () => {
    if (
      pendingPushCount.current > 0 ||
      Date.now() - lastLocalMutationAt.current < 4000
    ) {
      return;
    }
    const fetchStartedAt = Date.now();
    const res = await fetchVercelStorage();
    if (!res.ok) return;
    if (
      pendingPushCount.current > 0 ||
      lastLocalMutationAt.current >= fetchStartedAt ||
      Date.now() - lastLocalMutationAt.current < 4000
    ) {
      return;
    }
    setStorageEngine(res.engine);

    if (res.data) {
      isApplyingRemoteUpdate.current = true;
      if (Array.isArray(res.data.packages) && res.data.packages.length > 0) {
        const cleanedPackages = filterOutSimulasiTka(res.data.packages);
        setPackages(cleanedPackages);
        if (cleanedPackages.length !== res.data.packages.length) {
          saveVercelStorage({ packages: cleanedPackages }).catch(() => {});
        }
      }
      if (Array.isArray(res.data.schedules) && res.data.schedules.length > 0) {
        setSchedules(res.data.schedules);
      }
      if (
        Array.isArray(res.data.participants) &&
        res.data.participants.length > 0
      ) {
        setParticipants(res.data.participants);
      }
      if (Array.isArray(res.data.proctors) && res.data.proctors.length > 0) {
        setProctors(res.data.proctors);
      }
      if (typeof res.data.activeToken === 'string' && res.data.activeToken) {
        setActiveToken(res.data.activeToken);
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
      // First boot on Vercel Storage: seed cloud storage with current state
      const seedRes = await saveVercelStorage({
        packages,
        schedules,
        participants,
        proctors,
        activeToken,
        resultsHistory,
      });
      if (seedRes.ok) {
        setStorageEngine(seedRes.engine);
      }
    }
    isHydratedFromCloud.current = true;
  }, [
    activeToken,
    filterOutSimulasiTka,
    packages,
    participants,
    proctors,
    resultsHistory,
    schedules,
  ]);

  useEffect(() => {
    syncFromVercelCloud();
    const pollTimer = window.setInterval(() => {
      syncFromVercelCloud();
    }, 6000);
    return () => window.clearInterval(pollTimer);
  }, [syncFromVercelCloud]);

  // Push changes to Vercel Storage (/api/storage) when modified locally
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
        setStorageEngine(res.engine);
        setLastSyncedLabel(
          new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      }
    } finally {
      pendingPushCount.current = Math.max(0, pendingPushCount.current - 1);
    }
  }, [
    activeToken,
    packages,
    participants,
    proctors,
    resultsHistory,
    schedules,
  ]);

  useEffect(() => {
    if (!isHydratedFromCloud.current || isApplyingRemoteUpdate.current) {
      return;
    }
    lastLocalMutationAt.current = Date.now();
    const debounce = window.setTimeout(() => {
      pushToVercelCloud();
    }, 250);
    return () => window.clearTimeout(debounce);
  }, [
    packages,
    schedules,
    participants,
    proctors,
    activeToken,
    resultsHistory,
    pushToVercelCloud,
  ]);

  const selectedPackage =
    packages.find((p) => p.id === participant.selectedPackageId) ||
    (activeSchedules.length > 0
      ? packages.find(
          (p) =>
            p.title.trim().toLowerCase() ===
            activeSchedules[0].mapel.trim().toLowerCase()
        )
      : undefined) ||
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
      const timeStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      setParticipants((prev) => {
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
                  }
                : row
            )
          : [
              {
                id: `p_viol_${Date.now()}`,
                selected: false,
                status: 'Active',
                kodeTes: 'GLDTKA25MAH2',
                username: participant.username.toUpperCase(),
                namaPeserta: participant.fullName,
                kelompok: '1',
                kelas: 'XII IPA',
                loginState: 'Terkunci (Pelanggaran)',
                requestReset: true,
                violationReason: reason,
                violationAt: timeStr,
              },
              ...prev,
            ];

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

      setLastViolationInfo({
        username: participant.username.toUpperCase(),
        fullName: participant.fullName,
        reason,
        timestamp: timeStr,
      });
      setStage('login');
    },
    [participant.fullName, participant.username]
  );

  // Automatically enter fullscreen on laptop and mobile immediately when CBT is clicked / accessed
  // and handle Esc key on laptop keyboard to exit CBT
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
      // Hanya re-enforce layar penuh saat siswa sudah berada di halaman soal aktif
      if (stage === 'exam_running') {
        requestCbtFullscreen();
      }
    };

    // Re-enforce saat sesi ujian aktif jika siswa mengklik di dalam ujian
    window.addEventListener('load', handleActiveExamUserInteraction, { passive: true });
    window.addEventListener('pageshow', handleActiveExamUserInteraction, { passive: true });
    document.addEventListener('pointerdown', handleActiveExamUserInteraction, { capture: true, passive: true });
    document.addEventListener('click', handleActiveExamUserInteraction, { capture: true, passive: true });

    // Handle Esc key on keyboard to exit CBT on laptop
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
        exitCbtFullscreen();

        // Hanya catat pelanggaran jika siswa sudah masuk ke halaman soal (exam_running)
        if (stage === 'exam_running') {
          lockStudentByViolation(
            'Keluar dari halaman soal ujian CBT (Menekan tombol Esc pada keyboard laptop)'
          );
        } else if (
          stage === 'confirm_participant' ||
          stage === 'confirm_test' ||
          stage === 'exam_result'
        ) {
          if (stage === 'confirm_participant' || stage === 'confirm_test') {
            setParticipants((prev) =>
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

    // Handle native browser fullscreen change (e.g. browser Esc key)
    const handleFullscreenChange = () => {
      const isFs = updateFullscreenState();
      if (!isFs) {
        if (stage === 'exam_running') {
          lockStudentByViolation(
            'Keluar dari halaman soal ujian CBT (Menekan tombol Esc / Keluar dari Fullscreen)'
          );
        }
      }
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
    participant.username,
  ]);

  // Detect student exit violation ONLY when inside active question page (exam_running)
  useEffect(() => {
    const isStudentInActiveCbtSession = stage === 'exam_running';

    if (!isStudentInActiveCbtSession) return;

    const handleVisibilityViolation = () => {
      if (document.visibilityState === 'hidden') {
        lockStudentByViolation(
          'Keluar dari halaman soal CBT / berpindah tab atau aplikasi saat ujian berlangsung'
        );
      }
    };

    const handleWindowBlurViolation = () => {
      lockStudentByViolation(
        'Keluar dari fokus layar soal CBT / membuka jendela atau aplikasi lain saat ujian berlangsung'
      );
    };

    const handlePageLeaveViolation = () => {
      lockStudentByViolation(
        'Menutup atau keluar dari halaman soal CBT saat ujian berlangsung'
      );
    };

    document.addEventListener('visibilitychange', handleVisibilityViolation);
    window.addEventListener('blur', handleWindowBlurViolation);
    window.addEventListener('pagehide', handlePageLeaveViolation);
    window.addEventListener('beforeunload', handlePageLeaveViolation);

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityViolation
      );
      window.removeEventListener('blur', handleWindowBlurViolation);
      window.removeEventListener('pagehide', handlePageLeaveViolation);
      window.removeEventListener('beforeunload', handlePageLeaveViolation);
    };
  }, [stage, lockStudentByViolation]);

  const handleRequestResetFromLogin = useCallback((username: string) => {
    const cleanUser = username.trim().toUpperCase();
    const timeStr = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setParticipants((prev) =>
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
            }
          : row
      )
    );
  }, []);

  const handleLoginSuccess = (username: string) => {
    const cleanUser = username.trim().toUpperCase();
    const matchedRow = participants.find(
      (p) => p.username.toUpperCase() === cleanUser
    );

    // Block login if student is locked due to exit violation
    if (
      matchedRow &&
      (matchedRow.loginState === 'Terkunci (Pelanggaran)' ||
        matchedRow.requestReset)
    ) {
      return;
    }

    requestCbtFullscreen();

    const isSainsPreset = cleanUser.startsWith('K02');
    const resolvedFullName =
      matchedRow?.namaPeserta ||
      (isSainsPreset ? 'BAGAS ADITYA NUGRAHA' : 'NADIA PUTRI PRATAMA');

    // Update or register participant loginState in shared Vercel Storage
    setParticipants((prev) => {
      const exists = prev.some(
        (row) => row.username.toUpperCase() === cleanUser
      );
      if (exists) {
        return prev.map((row) =>
          row.username.toUpperCase() === cleanUser
            ? { ...row, loginState: 'Sedang Mengerjakan', requestReset: false }
            : row
        );
      }
      return [
        {
          id: `p_${Date.now()}`,
          selected: false,
          status: 'Active',
          kodeTes: 'GLDTKA25MAH2',
          username: cleanUser,
          namaPeserta: resolvedFullName,
          kelompok: '1',
          kelas: 'XII IPA',
          loginState: 'Sedang Mengerjakan',
          requestReset: false,
        },
        ...prev,
      ];
    });

    setLastViolationInfo(null);
    setParticipant((prev) => ({
      ...prev,
      username: cleanUser,
      nik: isSainsPreset ? '3174052209080004' : '3273011805080002',
      fullName: resolvedFullName,
      gender: isSainsPreset ? 'Laki-Laki' : 'Perempuan',
      selectedPackageId: isSainsPreset
        ? packages[1]?.id || packages[0].id
        : packages[0].id,
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
    requestCbtFullscreen();
    setParticipants((prev) =>
      prev.map((row) =>
        row.username.toUpperCase() === participant.username.toUpperCase()
          ? { ...row, loginState: 'Sedang Mengerjakan', requestReset: false }
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

      setParticipants((prev) =>
        prev.map((row) =>
          row.username.toUpperCase() === participant.username.toUpperCase()
            ? { ...row, loginState: 'Selesai' }
            : row
        )
      );
      setResultsHistory((prev) => [summary, ...prev]);
      setStage('exam_result');
    },
    [answers, participant, selectedPackage]
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
      setParticipants((prev) =>
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
        onUpdateParticipants={setParticipants}
        packages={packages}
        onUpdatePackages={handleUpdatePackages}
        onResetDefaultPackages={() => handleUpdatePackages(INITIAL_EXAM_PACKAGES)}
        resultsHistory={resultsHistory}
        onClearHistory={() => setResultsHistory([])}
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
        onUpdateSchedules={setSchedules}
        participants={participants}
        onUpdateParticipants={setParticipants}
        proctors={proctors}
        onUpdateProctors={setProctors}
        packages={packages}
        onUpdatePackages={handleUpdatePackages}
        onResetDefaultPackages={() => handleUpdatePackages(INITIAL_EXAM_PACKAGES)}
        resultsHistory={resultsHistory}
        onClearHistory={() => setResultsHistory([])}
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
          lastViolationInfo={lastViolationInfo}
          onRequestResetLogin={handleRequestResetFromLogin}
          onQuickLoginAdmin={() => {
            requestCbtFullscreen();
            setAdminUsername('K05060108-KB6K');
            setStage('admin_dashboard');
          }}
          onQuickLoginProctor={() => {
            requestCbtFullscreen();
            setProctorSession({
              name: 'K05060108-KB6K',
              encryptionCode: 'GLDTKASMA',
            });
            setStage('proctor_dashboard');
          }}
        />
      )}

      {/* Stage 1B: Halaman Login Khusus Proktor */}
      {stage === 'proctor_login' && (
        <ProctorLoginView
          onProctorLoginSuccess={(proctorName, encryptionCode) => {
            requestCbtFullscreen();
            setProctorSession({ name: proctorName, encryptionCode });
            setStage('proctor_dashboard');
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
            setStage('admin_dashboard');
          }}
          onBackToStudentLogin={() => setStage('login')}
          onGoToProctorLogin={() => setStage('proctor_login')}
        />
      )}

      {/* Stage 2: Konfirmasi Data Peserta & Token */}
      {stage === 'confirm_participant' && (
        <ParticipantConfirmationView
          initialProfile={participant}
          packages={packages}
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
