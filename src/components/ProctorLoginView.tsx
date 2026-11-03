import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, KeyRound, ArrowLeft, Lock, UserCheck } from 'lucide-react';

interface ProctorLoginViewProps {
  onProctorLoginSuccess: (proctorName: string, encryptionCode: string) => void;
  onBackToStudentLogin: () => void;
  onGoToAdminLogin?: () => void;
}

export const ProctorLoginView: React.FC<ProctorLoginViewProps> = ({
  onProctorLoginSuccess,
  onBackToStudentLogin,
  onGoToAdminLogin,
}) => {
  const [proctorName, setProctorName] = useState('');
  const [password, setPassword] = useState('');
  const [encryptionCode, setEncryptionCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showEncryption, setShowEncryption] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = proctorName.trim();
    const cleanPass = password.trim();
    const cleanEnc = encryptionCode.trim();

    if (!cleanName || !cleanPass || !cleanEnc) {
      setErrorMsg('Nama Proktor, Kata Sandi, dan Kode Enkripsi wajib diisi lengkap.');
      return;
    }

    if (cleanEnc.length < 4) {
      setErrorMsg('Kode Enkripsi tidak valid (minimal 4 karakter).');
      return;
    }

    setErrorMsg('');
    onProctorLoginSuccess(cleanName.toUpperCase(), cleanEnc.toUpperCase());
  };

  const handleFillDefaultProctor = () => {
    setProctorName('K05060108-KB6K');
    setPassword('SMADIP2026*');
    setEncryptionCode('GLDTKASMA');
    setErrorMsg('');
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 min-h-[calc(100vh-10rem)]">
      {/* Proctor Login Card matching the CBT aesthetic */}
      <div className="w-full max-w-[445px] bg-white rounded-[14px] px-9 sm:px-11 py-10 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.16)] border border-slate-100/80">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-[18px] font-bold text-[#1e293b] tracking-tight">
            Login Proktor
          </h1>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0066ff]">
            <ShieldCheck className="w-4 h-4" />
            <span>Akses Server Ruang</span>
          </span>
        </div>

        <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[#475569]">
          Masukkan nama proktor, kata sandi, dan kode enkripsi ruang ujian untuk mengelola sesi dan bank soal.
        </p>

        {errorMsg && (
          <div className="mt-4 px-3.5 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-7 space-y-6">
          {/* 1. Nama Proktor */}
          <div className="flex items-center gap-3.5">
            <div className="shrink-0 text-[#1e293b]" aria-hidden="true">
              <UserCheck className="w-[18px] h-[18px]" />
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={proctorName}
                onChange={(e) => setProctorName(e.target.value)}
                placeholder="Nama Proktor"
                aria-label="Nama Proktor"
                autoComplete="username"
                className="w-full pb-2 pt-1 text-[14px] text-slate-800 placeholder:text-slate-400 bg-transparent border-b border-slate-200 focus:border-[#0066ff] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* 2. Kata Sandi */}
          <div className="flex items-center gap-3.5">
            <div className="shrink-0 text-[#1e293b]" aria-hidden="true">
              <Lock className="w-[18px] h-[18px]" />
            </div>
            <div className="relative flex-1 flex items-center border-b border-slate-200 focus-within:border-[#0066ff] transition-colors">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata Sandi"
                aria-label="Kata Sandi"
                autoComplete="current-password"
                className="w-full pb-2 pt-1 pr-8 text-[14px] text-slate-800 placeholder:text-slate-400 bg-transparent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-0 bottom-2 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* 3. Kode Enkripsi */}
          <div className="flex items-center gap-3.5">
            <div className="shrink-0 text-[#1e293b]" aria-hidden="true">
              <KeyRound className="w-[18px] h-[18px]" />
            </div>
            <div className="relative flex-1 flex items-center border-b border-slate-200 focus-within:border-[#0066ff] transition-colors">
              <input
                type={showEncryption ? 'text' : 'password'}
                value={encryptionCode}
                onChange={(e) => setEncryptionCode(e.target.value.toUpperCase())}
                placeholder="Kode Enkripsi"
                aria-label="Kode Enkripsi"
                className="w-full pb-2 pt-1 pr-8 font-mono text-[14px] tracking-wider text-slate-800 placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 bg-transparent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowEncryption((prev) => !prev)}
                className="absolute right-0 bottom-2 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                aria-label={showEncryption ? 'Sembunyikan kode enkripsi' : 'Tampilkan kode enkripsi'}
              >
                {showEncryption ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2.5">
            {onGoToAdminLogin && (
              <button
                type="button"
                onClick={onGoToAdminLogin}
                className="w-full py-2.5 px-6 rounded-full bg-slate-800 hover:bg-slate-900 active:scale-[0.99] text-white text-[13.5px] font-semibold transition-all cursor-pointer"
              >
                Login Administrator
              </button>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-6 rounded-full bg-[#0066ff] hover:bg-[#0052cc] active:scale-[0.99] text-white text-[14px] font-semibold shadow-[0_6px_16px_rgba(0,102,255,0.28)] transition-all cursor-pointer"
            >
              Login Proktor
            </button>

            <button
              type="button"
              onClick={onBackToStudentLogin}
              className="w-full py-2 px-4 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Halaman Login Peserta</span>
            </button>
          </div>
        </form>
      </div>

      {/* Quick-Fill & Direct Instant Login Helper below card */}
      <div className="mt-5 w-full max-w-[445px] bg-white/85 backdrop-blur-xs rounded-xl p-3.5 border border-slate-200/80 shadow-xs space-y-2.5">
        <div className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Akses Masuk Cepat (Langsung Masuk Dashboard)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onProctorLoginSuccess('K05060108-KB6K', 'GLDTKASMA')}
            className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            ⚡ Masuk Cepat Proktor
          </button>
          <button
            type="button"
            onClick={handleFillDefaultProctor}
            className="py-2 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#0066ff] border border-blue-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Isi Kolom Otomatis
          </button>
        </div>
      </div>
    </main>
  );
};
