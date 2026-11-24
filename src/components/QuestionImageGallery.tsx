import React, { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';

const SAFE_IMAGE_SRC_REGEX =
  /^(?:data:image\/(?:png|jpeg|jpg|gif|webp|bmp);base64,[A-Za-z0-9+/=\s]+|\/assets\/[A-Za-z0-9/_\-.]+)$/i;

export function sanitizeQuestionImageSources(images?: string[]): string[] {
  if (!Array.isArray(images) || images.length === 0) return [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of images) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    if (SAFE_IMAGE_SRC_REGEX.test(trimmed)) {
      seen.add(trimmed);
      unique.push(trimmed);
    }
  }
  return unique;
}

interface QuestionImageGalleryProps {
  images?: string[];
  altPrefix?: string;
  compact?: boolean;
  maxHeightClass?: string;
  className?: string;
}

export const QuestionImageGallery: React.FC<QuestionImageGalleryProps> = ({
  images,
  altPrefix = 'Gambar Soal',
  compact = false,
  maxHeightClass,
  className = '',
}) => {
  const safeImages = sanitizeQuestionImageSources(images);
  const [zoomedSrc, setZoomedSrc] = useState<string | null>(null);

  if (safeImages.length === 0) return null;

  return (
    <>
      <div
        className={`flex flex-wrap items-start gap-2.5 ${
          compact ? 'mt-2' : 'my-3'
        } ${className}`}
      >
        {safeImages.map((src, idx) => (
          <div
            key={`${altPrefix}_${idx}`}
            onClick={(e) => {
              e.stopPropagation();
              setZoomedSrc(src);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                setZoomedSrc(src);
              }
            }}
            title="Klik untuk memperbesar gambar"
            className={`group relative rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs hover:border-[#0095ff] transition-all cursor-zoom-in overflow-hidden ${
              compact ? 'max-w-[220px]' : 'max-w-full sm:max-w-[520px]'
            }`}
          >
            <img
              src={src}
              alt={`${altPrefix} ${idx + 1}`}
              loading="lazy"
              className={`block rounded-lg object-contain bg-white w-auto ${
                maxHeightClass || (compact ? 'max-h-36' : 'max-h-80')
              }`}
            />
            <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/70 text-white text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="w-3 h-3" />
              Perbesar
            </span>
          </div>
        ))}
      </div>

      {zoomedSrc && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            e.stopPropagation();
            setZoomedSrc(null);
          }}
        >
          <div
            className="relative max-w-[92vw] max-h-[90vh] bg-white rounded-2xl p-3 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomedSrc(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-900 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg cursor-pointer transition-colors"
              aria-label="Tutup pratinjau gambar"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={zoomedSrc}
              alt={altPrefix}
              className="max-w-[86vw] max-h-[84vh] object-contain rounded-xl bg-white"
            />
          </div>
        </div>
      )}
    </>
  );
};
