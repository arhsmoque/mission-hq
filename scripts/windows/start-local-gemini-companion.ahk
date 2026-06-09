#Requires AutoHotkey v2.0
#SingleInstance Force

; Mission HQ Local Gemini Companion launcher.
; Double-click this file from the repo root, or create a shortcut to it.
; It opens PowerShell 7, runs npm run companion:gemini, and keeps logs visible.

repoRoot := RegExReplace(A_ScriptDir, "\\scripts\\windows$", "")
companionTitle := "Mission HQ Local Gemini Companion"

; Try pwsh (PowerShell 7) first. If not available on this machine, fall back to Windows PowerShell.
pwshPath := "pwsh.exe"
if (!FileExist(pwshPath)) {
  ; FileExist does not search PATH, so try a quick shell lookup.
  try {
    shell := ComObject("WScript.Shell")
    shell.Exec("pwsh.exe -Command exit 0")
  } catch {
    pwshPath := "powershell.exe"
  }
}

; Build the command using a here-string so single quotes inside repoRoot cannot break quoting.
; Pass the repo path and command as separate arguments to avoid shell escaping issues.
psBlock := "`n"
  . "Set-Location -LiteralPath `""" . repoRoot . "`""`n"
  . "Write-Host 'Starting Mission HQ Local Gemini Companion...' -ForegroundColor Cyan`n"
  . "Write-Host `"Repo: " . repoRoot . "`"`n"
  . "npm run companion:gemini`n"
  . "Write-Host ''`n"
  . "Write-Host 'Companion stopped. Press Enter to close.' -ForegroundColor Yellow`n"
  . "Read-Host`n"

Run('"' . pwshPath . '" -NoExit -ExecutionPolicy Bypass -Command "' . psBlock . '"', repoRoot)

TraySetIcon("shell32.dll", 220)
A_TrayMenu.Delete()
A_TrayMenu.Add("Open Mission HQ repo", (*) => Run('explorer.exe "' . repoRoot . '"'))
A_TrayMenu.Add("Start Companion", (*) => Run('"' . pwshPath . '" -NoExit -ExecutionPolicy Bypass -Command "' . psBlock . '"', repoRoot))
A_TrayMenu.Add()
A_TrayMenu.Add("Exit Launcher", (*) => ExitApp())

MsgBox(companionTitle . " launcher started.`n`nA PowerShell window should now be running the companion.", companionTitle, "Iconi")
