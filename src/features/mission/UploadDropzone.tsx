import { useCallback, useRef, useState } from 'react';

interface UploadDropzoneProps {
  onFileSelect: (file: File, previewUrl: string) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function isAccepted(file: File): boolean {
  return ACCEPTED_TYPES.has(file.type) || file.name.toLowerCase().endsWith('.docx');
}

function previewUrlFor(file: File): string {
  if (file.name.toLowerCase().endsWith('.docx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return '';
  }
  return URL.createObjectURL(file);
}

export default function UploadDropzone({ onFileSelect, disabled }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!isAccepted(file)) return;
      onFileSelect(file, previewUrlFor(file));
    },
    [onFileSelect]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [disabled, handleFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`
        rounded-2xl border-2 border-dashed p-8 text-center transition-all space-y-6
        ${isDragging ? 'border-accent bg-accent/5' : 'border-border bg-surface'}
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      {/* Hidden inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        disabled={disabled}
        className="hidden"
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        disabled={disabled}
        className="hidden"
      />

      {isDragging ? (
        <p className="font-semibold text-accent text-lg">Drop it here!</p>
      ) : (
        <>
          <p className="text-sm text-text-3">
            Drag & drop a file here, or use the buttons below
          </p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={disabled}
              className="flex-1 flex flex-col items-center gap-2 rounded-2xl bg-bg-2 border border-border px-4 py-5 font-semibold text-text-2 active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              <span className="text-3xl">📸</span>
              <span className="text-sm">Take Photo</span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={disabled}
              className="flex-1 flex flex-col items-center gap-2 rounded-2xl bg-bg-2 border border-border px-4 py-5 font-semibold text-text-2 active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              <span className="text-3xl">📄</span>
              <span className="text-sm">Upload File</span>
              <span className="text-xs text-text-3">PDF · DOCX · JPG</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
