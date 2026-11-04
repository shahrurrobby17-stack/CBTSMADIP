export type QuestionType =
  | 'pilihan_ganda'
  | 'pilihan_ganda_kompleks'
  | 'benar_salah'
  | 'menjodohkan'
  | 'isian_singkat';

export interface OptionItem {
  id: string; // 'A', 'B', 'C', 'D', 'E'
  text: string;
}

export interface StatementItem {
  id: string;
  statement: string;
  correctValue: 'Benar' | 'Salah';
}

export interface MatchingPremise {
  id: string;
  text: string;
}

export interface MatchingResponse {
  id: string;
  text: string;
}

export interface QuestionTableData {
  title?: string;
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface Question {
  id: string;
  number: number;
  type: QuestionType;
  category: string; // e.g., 'Literasi Membaca', 'Numerasi', 'Penalaran Sains'
  stimulusTitle?: string;
  stimulusText?: string; // HTML/paragraphs separated by \n\n
  stimulusSource?: string;
  stimulusTable?: QuestionTableData;
  stimulusHighlightBox?: string;
  questionText: string;
  instructionText?: string;
  // For pilihan_ganda and pilihan_ganda_kompleks
  options?: OptionItem[];
  correctOptionId?: string; // for pilihan_ganda
  correctOptionIds?: string[]; // for pilihan_ganda_kompleks
  // For benar_salah
  statements?: StatementItem[];
  trueLabel?: string; // default 'Benar' or 'Sesuai'
  falseLabel?: string; // default 'Salah' or 'Tidak Sesuai'
  // For menjodohkan
  premises?: MatchingPremise[];
  responses?: MatchingResponse[];
  correctPairs?: Record<string, string>; // premiseId -> responseId
  // For isian_singkat
  correctShortAnswers?: string[]; // accepted case-insensitive answers
  placeholder?: string;
  // Explanation & scoring
  points: number;
  explanation: string;
}

export interface ExamPackage {
  id: string;
  code: string;
  title: string;
  level: string;
  subtest: string;
  durationMinutes: number;
  questions: Question[];
  targetClass?: string; // e.g. 'Kelas X', 'Kelas XI IPA', 'Kelas XI IPS', 'Kelas XII IPA', 'Kelas XII IPS', 'Semua Kelas'
}

export interface StudentAnswer {
  questionId: string;
  // Single choice: 'A'
  selectedOptionId?: string;
  // Multiple choice complex: ['A', 'C']
  selectedOptionIds?: string[];
  // Benar / Salah: { statementId: 'Benar' | 'Salah' }
  statementAnswers?: Record<string, 'Benar' | 'Salah'>;
  // Menjodohkan: { premiseId: responseId }
  matchingPairs?: Record<string, string>;
  // Isian singkat: string
  shortAnswer?: string;
  // Flagged as doubtful (Ragu-ragu)
  doubtful?: boolean;
}

export interface ParticipantProfile {
  username: string;
  nik: string;
  fullName: string;
  schoolName: string;
  gender: 'Laki-Laki' | 'Perempuan';
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  selectedPackageId: string;
  enteredToken: string;
}

export interface ExamResultSummary {
  id: string;
  participant: ParticipantProfile;
  packageTitle: string;
  completedAt: string;
  timeUsedSeconds: number;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  totalPoints: number;
  maxPoints: number;
  finalScore: number; // 0 - 100
}

export interface AdminScheduleItem {
  id: string;
  hariTanggal: string;
  kelas: string;
  mapel: string;
  waktuMulai: string;
  durasi: string;
  isActive: boolean;
}

