# Local Gemini Companion — Runbook

## Quick start

```powershell
cd "D:\ARH-GITHUB\mission-hq"
$env:GOOGLE_APPLICATION_CREDENTIALS="D:\00_ARH\.ARH-AGENT-ENV\_env-mgmt\env\state\keys_vault\_sa-files\ash-2026-photobook-firebase-sa.json"
npm run companion:gemini
```

Or double-click `scripts/windows/start-local-gemini-companion.ahk`.

## Diagnostics

### Is the companion running?

Check the status panel in Mission HQ:

```text
Toolbelt → Admin → Settings → Local Gemini Companion
```

Expected state: `idle` or `running` with a fresh heartbeat (< 45s).

### Test the pipeline end-to-end

```powershell
npm run companion:test-job
```

This queues a small diagnostic job and waits for the companion to complete it.

### Check companion heartbeat from Firebase

```powershell
# Requires firebase-tools
firebase database:get /mission_hq/aiCompanions/desktop-ARH-G4
```

### Check recent jobs

```powershell
firebase database:get /mission_hq/aiJobs
```

## Common issues

### `app/invalid-credential`

**Cause**: Service account JSON is missing `project_id` or is malformed.  
**Fix**: Verify the SA file path and ensure it contains `project_id`, `client_email`, and `private_key`.

### `gemini` command not found

**Cause**: Gemini CLI is not installed or not on PATH.  
**Fix**:

```powershell
npm install -g @google/gemini-cli
```

### Companion starts but never picks up jobs

**Checklist**:
1. Is the companion in admin mode? (look for `Running in ADMIN mode` in logs)
2. Is the web app creating jobs under `mission_hq/aiJobs/{uid}`?
3. Are Firebase rules deployed? `firebase deploy --only database`
4. Is the job `status` actually `pending`?

### Job status is `error`

1. Read `error` field on the job node.
2. Read `result.stderr` for Gemini CLI stderr.
3. Read `result.rawOutput` for full stdout.
4. If Gemini CLI returned non-JSON, check the prompt template for malformed placeholders.

### Status panel shows `stale`

1. Companion process may have crashed or lost network.
2. Check the PowerShell window for errors.
3. Restart the companion.

## Restart procedure

1. Close the companion PowerShell window (or press Ctrl+C).
2. Wait 5 seconds for `onDisconnect` to mark the companion `offline` in Firebase.
3. Re-run `npm run companion:gemini` (or double-click the AHK launcher).

## Emulator testing

```powershell
$env:FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"
$env:FIREBASE_DATABASE_EMULATOR_HOST="localhost:9000"
npm run companion:gemini
```

## Rollback to client mode

If admin mode fails and you need immediate recovery:

```powershell
Remove-Item Env:\GOOGLE_APPLICATION_CREDENTIALS
npm run companion:gemini
```

The companion will fall back to anonymous auth (subject to Firebase Rules).
