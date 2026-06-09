#Requires AutoHotkey v2.0
#SingleInstance Force

; Mission HQ Local Gemini Companion launcher.
; Double-click this file from the repo root, or create a shortcut to it.
; It opens a PowerShell window, runs npm run companion:gemini, and keeps logs visible.

repoRoot := RegExReplace(A_ScriptDir, "\\scripts\\windows$", "")
companionTitle := "Mission HQ Local Gemini Companion"

psCommand := "Set-Location -LiteralPath '" . repoRoot . "'; "
  . "Write-Host 'Starting Mission HQ Local Gemini Companion...' -ForegroundColor Cyan; "
  . "Write-Host 'Repo: " . repoRoot . "'; "
  . "npm run companion:gemini; "
  . "Write-Host ''; "
  . "Write-Host 'Companion stopped. Press Enter to close.' -ForegroundColor Yellow; "
  . "Read-Host"

Run('powershell.exe -NoExit -ExecutionPolicy Bypass -Command "' . psCommand . '"', repoRoot)

TraySetIcon("shell32.dll", 220)
A_TrayMenu.Delete()
A_TrayMenu.Add("Open Mission HQ repo", (*) => Run('explorer.exe "' . repoRoot . '"'))
A_TrayMenu.Add("Start Companion", (*) => Run('powershell.exe -NoExit -ExecutionPolicy Bypass -Command "' . psCommand . '"', repoRoot))
A_TrayMenu.Add()
A_TrayMenu.Add("Exit Launcher", (*) => ExitApp())

MsgBox(companionTitle . " launcher started.`n`nA PowerShell window should now be running the companion.", companionTitle, "Iconi")
