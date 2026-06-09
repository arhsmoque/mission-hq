# Local Gemini Companion — Design Brief

## Surface

Desktop-side job worker that bridges Mission HQ (web app) to the official Google Gemini CLI running on a trusted local machine.

## Purpose

Allow parents to run Gemini-powered AI tasks (chat, worksheet explanation, hint generation) through their own Google-signed-in Gemini CLI session rather than routing all AI traffic through Cloudflare Workers. This reduces API key exposure, leverages existing Gemini CLI OAuth, and keeps sensitive child data within the family infrastructure.

## Risk Class

**Privileged / Local Bridge**

- The companion holds no long-lived secrets beyond the Firebase service account (admin mode) or anonymous auth token (client mode).
- It does not execute commands from Firebase; it only runs a fixed command shape (`gemini -p <prompt> --output-format json`).
- The web app never calls the desktop directly; all coordination goes through Firebase RTDB.
- Threat model: compromised Firebase account → attacker can queue jobs but cannot execute arbitrary code on the desktop.

## Operating Instructions

### Start (admin mode — hardened)

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="D:\00_ARH\.ARH-AGENT-ENV\_env-mgmt\env\state\keys_vault\_sa-files\ash-2026-photobook-firebase-sa.json"
npm run companion:gemini
```

### Start (client mode — development)

```powershell
npm run companion:gemini
```

### Windows shortcut

Double-click `scripts/windows/start-local-gemini-companion.ahk`.

## Failure Modes

| Mode | Symptom | Cause | Recovery |
|---|---|---|---|
| Start-up crash | `app/invalid-credential` | Missing or malformed `GOOGLE_APPLICATION_CREDENTIALS` | Verify SA JSON has `project_id`, `client_email`, `private_key` |
| Start-up crash | `gemini` not found | Gemini CLI not installed or not on PATH | `npm install -g @google/gemini-cli` |
| Silent stall | No jobs processed | Companion signed in but not watching | Check `mission_hq/aiCompanions/{id}` heartbeat is fresh |
| Job error | `status: error` in Firebase | Gemini CLI returned non-zero or invalid JSON | Inspect `result.stderr` and `result.rawOutput` on the job node |
| Stale companion | Status panel shows `stale` | Heartbeat > 45s old | Restart companion; check network to Firebase |
| Spoofed companion | Unknown companionId in status panel | Another authenticated client wrote to `aiCompanions` | Switch companion to admin mode; tighten `aiCompanions` rules later |

## Audit / Review Method

1. Inspect `mission_hq/aiCompanions/{companionId}` for heartbeat freshness.
2. Inspect `mission_hq/aiJobs/{uid}/{jobId}` for status timeline (`pending` → `running` → `done`/`error`).
3. Check `result.rawOutput` and `result.stderr` for evidence of Gemini CLI behavior.
4. Review `completedJobs` and `failedJobs` counters in companion status.

## Evidence / Replay / Recovery

- Every job carries `createdAt`, `startedAt`, `completedAt`, `updatedAt` timestamps.
- Every completed job stores `result.rawOutput` (full Gemini CLI stdout) and `result.stderr`.
- Jobs are never deleted by the companion; they remain in Firebase for inspection.
- Replay: create a new job with the same `input.messages` and `input.kind`.
- Recovery: if a job fails, the user can read `error` and `rawOutput` to decide whether to retry or adjust the prompt template.

## Status

- **Architecture**: stable
- **Security**: hardened (admin mode available); `aiJobs` rules scoped per-UID
- **Operator visibility**: status panel live in Toolbelt → Admin → Settings
- **CI**: build + conflict-marker check in `.github/workflows/ci.yml`
