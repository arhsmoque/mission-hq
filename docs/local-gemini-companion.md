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

In the app, open:

```text
Toolbelt → Admin → Chat → Local CLI
```

When you send a message, the webapp creates a Firebase job under:

```text
mission_hq/aiJobs/{uid}/{jobId}
```

The desktop companion claims pending jobs, runs Gemini CLI, and writes the result back to the same job.

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
