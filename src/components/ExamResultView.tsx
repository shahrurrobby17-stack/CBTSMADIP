import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Printer,
  LogOut,
  BookOpen,
  Award,
  Clock,
} from 'lucide-react';
import { ExamPackage, ParticipantProfile, Question, StudentAnswer } from '../types/cbt';
import { evaluateQuestionScore, getQuestionTypeLabel } from '../data/cbtData';

interface ExamResultViewProps {
  profile: ParticipantProfile;
  examPackage: ExamPackage;
  answers: Record<string, StudentAnswer>;
  timeUsedSeconds: number;
  onRetakeOrChangePackage: () => void;
  onLogout: () => void;
}

export const ExamResultView: React.FC<ExamResultViewProps> = ({
  profile,
  examPackage,
  answers,
  timeUsedSeconds,
  onRetakeOrChangePackage,
  onLogout,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'correct' | 'incorrect'>('all');

  const questions = examPackage.questions;
  const evaluations = questions.map((q) => {
    const ans = answers[q.id];
    const result = evaluateQuestionScore(q, ans);
    return {
      question: q,
      answer: ans,
      ...result,
    };
  });

  const totalPoints = evaluations.reduce((acc, e) => acc + e.earnedPoints, 0);
  const maxPoints = questions.reduce((acc, q) => acc + q.points, 0);
  const finalScore = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;
  const correctCount = evaluations.filter((e) => e.isCorrect).length;

  // Official ANBK Competency Tier classification
  const getCompetencyTier = (score: number) => {
    if (score >= 85) {
      return {
        label: 'Mahir (Mampu Mengintegrasikan & Mengevaluasi)',
        color: 'text-emerald-700',
      };
    }
    if (score >= 70) {
      return {
        label: 'Cakap (Mampu Mengaplikasikan Pengetahuan)',
        color: 'text-blue-700',
      };
    }
    if (score >= 50) {
      return {
        label: 'Dasar (Mampu Menemukan Informasi Eksplisit)',
        color: 'text-amber-700',
      };
    }
    return {
      label: 'Perlu Intervensi Khusus',
      color: 'text-rose-700',
    };
  };

  const tier = getCompetencyTier(finalScore);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m} menit ${s} detik`;
  };

  const renderStudentAnswerText = (q: Question, ans?: StudentAnswer) => {
    if (!ans) return 'Tidak dijawab';
    switch (q.type) {
      case 'pilihan_ganda': {
        if (!ans.selectedOptionId) return 'Tidak dijawab';
        const opt = q.options?.find((o) => o.id === ans.selectedOptionId);
        return `${ans.selectedOptionId}. ${opt?.text || ''}`;
      }
      case 'pilihan_ganda_kompleks': {
        if (!ans.selectedOptionIds || ans.selectedOptionIds.length === 0) {
          return 'Tidak dijawab';
        }
        return ans.selectedOptionIds.sort().join(', ');
      }
      case 'benar_salah': {
        if (!ans.statementAnswers) return 'Tidak dijawab';
        return (q.statements || [])
          .map(
            (st, idx) =>
              `Pernyataan ${idx + 1}: ${ans.statementAnswers?.[st.id] || '-'}`
          )
          .join(' · ');
      }
      case 'menjodohkan': {
        if (!ans.matchingPairs) return 'Tidak dijawab';
        return (q.premises || [])
          .map((p, idx) => {
            const rId = ans.matchingPairs?.[p.id];
            const rIdx = q.responses?.findIndex((r) => r.id === rId) ?? -1;
            const letter = rIdx >= 0 ? String.fromCharCode(65 + rIdx) : '-';
            return `Premis ${idx + 1} → Respon ${letter}`;
          })
          .join(' · ');
      }
      case 'isian_singkat':
        return ans.shortAnswer?.trim() || 'Tidak dijawab';
    }
  };

  const renderCorrectKeyText = (q: Question) => {
    switch (q.type) {
      case 'pilihan_ganda': {
        const opt = q.options?.find((o) => o.id === q.correctOptionId);
        return `${q.correctOptionId}. ${opt?.text || ''}`;
      }
      case 'pilihan_ganda_kompleks':
        return (q.correctOptionIds || []).join(', ');
      case 'benar_salah':
        return (q.statements || [])
          .map((st, idx) => `Pernyataan ${idx + 1}: ${st.correctValue}`)
          .join(' · ');
      case 'menjodohkan':
        return (q.premises || [])
          .map((p, idx) => {
            const rId = q.correctPairs?.[p.id];
            const rIdx = q.responses?.findIndex((r) => r.id === rId) ?? -1;
            const letter = rIdx >= 0 ? String.fromCharCode(65 + rIdx) : '-';
            return `Premis ${idx + 1} → Respon ${letter}`;
          })
          .join(' · ');
      case 'isian_singkat':
        return (q.correctShortAnswers || [])[0] || '-';
    }
  };

  const filteredEvaluations = evaluations.filter((item) => {
    if (filterMode === 'correct') return item.isCorrect;
    if (filterMode === 'incorrect') return !item.isCorrect;
    return true;
  });

  return (
    <main className="flex-1 max-w-[1180px] w-full mx-auto px-4 sm:px-8 py-8 space-y-6">
      {/* Summary Score Card */}
      <div className="bg-white rounded-[14px] p-6 sm:p-8 shadow-[0_18px_45px_-12px_rgba(15,23,42,0.14)] border border-slate-200/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
          <div>
            <div className="text-xs font-semibold text-slate-500">
              CBT SMA ISLAM DIPONEGORO WAGIR · LAPORAN HASIL SUMATIF AKHIR SEMESTER
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
              {examPackage.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>Peserta: <strong>{profile.fullName}</strong></span>
              <span aria-hidden="true">·</span>
              <span>Kode: <strong className="font-mono">{profile.username}</strong></span>
              <span aria-hidden="true">·</span>
              <span>Sekolah: <strong>{profile.schoolName}</strong></span>
            </div>
          </div>

          {/* Score Display Box */}
          <div className="flex items-center gap-5 bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 shrink-0">
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-500">
                Nilai Akhir Simulasi
              </div>
              <div className={`text-xs font-bold mt-0.5 ${tier.color}`}>
                {tier.label}
              </div>
            </div>
            <div className="pl-4 border-l border-slate-200 text-center">
              <div className="font-mono text-3xl font-extrabold text-[#0066ff] tabular-nums">
                {finalScore}
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                Skala 100
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="py-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-100">
          <div>
            <div className="text-xs text-slate-500">Jawaban Benar</div>
            <div className="mt-1 font-mono text-lg font-bold text-emerald-700 tabular-nums">
              {correctCount} / {questions.length} Soal
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Total Poin Diperoleh</div>
            <div className="mt-1 font-mono text-lg font-bold text-slate-800 tabular-nums">
              {totalPoints} / {maxPoints} Poin
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Waktu Pengerjaan</div>
            <div className="mt-1 text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="tabular-nums">{formatDuration(timeUsedSeconds)}</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Status Sesi</div>
            <div className="mt-1 text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              <span>Selesai & Dinilai</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRetakeOrChangePackage}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Ulangi / Pilih Mata Ujian Lain</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Hasil</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar ke Halaman Login</span>
          </button>
        </div>
      </div>

      {/* Detailed Question Review & Explanation Card */}
      <div className="bg-white rounded-[14px] p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-[#0066ff]" />
            <h2 className="text-lg font-bold text-slate-800">
              Kunci Jawaban & Pembahasan Lengkap
            </h2>
          </div>

          {/* Interactive Filter Controls */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({evaluations.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('correct')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                filterMode === 'correct'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Benar ({correctCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('incorrect')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                filterMode === 'incorrect'
                  ? 'bg-white text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Belum Tepat ({evaluations.length - correctCount})
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredEvaluations.map(({ question, answer, isCorrect, earnedPoints }) => (
            <div key={question.id} className="py-5 first:pt-1 last:pb-1 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-slate-800 text-white font-mono text-xs font-bold">
                    {question.number}
                  </span>
                  <span className="text-xs font-semibold text-slate-600">
                    {question.category} · {getQuestionTypeLabel(question.type)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isCorrect ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      Benar (+{earnedPoints} Poin)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                      <XCircle className="w-4 h-4" />
                      Belum Tepat (0 Poin)
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm font-semibold text-slate-900">
                {question.questionText}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-semibold text-slate-500 mb-1">
                    Jawaban Peserta:
                  </div>
                  <div className="font-medium text-slate-800">
                    {renderStudentAnswerText(question, answer)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200">
                  <div className="font-semibold text-emerald-800 mb-1">
                    Kunci Jawaban Resmi:
                  </div>
                  <div className="font-semibold text-emerald-950">
                    {renderCorrectKeyText(question)}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-blue-50/50 border border-blue-100 text-xs text-slate-700 leading-relaxed">
                <strong className="text-blue-900">Pembahasan: </strong>
                {question.explanation}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
};
