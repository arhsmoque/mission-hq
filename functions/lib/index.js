"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.annotateChinese = exports.generateModules = exports.sendChatMessage = exports.helloWorld = void 0;
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const openrouter_1 = require("./openrouter");
const chatScaffold_1 = require("./prompts/chatScaffold");
const safetyGuardrail_1 = require("./prompts/safetyGuardrail");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
// Hello World callable to verify toolchain
exports.helloWorld = (0, https_1.onCall)({
    region: 'asia-southeast1',
    cors: true,
}, async (request) => {
    const name = request.data.name || 'Agent';
    return { message: `Hello from Mission HQ, ${name}!`, timestamp: new Date().toISOString() };
});
// Phase 2: sendChatMessage
exports.sendChatMessage = (0, https_1.onCall)({
    region: 'asia-southeast1',
    cors: true,
}, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { missionId, moduleId, message, gadgetContext, model } = request.data;
    if (!missionId || !message) {
        throw new https_1.HttpsError('invalid-argument', 'missionId and message are required');
    }
    try {
        // Fetch mission for context
        const missionDoc = await db.collection('missions').doc(missionId).get();
        if (!missionDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Mission not found');
        }
        const missionData = missionDoc.data();
        const ocrText = missionData.ocrText || '';
        const modules = ((_a = missionData.aiAnalysis) === null || _a === void 0 ? void 0 : _a.modules) || [];
        // Find module context if specified
        const moduleContext = moduleId !== undefined
            ? modules.find((m) => m.id === moduleId)
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
            .map((d) => d.data())
            .reverse();
        // Build prompt
        const promptMessages = (0, chatScaffold_1.buildChatPrompt)({
            ocrText,
            moduleTitle: moduleContext === null || moduleContext === void 0 ? void 0 : moduleContext.title,
            moduleGoal: moduleContext === null || moduleContext === void 0 ? void 0 : moduleContext.goal,
            gadgetContext,
            lastMessages,
        });
        // Add current user message
        promptMessages.push({ role: 'user', content: message });
        // Call OpenRouter
        const selectedModel = model || 'deepseek/deepseek-chat';
        const rawResponse = await (0, openrouter_1.callOpenRouter)(promptMessages, selectedModel, 0.7);
        // Safety guardrail
        const safeResponse = (0, safetyGuardrail_1.sanitizeResponse)(rawResponse, ocrText);
        // Write assistant message to Firestore
        const assistantMsg = {
            msgId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: 'assistant',
            content: safeResponse,
            moduleId: moduleId !== null && moduleId !== void 0 ? moduleId : null,
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
    }
    catch (err) {
        console.error('sendChatMessage error:', err);
        throw new https_1.HttpsError('internal', err.message || 'Failed to process message');
    }
});
// Phase 3: generateModules
exports.generateModules = (0, https_1.onCall)({
    region: 'asia-southeast1',
    cors: true,
}, async (request) => {
    throw new https_1.HttpsError('unimplemented', 'Coming in Phase 3');
});
// Phase 4: annotateChinese
exports.annotateChinese = (0, https_1.onCall)({
    region: 'asia-southeast1',
    cors: true,
}, async (request) => {
    throw new https_1.HttpsError('unimplemented', 'Coming in Phase 4');
});
//# sourceMappingURL=index.js.map