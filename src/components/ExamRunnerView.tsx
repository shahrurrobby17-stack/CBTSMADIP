import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Clock,
  CheckSquare,
  Square,
  Info,
  X,
  AlertTriangle,
  CheckCircle2,
  Link2,
  RotateCcw,
} from 'lucide-react';
import { ExamPackage, Question, StudentAnswer } from '../types/cbt';
import { getQuestionTypeLabel, isQuestionAnswered } from '../data/cbtData';

interface ExamRunnerViewProps {
  examPackage: ExamPackage;
  answers: Record<string, StudentAnswer>;
  onUpdateAnswer: (questionId: string, updater: (prev: StudentAnswer) => StudentAnswer) => void;
  onFinishExam: (timeUsedSeconds: number) => void;
}

type FontScale = 'sm' | 'md' | 'lg';

const PAIR_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-500', badge: 'bg-blue-600 text-white' },
  { bg: 'bg-emerald-50', border: 'border-emerald-500', badge: 'bg-emerald-600 text-white' },
  { bg: 'bg-amber-50', border: 'border-amber-500', badge: 'bg-amber-600 text-white' },
  { bg: 'bg-purple-50', border: 'border-purple-500', badge: 'bg-purple-600 text-white' },
];

export const ExamRunnerView: React.FC<ExamRunnerViewProps> = ({
  examPackage,
  answers,
  onUpdateAnswer,
  onFinishExam,
}) => {
  const questions = examPackage.questions;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fontScale, setFontScale] = useState<FontScale>('md');
  const [remainingSeconds, setRemainingSeconds] = useState(
    examPackage.durationMinutes * 60
  );
  const [showQuestionListModal, setShowQuestionListModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showDoubtWarningModal, setShowDoubtWarningModal] = useState(false);
  const [confirmFinishChecked, setConfirmFinishChecked] = useState(false);

  // For matching question type: currently selected premise ID
  const [activePremiseId, setActivePremiseId] = useState<string | null>(null);

  const currentQuestion: Question = questions[currentIndex];
  const currentAnswer: StudentAnswer = answers[currentQuestion.id] || {
    questionId: currentQuestion.id,
  };

  // Reset activePremiseId when changing question
  useEffect(() => {
    setActivePremiseId(null);
  }, [currentQuestion.id]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onFinishExam(examPackage.durationMinutes * 60);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [examPackage.durationMinutes, onFinishExam]);

  // Keyboard navigation (Left / Right arrows when not typing in input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < questions.length - 1) {
        setCurrentIndex((i) => i + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, questions.length]);

  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [hrs, mins, s].map((v) => String(v).padStart(2, '0')).join(':');
  };

  const fontSizeClass =
    fontScale === 'sm'
      ? 'text-[13.5px] leading-relaxed'
      : fontScale === 'lg'
      ? 'text-[17.5px] leading-relaxed'
      : 'text-[15px] leading-relaxed';

  // Handlers for each question type
  const handleSelectSingleOption = (optionId: string) => {
    onUpdateAnswer(currentQuestion.id, (prev) => ({
      ...prev,
      selectedOptionId: optionId,
    }));
  };

  const handleToggleComplexOption = (optionId: string) => {
    onUpdateAnswer(currentQuestion.id, (prev) => {
      const existing = prev.selectedOptionIds || [];
      const next = existing.includes(optionId)
        ? existing.filter((id) => id !== optionId)
        : [...existing, optionId];
      return {
        ...prev,
        selectedOptionIds: next,
      };
    });
  };

  const handleSelectStatement = (statementId: string, val: 'Benar' | 'Salah') => {
    onUpdateAnswer(currentQuestion.id, (prev) => ({
      ...prev,
      statementAnswers: {
        ...(prev.statementAnswers || {}),
        [statementId]: val,
      },
    }));
  };

  const handlePairMatching = (responseId: string) => {
    if (!activePremiseId) return;
    onUpdateAnswer(currentQuestion.id, (prev) => {
      const existingPairs = { ...(prev.matchingPairs || {}) };
      // Ensure responseId isn't already paired to another premise
      Object.keys(existingPairs).forEach((pKey) => {
        if (existingPairs[pKey] === responseId) {
          delete existingPairs[pKey];
        }
      });
      existingPairs[activePremiseId] = responseId;
      return {
        ...prev,
        matchingPairs: existingPairs,
      };
    });
    setActivePremiseId(null);
  };

  const handleResetMatching = () => {
    onUpdateAnswer(currentQuestion.id, (prev) => ({
      ...prev,
      matchingPairs: {},
    }));
    setActivePremiseId(null);
  };

  const handleShortAnswerChange = (text: string) => {
    onUpdateAnswer(currentQuestion.id, (prev) => ({
      ...prev,
      shortAnswer: text,
    }));
  };

  const handleToggleDoubtful = () => {
    onUpdateAnswer(currentQuestion.id, (prev) => ({
      ...prev,
      doubtful: !prev.doubtful,
    }));
  };

  const handleRequestFinish = () => {
    const anyDoubtful = questions.some((q) => answers[q.id]?.doubtful);
    if (anyDoubtful) {
      setShowDoubtWarningModal(true);
      return;
    }
    setConfirmFinishChecked(false);
    setShowFinishModal(true);
  };

  const handleConfirmFinish = () => {
    if (!confirmFinishChecked) return;
    const usedSeconds = examPackage.durationMinutes * 60 - remainingSeconds;
    onFinishExam(Math.max(1, usedSeconds));
  };

  const answeredCount = questions.filter((q) =>
    isQuestionAnswered(q, answers[q.id])
  ).length;

  return (
    <main className="flex-1 max-w-[1380px] w-full mx-auto px-3 sm:px-6 py-5 flex flex-col">
      {/* Exam Main Card Container */}
      <div className="bg-white rounded-[14px] shadow-[0_18px_45px_-12px_rgba(15,23,42,0.14)] border border-slate-200/80 flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar inside Exam Card */}
        <div className="px-5 sm:px-7 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {/* Left: SOAL NO. [X] */}
          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm font-bold tracking-wide text-slate-700 uppercase">
              SOAL NO.
            </span>
            <span className="inline-flex items-center justify-center min-w-[38px] h-9 px-2.5 rounded-lg bg-[#0066ff] text-white font-mono text-base font-bold shadow-sm">
              {currentQuestion.number}
            </span>
            <div className="hidden md:flex flex-col pl-2 border-l border-slate-200 leading-tight">
              <span className="text-xs font-semibold text-slate-700">
                {currentQuestion.category}
              </span>
              <span className="text-[11px] text-slate-500">
                Tipe: {getQuestionTypeLabel(currentQuestion.type)}
              </span>
            </div>
          </div>

          {/* Right: Informasi Soal, Timer, Daftar Soal */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-200/80 hover:bg-slate-300/70 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Informasi Soal</span>
            </button>

            {/* Sisa Waktu Pill */}
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold ${
                remainingSeconds < 300
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-white border-slate-300 text-slate-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-[#0066ff]" />
              <span className="hidden sm:inline text-slate-500">Sisa Waktu :</span>
              <span className="font-mono text-sm font-bold tabular-nums">
                {formatTime(remainingSeconds)}
              </span>
            </div>

            {/* Daftar Soal Button */}
            <button
              type="button"
              onClick={() => setShowQuestionListModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <span>Daftar Soal</span>
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Sub-Toolbar: Ukuran Font Soal */}
        <div className="px-5 sm:px-7 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Ukuran font soal:</span>
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFontScale('sm')}
                className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                  fontScale === 'sm'
                    ? 'bg-blue-50 text-[#0066ff] underline'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setFontScale('md')}
                className={`px-2 py-0.5 rounded text-sm font-semibold transition-colors cursor-pointer ${
                  fontScale === 'md'
                    ? 'bg-blue-50 text-[#0066ff] underline'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setFontScale('lg')}
                className={`px-2 py-0.5 rounded text-base font-bold transition-colors cursor-pointer ${
                  fontScale === 'lg'
                    ? 'bg-blue-50 text-[#0066ff] underline'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                A
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500 tabular-nums">
            Terjawab: <strong className="text-slate-800">{answeredCount}</strong> dari{' '}
            <strong className="text-slate-800">{questions.length}</strong> soal
          </div>
        </div>

        {/* Main Split Question Area: Left (Stimulus/Wacana) & Right (Soal & Opsi) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Left Column: Wacana / Stimulus */}
          <div className="lg:col-span-6 p-5 sm:p-7 overflow-y-auto max-h-[62vh] bg-slate-50/30">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Wacana / Stimulus Soal
            </div>

            {currentQuestion.stimulusTitle && (
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-3">
                {currentQuestion.stimulusTitle}
              </h2>
            )}

            {currentQuestion.stimulusText && (
              <div className={`space-y-3.5 text-slate-700 ${fontSizeClass}`}>
                {currentQuestion.stimulusText.split('\n\n').map((para, idx) => (
                  <p key={idx} className="text-justify">
                    {para}
                  </p>
                ))}
              </div>
            )}

            {/* Optional Stimulus Data Table */}
            {currentQuestion.stimulusTable && (
              <div className="mt-5 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                {currentQuestion.stimulusTable.title && (
                  <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-800">
                    {currentQuestion.stimulusTable.title}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        {currentQuestion.stimulusTable.headers.map((h, i) => (
                          <th key={i} className="py-2.5 px-3 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentQuestion.stimulusTable.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/70">
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className={`py-2 px-3 ${
                                cIdx > 0 ? 'font-mono tabular-nums text-slate-800' : 'font-medium text-slate-800'
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {currentQuestion.stimulusTable.caption && (
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 italic">
                    {currentQuestion.stimulusTable.caption}
                  </div>
                )}
              </div>
            )}

            {/* Optional Highlight Formula / Info Box */}
            {currentQuestion.stimulusHighlightBox && (
              <div className="mt-4 p-3.5 rounded-lg bg-blue-50/70 border border-blue-200 text-xs sm:text-sm font-mono font-semibold text-blue-900">
                {currentQuestion.stimulusHighlightBox}
              </div>
            )}

            {currentQuestion.stimulusSource && (
              <div className="mt-4 pt-3 border-t border-slate-200/70 text-xs text-slate-500 italic">
                {currentQuestion.stimulusSource}
              </div>
            )}
          </div>

          {/* Right Column: Pertanyaan & Area Jawaban */}
          <div className="lg:col-span-6 p-5 sm:p-7 overflow-y-auto max-h-[62vh] flex flex-col justify-between">
            <div>
              {/* Question Text */}
              <div className={`font-semibold text-slate-900 ${fontSizeClass}`}>
                {currentQuestion.questionText}
              </div>

              {currentQuestion.instructionText && (
                <p className="mt-1.5 text-xs font-medium text-blue-700">
                  {currentQuestion.instructionText}
                </p>
              )}

              {/* Dynamic Answer Input Area */}
              <div className="mt-5">
                {/* 1. PILIHAN GANDA */}
                {currentQuestion.type === 'pilihan_ganda' &&
                  currentQuestion.options && (
                    <div className="space-y-2.5">
                      {currentQuestion.options.map((opt) => {
                        const isSelected =
                          currentAnswer.selectedOptionId === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectSingleOption(opt.id)}
                            className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3.5 cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50/90 border-[#0066ff] ring-1 ring-[#0066ff]'
                                : 'bg-white hover:bg-slate-50 border-slate-200'
                            }`}
                          >
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors ${
                                isSelected
                                  ? 'bg-[#0066ff] text-white'
                                  : 'bg-slate-100 text-slate-700 border border-slate-300'
                              }`}
                            >
                              {opt.id}
                            </span>
                            <span className={`text-slate-800 ${fontSizeClass}`}>
                              {opt.text}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                {/* 2. PILIHAN GANDA KOMPLEKS (MCMA) */}
                {currentQuestion.type === 'pilihan_ganda_kompleks' &&
                  currentQuestion.options && (
                    <div className="space-y-2.5">
                      {currentQuestion.options.map((opt) => {
                        const isChecked = (
                          currentAnswer.selectedOptionIds || []
                        ).includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleToggleComplexOption(opt.id)}
                            className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3.5 cursor-pointer ${
                              isChecked
                                ? 'bg-blue-50/90 border-[#0066ff] ring-1 ring-[#0066ff]'
                                : 'bg-white hover:bg-slate-50 border-slate-200'
                            }`}
                          >
                            <span className="mt-0.5 shrink-0 text-[#0066ff]">
                              {isChecked ? (
                                <CheckSquare className="w-5 h-5 fill-blue-600 text-white" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-400" />
                              )}
                            </span>
                            <span className={`text-slate-800 ${fontSizeClass}`}>
                              {opt.text}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                {/* 3. BENAR / SALAH (KATEGORI MATRIX) */}
                {currentQuestion.type === 'benar_salah' &&
                  currentQuestion.statements && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700">
                            <th className="py-3 px-4">Pernyataan</th>
                            <th className="py-3 px-3 text-center w-24">
                              {currentQuestion.trueLabel || 'Benar'}
                            </th>
                            <th className="py-3 px-3 text-center w-24">
                              {currentQuestion.falseLabel || 'Salah'}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {currentQuestion.statements.map((st) => {
                            const chosen =
                              currentAnswer.statementAnswers?.[st.id];
                            return (
                              <tr key={st.id} className="hover:bg-slate-50/80">
                                <td className={`py-3.5 px-4 text-slate-800 ${fontSizeClass}`}>
                                  {st.statement}
                                </td>
                                <td className="py-3.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSelectStatement(st.id, 'Benar')
                                    }
                                    className={`w-7 h-7 rounded-full border mx-auto flex items-center justify-center cursor-pointer transition-all ${
                                      chosen === 'Benar'
                                        ? 'border-[#0066ff] bg-[#0066ff] text-white'
                                        : 'border-slate-300 bg-white hover:border-blue-400'
                                    }`}
                                    aria-label={`Pilih ${currentQuestion.trueLabel || 'Benar'}`}
                                  >
                                    {chosen === 'Benar' && (
                                      <span className="w-2.5 h-2.5 rounded-full bg-white" />
                                    )}
                                  </button>
                                </td>
                                <td className="py-3.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSelectStatement(st.id, 'Salah')
                                    }
                                    className={`w-7 h-7 rounded-full border mx-auto flex items-center justify-center cursor-pointer transition-all ${
                                      chosen === 'Salah'
                                        ? 'border-[#0066ff] bg-[#0066ff] text-white'
                                        : 'border-slate-300 bg-white hover:border-blue-400'
                                    }`}
                                    aria-label={`Pilih ${currentQuestion.falseLabel || 'Salah'}`}
                                  >
                                    {chosen === 'Salah' && (
                                      <span className="w-2.5 h-2.5 rounded-full bg-white" />
                                    )}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                {/* 4. MENJODOHKAN (MATCHING) */}
                {currentQuestion.type === 'menjodohkan' &&
                  currentQuestion.premises &&
                  currentQuestion.responses && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          {activePremiseId
                            ? 'Sekarang klik salah satu kotak pada kolom Respon (Kanan) untuk memasangkan.'
                            : 'Klik salah satu kotak Premis (Kiri) terlebih dahulu.'}
                        </span>
                        <button
                          type="button"
                          onClick={handleResetMatching}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Pasangan</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Left Column: Premises */}
                        <div className="space-y-2.5">
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Premis (Pernyataan)
                          </div>
                          {currentQuestion.premises.map((prem, pIdx) => {
                            const pairedResponseId =
                              currentAnswer.matchingPairs?.[prem.id];
                            const isSelecting = activePremiseId === prem.id;
                            const colorObj =
                              PAIR_COLORS[pIdx % PAIR_COLORS.length];

                            return (
                              <button
                                key={prem.id}
                                type="button"
                                onClick={() => setActivePremiseId(prem.id)}
                                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-2 ${
                                  isSelecting
                                    ? 'bg-blue-50 border-[#0066ff] ring-2 ring-blue-400'
                                    : pairedResponseId
                                    ? `${colorObj.bg} ${colorObj.border}`
                                    : 'bg-white hover:bg-slate-50 border-slate-200'
                                }`}
                              >
                                <span className="text-xs sm:text-sm font-medium text-slate-800">
                                  {pIdx + 1}. {prem.text}
                                </span>
                                {pairedResponseId && (
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-bold shrink-0 flex items-center gap-1 ${colorObj.badge}`}
                                  >
                                    <Link2 className="w-3 h-3" />
                                    #{pIdx + 1}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Right Column: Responses */}
                        <div className="space-y-2.5">
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Respon (Pilihan Pasangan)
                          </div>
                          {currentQuestion.responses.map((resp, rIdx) => {
                            // Find if any premise is paired with this response
                            const pairedPremiseIndex =
                              currentQuestion.premises?.findIndex(
                                (p) =>
                                  currentAnswer.matchingPairs?.[p.id] ===
                                  resp.id
                              ) ?? -1;
                            const isPaired = pairedPremiseIndex !== -1;
                            const colorObj = isPaired
                              ? PAIR_COLORS[
                                  pairedPremiseIndex % PAIR_COLORS.length
                                ]
                              : null;

                            return (
                              <button
                                key={resp.id}
                                type="button"
                                onClick={() => handlePairMatching(resp.id)}
                                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-2 ${
                                  isPaired && colorObj
                                    ? `${colorObj.bg} ${colorObj.border}`
                                    : activePremiseId
                                    ? 'bg-white hover:bg-blue-50/60 border-blue-300 border-dashed'
                                    : 'bg-white hover:bg-slate-50 border-slate-200'
                                }`}
                              >
                                <span className="text-xs sm:text-sm text-slate-800">
                                  {String.fromCharCode(65 + rIdx)}. {resp.text}
                                </span>
                                {isPaired && colorObj && (
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-bold shrink-0 ${colorObj.badge}`}
                                  >
                                    Pasangan #{pairedPremiseIndex + 1}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                {/* 5. ISIAN SINGKAT */}
                {currentQuestion.type === 'isian_singkat' && (
                  <div className="space-y-3">
                    <label
                      htmlFor="shortAnswerInput"
                      className="block text-xs font-semibold text-slate-600"
                    >
                      Jawaban Singkat Anda:
                    </label>
                    <input
                      id="shortAnswerInput"
                      type="text"
                      value={currentAnswer.shortAnswer || ''}
                      onChange={(e) => handleShortAnswerChange(e.target.value)}
                      placeholder={
                        currentQuestion.placeholder ||
                        'Ketikkan jawaban singkat Anda di sini...'
                      }
                      className="w-full max-w-md px-4 py-3 text-base font-mono font-semibold text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-[#0066ff] focus:bg-white transition-colors"
                    />
                    {currentAnswer.shortAnswer?.trim() && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Jawaban tersimpan otomatis.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Navigation Footer Bar (Authentic Pusmendik Red / Yellow / Blue buttons) */}
        <div className="px-5 sm:px-7 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Soal Sebelumnya (Red/Rose) */}
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
              currentIndex === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-[#e11d48] hover:bg-[#be123c] text-white shadow-sm cursor-pointer'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Soal Sebelumnya</span>
          </button>

          {/* Center: Ragu-Ragu Checkbox Button (Amber/Yellow) */}
          <button
            type="button"
            onClick={handleToggleDoubtful}
            className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              currentAnswer.doubtful
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-600 shadow-sm'
                : 'bg-[#f59e0b] hover:bg-[#d97706] text-white shadow-sm'
            }`}
          >
            <span className="w-4 h-4 rounded bg-white/90 text-amber-700 flex items-center justify-center text-xs font-extrabold">
              {currentAnswer.doubtful ? '✓' : ''}
            </span>
            <span>Ragu-Ragu</span>
          </button>

          {/* Right: Soal Berikutnya or Selesai Tes (Blue) */}
          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={() =>
                setCurrentIndex((prev) =>
                  Math.min(questions.length - 1, prev + 1)
                )
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer"
            >
              <span>Soal Berikutnya</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRequestFinish}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer"
            >
              <span>Selesai Tes</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* MODAL 1: DAFTAR SOAL (Question Navigation Grid) */}
      {showQuestionListModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-800">
                Daftar Nomor Soal
              </h3>
              <button
                type="button"
                onClick={() => setShowQuestionListModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5 grid grid-cols-5 gap-3">
              {questions.map((q, idx) => {
                const ans = answers[q.id];
                const answered = isQuestionAnswered(q, ans);
                const doubtful = ans?.doubtful;
                const isCurrent = idx === currentIndex;

                let btnStyle =
                  'bg-white border-slate-300 text-slate-700 hover:bg-slate-50';
                if (doubtful) {
                  btnStyle =
                    'bg-[#f59e0b] border-amber-600 text-white font-bold';
                } else if (answered) {
                  btnStyle =
                    'bg-slate-800 border-slate-900 text-white font-bold';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowQuestionListModal(false);
                    }}
                    className={`relative h-12 rounded-xl border-2 font-mono text-sm flex flex-col items-center justify-center transition-all cursor-pointer ${btnStyle} ${
                      isCurrent ? 'ring-2 ring-[#0066ff] ring-offset-2' : ''
                    }`}
                  >
                    <span>{q.number}</span>
                    {q.type === 'pilihan_ganda' && ans?.selectedOptionId && (
                      <span className="text-[10px] opacity-90">
                        ({ans.selectedOptionId})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-slate-800 inline-block" />
                  Sudah Dijawab
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-[#f59e0b] inline-block" />
                  Ragu-Ragu
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded border border-slate-300 bg-white inline-block" />
                  Belum Dijawab
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowQuestionListModal(false);
                  handleRequestFinish();
                }}
                className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
              >
                Akhiri Tes Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: INFORMASI SOAL */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-800">
                Informasi Butir Soal #{currentQuestion.number}
              </h3>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs sm:text-sm text-slate-600">
              <div>
                <span className="font-semibold text-slate-800">Domain / Kompetensi:</span>{' '}
                {currentQuestion.category}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Bentuk Soal:</span>{' '}
                {getQuestionTypeLabel(currentQuestion.type)}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Bobot Nilai Maksimal:</span>{' '}
                {currentQuestion.points} Poin
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="px-5 py-2 rounded-full bg-[#0066ff] text-white text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PERINGATAN MASIH ADA SOAL RAGU-RAGU */}
      {showDoubtWarningModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Masih Ada Jawaban Ragu-Ragu!
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Anda masih memiliki soal yang ditandai <strong>Ragu-Ragu</strong> (warna kuning). Silakan hilangkan tanda centang Ragu-Ragu terlebih dahulu sebelum mengakhiri tes.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDoubtWarningModal(false);
                  setShowQuestionListModal(true);
                }}
                className="px-6 py-2.5 rounded-full bg-[#f59e0b] hover:bg-amber-600 text-white text-xs font-bold cursor-pointer"
              >
                Lihat Daftar Soal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: KONFIRMASI SELESAI TES (Official Pusmendik ANBK Dialog) */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-slate-800">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0066ff] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold">
                Konfirmasi Selesai Tes
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin mengakhiri mata uji{' '}
              <strong>{examPackage.title}</strong>?
              {answeredCount < questions.length && (
                <span className="block mt-2 text-rose-600 font-semibold">
                  Perhatian: Masih terdapat {questions.length - answeredCount} soal yang belum dijawab.
                </span>
              )}
            </p>

            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmFinishChecked}
                onChange={(e) => setConfirmFinishChecked(e.target.checked)}
                className="mt-1 w-4 h-4 accent-[#0066ff]"
              />
              <span className="text-xs text-slate-800 leading-relaxed">
                Centang kotak ini, kemudian tekan tombol <strong>Selesai</strong>. Anda akan melihat laporan hasil nilai dan pembahasan soal.
              </span>
            </label>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowFinishModal(false)}
                className="px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Tidak / Kembali
              </button>
              <button
                type="button"
                disabled={!confirmFinishChecked}
                onClick={handleConfirmFinish}
                className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all ${
                  confirmFinishChecked
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
