@echo off
rem Launches Northreach in a browser window that ALLOWS sound autoplay
rem (owner request, session 56: no click needed after F5).
rem Uses a dedicated browser profile so the flag reliably applies.

set URL=http://localhost:5180
set PROFILE=%LOCALAPPDATA%\NorthreachBrowser

set CHROME="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist %CHROME% (
  start "" %CHROME% --autoplay-policy=no-user-gesture-required --user-data-dir="%PROFILE%" --new-window %URL%
  exit /b
)

set EDGE="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist %EDGE% set EDGE="%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist %EDGE% (
  start "" %EDGE% --autoplay-policy=no-user-gesture-required --user-data-dir="%PROFILE%" --new-window %URL%
  exit /b
)

echo Neither Chrome nor Edge found - open %URL% manually.
pause
