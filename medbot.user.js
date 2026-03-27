// ==UserScript==
// @name         MedBot
// @author       @medc
// @version      3.0
// @description  Currently WIP, tool that automates the discord bot Mudae.
// @match        *://discord.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @updateURL    https://raw.githubusercontent.com/MedicV2/Medbot-Mudae/refs/heads/main/medbot.user.js
// @downloadURL  https://raw.githubusercontent.com/MedicV2/Medbot-Mudae/refs/heads/main/medbot.user.js
// @resource     medbot-css https://raw.githubusercontent.com/MedicV2/Medbot-Mudae/refs/heads/main/medbot.css
// @connect      media2.giphy.com
// @connect      cdn.discordapp.com
// ==/UserScript==

(function () {
  'use strict';

  const MEDBOT_GIF_URL = 'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExZWc4aWpiM3E0NWt0ZGFjbG04aWhvbTE1YzJuMjhucXN3ODhzeXM5dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/bXufANMxyrNihW1iTv/giphy.gif';
  let medbotGifObjectUrl = null;

  const REPLY_DELAY_MIN_MS = 1500;
  const REPLY_DELAY_MAX_MS = 2000;
  const INFINITE_STALL_MS  = 10000;
  const MSG_CACHE_TTL_MS   = 5 * 60 * 1000;

  const KAKERA_SCAN_DELAYS = [0, 150, 400, 900, 1800];
  const CLAIM_SCAN_DELAYS  = [0, 300, 800, 1800];

  const KAKERA_ICONS = [
    { key: 'purple',  label: 'Purple',  url: 'https://cdn.discordapp.com/emojis/609264156347990016.webp?size=44' },
    { key: 'blue',    label: 'Blue',    url: 'https://cdn.discordapp.com/emojis/469835869059153940.webp?size=44' },
    { key: 'teal',    label: 'Teal',    url: 'https://cdn.discordapp.com/emojis/609264180851376132.webp?size=44' },
    { key: 'green',   label: 'Green',   url: 'https://cdn.discordapp.com/emojis/609264166381027329.webp?size=44' },
    { key: 'yellow',  label: 'Yellow',  url: 'https://cdn.discordapp.com/emojis/605112931168026629.webp?size=44' },
    { key: 'orange',  label: 'Orange',  url: 'https://cdn.discordapp.com/emojis/605112954391887888.webp?size=44' },
    { key: 'red',     label: 'Red',     url: 'https://cdn.discordapp.com/emojis/605112980295647242.webp?size=44' },
    { key: 'rainbow', label: 'Rainbow', url: 'https://cdn.discordapp.com/emojis/608192076286263297.webp?size=44' },
    { key: 'light',   label: 'Light',   url: 'https://cdn.discordapp.com/emojis/815961697918779422.webp?size=44' },
    { key: 'dark',    label: 'Dark',    url: 'https://cdn.discordapp.com/emojis/1436810949548839003.webp?size=44' },
    { key: 'chaos',   label: 'Chaos',   url: 'https://cdn.discordapp.com/emojis/1441097472587075758.webp?size=44' },
  ];

  const KAKERA_URL_MAP = new Map(KAKERA_ICONS.map(k => [normalizeUrl(k.url), k.key]));
  const KAKERA_BY_KEY  = Object.fromEntries(KAKERA_ICONS.map(k => [k.key, k]));

  // Persistent state

  let autoKakeraEnabled  = false;
  let selectedKakeraKeys = new Set();
  let autoClaimWishes    = false;
  let autoClaimMinKakera = 0;
  let autoClaimMaxKakera = 0;
  let autoClaimSeries    = '';
  let selectedRollCommand = '$wa';

  function loadSettings() {
    try {
      autoKakeraEnabled  = !!GM_getValue('medbot.autoKakeraEnabled', false);
      const saved        = GM_getValue('medbot.selectedKakeraKeys', []);
      selectedKakeraKeys = new Set(Array.isArray(saved) ? saved : []);
      autoClaimWishes    = !!GM_getValue('medbot.autoClaimWishes', false);
      autoClaimMinKakera = Number(GM_getValue('medbot.autoClaimMinKakera', 0)) || 0;
      autoClaimMaxKakera = Number(GM_getValue('medbot.autoClaimMaxKakera', 0)) || 0;
      autoClaimSeries    = GM_getValue('medbot.autoClaimSeries', '') || '';
      selectedRollCommand = GM_getValue('medbot.selectedRollCommand', '$wa') || '$wa';
      channelLockEnabled = !!GM_getValue('medbot.channelLockEnabled', false);
      lockedChannelId    = GM_getValue('medbot.lockedChannelId',   null) || null;
      lockedServerId     = GM_getValue('medbot.lockedServerId',    null) || null;
      lockedChannelName  = GM_getValue('medbot.lockedChannelName', '')   || '';
      lockedServerName   = GM_getValue('medbot.lockedServerName',  '')   || '';
    } catch {
      autoKakeraEnabled = false;
      selectedKakeraKeys = new Set();
      autoClaimWishes = false;
      autoClaimMinKakera = autoClaimMaxKakera = 0;
      autoClaimSeries = '';
      selectedRollCommand = '$wa';
      channelLockEnabled = false;
      lockedChannelId = lockedServerId = null;
      lockedChannelName = lockedServerName = '';
    }
  }

  function saveSettings() {
    try {
      GM_setValue('medbot.autoKakeraEnabled', autoKakeraEnabled);
      GM_setValue('medbot.selectedKakeraKeys', [...selectedKakeraKeys]);
      GM_setValue('medbot.autoClaimWishes',    autoClaimWishes);
      GM_setValue('medbot.autoClaimMinKakera', autoClaimMinKakera);
      GM_setValue('medbot.autoClaimMaxKakera', autoClaimMaxKakera);
      GM_setValue('medbot.autoClaimSeries',    autoClaimSeries);
      GM_setValue('medbot.selectedRollCommand', selectedRollCommand);
      GM_setValue('medbot.channelLockEnabled', channelLockEnabled);
      GM_setValue('medbot.lockedChannelId',    lockedChannelId);
      GM_setValue('medbot.lockedServerId',     lockedServerId);
      GM_setValue('medbot.lockedChannelName',  lockedChannelName);
      GM_setValue('medbot.lockedServerName',   lockedServerName);
    } catch {}
  }

  function loadTuData() {
    try {
      if (!currentServerId) {
        tuData.claimAvailable = null; tuData.claimResetAt = 0;
        tuData.rollsLeft = null; tuData.rollsMax = null; tuData.rollsResetAt = 0;
        tuData.rtAvailable = null; tuData.rtResetAt = 0; tuData.lastUpdated = 0;
        return;
      }
      const servers = JSON.parse(GM_getValue('medbot.tuServers', 'null')) || {};
      const entry = servers[currentServerId] || {};
      tuData.claimAvailable = entry.claimAvailable ?? null;
      tuData.claimResetAt   = Number(entry.claimResetAt) || 0;
      tuData.rollsLeft      = entry.rollsLeft ?? null;
      tuData.rollsMax       = entry.rollsMax ?? null;
      tuData.rollsResetAt   = Number(entry.rollsResetAt) || 0;
      tuData.rtAvailable    = entry.rtAvailable ?? null;
      tuData.rtResetAt      = Number(entry.rtResetAt) || 0;
      tuData.lastUpdated    = Number(entry.lastUpdated) || 0;
    } catch {}
  }

  function saveTuData() {
    try {
      if (!currentServerId) return;
      const servers = JSON.parse(GM_getValue('medbot.tuServers', 'null')) || {};
      servers[currentServerId] = {
        claimAvailable: tuData.claimAvailable,
        claimResetAt:   tuData.claimResetAt,
        rollsLeft:      tuData.rollsLeft,
        rollsMax:       tuData.rollsMax,
        rollsResetAt:   tuData.rollsResetAt,
        rtAvailable:    tuData.rtAvailable,
        rtResetAt:      tuData.rtResetAt,
        lastUpdated:    tuData.lastUpdated,
      };
      GM_setValue('medbot.tuServers', JSON.stringify(servers));
    } catch {}
  }

  // Run state

  let isRunning            = false;
  let infiniteMode         = false;
  let remainingRuns        = 0;
  let waitingForMudae      = false;
  let nextSendTimer        = null;
  let stallGuardTimer      = null;
  let recoveryInProgress   = false;
  let pendingBotRolls      = 0;
  let activeGame           = null;
  const mult               = { oh: 1, oc: 1, oq: 1, ot: 1 };
  let awaitingTuResponse   = false;
  let channelLockEnabled   = false;
  let lockedChannelId      = null;
  let lockedServerId       = null;
  let lockedChannelName    = '';
  let currentServerId      = null;
  let lockedServerName     = '';
  let channelPaused        = false;
  let tuData = { claimAvailable: null, claimResetAt: 0, rollsLeft: null, rollsMax: null, rollsResetAt: 0, rtAvailable: null, rtResetAt: 0, lastUpdated: 0 };

  // Roll command constants

  const ROLL_COMMANDS = new Set([
    '$husbando','$h','$hx','$husbandoa','$ha','$husbandog','$hg',
    '$waifu','$w','$wx','$waifua','$wa','$waifug','$wg',
    '$marry','$m','$mx','$marrya','$ma','$marryg','$mg',
  ]);

  const ROLL_DROPDOWN_OPTIONS = ['$w','$wa','$wg','$h','$ha','$hg','$m','$ma','$mg'];

  // Message dedupe cache (make sure each message is tracked once by saving msg id in cache)

  const processedMsgIds = new Map();

  let _lastCacheCleanup = 0;
  function isMessageProcessed(msgId, type = null) {
    const now = Date.now();
    // Clean expired entries (at most once per 30s)
    if (now - _lastCacheCleanup > 30000) {
      _lastCacheCleanup = now;
      for (const [id, entry] of processedMsgIds) {
        if (entry.expiry <= now) processedMsgIds.delete(id);
      }
    }
    if (!processedMsgIds.has(msgId)) {
      const types = type ? new Set([type]) : new Set();
      processedMsgIds.set(msgId, { expiry: now + MSG_CACHE_TTL_MS, types });
      return false; // not processed before
    }
    const entry = processedMsgIds.get(msgId);
    if (type) {
      if (entry.types.has(type)) return true;
      entry.types.add(type);
      entry.expiry = now + MSG_CACHE_TTL_MS;
      return false;
    }
    return true;
  }



  // Observer state

  let msgObserver      = null;
  let bootObserver     = null;
  let attachedList     = null;
  let livenessInterval = null;

  // Utilities

  function normalizeUrl(url) {
    try { const u = new URL(url, location.origin); return `${u.origin}${u.pathname}`; }
    catch { return (url || '').split('?')[0]; }
  }

  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // DOM helpers

  const getChatInput    = () => document.querySelector('[data-slate-editor="true"],[role="textbox"][contenteditable="true"]');
  const getMessageList  = () => document.querySelector('ol[data-list-id="chat-messages"],[role="list"][data-list-id="chat-messages"],ol[aria-label^="Messages in "]');
  const _mudaeCache = new WeakMap();
  const isMudaeMessage  = el  => {
    if (_mudaeCache.has(el)) return _mudaeCache.get(el);
    const r = [...el.querySelectorAll('[id^="message-username-"],[class*="username"]')].some(n => n.textContent.trim().startsWith('Mudae'));
    _mudaeCache.set(el, r);
    return r;
  };
  const getMessageText  = el  => (el.querySelector('[id^="message-content-"],[class*="messageContent"]')?.innerText || '').trim();
  const getMessageTimestamp = el => { const t = el.querySelector('time[datetime]'); return t ? new Date(t.getAttribute('datetime')).getTime() : null; };
  const getAttachmentMenu = () => [...document.querySelectorAll('[role="menu"]')].find(m => /channel actions|attachment/i.test(m.getAttribute('aria-label') || '')) || null;

  function getPlaceholder() {
    const editor = getChatInput();
    const parent = editor?.closest('[class*="channelTextArea"],[class*="textArea"],[class*="editor"]') || editor?.parentElement;
    return parent?.querySelector('[aria-hidden="true"]')
      || document.querySelector('[aria-hidden="true"][data-slate-placeholder="true"],[aria-hidden="true"][class*="placeholder"]');
  }

  // your Discord handle, used to match rollcap messages etc
  function getOwnHandle() {
    return document.querySelector('[class*="panelSubtextContainer"] [class*="hovered"]')?.textContent?.trim() || 'Unknown';
  }

  // your Discord username, used for tracking your own messages and wish pings
  function getOwnUsername() {
    const el = document.querySelector('[data-username-with-effects]');
    return el?.getAttribute('data-username-with-effects') || el?.textContent?.trim() || 'Unknown';
  }

  function getMsgId(msgEl) {
    const el = msgEl?.querySelector('[id^="message-content-"]');
    if (!el) return null;
    const match = el.id.match(/message-content-(\d+)/);
    return match ? match[1] : null;
  }

  const getSphereId  = btn   => btn.querySelector('img.emoji')?.dataset?.id || null;
  const getOhButtons = msgEl => [...(msgEl.querySelector('[id^="message-accessories-"]')?.querySelectorAll('button') || [])];

  function isOnLockedChannel() {
    if (!channelLockEnabled || !lockedChannelId) return true;
    const info = getCurrentChannelInfo();
    return !!(info && info.channelId === lockedChannelId && info.serverId === lockedServerId);
  }

  function getCurrentChannelInfo() {
    const selectedLink = document.querySelector('li[class*="selected_"] a[aria-current="page"]')
      || document.querySelector('li[class*="selected_"] a[data-list-item-id^="channels___"]');
    if (!selectedLink) return null;
    const channelName = selectedLink.querySelector('[class*="name__"]')?.textContent.trim()
      || (selectedLink.getAttribute('aria-label') || '').replace(/\s*\(.*?\)\s*$/, '').replace(/^(?:[^,]+,\s+)+/, '').trim() || '';
    const href  = selectedLink.getAttribute('href') || '';
    const match = href.match(/\/channels\/(\d+)\/(\d+)/);
    if (!match) return { channelName, channelId: null, serverName: null, serverId: null };
    const serverId   = match[1];
    const channelId  = match[2];
    const guildItem  = document.querySelector(`[data-list-item-id="guildsnav___${serverId}"]`);
    const serverName = guildItem?.closest('[class*="listItem"]')?.querySelector('[class*="guildNameText"]')?.textContent.trim()
      || guildItem?.querySelector('[class*="hiddenVisually"]')?.textContent.trim().replace(/^[\d\w\s]+,\s+/, '') || null;
    return { channelName, channelId, serverName, serverId };
  }

  // Send

  function sendRawCommand(cmd) {
    const input = getChatInput();
    if (!input) return false;
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'a', code: 'KeyA', keyCode: 65, ctrlKey: true }));
    let pasted = false;
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', cmd);
      pasted = input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
    } catch { /* ignore */ }
    if (!pasted) {
      try { document.execCommand('selectAll', false); } catch { /* ignore */ }
      try { document.execCommand('insertText', false, cmd); } catch { /* ignore */ }
    }
    setTimeout(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
      setTimeout(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'a', code: 'KeyA', keyCode: 65, ctrlKey: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Delete', code: 'Delete', keyCode: 46 }));
      }, 100);
    }, 60);
    return true;
  }

  // Send loop

  function clearTimers() {
    clearTimeout(nextSendTimer);   nextSendTimer   = null;
    clearTimeout(stallGuardTimer); stallGuardTimer = null;
  }

  function scheduleNextSend() {
    if (!isRunning || recoveryInProgress) return;
    clearTimers();
    nextSendTimer = setTimeout(() => { nextSendTimer = null; doNextSend(); }, rand(REPLY_DELAY_MIN_MS, REPLY_DELAY_MAX_MS));
  }

  function doNextSend() {
    if (!isRunning || recoveryInProgress) return;
    if (!tuData.lastUpdated) { stopMedBot(); console.warn('[MedBot] Stopped — run Configure ($tu) for this server first'); return; }
    if (!isOnLockedChannel()) {
      channelPaused = true;
      nextSendTimer = setTimeout(doNextSend, 1500);
      updateVisuals();
      return;
    }
    channelPaused = false;
    if (!infiniteMode && remainingRuns <= 0) { stopMedBot(); return; }
    if (!sendRawCommand(selectedRollCommand)) return;
    pendingBotRolls++;
    if (tuData.rollsLeft !== null) { tuData.rollsLeft = Math.max(0, tuData.rollsLeft - 1); saveTuData(); }
    if (!infiniteMode) {
      remainingRuns--;
      if (remainingRuns <= 0) { nextSendTimer = setTimeout(stopMedBot, 5000); updateVisuals(); return; }
    }
    waitingForMudae = true;
    updateVisuals();
    if (infiniteMode) {
      stallGuardTimer = setTimeout(() => {
        if (!isRunning || !waitingForMudae) return;
        console.log('[MedBot] No Mudae reply for 10s — continuing');
        waitingForMudae = false;
        scheduleNextSend();
      }, INFINITE_STALL_MS);
    }
  }

  function onMudaeResponseReceived() {
    if (!isRunning || recoveryInProgress || !waitingForMudae) return;
    waitingForMudae = false;
    clearTimers();
    scheduleNextSend();
  }

  function stopMedBot() {
    clearTimers();
    isRunning = false; infiniteMode = false; waitingForMudae = false; remainingRuns = 0;
    recoveryInProgress = false; pendingBotRolls = 0; channelPaused = false;
    updateVisuals();
    console.log('[MedBot] Stopped');
  }

  function startMedBot(count, infinite) {
    stopMedBot();
    infiniteMode  = !!infinite;
    remainingRuns = count;
    isRunning     = true;
    console.log('[MedBot] Starting', { infiniteMode, remainingRuns });
    doNextSend();
  }

  // Visuals

  function updateVisuals(placeholder) {
    const input = getChatInput();
    if (!input) return;
    if (!placeholder) placeholder = getPlaceholder();
    if (isRunning || activeGame) {
      input.style.background   = 'linear-gradient(135deg, rgba(88,101,242,0.10), rgba(88,101,242,0.04))';
      input.style.borderRadius = '8px';
      input.style.transition   = 'all 0.25s ease';
      if (placeholder) {
        placeholder.style.color      = 'var(--text-muted)';
        placeholder.style.fontSize   = '0.92rem';
        placeholder.style.fontWeight = '500';
        const label = infiniteMode ? 'Infinite' : `${remainingRuns} left`;
        if (activeGame)              placeholder.textContent = `MedBot • $${activeGame} in progress...`;
        else if (recoveryInProgress) placeholder.textContent = 'MedBot • Rollcap recovery...';
        else if (channelPaused)      placeholder.textContent = `MedBot • ${label} • paused (wrong channel)`;
        else if (waitingForMudae)    placeholder.textContent = `MedBot • ${label} • waiting for Mudae...`;
        else if (nextSendTimer)      placeholder.textContent = `MedBot • ${label} • sending soon...`;
        else                         placeholder.textContent = `MedBot • ${label}`;
      }
    } else {
      input.style.background = input.style.borderRadius = input.style.transition = '';
      if (placeholder) {
        placeholder.style.color = placeholder.style.fontSize = placeholder.style.fontWeight = '';
        placeholder.textContent = placeholder.getAttribute('data-medbot-original') || '';
      }
    }
  }

  // Button clicking

  function clickBtn(btn) {
    try { btn.click(); } catch {console.log('[MedBot] Failed to click button', btn); }
  }

  // Kakera

  function clickMatchingKakera(msgEl) {
    if (!autoKakeraEnabled || !tuData.lastUpdated || !isMudaeMessage(msgEl)) return;
    const msgId = getMsgId(msgEl);
    if (!msgId || isMessageProcessed(msgId, 'kakera')) return;
    const matchingBtns = [...msgEl.querySelectorAll('button')].filter(btn => {
      const img = btn.querySelector('img.emoji');
      return img && selectedKakeraKeys.has(KAKERA_URL_MAP.get(normalizeUrl(img.src))) && btn.closest('[id^="message-accessories-"]');
    });
    if (!matchingBtns.length) return;
    matchingBtns.forEach(clickBtn);
  }

  // Rollcap recovery

  async function handleRollcapRecovery(msgEl) {
    if (!isRunning || !infiniteMode || recoveryInProgress || !isMudaeMessage(msgEl)) return;
    const handle = getOwnHandle();
    if (handle === 'Unknown') return;
    const text  = getMessageText(msgEl);
    const match = text.match(new RegExp(`^${escapeRegExp(handle)}, the roulette is limited to (\\d+) uses per hour\\.\\s*(\\d+) min left\\.`, 'i'));
    if (!match) return;
    const msgId = getMsgId(msgEl);
    if (!msgId || isMessageProcessed(msgId)) return;
    recoveryInProgress = true; waitingForMudae = false; clearTimers(); updateVisuals();
    console.log('[MedBot] Rollcap — sending $us 20 x5');
    await sleep(1000);
    for (let i = 0; i < 5; i++) { sendRawCommand('$us 20'); if (i < 4) await sleep(1500); }
    await sleep(1500);
    recoveryInProgress = false; updateVisuals();
    if (isRunning) doNextSend();
  }


  // Sphere emoji IDs used by all the minigames ($oh, $oc, $oq, $ot)

  const SPHERE_ID = {
    qmark:  '1437140748423270441',
    purple: '1437140625844867244',
    blue:   '1437140639987929108',
    teal:   '1437140651614535680',
    green:  '1437140664193126441',
    yellow: '1437140677187338310',
    orange: '1437140688608432185',
    red:    '1437140700604137554',
    black:  '1437140725492879471',
    white:  '1437140737459486780',
    rainbow: '1437140713795227809',
  };

  const ID_TO_COLOR = Object.fromEntries(Object.entries(SPHERE_ID).map(([k, v]) => [v, k])); // reverse lookup: emoji ID → color name

  // Game message detection

  const hasActiveGameButtons = msgEl => getOhButtons(msgEl).some(b => !b.hasAttribute('disabled'));

  async function waitForGameMsg(keyword, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      await sleep(300);
      const list = getMessageList();
      if (!list) continue;
      const articles = [...list.querySelectorAll('[role="article"]')].slice(-8).reverse();
      for (const msgEl of articles) {
        if (!isMudaeMessage(msgEl)) continue;
        if (!getMessageText(msgEl).includes(keyword)) continue;
        if (!hasActiveGameButtons(msgEl)) continue;
        return msgEl;
      }
    }
    return null;
  }

  async function waitForButtonDone(msgEl, btnIdx, timeout = 8000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const btn = getOhButtons(msgEl)[btnIdx];
      if (!btn || !btn.hasAttribute('data-migration-pending')) break;
      await sleep(100);
    }
    await sleep(500);
  }

  // Auto $oh

  const SPHERE_VALUE = {
    [SPHERE_ID.rainbow]: 10, [SPHERE_ID.red]: 9, [SPHERE_ID.black]: 8, [SPHERE_ID.white]: 7,
    [SPHERE_ID.orange]: 6, [SPHERE_ID.yellow]: 5, [SPHERE_ID.green]: 4,
    [SPHERE_ID.teal]: 3, [SPHERE_ID.blue]: 2, [SPHERE_ID.purple]: 1, [SPHERE_ID.qmark]: 0,
  };

  function pickOhIndex(btns, clickedIndexes, clicksLeft) {
    let purpleIdx = -1, blueIdx = -1, tealIdx = -1;
    let bestValueIdx = -1, bestValueScore = -1;
    const qmarkIndices = [];

    for (let i = 0; i < btns.length; i++) {
      if (clickedIndexes.has(i)) continue;
      const id    = getSphereId(btns[i]);
      const value = SPHERE_VALUE[id] ?? -1;
      if (value < 0) continue;

      if (id === SPHERE_ID.purple) { purpleIdx = i; continue; }
      if (id === SPHERE_ID.qmark)  { qmarkIndices.push(i); continue; }
      if (id === SPHERE_ID.blue)   { if (blueIdx === -1) blueIdx = i; continue; }
      if (id === SPHERE_ID.teal)   { if (tealIdx === -1) tealIdx = i; continue; }
      if (value > bestValueScore) { bestValueScore = value; bestValueIdx = i; }
    }

    if (purpleIdx !== -1) return purpleIdx;
    if (bestValueIdx !== -1) return bestValueIdx;
    if (clicksLeft <= 0) return -1;

    const randomQmark = qmarkIndices.length > 0
      ? qmarkIndices[Math.floor(Math.random() * qmarkIndices.length)]
      : -1;

    if (clicksLeft === 1) {
      if (randomQmark !== -1) return randomQmark;
      if (tealIdx !== -1) return tealIdx;
      return blueIdx;
    }

    if (blueIdx !== -1) return blueIdx;

    if (tealIdx !== -1 && randomQmark !== -1) return Math.random() < 0.5 ? randomQmark : tealIdx;
    if (tealIdx  !== -1) return tealIdx;
    return randomQmark;
  }

  async function runGame(name, keyword, multiplier, bodyFn) {
    if (activeGame) return;
    activeGame = name; updateVisuals();
    sendRawCommand(multiplier > 1 ? `$${name} ${multiplier}` : `$${name}`);
    const msgEl = await waitForGameMsg(keyword);
    if (!msgEl) { console.warn(`[MedBot] $${name}: no response found`); activeGame = null; updateVisuals(); return; }
    await sleep(1000);
    await bodyFn(msgEl);
    activeGame = null; updateVisuals();
    console.log(`[MedBot] $${name} complete`);
  }

  async function runAutoOh() {
    await runGame('oh', 'times on the buttons below', mult.oh, async msgEl => {
      const clicked = new Set();
      let clicks = 5;

      while (true) {
        const btns = getOhButtons(msgEl);
        if (!btns.length) break;

        const idx = pickOhIndex(btns, clicked, clicks);
        if (idx === -1) break;

        const id     = getSphereId(btns[idx]);
        const isFree = id === SPHERE_ID.purple;
        clicked.add(idx);
        clickBtn(btns[idx]);
        if (!isFree) clicks--;
        console.log(`[MedBot] $oh: clicked index ${idx} (${id}) — ${clicks} clicks left`);
        updateVisuals();

        if (clicks <= 0 && !isFree) break;
        await waitForButtonDone(msgEl, idx);
      }
    });
  }

  // Auto $oc

  function idxToRC(idx) { return [Math.floor(idx / 5), idx % 5]; }

  function classifyButton(redIdx, btnIdx) {
    const [redRow, redCol] = idxToRC(redIdx);
    const [row,    col]    = idxToRC(btnIdx);
    const rowDist = Math.abs(row - redRow);
    const colDist = Math.abs(col - redCol);
    if (rowDist === 0 && colDist === 0) return 'red';
    if (rowDist + colDist === 1)        return 'orange';
    if (rowDist === colDist)            return 'yellow';
    if (rowDist === 0 || colDist === 0) return 'green';
    return 'blue';
  }

  function possibleRedPositions(observations) {
    const options = new Set();

    for (let option = 0; option < 25; option++) {
      if (option === 12) continue;

      let couldBeHere = true;

      for (const [btnIdx, sphereId] of observations) {
        if (btnIdx === option) {
          if (sphereId !== SPHERE_ID.red) { couldBeHere = false; break; }
          continue;
        }

        const colorName = ID_TO_COLOR[sphereId];
        if (!colorName) continue;

        const [redRow, redCol] = idxToRC(option);
        const [row,    col]    = idxToRC(btnIdx);
        const rowDist = Math.abs(row - redRow);
        const colDist = Math.abs(col - redCol);

        let geometryMatches;
        switch (colorName) {
          case 'orange': geometryMatches = rowDist + colDist === 1;                              break;
          case 'yellow': geometryMatches = rowDist === colDist && rowDist > 0;                   break;
          case 'green':  geometryMatches = rowDist === 0 || colDist === 0;                       break;
          case 'teal':   geometryMatches = rowDist === 0 || colDist === 0 || rowDist === colDist; break;
          case 'blue':   geometryMatches = rowDist !== 0 && colDist !== 0 && rowDist !== colDist; break;
          default:       geometryMatches = true;
        }

        if (!geometryMatches) { couldBeHere = false; break; }
      }

      if (couldBeHere) options.add(option);
    }

    return options;
  }


  function pickOcCell(options, clicked, btns) {
    const totalOptions = options.size;
    if (totalOptions === 0) return -1;

    let bestIdx = -1, bestScore = -Infinity;

    for (let i = 0; i < 25; i++) {
      if (i === 12) continue;
      if (clicked.has(i)) continue;
      if (btns[i] && getSphereId(btns[i]) !== SPHERE_ID.qmark) continue;

      const colorCounts = new Map();
      for (const redPos of options) {
        const color = classifyButton(redPos, i);
        colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
      }

      let partitionCost = 0;
      for (const [color, count] of colorCounts) {
        if (color !== 'red') partitionCost += count * count;
      }

      const score = totalOptions - partitionCost / totalOptions;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }

    return bestIdx;
  }

  function ocPriority(redIdx) {
    const order   = ['orange', 'yellow', 'green', 'teal', 'blue'];
    const buckets = { orange: [], yellow: [], green: [], teal: [], blue: [] };

    for (let i = 0; i < 25; i++) {
      if (i === redIdx) continue;
      const color = classifyButton(redIdx, i);
      if (buckets[color]) buckets[color].push(i);
    }

    return order.flatMap(color => buckets[color]);
  }

  async function runAutoOc() {
    await runGame('oc', 'red sphere', mult.oc, async msgEl => {
      const observations = new Map();
      const clicked      = new Set();
      let clicks = 5, redIdx = -1, priority = null;

      getOhButtons(msgEl).forEach((b, i) => {
        const id = getSphereId(b);
        if (id && id !== SPHERE_ID.qmark) observations.set(i, id);
      });

      for (let turn = 0; turn < 5 && clicks > 0; turn++) {
        const btns = getOhButtons(msgEl);
        if (!btns.length) break;

        let chosenIdx = -1;

        if (redIdx !== -1) {
          for (const i of priority) { if (!clicked.has(i)) { chosenIdx = i; break; } }
        } else {
          const options = possibleRedPositions(observations);
          console.log(`[MedBot] $oc: ${options.size} possible red positions remaining`);

          if (options.size === 1) {
            redIdx   = [...options][0];
            priority = [redIdx, ...ocPriority(redIdx)];
            console.log(`[MedBot] $oc: deduced red at index ${redIdx} without clicking`);
            for (const i of priority) { if (!clicked.has(i)) { chosenIdx = i; break; } }
          } else {
            chosenIdx = pickOcCell(options, clicked, btns);
          }
        }

        if (chosenIdx === -1) break;
        clicked.add(chosenIdx);
        clickBtn(btns[chosenIdx]);
        clicks--;
        console.log(`[MedBot] $oc: clicked index ${chosenIdx} — ${clicks} clicks left`);
        updateVisuals();
        await waitForButtonDone(msgEl, chosenIdx);

        const updatedBtns = getOhButtons(msgEl);
        const revealedId  = getSphereId(updatedBtns[chosenIdx]);
        if (revealedId && revealedId !== SPHERE_ID.qmark) {
          observations.set(chosenIdx, revealedId);
          if (revealedId === SPHERE_ID.red) {
            redIdx   = chosenIdx;
            priority = [redIdx, ...ocPriority(redIdx)];
            console.log(`[MedBot] $oc: found red at index ${redIdx}`);
          }
        }
      }
    });
  }

  // Auto $oq

  const OQ_CLUE = { [SPHERE_ID.blue]: 0, [SPHERE_ID.teal]: 1, [SPHERE_ID.green]: 2, [SPHERE_ID.yellow]: 3, [SPHERE_ID.orange]: 4 };

  const OQ_NEIGHBORS = Array.from({ length: 25 }, (_, i) => {
    const row = Math.floor(i / 5), col = i % 5, result = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) result.push(nr * 5 + nc);
      }
    return result;
  });

  function oqSolveConstraints(revealed) {
    const mustBePurple = new Set();
    const cantBePurple = new Set();
    let madeProgress = true;

    while (madeProgress) {
      madeProgress = false;

      for (const [btnIdx, id] of revealed) {
        const clue = OQ_CLUE[id];
        if (clue === undefined) continue;

        const neighbors    = OQ_NEIGHBORS[btnIdx];
        const foundPurples = neighbors.filter(n => revealed.get(n) === SPHERE_ID.purple || mustBePurple.has(n)).length;
        const unknowns     = neighbors.filter(n => !revealed.has(n) && !cantBePurple.has(n) && !mustBePurple.has(n));
        const stillNeeded  = clue - foundPurples;

        if (stillNeeded === 0) {
          for (const n of unknowns) {
            if (!cantBePurple.has(n)) { cantBePurple.add(n); madeProgress = true; }
          }
        } else if (stillNeeded > 0 && stillNeeded === unknowns.length) {
          for (const n of unknowns) {
            if (!mustBePurple.has(n)) { mustBePurple.add(n); madeProgress = true; }
          }
        }
      }
    }

    return { definitePurple: mustBePurple, definiteEmpty: cantBePurple };
  }

  function computeOqScores(revealed, definiteEmpty = new Set()) {
    const scores  = new Array(25).fill(1.0);
    const skipped = new Set(definiteEmpty);

    for (const [btnIdx, id] of revealed) {
      scores[btnIdx] = -1;

      const clue = OQ_CLUE[id];
      if (clue === undefined) continue;

      const unrevealed = OQ_NEIGHBORS[btnIdx].filter(n => !revealed.has(n));
      if (clue === 0) {
        unrevealed.forEach(n => skipped.add(n));
      } else {
        const weight = clue / Math.max(unrevealed.length, 1);
        unrevealed.forEach(n => { scores[n] += weight; });
      }
    }

    skipped.forEach(n => { if (scores[n] > 0) scores[n] = 0; });

    return scores;
  }

  function pickOqIndex(scores, revealed) {
    let bestIdx = -1, bestScore = -1;

    for (let i = 0; i < 25; i++) {
      if (revealed.has(i) || scores[i] < 0) continue;
      const unknownNeighbours = OQ_NEIGHBORS[i].filter(n => !revealed.has(n)).length;
      const adjustedScore     = scores[i] + unknownNeighbours * 0.01;
      if (adjustedScore > bestScore) { bestScore = adjustedScore; bestIdx = i; }
    }

    return bestIdx;
  }

  async function runAutoOq() {
    await runGame('oq', 'Find 3 purple spheres', mult.oq, async msgEl => {
      let clicks = Number(getMessageText(msgEl).match(/click\s+(\d+)\s+times/i)?.[1] ?? 7);
      const revealed = new Map();

      while (clicks > 0) {
        const btns = getOhButtons(msgEl);

        const redIdx = btns.findIndex((b, i) => !revealed.has(i) && getSphereId(b) === SPHERE_ID.red);

        if (redIdx !== -1) {
          clickBtn(btns[redIdx]);
          clicks--;
          revealed.set(redIdx, SPHERE_ID.red);
          console.log(`[MedBot] $oq: clicked RED at index ${redIdx} — ${clicks} clicks left`);
          updateVisuals();
          await waitForButtonDone(msgEl, redIdx);
          continue;
        }

        const { definitePurple, definiteEmpty } = oqSolveConstraints(revealed);

        const confirmedPurple = [...definitePurple].find(p => !revealed.has(p));
        if (confirmedPurple !== undefined) {
          clickBtn(btns[confirmedPurple]);
          console.log(`[MedBot] $oq: definite purple at index ${confirmedPurple} (free)`);
          updateVisuals();
          await waitForButtonDone(msgEl, confirmedPurple);
          const newId = getSphereId(getOhButtons(msgEl)[confirmedPurple]);
          if (newId) revealed.set(confirmedPurple, newId);
          continue;
        }

        const scores = computeOqScores(revealed, definiteEmpty);
        const chosen = pickOqIndex(scores, revealed);
        if (chosen === -1) break;

        clickBtn(btns[chosen]);
        console.log(`[MedBot] $oq: idx=${chosen} score=${scores[chosen].toFixed(2)} — ${clicks} left`);
        updateVisuals();
        await waitForButtonDone(msgEl, chosen);
        const chosenId = getSphereId(getOhButtons(msgEl)[chosen]);
        if (chosenId && chosenId !== SPHERE_ID.qmark) revealed.set(chosen, chosenId);
        if (chosenId !== SPHERE_ID.purple) clicks--;
      }
    });
  }

  // Auto $ot

  async function runAutoOt() {
    await runGame('ot', 'colors are free', mult.ot, async msgEl => {
      let clicks = Number(getMessageText(msgEl).match(/click\s+(\d+)\s+times/i)?.[1] ?? 4);
      const clicked = new Set();

      while (true) {
        const btns = getOhButtons(msgEl);
        if (!btns.length) break;

        let freeIdx = -1, hiddenIdx = -1, blueIdx = -1;
        for (let i = 0; i < btns.length; i++) {
          if (clicked.has(i) || btns[i].hasAttribute('disabled')) continue;
          const id = getSphereId(btns[i]);
          if (freeIdx === -1 && id && id !== SPHERE_ID.qmark && id !== SPHERE_ID.blue) { freeIdx = i; break; }
          if (hiddenIdx === -1 && (!id || id === SPHERE_ID.qmark)) hiddenIdx = i;
          else if (blueIdx === -1 && id === SPHERE_ID.blue) blueIdx = i;
        }
        const chosenIdx = freeIdx !== -1 ? freeIdx : clicks > 0 ? (hiddenIdx !== -1 ? hiddenIdx : blueIdx) : -1;

        if (chosenIdx === -1) break;

        clicked.add(chosenIdx);
        clickBtn(btns[chosenIdx]);
        console.log(`[MedBot] $ot: clicked index ${chosenIdx} — ${clicks} blue clicks left`);
        updateVisuals();
        await waitForButtonDone(msgEl, chosenIdx);

        const revealedId = getSphereId(getOhButtons(msgEl)[chosenIdx]);
        if (revealedId === SPHERE_ID.blue) {
          clicks--;
          console.log(`[MedBot] $ot: revealed blue, ${clicks} clicks left`);
        } else {
          console.log(`[MedBot] $ot: revealed non-blue (free), clicks unchanged`);
        }
      }
    });
  }

  // Auto Claim

  const KAKERA_EMOJI_ID = '469835869059153940';

  function isWishedByMe(msgEl) {
    const content = msgEl.querySelector('[id^="message-content-"]');
    if (!content?.textContent?.trim().startsWith('Wished by')) return false;
    const uname = getOwnUsername();
    return [...content.querySelectorAll('[class*="mention"]')].some(m => m.textContent.trim() === `@${uname}`);
  }

  function getKakeraValue(msgEl) {
    const img = msgEl.querySelector(`img.emoji[data-id="${KAKERA_EMOJI_ID}"]`);
    if (!img) return null;
    const prev = img.closest('[class*="emojiContainer"]')?.previousElementSibling;
    return prev?.tagName === 'STRONG' ? (Number(prev.textContent.trim()) || null) : null;
  }

  function getSeriesName(msgEl) {
    const desc = msgEl.querySelector('[class*="embedDescription"]');
    if (!desc) return null;
    let text = '';
    for (const node of desc.childNodes) {
      if (node.nodeName === 'STRONG') break;
      text += node.textContent;
    }
    return text.trim().replace(/\s+/g, ' ') || null;
  }

  const isAlreadyOwned = msgEl =>
    [...msgEl.querySelectorAll('[class*="embedFooterText"]')].some(el => el.textContent.trim().startsWith('Belongs to'));

  const getClaimButton = msgEl =>
    msgEl.querySelector('[id^="message-accessories-"] [class*="children"] button') || null;

  function tryAutoClaim(msgEl) {
    if (!isMudaeMessage(msgEl)) return;
    const msgId = getMsgId(msgEl);
    if (!msgId || isMessageProcessed(msgId, 'claim')) return;
    if (!autoClaimWishes && !(autoClaimMinKakera > 0 && autoClaimMaxKakera > 0) && !autoClaimSeries) return;
    if (isAlreadyOwned(msgEl)) return;

    const claimBtn = getClaimButton(msgEl);
    if (!claimBtn) return;

    const kakera    = getKakeraValue(msgEl);
    const inRange   = autoClaimMinKakera > 0 && autoClaimMaxKakera > 0
      && kakera !== null && kakera >= autoClaimMinKakera && kakera <= autoClaimMaxKakera;
    const wished    = autoClaimWishes && isWishedByMe(msgEl);
    const inSeries  = !!autoClaimSeries && (getSeriesName(msgEl) || '').toLowerCase().includes(autoClaimSeries.toLowerCase());

    if (!wished && !inRange && !inSeries) return;

    const claimReady = tuData.claimAvailable === true
      || (tuData.claimAvailable === false && tuData.claimResetAt > 0 && Date.now() >= tuData.claimResetAt);
    if ((wished || inRange) && !claimReady) return;

    clickBtn(claimBtn);
    tuData.claimAvailable = false;
    saveTuData();
    console.log(`[MedBot] Auto-claimed — kakera=${kakera}, wished=${wished}, series=${inSeries}`);
  }

  // $tu parsing

  function parseMudaeTime(str) {
    if (!str) return null;
    const hours = Number(str.match(/(\d+)\s*h/i)?.[1]   || 0);
    const mins  = Number(str.match(/(\d+)\s*min/i)?.[1]  || 0);
    return (hours || mins) ? (hours * 60 + mins + 1) * 60000 : null;
  }

  function parseTuMessage(text) {
    const claimAvailable  = /you can claim right now/i.test(text);
    const claimResetMatch = text.match(/next claim reset(?:\s+is)?\s+in\s+((?:\d+\s*h\s*)?\d+\s*min)/i);
    const cantClaimMatch  = !claimAvailable
      ? text.match(/you can't claim for another\s+((?:\d+\s*h\s*)?\d+\s*min)/i) : null;
    const rollsMatch      = text.match(/you have (\d+) rolls/i);
    const rollsResetMatch = text.match(/(?:next\s+)?rolls\s+reset(?:\s+is)?\s+in\s+((?:\d+\s*h\s*)?\d+\s*min)/i);
    const rtAvailable     = /\$rt\s+is\s+available/i.test(text) ? true
                          : /cooldown of \$rt is not over/i.test(text) ? false : null;
    const rtResetMatch    = text.match(/cooldown of \$rt is not over\.\s*Time left:\s*((?:\d+\s*h\s*)?\d+\s*min)/i);
    return {
      claimAvailable,
      claimResetMs: parseMudaeTime(claimResetMatch?.[1] ?? cantClaimMatch?.[1] ?? null),
      rollsLeft:    rollsMatch ? Number(rollsMatch[1]) : null,
      rollsResetMs: parseMudaeTime(rollsResetMatch?.[1]),
      rtAvailable,
      rtResetMs:    parseMudaeTime(rtResetMatch?.[1]),
    };
  }

  function isTuResponse(text) {
    const handle = getOwnHandle();
    if (handle !== 'Unknown' && !new RegExp(`^${escapeRegExp(handle)},`, 'i').test(text)) return false;
    return /you have \d+ rolls/i.test(text)
      && /(?:you can(?:'t)? claim|next claim reset)/i.test(text);
  }

  function formatCountdown(ms) {
    if (ms <= 0) return 'now';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function renderChannelInfo(container) {
    if (!container) return;
    const current = getCurrentChannelInfo();
    const displayInfo = channelLockEnabled && lockedChannelId
      ? { server: lockedServerName || '—', channel: lockedChannelName || '—' }
      : { server: current?.serverName || '—', channel: current?.channelName || '—' };

    container.innerHTML = `
      <div class="medbot-channel-rows">
        <div class="medbot-channel-tooltip">
          <strong style="color:var(--mb-accent)">Channel lock</strong><br>
          <br>
          <span style="color:var(--mb-text-muted)">Enabling the toggle locks the bot to whichever channel you are currently in. This prevents the bot from accidentally sending messages when switching channels & is currently rolling.</span>
        </div>
        <label class="medbot-toggle-row medbot-lock-row">
          <div class="medbot-channel-breadcrumb-wrap">
            <span class="medbot-channel-server">${displayInfo.server}</span><span class="medbot-channel-sep"> › </span><span class="medbot-channel-name">#${displayInfo.channel}</span>
          </div>
          <label class="medbot-switch" style="flex-shrink:0">
            <input type="checkbox" id="medbot-channel-lock" ${channelLockEnabled ? 'checked' : ''}>
            <span class="medbot-switch-track"></span><span class="medbot-switch-thumb"></span>
          </label>
        </label>
      </div>`;

    container.querySelector('#medbot-channel-lock').addEventListener('change', e => {
      channelLockEnabled = e.target.checked;
      if (channelLockEnabled && current) {
        lockedChannelId   = current.channelId;
        lockedServerId    = current.serverId;
        lockedChannelName = current.channelName;
        lockedServerName  = current.serverName || '';
      }
      saveSettings();
      renderChannelInfo(container);
    });
  }

  function expireTimers() {
    const now = Date.now();
    const claimExpired = !tuData.claimAvailable && tuData.claimResetAt > 0 && now >= tuData.claimResetAt;
    const rollsExpired = tuData.rollsResetAt > 0 && now >= tuData.rollsResetAt;
    const rtExpired    = tuData.rtAvailable === false && tuData.rtResetAt > 0 && now >= tuData.rtResetAt;
    if (claimExpired) { tuData.claimAvailable = true;  tuData.claimResetAt  = 0; }
    if (rollsExpired) { tuData.rollsLeft = tuData.rollsMax; tuData.rollsResetAt = 0; }
    if (rtExpired)    { tuData.rtAvailable = true;     tuData.rtResetAt     = 0; }
    if (claimExpired || rollsExpired || rtExpired) saveTuData();
    return { claimExpired, rollsExpired, rtExpired };
  }

  function renderTuStatus(container) {
    if (!container) return;
    if (!tuData.lastUpdated) {
      container.innerHTML = '<div class="medbot-tu-empty">No data yet, click Configure to sync this server.</div>';
      return;
    }
    expireTimers();
    const now = Date.now();
    const claimResetMs = tuData.claimResetAt - now;
    const rollsResetMs = tuData.rollsResetAt - now;
    const rtResetMs    = tuData.rtResetAt    - now;
    const ageMs        = now - tuData.lastUpdated;
    const ageText      = ageMs < 60000   ? `${Math.floor(ageMs / 1000)}s ago`
                       : ageMs < 3600000 ? `${Math.floor(ageMs / 60000)}m ago`
                       :                   `${Math.floor(ageMs / 3600000)}h ago`;

    const claimBadge = tuData.claimAvailable
      ? '<span class="medbot-tu-badge available">Available</span>'
      : '<span class="medbot-tu-badge unavailable">Unavailable</span>';
    const claimSub = claimResetMs > 0 ? formatCountdown(claimResetMs) : '—';
    const rollsSub = rollsResetMs > 0 ? formatCountdown(rollsResetMs) : '—';
    const rtSub    = rtResetMs > 0 ? formatCountdown(rtResetMs) : '—';
    const rollsPct = tuData.rollsMax ? Math.round(((tuData.rollsLeft ?? 0) / tuData.rollsMax) * 100) : 0;

    const rtCard = tuData.rtAvailable !== null ? `
        <div class="medbot-tu-card">
          <div class="medbot-tu-card-label">$rt</div>
          <div class="medbot-tu-card-main">
            ${tuData.rtAvailable
              ? '<span class="medbot-tu-badge available">Available</span>'
              : '<span class="medbot-tu-badge unavailable">Unavailable</span>'}
          </div>
          <div class="medbot-tu-card-sub">${rtSub}</div>
        </div>` : '';

    container.innerHTML = `
      <div class="medbot-tu-grid${tuData.rtAvailable !== null ? ' cols-3' : ' cols-2'}">
        <div class="medbot-tu-card">
          <div class="medbot-tu-card-label">Claim</div>
          <div class="medbot-tu-card-main">${claimBadge}</div>
          <div class="medbot-tu-card-sub">${claimSub}</div>
        </div>
        <div class="medbot-tu-card">
          <div class="medbot-tu-card-label">Rolls</div>
          <div class="medbot-tu-card-main"><span class="medbot-tu-rolls-num">${tuData.rollsLeft ?? '—'}</span></div>
          <div class="medbot-tu-progress"><div class="medbot-tu-progress-fill" style="width:${rollsPct}%"></div></div>
          <div class="medbot-tu-card-sub">${rollsSub}</div>
        </div>${rtCard}
      </div>
      <div class="medbot-tu-updated">Updated ${ageText}</div>`;
  }

  function handleTuResponse(msgEl) {
    const text = getMessageText(msgEl);
    if (!isTuResponse(text)) return;
    const msgId = getMsgId(msgEl);
    if (!msgId || isMessageProcessed(msgId)) return;
    if (!awaitingTuResponse) {
      if (!tuData.lastUpdated) return;
      const msgTime = getMessageTimestamp(msgEl);
      if (!msgTime || Math.floor(Date.now() / 60000) !== Math.floor(msgTime / 60000)) return;
    }
    const now    = Date.now();
    const parsed = parseTuMessage(text);
    tuData.claimAvailable = parsed.claimAvailable;
    tuData.claimResetAt   = parsed.claimResetMs != null ? now + parsed.claimResetMs : 0;
    tuData.rollsLeft      = parsed.rollsLeft;
    if (parsed.rollsLeft !== null && (tuData.rollsMax === null || parsed.rollsLeft > tuData.rollsMax)) tuData.rollsMax = parsed.rollsLeft;
    tuData.rollsResetAt   = parsed.rollsResetMs != null ? now + parsed.rollsResetMs : 0;
    tuData.rtAvailable    = parsed.rtAvailable;
    tuData.rtResetAt      = parsed.rtResetMs    != null ? now + parsed.rtResetMs    : 0;
    tuData.lastUpdated    = now;
    saveTuData();
    if (awaitingTuResponse) {
      awaitingTuResponse = false;
      const configBtn = document.querySelector('#medbot-backdrop #medbot-configure-tu');
      if (configBtn) { configBtn.textContent = 'Configure'; configBtn.disabled = false; }
    }
    renderTuStatus(getTuStatusContainer());
  }

  function getTuStatusContainer() {
    return document.querySelector('#medbot-backdrop [data-panel="settings"].active #medbot-tu-status');
  }

  function isMudaeOrContinuation(msgEl) {
    if (isMudaeMessage(msgEl)) return true;
    const labelledBy = msgEl.getAttribute('aria-labelledby') || '';
    const m = labelledBy.match(/message-username-\d+/);
    if (!m) return false;
    const el = document.getElementById(m[0]);
    return el?.textContent?.trim().startsWith('Mudae') || false;
  }

  function handleClaimDenied(msgEl) {
    if (!isMudaeOrContinuation(msgEl)) return;
    const msgTime = getMessageTimestamp(msgEl);
    if (!msgTime || Math.floor(Date.now() / 60000) !== Math.floor(msgTime / 60000)) return;
    const text     = getMessageText(msgEl);
    const username = getOwnUsername();
    if (username === 'Unknown' || !new RegExp(`^@${escapeRegExp(username)},`, 'i').test(text)) return;
    const match = text.match(/next interval begins in\s+((?:\d+\s*h\s*)?\d+\s*min)/i);
    const ms    = match ? parseMudaeTime(match[1]) : null;
    if (ms == null) return;
    const msgId = getMsgId(msgEl);
    if (!msgId || isMessageProcessed(msgId)) return;
    const now = Date.now();
    tuData.claimAvailable = false; tuData.claimResetAt = now + ms; tuData.lastUpdated = now;
    saveTuData();
    renderTuStatus(getTuStatusContainer());
    console.log(`[MedBot] Claim denied — next interval in ${match[1]}`);
  }

  function handleRtCooldown(msgEl) {
    const text = getMessageText(msgEl);
    const match = text.match(/cooldown of \$rt is not over\.\s*Time left:\s*((?:\d+\s*h\s*)?\d+\s*min)/i);
    if (!match) return;
    const msgId = getMsgId(msgEl);
    if (!msgId || isMessageProcessed(msgId)) return;
    const ms = parseMudaeTime(match[1]);
    if (ms == null) return;
    const now = Date.now();
    tuData.rtAvailable = false;
    tuData.rtResetAt = now + ms;
    tuData.lastUpdated = now;
    saveTuData();
    renderTuStatus(getTuStatusContainer());
    console.log(`[MedBot] $rt cooldown — ${match[1]}`);
  }

  // Own command detection

  function handleOwnCommandMessage(msgEl) {
    if (!msgEl || !tuData.lastUpdated) return;
    if (msgEl.querySelector('[class*="isSending"]')) return; // Discord is still sending current message and has a different temp ID, skip it (this was so damn annoying, had me stuck for a while)
    const usernameEl = msgEl.querySelector('[id^="message-username-"] [class*="username"]');
    if (!usernameEl) return;
    const senderName = (usernameEl.getAttribute('data-text') || usernameEl.textContent || '').trim();
    const ownName = getOwnUsername();
    if (!senderName || ownName === 'Unknown' || senderName !== ownName) return;

    // dedupe + freshness check
    const msgId = getMsgId(msgEl);
    if (!msgId || isMessageProcessed(msgId)) return;
    const timeEl = msgEl.querySelector('time[datetime]');
    if (timeEl) {
      const msgDate = new Date(timeEl.getAttribute('datetime'));
      const now = new Date();
      if (msgDate.getHours() !== now.getHours() || msgDate.getMinutes() !== now.getMinutes()) return;
    }

    const text = (msgEl.querySelector('[id^="message-content-"]')?.innerText || '').trim().toLowerCase();
    if (!text) return;

    if (ROLL_COMMANDS.has(text)) {
      if (pendingBotRolls > 0) {
        pendingBotRolls--;
        return; // bot sent this, already deducted in doNextSend
      }
      if (tuData.rollsLeft !== null && tuData.rollsLeft > 0) {
        tuData.rollsLeft = Math.max(0, tuData.rollsLeft - 1);
        tuData.lastUpdated = Date.now();
        saveTuData();
        renderTuStatus(getTuStatusContainer());
        console.log(`[MedBot] Manual roll detected (${text}), rollsLeft=${tuData.rollsLeft}`);
      }
      return;
    }

    if (text === '$rt' && tuData.rtAvailable === true) {
      tuData.rtAvailable = false;
      tuData.rtResetAt = 0;
      tuData.lastUpdated = Date.now();
      saveTuData();
      renderTuStatus(getTuStatusContainer());
      console.log('[MedBot] Manual $rt detected, marked unavailable');
    }
  }

  // Message processing

  function processMessage(msgEl) {
    if (!msgEl) return;
    handleOwnCommandMessage(msgEl);
    KAKERA_SCAN_DELAYS.forEach(delay => setTimeout(() => clickMatchingKakera(msgEl), delay));
    CLAIM_SCAN_DELAYS.forEach(delay => setTimeout(() => tryAutoClaim(msgEl), delay));
    handleRollcapRecovery(msgEl);
    if (isMudaeMessage(msgEl)) { onMudaeResponseReceived(); handleTuResponse(msgEl); handleRtCooldown(msgEl); }
    handleClaimDenied(msgEl);
  }

  // Message list observer

  function attachObserver(listEl) {
    if (!listEl || (attachedList === listEl && msgObserver)) return;
    msgObserver?.disconnect();
    attachedList = listEl;
    msgObserver  = new MutationObserver(mutations => {
      const seen = new Set();
      for (const { addedNodes } of mutations) {
        for (const node of addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches('[role="article"]')) seen.add(node);
          const parent = node.closest?.('[role="article"]');
          if (parent) seen.add(parent);
          node.querySelectorAll?.('[role="article"]').forEach(a => seen.add(a));
        }
      }
      seen.forEach(processMessage);
    });
    msgObserver.observe(listEl, { childList: true, subtree: true });
    [...listEl.querySelectorAll('[role="article"]')].slice(-15).forEach(processMessage);
  }

  function startBootObserver() {
    if (bootObserver) return;
    const immediate = getMessageList();
    if (immediate) { attachObserver(immediate); startLivenessWatcher(); return; }
    bootObserver = new MutationObserver(() => {
      const list = getMessageList();
      if (!list) return;
      bootObserver.disconnect(); bootObserver = null;
      attachObserver(list);
      startLivenessWatcher();
    });
    bootObserver.observe(document.body, { childList: true, subtree: true });
  }

  function startLivenessWatcher() {
    if (livenessInterval) return;
    livenessInterval = setInterval(() => {
      if (attachedList && !document.contains(attachedList)) {
        msgObserver?.disconnect(); msgObserver = null; attachedList = null;
        clearInterval(livenessInterval); livenessInterval = null;
        startBootObserver();
      }
    }, 1000);
  }

  // Attachment menu injection

  function injectMenuButton(menu) {
    if (!menu || menu.querySelector('[data-medbot-injected]')) return;
    const scroller = menu.querySelector('[class*="scroller"]') || menu;
    const first    = scroller.querySelector('[role="menuitem"]');
    const item     = document.createElement('div');
    item.setAttribute('role', 'menuitem');
    item.setAttribute('tabindex', '-1');
    item.setAttribute('data-menu-item', 'true');
    item.setAttribute('data-medbot-injected', 'true');
    if (first) item.className = first.className;
    item.style.position = 'relative';

    const iconWrapClass = first?.querySelector('[class*="iconContainer"]')?.className || '';
    const labelClass    = first?.querySelector('[class*="label_"]')?.className || '';
    const svgClass      = first?.querySelector('svg')?.getAttribute('class') || '';

    item.innerHTML = `
      <div class="${iconWrapClass}">
        <svg class="${svgClass}" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path fill="currentColor" d="M14 2L5 13H12L9 22L20 11H13Z"/>
        </svg>
      </div>
      <div class="${labelClass}">MedBot</div>
      <div class="medbot-menu-status${isRunning ? ' running' : ''}">
        ${isRunning ? '<span class="medbot-menu-status-dot"></span>LIVE' : 'AUTO'}
      </div>`;
    item.addEventListener('mouseenter', () => {
      item.focus();
      const closestMenu = item.closest('[role="menu"]');
      if (!closestMenu) return;
      let focusedClass = null;
      closestMenu.querySelectorAll('[role="menuitem"]').forEach(sibling => {
        if (sibling === item) return;
        const siblingFocusedClass = [...sibling.classList].find(c => /^focused/.test(c));
        if (siblingFocusedClass) { focusedClass = siblingFocusedClass; sibling.classList.remove(siblingFocusedClass); }
      });
      if (focusedClass) item.classList.add(focusedClass);
    });
    item.addEventListener('mouseleave', () => {
      const focusedClass = [...item.classList].find(c => /^focused/.test(c));
      if (focusedClass) item.classList.remove(focusedClass);
    });
    item.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openMedBotModal(); });
    if (first) scroller.insertBefore(item, first); else scroller.appendChild(item);
  }

  function observeMenus() {
    new MutationObserver(mutations => {
      for (const { addedNodes } of mutations) {
        for (const node of addedNodes) {
          if (!(node instanceof Element)) continue;
          const menus = node.matches('[role="menu"]') ? [node] : [...node.querySelectorAll('[role="menu"]')];
          for (const menu of menus) {
            if (/channel actions|attachment/i.test(menu.getAttribute('aria-label') || '')) injectMenuButton(menu);
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
    injectMenuButton(getAttachmentMenu());
  }

  // Styles

  function injectStyles() {
    if (document.getElementById('medbot-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'medbot-styles';
    styleEl.textContent = GM_getResourceText('medbot-css');
    document.head.appendChild(styleEl);
  }

  // Modal

  function closeMedBotModal() { document.getElementById('medbot-backdrop')?.remove(); }

  function loadMedBotGif() {
    return new Promise(resolve => {
      if (medbotGifObjectUrl) return resolve(medbotGifObjectUrl);
      GM_xmlhttpRequest({
        method: 'GET', url: MEDBOT_GIF_URL, responseType: 'blob',
        onload(xhr) {
          try { medbotGifObjectUrl = URL.createObjectURL(xhr.response); resolve(medbotGifObjectUrl); }
          catch { resolve(null); }
        },
        onerror() { resolve(null); },
      });
    });
  }

  async function openMedBotModal() {
    const gifSrc  = await loadMedBotGif();
    injectStyles(); closeMedBotModal();
    const username = getOwnUsername();
    const handle   = getOwnHandle();
    const backdrop = document.createElement('div');
    backdrop.className = 'medbot-backdrop';
    backdrop.id        = 'medbot-backdrop';
    backdrop.innerHTML = `
      <div class="medbot-modal" role="dialog" aria-modal="true">
        ${gifSrc ? `<div class="medbot-gif-wrap"><img class="medbot-gif" src="${gifSrc}" alt="" draggable="false"></div>` : ''}
        <div class="medbot-header">
          <div>
            <div class="medbot-title">MedBot</div>
            <div class="medbot-user-pill" title="${handle}"><span class="medbot-user-pill-dot"></span>${username}</div>
          </div>
          <div class="medbot-status-badge ${isRunning ? 'running' : 'idle'}">
            <span class="medbot-status-dot"></span>${isRunning ? 'Running' : 'Idle'}
          </div>
        </div>
        <div class="medbot-divider"></div>
        <div class="medbot-tabs">
          <div class="medbot-tab-indicator"></div>
          <button class="medbot-tab active" data-tab="send">Send</button>
          <button class="medbot-tab" data-tab="kakera">Kakera</button>
          <button class="medbot-tab" data-tab="claim">Claim</button>
          <button class="medbot-tab" data-tab="extra">Extra</button>
          <button class="medbot-tab" data-tab="settings">Settings</button>
        </div>

        <div class="medbot-panel active" data-panel="send">
          <div class="medbot-field">
            <label class="medbot-field-label">Roll command</label>
            <select id="medbot-roll-cmd" class="medbot-input medbot-select">
              ${ROLL_DROPDOWN_OPTIONS.map(cmd => `<option value="${cmd}"${cmd === selectedRollCommand ? ' selected' : ''}>${cmd}</option>`).join('')}
            </select>
          </div>
          <div class="medbot-field">
            <label class="medbot-field-label">Roll count</label>
            <input id="medbot-count" class="medbot-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="e.g. 50">
          </div>
          <label class="medbot-toggle-row">
            <div>
              <div class="medbot-toggle-label">Infinite mode</div>
              <div class="medbot-toggle-sub">Requires sufficient $us balance</div>
            </div>
            <label class="medbot-switch">
              <input id="medbot-infinite" type="checkbox">
              <span class="medbot-switch-track"></span><span class="medbot-switch-thumb"></span>
            </label>
          </label>
        </div>

        <div class="medbot-panel" data-panel="kakera">
          <label class="medbot-toggle-row">
            <div>
              <div class="medbot-toggle-label">Auto kakera clicking</div>
              <div class="medbot-toggle-sub">Click kakera buttons on Mudae replies</div>
            </div>
            <label class="medbot-switch">
              <input id="medbot-auto-kakera" type="checkbox" ${autoKakeraEnabled ? 'checked' : ''}>
              <span class="medbot-switch-track"></span><span class="medbot-switch-thumb"></span>
            </label>
          </label>
          <div class="medbot-kakera-scroll">
            ${KAKERA_ICONS.map(k => `
              <label class="medbot-kakera-row${selectedKakeraKeys.has(k.key) ? ' selected' : ''}">
                <input type="checkbox" data-kakera-key="${k.key}" ${selectedKakeraKeys.has(k.key) ? 'checked' : ''}>
                <img src="${k.url}" alt="${k.label}">
                <span class="medbot-kakera-name">${k.label}</span>
                <span class="medbot-kakera-check">
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l2.5 2.5L9 1" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              </label>`).join('')}
          </div>
          <div class="medbot-mini-note">Mudae messages are scanned, buttons with matching kakera types are automatically clicked.</div>
        </div>

        <div class="medbot-panel" data-panel="extra">
          <div class="medbot-toggle-row" style="cursor:default">
            <div>
              <div class="medbot-toggle-label">Auto $oh</div>
              <div class="medbot-toggle-sub">Randomly plays, claiming highest first</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
              <div class="medbot-multiplier-control">
                <button class="medbot-mult-btn" data-game="oh" data-dir="-1" ${mult.oh <= 1 ? 'disabled' : ''}>&#8249;</button>
                <span class="medbot-mult-display" id="medbot-oh-mult">${mult.oh}x</span>
                <button class="medbot-mult-btn" data-game="oh" data-dir="1" ${mult.oh >= 10 ? 'disabled' : ''}>&#8250;</button>
              </div>
              <button class="medbot-btn medbot-btn-primary" id="medbot-oh">${activeGame === 'oh' ? 'Running' : 'Play'}</button>
            </div>
          </div>
          <div class="medbot-toggle-row" style="cursor:default">
            <div>
              <div class="medbot-toggle-label">Auto $oc</div>
              <div class="medbot-toggle-sub">Hunt red using spatial inference</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
              <div class="medbot-multiplier-control">
                <button class="medbot-mult-btn" data-game="oc" data-dir="-1" ${mult.oc <= 1 ? 'disabled' : ''}>&#8249;</button>
                <span class="medbot-mult-display" id="medbot-oc-mult">${mult.oc}x</span>
                <button class="medbot-mult-btn" data-game="oc" data-dir="1" ${mult.oc >= 10 ? 'disabled' : ''}>&#8250;</button>
              </div>
              <button class="medbot-btn medbot-btn-primary" id="medbot-oc">${activeGame === 'oc' ? 'Running' : 'Play'}</button>
            </div>
          </div>
          <div class="medbot-toggle-row" style="cursor:default">
            <div>
              <div class="medbot-toggle-label">Auto $oq</div>
              <div class="medbot-toggle-sub">Use clue spheres to find purple spheres</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
              <div class="medbot-multiplier-control">
                <button class="medbot-mult-btn" data-game="oq" data-dir="-1" ${mult.oq <= 1 ? 'disabled' : ''}>&#8249;</button>
                <span class="medbot-mult-display" id="medbot-oq-mult">${mult.oq}x</span>
                <button class="medbot-mult-btn" data-game="oq" data-dir="1" ${mult.oq >= 10 ? 'disabled' : ''}>&#8250;</button>
              </div>
              <button class="medbot-btn medbot-btn-primary" id="medbot-oq">${activeGame === 'oq' ? 'Running' : 'Play'}</button>
            </div>
          </div>
          <div class="medbot-toggle-row" style="cursor:default">
            <div>
              <div class="medbot-toggle-label">Auto $ot</div>
              <div class="medbot-toggle-sub">Click free spheres, avoid blue until forced</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
              <div class="medbot-multiplier-control">
                <button class="medbot-mult-btn" data-game="ot" data-dir="-1" ${mult.ot <= 1 ? 'disabled' : ''}>&#8249;</button>
                <span class="medbot-mult-display" id="medbot-ot-mult">${mult.ot}x</span>
                <button class="medbot-mult-btn" data-game="ot" data-dir="1" ${mult.ot >= 10 ? 'disabled' : ''}>&#8250;</button>
              </div>
              <button class="medbot-btn medbot-btn-primary" id="medbot-ot">${activeGame === 'ot' ? 'Running' : 'Play'}</button>
            </div>
          </div>
          <div class="medbot-mini-note">$oh: Target highest value spheres.<br>$oc: Hunts red with 99% accuracy.<br>$oq: Tries to find all purple, to claim red.<br>$ot: Collects all free spheres, avoids blue until forced.</div>
        </div>

        <div class="medbot-panel" data-panel="claim">
          <label class="medbot-toggle-row" style="margin-bottom:0">
            <div>
              <div class="medbot-toggle-label">Auto Claim Wishes</div>
              <div class="medbot-toggle-sub">Claim characters wished by @you when they appear</div>
            </div>
            <label class="medbot-switch">
              <input id="medbot-autoclaim-wishes" type="checkbox" ${autoClaimWishes ? 'checked' : ''}>
              <span class="medbot-switch-track"></span><span class="medbot-switch-thumb"></span>
            </label>
          </label>

          <div class="medbot-or-divider">and/or</div>

          <div class="medbot-claim-section">
            <div class="medbot-claim-section-label">
              <img src="${KAKERA_BY_KEY.blue.url}" style="width:14px;height:14px;object-fit:contain;flex-shrink:0">
              Auto claim by Kakera Range
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <input id="medbot-claim-min" class="medbot-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="Min" style="flex:1" value="${autoClaimMinKakera || ''}" ${autoClaimMinKakera && autoClaimMaxKakera ? 'disabled' : ''}>
              <span style="color:var(--mb-text-dim);font-family:var(--mb-font-mono);font-size:13px;flex-shrink:0">–</span>
              <input id="medbot-claim-max" class="medbot-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="Max" style="flex:1" value="${autoClaimMaxKakera || ''}" ${autoClaimMinKakera && autoClaimMaxKakera ? 'disabled' : ''}>
              <button id="medbot-claim-set" class="medbot-btn medbot-btn-primary" style="flex-shrink:0;padding:0 12px;height:34px;font-size:12px;min-width:0" ${autoClaimMinKakera && autoClaimMaxKakera ? 'disabled' : ''}>Set</button>
              <button id="medbot-claim-clear" style="flex-shrink:0;padding:0 10px;height:34px;background:transparent;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:var(--mb-text-muted);font-size:16px;line-height:1;cursor:pointer;transition:all .15s" title="Clear range">×</button>
            </div>
          </div>

          <div class="medbot-or-divider">and/or</div>

          <div class="medbot-claim-section">
            <div class="medbot-claim-section-label">Auto claim by Series</div>
            <div style="display:flex;gap:8px;align-items:center">
              <input id="medbot-claim-series" class="medbot-input" type="text" autocomplete="off" spellcheck="false" placeholder="e.g. Shokugeki no Souma" style="flex:1" value="${autoClaimSeries || ''}" ${autoClaimSeries ? 'disabled' : ''}>
              <button id="medbot-series-set" class="medbot-btn medbot-btn-primary" style="flex-shrink:0;padding:0 12px;height:34px;font-size:12px;min-width:0" ${autoClaimSeries ? 'disabled' : ''}>Set</button>
              <button id="medbot-series-clear" style="flex-shrink:0;padding:0 10px;height:34px;background:transparent;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:var(--mb-text-muted);font-size:16px;line-height:1;cursor:pointer;transition:all .15s" title="Clear series">×</button>
            </div>
          </div>

          <p class="medbot-claim-note">WIP, more coming soon.</p>
        </div>

        <div class="medbot-panel" data-panel="settings">
          <div id="medbot-channel-info" class="medbot-tu-status"></div>
          <div id="medbot-tu-status" class="medbot-tu-status"></div>
          <div class="medbot-mini-note" style="margin-top:0;margin-bottom:14px">
            Clicking <strong style="color:var(--mb-accent)">Configure</strong> sends $tu and syncs status for the current server. (saved across servers)
          </div>
          <button class="medbot-btn medbot-btn-secondary" id="medbot-configure-tu" style="width:100%">Configure</button>
        </div>

        <div class="medbot-actions">
          <div class="medbot-actions-left">
            ${isRunning ? '<button class="medbot-btn medbot-btn-danger" id="medbot-stop">Stop</button>' : ''}
          </div>
          <button class="medbot-btn medbot-btn-ghost" id="medbot-cancel">Cancel</button>
          <button class="medbot-btn medbot-btn-secondary" id="medbot-save" style="display:none">Save</button>
          <button class="medbot-btn medbot-btn-primary" id="medbot-start">${isRunning ? 'Restart' : 'Start'}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    const qs = s => backdrop.querySelector(s);
    const countInput = qs('#medbot-count'), infiniteChk = qs('#medbot-infinite');
    const autoKakeraChk = qs('#medbot-auto-kakera'), autoClaimWishesChk = qs('#medbot-autoclaim-wishes');
    const claimMinInput = qs('#medbot-claim-min'), claimMaxInput = qs('#medbot-claim-max'), claimSeriesInput = qs('#medbot-claim-series');
    const saveBtn = qs('#medbot-save'), startBtn = qs('#medbot-start'), actLeft = qs('.medbot-actions-left');
    const kakeraChecks = [...backdrop.querySelectorAll('[data-kakera-key]')];
    const tabs = [...backdrop.querySelectorAll('.medbot-tab')], panels = [...backdrop.querySelectorAll('.medbot-panel')];

    // sliding tab indicator
    const indicator = qs('.medbot-tab-indicator');
    function positionIndicator(tab) {
      if (!indicator || !tab) return;
      indicator.style.left  = `${tab.offsetLeft}px`;
      indicator.style.width = `${tab.offsetWidth}px`;
    }
    // wait a frame so layout is ready
    requestAnimationFrame(() => positionIndicator(qs('.medbot-tab.active')));

    function syncFooter(tabName) {
      const onSend     = tabName === 'send';
      const onSettings = tabName === 'settings';
      if (saveBtn)  saveBtn.style.display  = (onSend || onSettings || tabName === 'extra' || tabName === 'claim') ? 'none' : '';
      if (startBtn) startBtn.style.display = onSend ? '' : 'none';
      if (actLeft)  actLeft.style.display  = onSend ? '' : 'none';
    }

    tabs.forEach(tab => tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      panels.forEach(p => p.classList.toggle('active', p.dataset.panel === name));
      positionIndicator(tab);
      syncFooter(name);
      if (name === 'settings') {
        renderChannelInfo(backdrop.querySelector('#medbot-channel-info'));
        renderTuStatus(backdrop.querySelector('#medbot-tu-status'));
      }
    }));
    syncFooter('send');

    const switchToSettingsTab = () => {
      const settingsTab = backdrop.querySelector('.medbot-tab[data-tab="settings"]');
      if (settingsTab) settingsTab.click();
    };

    const rollCmdSelect = qs('#medbot-roll-cmd');
    rollCmdSelect.addEventListener('change', () => {
      selectedRollCommand = rollCmdSelect.value;
      saveSettings();
    });

    const syncCount = () => { const on = infiniteChk.checked; countInput.disabled = on; countInput.style.opacity = on ? '0.35' : '1'; };
    infiniteChk.addEventListener('change', syncCount); syncCount();
    [countInput, claimMinInput, claimMaxInput].forEach(inp =>
      inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, ''); }));

    const claimSetBtn   = qs('#medbot-claim-set');
    const claimClearBtn = qs('#medbot-claim-clear');
    const seriesSetBtn  = qs('#medbot-series-set');
    const seriesClearBtn = qs('#medbot-series-clear');

    const syncRangeDisabled = (locked) => {
      claimMinInput.disabled = locked;
      claimMaxInput.disabled = locked;
      claimSetBtn.disabled   = locked;
      claimMinInput.style.opacity = locked ? '0.5' : '1';
      claimMaxInput.style.opacity = locked ? '0.5' : '1';
    };
    const syncSeriesDisabled = (locked) => {
      claimSeriesInput.disabled = locked;
      seriesSetBtn.disabled     = locked;
      claimSeriesInput.style.opacity = locked ? '0.5' : '1';
    };

    claimSetBtn.addEventListener('click', () => {
      if (!tuData.lastUpdated) { switchToSettingsTab(); return; }
      const min = Number(claimMinInput.value.trim()) || 0;
      const max = Number(claimMaxInput.value.trim()) || 0;
      if (!min || !max || min > max) return;
      autoClaimMinKakera = min; autoClaimMaxKakera = max;
      saveSettings(); syncRangeDisabled(true);
    });
    claimClearBtn.addEventListener('click', () => {
      claimMinInput.value = ''; claimMaxInput.value = '';
      autoClaimMinKakera = 0; autoClaimMaxKakera = 0;
      saveSettings(); syncRangeDisabled(false);
    });

    seriesSetBtn.addEventListener('click', () => {
      if (!tuData.lastUpdated) { switchToSettingsTab(); return; }
      const val = claimSeriesInput.value.trim();
      if (!val) return;
      autoClaimSeries = val;
      saveSettings(); syncSeriesDisabled(true);
    });
    seriesClearBtn.addEventListener('click', () => {
      claimSeriesInput.value = '';
      autoClaimSeries = '';
      saveSettings(); syncSeriesDisabled(false);
    });

    autoClaimWishesChk.addEventListener('change', () => {
      if (autoClaimWishesChk.checked && !tuData.lastUpdated) {
        autoClaimWishesChk.checked = false;
        switchToSettingsTab();
        return;
      }
      autoClaimWishes = autoClaimWishesChk.checked;
      saveSettings();
    });
    backdrop.querySelectorAll('.medbot-kakera-row').forEach(row =>
      row.addEventListener('change', () => row.classList.toggle('selected', row.querySelector('input').checked))
    );

    autoKakeraChk.addEventListener('change', () => {
      if (autoKakeraChk.checked && !tuData.lastUpdated) {
        autoKakeraChk.checked = false;
        switchToSettingsTab();
      }
    });

    backdrop.querySelectorAll('.medbot-mult-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const game = btn.dataset.game;
        const dir  = Number(btn.dataset.dir);
        mult[game] = Math.max(1, Math.min(10, mult[game] + dir));
        const val = mult[game];
        const display = backdrop.querySelector(`#medbot-${game}-mult`);
        if (display) display.textContent = `${val}x`;
        const ctrl = btn.closest('.medbot-multiplier-control');
        ctrl.querySelector('[data-dir="-1"]').disabled = val <= 1;
        ctrl.querySelector('[data-dir="1"]').disabled  = val >= 10;
      });
    });

    const applyAndSave = () => {
      autoKakeraEnabled  = autoKakeraChk.checked;
      selectedKakeraKeys = new Set(kakeraChecks.filter(el => el.checked).map(el => el.dataset.kakeraKey));
      autoClaimWishes    = autoClaimWishesChk.checked;
      saveSettings();
    };

    backdrop.querySelector('#medbot-save').addEventListener('click',  () => { applyAndSave(); closeMedBotModal(); });
    backdrop.querySelector('#medbot-cancel').addEventListener('click', closeMedBotModal);
    backdrop.querySelector('#medbot-stop')?.addEventListener('click', () => { stopMedBot(); closeMedBotModal(); });
    backdrop.querySelector('#medbot-start').addEventListener('click', () => {
      if (!tuData.lastUpdated) {
        switchToSettingsTab();
        return;
      }
      applyAndSave();
      const infinite = infiniteChk.checked;
      const count    = Number(countInput.value.trim());
      if (!infinite && (!count || !Number.isInteger(count) || count < 1)) {
        alert('Enter a number greater than 0, or enable infinite mode.');
        return;
      }
      startMedBot(count, infinite);
      closeMedBotModal();
    });

    [[runAutoOh,'oh'],[runAutoOc,'oc'],[runAutoOq,'oq'],[runAutoOt,'ot']].forEach(([runFn, gameId]) =>
      qs(`#medbot-${gameId}`)?.addEventListener('click', () => { closeMedBotModal(); runFn(); }));

    const configureBtn = backdrop.querySelector('#medbot-configure-tu');
    configureBtn?.addEventListener('click', () => {
      awaitingTuResponse = true;
      sendRawCommand('$tu');
      configureBtn.textContent = 'Sent — waiting for reply…'; configureBtn.disabled = true;
      setTimeout(() => { configureBtn.textContent = 'Configure'; configureBtn.disabled = false; }, 8000);
    });

    const tuInterval = setInterval(() => {
      if (!document.contains(backdrop)) { clearInterval(tuInterval); return; }
      const container = backdrop.querySelector('#medbot-tu-status');
      if (container?.closest('[data-panel="settings"].active')) renderTuStatus(container);
    }, 1000);

    let _downOnBackdrop = false;
    backdrop.addEventListener('mousedown', e => { _downOnBackdrop = e.target === backdrop; });
    backdrop.addEventListener('mouseup', e => {
      if (_downOnBackdrop && e.target === backdrop) closeMedBotModal();
      _downOnBackdrop = false;
    });
    setTimeout(() => countInput.focus(), 10);
  }

  // Boot

  window.addEventListener('keydown', e => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'm') {
      e.preventDefault(); e.stopPropagation(); openMedBotModal();
    }
  }, true);

  loadSettings();
  injectStyles();
  observeMenus();
  startBootObserver();

  let _tick = 0;
  setInterval(() => {
    _tick++;
    // update placeholder text and track server changes (runs every 700ms)
    const ph = getPlaceholder();
    if (ph && !ph.getAttribute('data-medbot-original')) ph.setAttribute('data-medbot-original', ph.textContent || '');
    updateVisuals(ph);
    const sid = getCurrentChannelInfo()?.serverId || null;
    if (sid && sid !== currentServerId) { currentServerId = sid; loadTuData(); }
    // Channel lock guard (every 2 ticks)
    if (_tick % 2 === 0 && isRunning && channelLockEnabled && lockedChannelId) {
      if (waitingForMudae && !isOnLockedChannel()) {
        waitingForMudae = false; clearTimers();
        channelPaused = true;
        nextSendTimer = setTimeout(doNextSend, 1500);
        updateVisuals();
      }
    }
    // Timer expiry (every 14 ticks)
    if (_tick % 14 === 0) expireTimers();
  }, 700);

  console.log('[MedBot UI] Loaded v3.0');
})();
