import { useState } from 'react';

interface OcrPreviewProps {
  previewUrl: string;
  initialText: string;
  confidence: number;
  onConfirm: (editedText: string) => void;
  onRetry: () => void;
}

export default function OcrPreview({
  previewUrl,
  initialText,
  confidence,
  onConfirm,
  onRetry,
}: OcrPreviewProps) {
  const [text, setText] = useState(initialText);
  const confidenceOk = confidence >= 85;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden bg-surface border border-border">
        <img
          src={previewUrl}
          alt="Worksheet preview"
          className="w-full max-h-64 object-contain"
        />
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
            confidenceOk
              ? 'bg-green/10 text-green'
              : 'bg-red/10 text-red'
          }`}
        >
          OCR Confidence: {Math.round(confidence)}%
        </span>
        {!confidenceOk && (
          <span className="text-xs text-red font-medium">
            Low confidence — you may want to retake the photo
          </span>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-text-2 mb-1">
          Recognised Text (you can edit)
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="w-full rounded-xl border border-border bg-surface p-3 text-sm text-text focus:border-accent focus:outline-none resize-y"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onConfirm(text)}
          className="flex-1 rounded-xl bg-accent py-3 font-bold text-white shadow-md active:scale-[0.98]"
        >
          Looks Good — Build My Mission!
        </button>
        <button
          onClick={onRetry}
          className="rounded-xl bg-bg-2 px-5 py-3 font-semibold text-text-2 active:scale-[0.98]"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
