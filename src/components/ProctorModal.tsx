import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  Plus,
  Trash2,
  RotateCcw,
  Users,
  BookOpen,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { ExamPackage, ExamResultSummary, Question } from '../types/cbt';
import { getQuestionTypeLabel } from '../data/cbtData';

interface ProctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeToken: string;
  onUpdateToken: (newToken: string) => void;
  packages: ExamPackage[];
  onUpdatePackages: (nextPackages: ExamPackage[]) => void;
  onResetDefaultPackages: () => void;
  resultsHistory: ExamResultSummary[];
  onClearHistory: () => void;
}

export const ProctorModal: React.FC<ProctorModalProps> = ({
  isOpen,
  onClose,
  activeToken,
  onUpdateToken,
  packages,
  onUpdatePackages,
  onResetDefaultPackages,
  resultsHistory,
  onClearHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'token' | 'questions' | 'results'>('token');
  const [selectedPkgId, setSelectedPkgId] = useState(packages[0]?.id || '');
  const [customTokenInput, setCustomTokenInput] = useState(activeToken);
  const [savedNotice, setSavedNotice] = useState('');

  // New Question Form State
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
  const [newExplanation, setNewExplanation] = useState('');

  if (!isOpen) return null;

  const selectedPackage =
    packages.find((p) => p.id === selectedPkgId) || packages[0];

  const notify = (msg: string) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(''), 2500);
  };

  const handleGenerateRandomToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = '';
    for (let i = 0; i < 6; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCustomTokenInput(token);
    onUpdateToken(token);
    notify(`Token ujian diperbarui menjadi ${token}`);
  };

  const handleSaveCustomToken = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customTokenInput.trim().toUpperCase();
    if (cleaned.length < 4) return;
    onUpdateToken(cleaned);
    notify(`Token ujian disimpan: ${cleaned}`);
  };

  const handleChangeDuration = (pkgId: string, minutes: number) => {
    const next = packages.map((p) =>
      p.id === pkgId
        ? { ...p, durationMinutes: Math.max(5, Math.min(180, minutes)) }
        : p
    );
    onUpdatePackages(next);
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage || !newQuestionText.trim() || !optA.trim() || !optB.trim()) {
      return;
    }

    const nextNumber = selectedPackage.questions.length + 1;
    const newQuestion: Question = {
      id: `custom_${Date.now()}`,
      number: nextNumber,
      type: 'pilihan_ganda',
      category: newCategory.trim() || 'Penalaran Umum',
      stimulusTitle: newStimulusTitle.trim() || 'Wacana Soal Tambahan',
      stimulusText:
        newStimulusText.trim() ||
        'Bacalah pertanyaan dengan saksama sebelum memilih jawaban yang paling tepat.',
      questionText: newQuestionText.trim(),
      instructionText: 'Pilih satu jawaban yang paling tepat!',
      options: [
        { id: 'A', text: optA.trim() },
        { id: 'B', text: optB.trim() },
        { id: 'C', text: optC.trim() || 'Pilihan C' },
        { id: 'D', text: optD.trim() || 'Pilihan D' },
        { id: 'E', text: optE.trim() || 'Pilihan E' },
      ],
      correctOptionId: correctOpt,
      points: 10,
      explanation:
        newExplanation.trim() || `Jawaban yang benar adalah opsi ${correctOpt}.`,
    };

    const nextPackages = packages.map((pkg) =>
      pkg.id === selectedPackage.id
        ? { ...pkg, questions: [...pkg.questions, newQuestion] }
        : pkg
    );
    onUpdatePackages(nextPackages);

    setNewStimulusTitle('');
    setNewStimulusText('');
    setNewQuestionText('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setOptE('');
    setNewExplanation('');
    notify(`Soal No. ${nextNumber} berhasil ditambahkan ke ${selectedPackage.code}`);
  };

  const handleDeleteQuestion = (pkgId: string, qId: string) => {
    const nextPackages = packages.map((pkg) => {
      if (pkg.id !== pkgId) return pkg;
      const filtered = pkg.questions
        .filter((q) => q.id !== qId)
        .map((q, idx) => ({ ...q, number: idx + 1 }));
      return { ...pkg, questions: filtered };
    });
    onUpdatePackages(nextPackages);
    notify('Butir soal berhasil dihapus.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#1e5282] text-white flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold">
              Panel Proktor & Manajemen Bank Soal ANBK / TKA
            </h2>
            <p className="text-xs text-sky-200">
              Kelola token rilis, durasi ujian, bank soal simulasi, dan rekap hasil peserta
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('token')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'token'
                  ? 'bg-white text-[#0066ff] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Token & Pengaturan Waktu</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('questions')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'questions'
                  ? 'bg-white text-[#0066ff] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Bank Soal ({selectedPackage?.questions.length || 0})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('results')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'results'
                  ? 'bg-white text-[#0066ff] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Rekap Nilai ({resultsHistory.length})</span>
            </button>
          </div>

          {savedNotice && (
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{savedNotice}</span>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: TOKEN & PENGATURAN */}
          {activeTab === 'token' && (
            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Token Rilis Saat Ini
                  </div>
                  <div className="mt-1 font-mono text-2xl font-extrabold tracking-[0.25em] text-[#0066ff]">
                    {activeToken}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Token ini digunakan peserta pada halaman Konfirmasi Data Peserta.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <form onSubmit={handleSaveCustomToken} className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={8}
                      value={customTokenInput}
                      onChange={(e) => setCustomTokenInput(e.target.value.toUpperCase())}
                      className="w-32 px-3 py-2 font-mono text-xs font-bold uppercase bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      Set Token
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={handleGenerateRandomToken}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs font-semibold cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Acak Token Baru</span>
                  </button>
                </div>
              </div>

              {/* Duration per Package */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800">
                    Daftar Paket Mata Ujian & Alokasi Waktu
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      onResetDefaultPackages();
                      notify('Bank soal dikembalikan ke setelan awal Pusmendik.');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset ke Bank Soal Bawaan</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <div className="text-sm font-bold text-slate-800">
                          {pkg.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Kode: {pkg.code} · {pkg.questions.length} Butir Soal
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-600">
                          Durasi (Menit):
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={180}
                          value={pkg.durationMinutes}
                          onChange={(e) =>
                            handleChangeDuration(
                              pkg.id,
                              parseInt(e.target.value, 10) || 60
                            )
                          }
                          className="w-20 px-2.5 py-1.5 font-mono text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BANK SOAL */}
          {activeTab === 'questions' && selectedPackage && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="text-xs font-bold text-slate-700">
                  Pilih Paket Mata Ujian:
                </label>
                <select
                  value={selectedPackage.id}
                  onChange={(e) => setSelectedPkgId(e.target.value)}
                  className="flex-1 max-w-md px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg"
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.questions.length} Soal)
                    </option>
                  ))}
                </select>
              </div>

              {/* Existing Questions List */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700">
                  Daftar Butir Soal ({selectedPackage.questions.length} Soal)
                </div>
                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {selectedPackage.questions.map((q) => (
                    <div
                      key={q.id}
                      className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-slate-50"
                    >
                      <div className="text-xs">
                        <span className="font-mono font-bold text-[#0066ff]">
                          No. {q.number}
                        </span>{' '}
                        <span className="font-semibold text-slate-700">
                          [{getQuestionTypeLabel(q.type)}]
                        </span>{' '}
                        <span className="text-slate-500">· {q.category}</span>
                        <p className="text-slate-800 mt-1 line-clamp-1">
                          {q.questionText}
                        </p>
                      </div>
                      {selectedPackage.questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteQuestion(selectedPackage.id, q.id)
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                          title="Hapus soal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Question Form */}
              <form
                onSubmit={handleAddQuestion}
                className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Plus className="w-4 h-4 text-[#0066ff]" />
                  <span>Tambah Soal Pilihan Ganda Baru</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Kategori / Kompetensi
                    </label>
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Judul Wacana / Stimulus
                    </label>
                    <input
                      type="text"
                      value={newStimulusTitle}
                      onChange={(e) => setNewStimulusTitle(e.target.value)}
                      placeholder="Contoh: Perkembangan AI di Pendidikan"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Teks Wacana / Stimulus
                  </label>
                  <textarea
                    rows={2}
                    value={newStimulusText}
                    onChange={(e) => setNewStimulusText(e.target.value)}
                    placeholder="Tuliskan bacaan atau pengantar soal..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Pertanyaan Soal *
                  </label>
                  <input
                    type="text"
                    required
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Ketikkan kalimat pertanyaan..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    value={optA}
                    onChange={(e) => setOptA(e.target.value)}
                    placeholder="Opsi A *"
                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    required
                    value={optB}
                    onChange={(e) => setOptB(e.target.value)}
                    placeholder="Opsi B *"
                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={optC}
                    onChange={(e) => setOptC(e.target.value)}
                    placeholder="Opsi C"
                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={optD}
                    onChange={(e) => setOptD(e.target.value)}
                    placeholder="Opsi D"
                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={optE}
                    onChange={(e) => setOptE(e.target.value)}
                    placeholder="Opsi E"
                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-600">
                      Kunci Jawaban:
                    </label>
                    <select
                      value={correctOpt}
                      onChange={(e) => setCorrectOpt(e.target.value)}
                      className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                    >
                      {['A', 'B', 'C', 'D', 'E'].map((k) => (
                        <option key={k} value={k}>
                          Opsi {k}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Pembahasan Singkat
                  </label>
                  <input
                    type="text"
                    value={newExplanation}
                    onChange={(e) => setNewExplanation(e.target.value)}
                    placeholder="Penjelasan mengapa jawaban tersebut benar..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs font-semibold cursor-pointer"
                >
                  Simpan Butir Soal
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: REKAP NILAI PESERTA */}
          {activeTab === 'results' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  Riwayat Hasil Simulasi Peserta
                </h3>
                {resultsHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearHistory}
                    className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    Bersihkan Riwayat
                  </button>
                )}
              </div>

              {resultsHistory.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                  Belum ada data peserta yang menyelesaikan simulasi pada perangkat ini.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                        <th className="py-2.5 px-3">Peserta</th>
                        <th className="py-2.5 px-3">Mata Ujian</th>
                        <th className="py-2.5 px-3">Benar</th>
                        <th className="py-2.5 px-3">Skor Akhir</th>
                        <th className="py-2.5 px-3">Waktu Selesai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {resultsHistory.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {r.participant.fullName}{' '}
                            <span className="font-mono text-slate-400">
                              ({r.participant.username})
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {r.packageTitle}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums">
                            {r.correctCount} / {r.totalQuestions}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#0066ff] tabular-nums">
                            {r.finalScore}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {r.completedAt}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
