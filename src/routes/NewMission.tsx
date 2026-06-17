import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import UploadDropzone from '@/features/mission/UploadDropzone';
import OcrPreview from '@/features/mission/OcrPreview';
import { runOcr, type OcrResult } from '@/lib/ocr';
import { useCreateMission, useGenerateModules } from '@/features/mission/useMission';
import { useRootStore } from '@/stores/rootStore';

type Step = 'upload' | 'processing' | 'preview' | 'creating' | 'generating';

export default function NewMission() {
  const navigate = useNavigate();
  const createMission = useCreateMission();
  const generateModules = useGenerateModules();
  const selectedModel = useRootStore((s) => s.selectedModel);

  const [step, setStep] = useState<Step>('upload');
  const [previewUrl, setPreviewUrl] = useState('');
  const [ocrResult, setOcrResult] = useState<OcrResult>({ text: '', confidence: 0, engine: 'vision_llm' });

  const handleFileSelect = useCallback(async (file: File, url: string) => {
    setPreviewUrl(url);
    setStep('processing');
    try {
      const result = await runOcr(file);
      setOcrResult(result);
      setStep('preview');
    } catch (err) {
      console.error('OCR failed:', err);
      alert('OCR failed. Please try a clearer photo.');
      setStep('upload');
    }
  }, []);

  const handleConfirm = useCallback(
    async (editedText: string) => {
      setStep('creating');
      try {
        const missionId = await createMission.mutateAsync({
          ocrText: editedText,
          ocrEngine: ocrResult.engine,
          confidence: ocrResult.confidence,
        });
        setStep('generating');
        await generateModules.mutateAsync({
          missionId,
          ocrText: editedText,
          model: selectedModel,
        });
        navigate(`/mission/${missionId}`);
      } catch (err) {
        console.error('Create mission failed:', err);
        alert('Could not save mission. Check console for details.');
        setStep('preview');
      }
    },
    [createMission, generateModules, navigate, ocrResult.engine, ocrResult.confidence, selectedModel]
  );

  const handleRetry = useCallback(() => {
    setPreviewUrl('');
    setOcrResult({ text: '', confidence: 0, engine: 'vision_llm' });
    setStep('upload');
  }, []);

  return (
    <div className="p-6 max-w-xl mx-auto">
      <button onClick={() => navigate(-1)} className="mb-4 text-text-2">
        Back
      </button>
      <h1 className="font-display text-2xl font-black text-primary mb-2">
        New Mission
      </h1>
      <p className="text-text-3 mb-6">Upload a worksheet to get started.</p>

      {step === 'upload' && (
        <UploadDropzone onFileSelect={handleFileSelect} />
      )}

      {step === 'processing' && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <p className="mt-4 text-text-2 font-medium">Reading your worksheet...</p>
        </div>
      )}

      {step === 'preview' && (
        <OcrPreview
          previewUrl={previewUrl}
          initialText={ocrResult.text}
          confidence={ocrResult.confidence}
          onConfirm={handleConfirm}
          onRetry={handleRetry}
        />
      )}

      {step === 'creating' && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <p className="mt-4 text-text-2 font-medium">Saving your mission...</p>
        </div>
      )}

      {step === 'generating' && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <p className="mt-4 text-text-2 font-medium">AI is breaking this into steps...</p>
        </div>
      )}
    </div>
  );
}
