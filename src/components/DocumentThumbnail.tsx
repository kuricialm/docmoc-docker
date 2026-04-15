import { useEffect, useRef, useState, memo } from 'react';
import * as api from '@/lib/api';
import FileTypeIcon from './FileTypeIcon';
import { Skeleton } from '@/components/ui/skeleton';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
const PDF_TYPE = 'application/pdf';

// Simple in-memory cache: docId -> dataURL
const thumbCache = new Map<string, string>();

function isPreviewable(fileType: string) {
  return IMAGE_TYPES.includes(fileType) || fileType === PDF_TYPE;
}

function clamp(min: number, value: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type Props = {
  docId: string;
  fileType: string;
  enabled: boolean;
};

async function renderPdfThumb(blob: Blob): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await blob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const scale = 800 / page.getViewport({ scale: 1 }).width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  pdf.destroy();
  return dataUrl;
}

export default memo(function DocumentThumbnail({ docId, fileType, enabled }: Props) {
  const [src, setSrc] = useState<string | null>(thumbCache.get(docId) ?? null);
  const [loading, setLoading] = useState(!thumbCache.has(docId));
  const [error, setError] = useState(false);
  const [sourceAspectRatio, setSourceAspectRatio] = useState<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled || !isPreviewable(fileType) || thumbCache.has(docId)) {
      setLoading(false);
      return;
    }

    let revoke: (() => void) | null = null;

    (async () => {
      try {
        const blob = await api.getDocumentBlob(docId);
        if (!blob || !mounted.current) return;

        let url: string;
        if (fileType === PDF_TYPE) {
          url = await renderPdfThumb(blob);
        } else {
          url = URL.createObjectURL(blob);
          revoke = () => URL.revokeObjectURL(url);
        }

        thumbCache.set(docId, url);
        if (mounted.current) setSrc(url);
      } catch {
        if (mounted.current) setError(true);
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();

    return () => {
      // Don't revoke cached URLs — they stay for the session
    };
  }, [docId, fileType, enabled]);

  if (!enabled || !isPreviewable(fileType) || error) {
    return <FileTypeIcon fileType={fileType} size="lg" />;
  }

  if (loading) {
    return <Skeleton className="w-full h-full rounded-none" />;
  }

  if (src) {
    const isPdf = fileType === PDF_TYPE;
    const ratio = sourceAspectRatio ?? (isPdf ? 0.75 : 1.4);

    // Match reference behavior:
    // - Large framed tile
    // - Top-anchored
    // - Natural media ratio (no stretch)
    // - Cropping happens by viewport clipping, not distortion
    const frameWidth = clamp(56, 66 + (ratio - 1) * 18, 82);
    const objectPosition = isPdf
      ? 'center top'
      : ratio > 1.8
        ? 'center 40%'
        : ratio < 0.8
          ? 'center 32%'
          : 'center center';

    return (
      <div className="w-full h-full px-[clamp(10px,2.6vw,16px)] pt-[clamp(12px,3vw,20px)] overflow-hidden">
        <div className="w-full h-full flex items-start justify-center overflow-hidden">
          <div
            className="relative overflow-hidden rounded-lg border border-border/40 bg-background shadow-md"
            style={{ width: `${frameWidth}%`, aspectRatio: ratio }}
          >
            <img
              src={src}
              alt=""
              className="w-full h-full object-cover"
              style={{ objectPosition }}
              draggable={false}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                if (naturalWidth && naturalHeight) {
                  setSourceAspectRatio(naturalWidth / naturalHeight);
                }
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return <FileTypeIcon fileType={fileType} size="lg" />;
});
