#Requires -Version 7.0
<#
.SYNOPSIS
  Deploy Mission HQ — git push (Cloudflare) + Firebase backend.

.DESCRIPTION
  1. Commits any staged/unstaged changes and pushes to GitHub.
     Cloudflare Workers picks up the push and rebuilds automatically.
  2. Deploys Firebase Realtime Database rules to the ash-2026-photobook project.

.PARAMETER Message
  Git commit message. Defaults to a timestamp-based message.

.PARAMETER SkipGit
  Skip the git commit + push step (Cloudflare deploy won't trigger).

.PARAMETER SkipFirebase
  Skip the Firebase deploy step.

.PARAMETER WhatIf
  Print what would happen without executing anything.

.EXAMPLE
  pwsh -File deploy.ps1 -Message "feat: add mission archive filter"
  pwsh -File deploy.ps1 -SkipFirebase
  pwsh -File deploy.ps1 -WhatIf
#>
param(
    [Parameter()][string]$Message = '',
    [Parameter()][switch]$SkipGit,
    [Parameter()][switch]$SkipFirebase,
    [Parameter()][switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RepoDir = $PSScriptRoot

function Write-OK   ($m) { Write-Host "[OK]   $m" -ForegroundColor Green  }
function Write-INFO ($m) { Write-Host "[INFO] $m" -ForegroundColor Cyan   }
function Write-WARN ($m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-ERR  ($m) { Write-Host "[ERR]  $m" -ForegroundColor Red    }

function Invoke-Step ([string]$Label, [scriptblock]$Action) {
    Write-INFO $Label
    if ($WhatIf) {
        Write-WARN "  [WhatIf] skipping execution"
        return
    }
    & $Action
}

# ── Git push → triggers Cloudflare Workers build ─────────────────────────────
if (-not $SkipGit) {
    Invoke-Step 'Checking git status...' {
        $status = git -C $RepoDir status --porcelain
        if ($status) {
            $commitMsg = if ($Message) { $Message } else { "deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
            Write-INFO "Changes detected — committing: $commitMsg"
            git -C $RepoDir add -A
            if ($LASTEXITCODE -ne 0) { throw "git add failed" }
            git -C $RepoDir commit -m $commitMsg
            if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
        } else {
            Write-INFO "Working tree clean — nothing to commit"
        }
    }

    Invoke-Step 'Pushing to GitHub (triggers Cloudflare build)...' {
        git -C $RepoDir push
        if ($LASTEXITCODE -ne 0) { throw "git push failed" }
        Write-OK "Pushed — Cloudflare will rebuild automatically"
    }
}

# ── Firebase backend ──────────────────────────────────────────────────────────
if (-not $SkipFirebase) {
    Invoke-Step 'Deploying Firebase Realtime Database rules...' {
        firebase deploy --only database --project ash-2026-photobook
        if ($LASTEXITCODE -ne 0) { throw "firebase deploy (database) failed" }
        Write-OK "RTDB rules deployed"
    }
}

Write-OK "All done."
