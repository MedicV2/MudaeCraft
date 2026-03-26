@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "$f='%~f0';$l=gc $f;$s=($l|sls '^#PS1$').LineNumber;iex(($l[$s..($l.Count-1)])-join[char]10)"
pause
exit /b %errorlevel%
#PS1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$CSS_URL = 'https://raw.githubusercontent.com/MedicV2/Medbot-Mudae/refs/heads/main/medbot.css'
$JS_URL  = 'https://raw.githubusercontent.com/MedicV2/Medbot-Mudae/refs/heads/main/medbot.user.js'
$CHANNEL = 'Discord'

function log([string]$m) { Write-Host "[MedBot] $m" }

function Get-Asar {
    $root = Join-Path $env:LOCALAPPDATA $CHANNEL
    if (-not (Test-Path $root)) { throw "Discord not found: $root" }
    $dir = Get-ChildItem $root -Directory -Filter 'app-*' |
        Sort-Object { try { [version]($_.Name -replace '^app-','') } catch { [version]'0.0.0' } } -Descending |
        Select-Object -First 1
    if (-not $dir) { throw "No app-* folder in $root" }
    $p = Join-Path $dir.FullName 'resources\app.asar'
    if (-not (Test-Path $p)) { throw 'app.asar not found' }
    [pscustomobject]@{ Path = $p; Backup = "$p.medbot.bak" }
}

function Stop-Discord {
    log 'Stopping Discord'
    Get-Process | Where-Object { $_.Name -match '^Discord' } |
        ForEach-Object { try { Stop-Process -Id $_.Id -Force } catch {} }
    Start-Sleep -Milliseconds 1200
}

function Invoke-Asar([string[]]$a) {
    $npx = Get-Command npx -ErrorAction SilentlyContinue
    if (-not $npx) { throw 'npx not found — install Node.js LTS first' }
    & $npx.Source --yes '@electron/asar' @a
    if ($LASTEXITCODE -ne 0) { throw "asar failed (exit $LASTEXITCODE)" }
}

