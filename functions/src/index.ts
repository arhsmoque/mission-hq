import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { callOpenRouter } from './openrouter';
import { buildChatPrompt } from './prompts/chatScaffold';
import { sanitizeResponse } from './prompts/safetyGuardrail';

initializeApp();
const db = getFirestore();

// Hello World callable to verify toolchain
export const helloWorld = onCall({
  region: 'asia-southeast1',
  cors: true,
}, async (request) => {
  const name = request.data.name || 'Agent';
  return { message: `Hello from Mission HQ, ${name}!`, timestamp: new Date().toISOString() };
});

// Phase 2: sendChatMessage
export const sendChatMessage = onCall({
  region: 'asia-southeast1',
  cors: true,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { missionId, moduleId, message, gadgetContext, model } = request.data as {
    missionId: string;
    moduleId?: number;
    message: string;
    gadgetContext?: string;
    model?: string;
  };

  if (!missionId || !message) {
    throw new HttpsError('invalid-argument', 'missionId and message are required');
  }

  try {
    // Fetch mission for context
    const missionDoc = await db.collection('missions').doc(missionId).get();
    if (!missionDoc.exists) {
      throw new HttpsError('not-found', 'Mission not found');
    }

    const missionData = missionDoc.data()!;
    const ocrText = missionData.ocrText || '';
    const modules = missionData.aiAnalysis?.modules || [];

    // Find module context if specified
    const moduleContext = moduleId !== undefined
      ? modules.find((m: any) => m.id === moduleId)
      : undefined;

    // Fetch last 10 messages
    const messagesSnap = await db
      .collection('chats')
      .doc(missionId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const lastMessages = messagesSnap.docs
      .map((d) => d.data() as { role: string; content: string })
      .reverse();

    // Build prompt
    const promptMessages = buildChatPrompt({
      ocrText,
      moduleTitle: moduleContext?.title,
      moduleGoal: moduleContext?.goal,
      gadgetContext,
      lastMessages,
    });

    // Add current user message
    promptMessages.push({ role: 'user', content: message });

    // Call OpenRouter
    const selectedModel = model || 'deepseek/deepseek-chat';
    const rawResponse = await callOpenRouter(promptMessages, selectedModel, 0.7);

    // Safety guardrail
    const safeResponse = sanitizeResponse(rawResponse, ocrText);

    // Write assistant message to Firestore
    const assistantMsg = {
      msgId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      role: 'assistant',
      content: safeResponse,
      moduleId: moduleId ?? null,
      gadgetUsed: gadgetContext || null,
      modelUsed: selectedModel,
      timestamp: new Date(),
    };

    await db
      .collection('chats')
      .doc(missionId)
      .collection('messages')
      .doc(assistantMsg.msgId)
      .set(assistantMsg);

    return { success: true, messageId: assistantMsg.msgId };
  } catch (err: any) {
    console.error('sendChatMessage error:', err);
    throw new HttpsError('internal', err.message || 'Failed to process message');
  }
});

// Phase 3: generateModules
export const generateModules = onCall({
  region: 'asia-southeast1',
  cors: true,
}, async (request) => {
  throw new HttpsError('unimplemented', 'Coming in Phase 3');
});

// Phase 4: annotateChinese
export const annotateChinese = onCall({
  region: 'asia-southeast1',
  cors: true,
}, async (request) => {
  throw new HttpsError('unimplemented', 'Coming in Phase 4');
});
