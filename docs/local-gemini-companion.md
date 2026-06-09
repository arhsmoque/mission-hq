# Local Gemini CLI Companion

Mission HQ can run a personal desktop companion that watches Firebase jobs and delegates them to Gemini CLI on your own PC.

## Data flow

```text
Phone / browser Mission HQ
→ Firebase aiJobs queue
→ home desktop companion
→ Gemini CLI signed in with Google
→ Firebase result
→ Mission HQ updates
```

This mode is separate from the Cloudflare Worker Gemini API path. It is intended for your own machine and your own signed-in Gemini CLI session.

## Install Gemini CLI

```bash
npm install -g @google/gemini-cli
gemini
```

Choose Google sign-in during the first `gemini` run.

## Start the companion

From this repo:

```bash
npm install
npm run companion:gemini
```

Windows users can also double-click:

```text
scripts/windows/start-local-gemini-companion.ahk
```

The AHKv2 launcher opens PowerShell in the repo root, runs `npm run companion:gemini`, and leaves logs visible.

## Use from Mission HQ

In the app, open:

```text
Toolbelt → Admin → Chat → Local CLI
```

When you send a message, the webapp creates a Firebase job under:

```text
mission_hq/aiJobs/{uid}/{jobId}
```

The desktop companion claims pending jobs, runs Gemini CLI, and writes the result back to the same job.

## Operator status

The companion writes heartbeat records under:

```text
mission_hq/aiCompanions/{companionId}
```

View status in:

```text
Toolbelt → Admin → Settings → Local Gemini Companion
```

The panel shows whether the desktop companion is `starting`, `idle`, `running`, `stale`, `offline`, or `error`, plus heartbeat age, active job, completed count, failed count, and process id.

## Prompt templates

Templates live in:

```text
scripts/gemini-prompts
```

Current templates:

```text
general.md
admin_chat.md
```

More job kinds can be added later, for example:

```text
mission_generate.md
ocr_cleanup.md
answer_check.md
hint_generate.md
quiz_generate.md
parent_summary.md
```

## Emulator testing

For Firebase emulator testing:

```bash
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 FIREBASE_DATABASE_EMULATOR_HOST=localhost:9000 npm run companion:gemini
```

PowerShell:

```powershell
$env:FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"
$env:FIREBASE_DATABASE_EMULATOR_HOST="localhost:9000"
npm run companion:gemini
```

## Tailscale role

Tailscale is optional for the Firebase queue mode. Use it for remote desktop/admin access, logs, or a future local status dashboard. The phone does not need to call the desktop directly when Firebase is the queue.

## Safety notes

The Firebase job contains structured input only. The companion never executes commands from Firebase. It always runs a fixed command shape:

```text
gemini -p <prompt> --output-format json
```

Keep the companion running only on machines you control.

## Security modes

The companion supports two authentication modes.

### Client mode (default)

The companion signs into Firebase anonymously, just like the web app. It is subject to Firebase Security Rules. This is convenient for local development but means the companion cannot access jobs across users if rules are tightened per-UID.

### Admin mode (hardened)

Set `GOOGLE_APPLICATION_CREDENTIALS` to a Firebase service account key JSON file:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\secrets\mission-hq-service-account.json"
npm run companion:gemini
```

Admin mode bypasses Firebase Security Rules entirely, so the companion can read/write all jobs while the web app remains restricted to `auth.uid == $uid`.

To generate a service account key:

1. Firebase Console → Project Settings → Service Accounts
2. Click **Generate new private key**
3. Save the JSON file securely
4. Set `GOOGLE_APPLICATION_CREDENTIALS` to its absolute path

Never commit service account keys to Git.

## Current security posture

- `aiJobs` rules restrict users to their own `$uid` subtree.
- `aiCompanions` rules allow any authenticated user to read and any authenticated user to write.
- The companion in **client mode** uses anonymous auth and is bound by these rules.
- The companion in **admin mode** uses a service account and bypasses rules.
- Recommended production setup: run the companion in **admin mode** on a trusted desktop.
