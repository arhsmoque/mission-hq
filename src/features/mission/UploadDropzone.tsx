import { useCallback, useState } from 'react';

interface UploadDropzoneProps {
  onFileSelect: (file: File, previewUrl: string) => void;
  disabled?: boolean;
}

export default function UploadDropzone({ onFileSelect, disabled }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') return;
      const url = URL.createObjectURL(file);
      onFileSelect(file, url);
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

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
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
        relative rounded-2xl border-2 border-dashed p-12 text-center transition-all
        ${isDragging ? 'border-accent bg-accent/5' : 'border-border bg-surface'}
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <input
        type="file"
        accept="image/*,.pdf"
        capture="environment"
        onChange={onChange}
        disabled={disabled}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
      <div className="text-4xl mb-3">📸</div>
      <p className="font-semibold text-primary">
        {isDragging ? 'Drop it here!' : 'Tap to take a photo'}
      </p>
      <p className="text-sm text-text-3 mt-1">
        Or drag & drop an image / PDF
      </p>
    </div>
  );
}