function Get-RelPath([string]$From, [string]$To) {
    $base = [Uri]::new(([IO.Path]::GetDirectoryName($From).TrimEnd('\') + '\'))
    $rel  = [Uri]::UnescapeDataString($base.MakeRelativeUri([Uri]::new($To)).ToString()) -replace '\\','/'
    if (-not $rel.StartsWith('.')) { $rel = "./$rel" }
    if ($rel.EndsWith('.js'))      { $rel = $rel.Substring(0, $rel.Length - 3) }
    $rel
}

function Write-MedBotFiles([string]$Root) {
    $loader = @'
'use strict';
(() => {
  const { app, BrowserWindow, ipcMain, session } = require('electron');
  const { readFileSync, writeFileSync, mkdirSync, existsSync } = require('fs');
  const { join } = require('path');

  /* --- file-backed GM storage --- */
  const storageDir  = join(app.getPath('userData'), 'medbot');
  const storageFile = join(storageDir, 'medbot-storage.json');
  if (!existsSync(storageDir)) mkdirSync(storageDir, { recursive: true });
  let cache = {};
  try { if (existsSync(storageFile)) cache = JSON.parse(readFileSync(storageFile, 'utf8')) || {}; } catch {}

  const save = () => { try { writeFileSync(storageFile, JSON.stringify(cache), 'utf8'); } catch {} };
  ipcMain.on('medbot-gm-get', (e, k, d) => { e.returnValue = k in cache ? cache[k] : d; });
  ipcMain.on('medbot-gm-set', (e, k, v) => { cache[k] = v; save(); e.returnValue = 1; });

  /* --- preload (exposes IPC bridge to renderer) --- */
  const preloadPath = join(storageDir, 'medbot-preload.js');
  try { writeFileSync(preloadPath, `'use strict';
try {
  const { contextBridge, ipcRenderer } = require('electron');
  const api = {
    get: (k, d) => ipcRenderer.sendSync('medbot-gm-get', k, d),
    set: (k, v) => ipcRenderer.sendSync('medbot-gm-set', k, v),
  };
  if (contextBridge?.exposeInMainWorld) contextBridge.exposeInMainWorld('__medbotGM', api);
  else window.__medbotGM = api;
} catch (e) { console.error('[MedBot] preload', e); }
`, 'utf8'); } catch {}

  /* --- CSP stripping --- */
  const CSP_HDRS = new Set(['content-security-policy', 'content-security-policy-report-only']);
  function stripCSP(ses) {
    if (!ses || ses.__mb) return; ses.__mb = true;
    ses.webRequest.onHeadersReceived((d, cb) => {
      const h = {}; for (const [k, v] of Object.entries(d.responseHeaders || {})) if (!CSP_HDRS.has(k.toLowerCase())) h[k] = v;
      cb({ cancel: false, responseHeaders: h });
    });
  }

  /* --- renderer injection --- */
  let payload;
  const inject = () => { payload ??= (() => { try { return readFileSync(join(__dirname, 'medbot.desktop.renderer.js'), 'utf8'); } catch { return ''; } })(); return payload; };
  function hook(wc) {
    if (!wc || wc.__mbH) return; wc.__mbH = true;
    stripCSP(wc.session);
    const run = () => { const c = inject(); if (c) wc.executeJavaScript(c, true).catch(() => {}); };
    wc.on('dom-ready', run);
    wc.on('did-navigate-in-page', run);
  }

  /* --- session preload registration --- */
  function addPreload(ses) {
    if (!ses || ses.__mbP) return; ses.__mbP = true;
    try { const p = ses.getPreloads?.() || []; if (!p.includes(preloadPath)) ses.setPreloads([...p, preloadPath]); } catch {}
  }

  const setup = (w) => { addPreload(w.webContents.session); hook(w.webContents); };
  const init  = () => { try { addPreload(session.defaultSession); } catch {} };
  const hookAll = () => BrowserWindow.getAllWindows().forEach(setup);

  app.on('browser-window-created', (_, w) => setup(w));
  if (app.isReady()) { init(); hookAll(); }
  else { app.once('ready', init); app.whenReady().then(hookAll).catch(() => {}); }
})();
'@

    $renderer = @'
(() => {
  if (window.__medbotRunning) return; window.__medbotRunning = true;
  const CSS_URL = '__CSS_URL__', JS_URL = '__JS_URL__';
  const gm = window.__medbotGM, PFX = 'medbot.gm.';
  const gGet = gm ? (k, d) => gm.get(PFX+k, d)
    : (k, d) => { try { const v = localStorage.getItem(PFX+k); return v === null ? d : JSON.parse(v); } catch { return d; } };
  const gSet = gm ? (k, v) => gm.set(PFX+k, v)
    : (k, v) => { try { localStorage.setItem(PFX+k, JSON.stringify(v)); } catch {} };
  let cssCache = '';
  window.GM_getValue        = gGet;
  window.GM_setValue        = gSet;
  window.GM_getResourceText = (n) => n === 'medbot-css' ? cssCache : '';
  window.GM_xmlhttpRequest  = (d) => {
    if (!d?.url) { d?.onerror?.(new Error('no url')); return; }
    fetch(d.url, { method: d.method||'GET', headers: d.headers||{}, body: d.data, cache: 'no-store' })
      .then(async r => {
        const blob = (d.responseType||'').toLowerCase() === 'blob';
        const data = blob ? await r.blob() : await r.text();
        d.onload?.({ status: r.status, statusText: r.statusText, responseText: blob ? '' : data, response: data });
      }).catch(e => d.onerror?.(e));
  };
  const applyCss = (txt) => {
    if (!document.getElementById('medbot-fonts')) {
      const m = txt.match(/@import\s+url\(\s*['"]?([^'")]+)['"]?\s*\)/);
      if (m) { const l = document.createElement('link'); l.id = 'medbot-fonts'; l.rel = 'stylesheet'; l.href = m[1]; document.head.appendChild(l); }
    }
    let el = document.getElementById('medbot-css');
    if (!el) { el = document.createElement('style'); el.id = 'medbot-css'; document.head.appendChild(el); }
    el.textContent = txt;
  };
  const boot = async () => {
    try {
      const get = (u, t) => fetch(u, {cache:'no-store'}).then(r => { if (!r.ok) throw new Error(t+' '+r.status); return r.text(); });
      const [css, js] = await Promise.all([get(CSS_URL,'CSS'), get(JS_URL,'JS')]);
      cssCache = css; applyCss(css);
      if (!window.__medbotScriptDone) { window.__medbotScriptDone = true; new Function(js+'\n//# sourceURL=medbot.user.js')(); }
    } catch (e) { console.error('[MedBot] boot', e); }
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, {once:true}) : boot();
})();
'@
    $renderer = $renderer.Replace('__CSS_URL__', $CSS_URL).Replace('__JS_URL__', $JS_URL)
    Set-Content (Join-Path $Root 'medbot.desktop.loader.js')   $loader   -Encoding UTF8
    Set-Content (Join-Path $Root 'medbot.desktop.renderer.js') $renderer -Encoding UTF8
    log 'Wrote loader + renderer'
}

function Patch-Entry([string]$Root) {
    $pkg      = Get-Content (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json
    $mainRel  = if ($pkg.main) { [string]$pkg.main } else { 'index.js' }
    $mainPath = Join-Path $Root $mainRel
    if (-not (Test-Path $mainPath)) { throw "Entry not found: $mainRel" }
    $req    = Get-RelPath $mainPath (Join-Path $Root 'medbot.desktop.loader.js')
    $marker = '__MEDBOT_DESKTOP_LOADER__'
    $hook   = "/* $marker */`ntry { require('$req'); } catch (e) { console.error('[MedBot]', e); }`n"
    $src    = Get-Content $mainPath -Raw
    if ($src -match [regex]::Escape($marker)) {
        $src = $src -replace "(?m)^/\* $marker \*/\r?\n.*\r?\n", ''
    }
    Set-Content $mainPath ($hook + $src) -Encoding UTF8
    log "Patched $mainRel"
}

# --- main ---
Write-Host ''
Write-Host '[MedBot]  1 = Inject'
Write-Host '[MedBot]  2 = Restore'
$choice = Read-Host '[MedBot]  Choice'

try {
    $d = Get-Asar
    Stop-Discord

    if ($choice -eq '2') {
        if (-not (Test-Path $d.Backup)) { throw "No backup found: $($d.Backup)" }
        Copy-Item $d.Backup $d.Path -Force
        log 'Restored. Start Discord!'
    } else {
        $tmp    = Join-Path $env:TEMP 'medbot-inject'
        $unpack = Join-Path $tmp 'unpacked'
        $packed = Join-Path $tmp 'app.patched.asar'
        if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
        New-Item $unpack -ItemType Directory -Force | Out-Null

        log 'Extracting app.asar'
        Invoke-Asar @('extract', $d.Path, $unpack)
        Write-MedBotFiles $unpack
        Patch-Entry $unpack
        log 'Repacking app.asar'
        Invoke-Asar @('pack', $unpack, $packed)

        if (-not (Test-Path $d.Backup)) {
            Copy-Item $d.Path $d.Backup -Force
            log 'Backup saved'
        }
        Copy-Item $packed $d.Path -Force
        Remove-Item $tmp -Recurse -Force
        log 'Done. Starting Discord...'
        Start-Process (Join-Path $env:LOCALAPPDATA "$CHANNEL\Update.exe") -ArgumentList '--processStart','Discord.exe'
    }
} catch {
    Write-Host "[MedBot] FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

