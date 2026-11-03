/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PusmendikHeader } from './components/PusmendikHeader';
import { LoginView } from './components/LoginView';
import {
  ParticipantConfirmationView,
  TestConfirmationView,
} from './components/ConfirmationViews';
import { ExamRunnerView } from './components/ExamRunnerView';
import { ExamResultView } from './components/ExamResultView';
import { ProctorLoginView } from './components/ProctorLoginView';
import { ProctorDashboardView } from './components/ProctorDashboardView';
import {
  AdminLoginView,
  AdminDashboardView,
  INITIAL_ADMIN_SCHEDULES,
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
  const [schedules, setSchedules] = useState<AdminScheduleItem[]>(
    INITIAL_ADMIN_SCHEDULES
  );
  const activeSchedules = schedules.filter((s) => s.isActive);
  const isScheduleActive = activeSchedules.length > 0;

  const [packages, setPackages] = useState<ExamPackage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PACKAGES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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

  // Sync packages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(packages));
    } catch {
      // ignore storage error
    }
  }, [packages]);

  // Sync token to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TOKEN, activeToken);
    } catch {
      // ignore
    }
  }, [activeToken]);

  // Sync history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(resultsHistory));
    } catch {
      // ignore
    }
  }, [resultsHistory]);

  const selectedPackage =
    packages.find((p) => p.id === participant.selectedPackageId) || packages[0];

  const requestMobileFullscreen = useCallback(() => {
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      msFullscreenElement?: Element | null;
    };

    if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement) {
      return;
    }

    if (docEl.requestFullscreen) {
      docEl
        .requestFullscreen({ navigationUI: 'hide' })
        .catch(() => {
          // Ignore if browser defers until user gesture
        });
    } else if (docEl.webkitRequestFullscreen) {
      try {
        docEl.webkitRequestFullscreen();
      } catch {
        // Ignore
      }
    }
  }, []);

  // Automatically enter fullscreen on mobile viewports immediately on entry
  // and on earliest user gesture to hide status bar and Google browser tabs
  useEffect(() => {
    const isMobileDevice = () =>
      window.innerWidth < 768 ||
      window.matchMedia('(pointer: coarse)').matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    const enforceMobileFullscreen = () => {
      if (isMobileDevice()) {
        window.scrollTo(0, 1);
        requestMobileFullscreen();
      }
    };

    // Attempt immediately when first entering the app
    enforceMobileFullscreen();

    // Also attempt on load, visibilitychange, and earliest capture-phase gestures
    window.addEventListener('load', enforceMobileFullscreen, { passive: true });
    document.addEventListener('visibilitychange', enforceMobileFullscreen, { passive: true });
    document.addEventListener('pointerdown', enforceMobileFullscreen, { capture: true, passive: true });
    document.addEventListener('touchstart', enforceMobileFullscreen, { capture: true, passive: true });
    document.addEventListener('touchend', enforceMobileFullscreen, { capture: true, passive: true });
    document.addEventListener('click', enforceMobileFullscreen, { capture: true, passive: true });
    document.addEventListener('keydown', enforceMobileFullscreen, { capture: true, passive: true });

    return () => {
      window.removeEventListener('load', enforceMobileFullscreen);
      document.removeEventListener('visibilitychange', enforceMobileFullscreen);
      document.removeEventListener('pointerdown', enforceMobileFullscreen, { capture: true });
      document.removeEventListener('touchstart', enforceMobileFullscreen, { capture: true });
      document.removeEventListener('touchend', enforceMobileFullscreen, { capture: true });
      document.removeEventListener('click', enforceMobileFullscreen, { capture: true });
      document.removeEventListener('keydown', enforceMobileFullscreen, { capture: true });
    };
  }, [requestMobileFullscreen]);

  const handleLoginSuccess = (username: string) => {
    if (window.innerWidth < 768) {
      requestMobileFullscreen();
    }
    const isSainsPreset = username.startsWith('K02');
    setParticipant((prev) => ({
      ...prev,
      username,
      nik: isSainsPreset ? '3174052209080004' : '3273011805080002',
      fullName: isSainsPreset ? 'BAGAS ADITYA NUGRAHA' : 'NADIA PUTRI PRATAMA',
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
    if (window.innerWidth < 768) {
      requestMobileFullscreen();
    }
    setParticipant(updatedProfile);
    setStage('confirm_test');
  };

  const handleStartExam = () => {
    if (window.innerWidth < 768) {
      requestMobileFullscreen();
    }
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

      setResultsHistory((prev) => [summary, ...prev]);
      setStage('exam_result');
    },
    [answers, participant, selectedPackage]
  );

  const handleLogout = () => {
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
        packages={packages}
        onUpdatePackages={setPackages}
        onResetDefaultPackages={() => setPackages(INITIAL_EXAM_PACKAGES)}
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
        packages={packages}
        onUpdatePackages={setPackages}
        onResetDefaultPackages={() => setPackages(INITIAL_EXAM_PACKAGES)}
        resultsHistory={resultsHistory}
        onClearHistory={() => setResultsHistory([])}
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
          onQuickLoginAdmin={() => {
            setAdminUsername('K05060108-KB6K');
            setStage('admin_dashboard');
          }}
          onQuickLoginProctor={() => {
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
