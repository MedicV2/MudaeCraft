// ==UserScript==
// @name         MedBot
// @author       @medc
// @version      3.1
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

  // ===================================================================
  //  SECTION 1,  CONSTANTS & CONFIGURATION
  //  Branding assets, timing values, Mudae kakera definitions, and
  //  roll command variants.
  // ===================================================================

  // -- Branding --
  const MEDBOT_GIF_URL = 'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExZWc4aWpiM3E0NWt0ZGFjbG04aWhvbTE1YzJuMjhucXN3ODhzeXM5dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/bXufANMxyrNihW1iTv/giphy.gif';
  let cachedGifBlobUrl = null; // object URL created once from the fetched GIF

  // -- Timing --
  const ROLL_DELAY_MIN_MS    = 1500;            // minimum ms between roll commands
  const ROLL_DELAY_MAX_MS    = 2000;            // maximum ms between roll commands
  const STALL_TIMEOUT_MS     = 10000;           // resume if no Mudae reply within this time
  const MESSAGE_CACHE_TTL_MS = 5 * 60 * 1000;   // 5-minute TTL for deduplication cache

  // Discord renders message elements progressively, so we re-scan at
  // staggered intervals to catch buttons that appear after the initial DOM insert.
  const KAKERA_SCAN_DELAYS = [0, 150, 400, 900, 1800];
  const CLAIM_SCAN_DELAYS  = [0, 300, 800, 1800];

  // -- Mudae Kakera Type Definitions --
  // Each entry maps a key to Discord custom emoji URL
  const KAKERA_TYPES = [
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

  // Lookup maps derived from KAKERA_TYPES
  const KAKERA_URL_TO_KEY = new Map(KAKERA_TYPES.map(k => [normalizeUrl(k.url), k.key]));
  const KAKERA_BY_KEY     = Object.fromEntries(KAKERA_TYPES.map(k => [k.key, k]));

  // Every valid roll command variant recognised by Mudae
  const MUDAE_ROLL_COMMANDS = new Set([
    '$husbando', '$h', '$hx', '$husbandoa', '$ha', '$husbandog', '$hg',
    '$waifu',    '$w', '$wx', '$waifua',    '$wa', '$waifug',    '$wg',
    '$marry',    '$m', '$mx', '$marrya',    '$ma', '$marryg',    '$mg',
  ]);

  // Subset shown in the modal dropdown selector
  const ROLL_DROPDOWN_OPTIONS = ['$w', '$wa', '$wg', '$h', '$ha', '$hg', '$m', '$ma', '$mg'];


  // ===================================================================
  //  SECTION 2,  PERSISTENT SETTINGS
  //  Values saved via GM_setValue / GM_getValue that survive across
  //  browser sessions and page reloads.
  // ===================================================================

  // -- Kakera settings --
  let autoKakeraEnabled   = false;
  let selectedKakeraTypes = new Set();    // which kakera colours to auto-click

  // -- Claim settings --
  let autoClaimWishes     = false;
  let autoClaimMinKakera  = 0;
  let autoClaimMaxKakera  = 0;
  let autoClaimSeries     = '';

  // -- Roll setting --
  let selectedRollCommand = '$wa';

  // -- Channel lock settings --
  let channelLockEnabled  = false;
  let lockedChannelId     = null;
  let lockedServerId      = null;
  let lockedChannelName   = '';
  let lockedServerName    = '';

  // Load all persisted settings from Tampermonkey storage.
  function loadSettings() {
    try {
      autoKakeraEnabled   = !!GM_getValue('medbot.autoKakeraEnabled', false);
      const savedKakera   = GM_getValue('medbot.selectedKakeraKeys', []);
      selectedKakeraTypes = new Set(Array.isArray(savedKakera) ? savedKakera : []);
      autoClaimWishes     = !!GM_getValue('medbot.autoClaimWishes', false);
      autoClaimMinKakera  = Number(GM_getValue('medbot.autoClaimMinKakera', 0)) || 0;
      autoClaimMaxKakera  = Number(GM_getValue('medbot.autoClaimMaxKakera', 0)) || 0;
      autoClaimSeries     = GM_getValue('medbot.autoClaimSeries', '') || '';
      selectedRollCommand = GM_getValue('medbot.selectedRollCommand', '$wa') || '$wa';
      channelLockEnabled  = !!GM_getValue('medbot.channelLockEnabled', false);
      lockedChannelId     = GM_getValue('medbot.lockedChannelId',   null) || null;
      lockedServerId      = GM_getValue('medbot.lockedServerId',    null) || null;
      lockedChannelName   = GM_getValue('medbot.lockedChannelName', '')   || '';
      lockedServerName    = GM_getValue('medbot.lockedServerName',  '')   || '';
    } catch {
      // Reset to safe defaults if storage is corrupted
      autoKakeraEnabled = false;
      selectedKakeraTypes = new Set();
      autoClaimWishes = false;
      autoClaimMinKakera = autoClaimMaxKakera = 0;
      autoClaimSeries = '';
      selectedRollCommand = '$wa';
      channelLockEnabled = false;
      lockedChannelId = lockedServerId = null;
      lockedChannelName = lockedServerName = '';
    }
  }

  // Persist all current settings to Tampermonkey storage.
  function saveSettings() {
    try {
      GM_setValue('medbot.autoKakeraEnabled',  autoKakeraEnabled);
      GM_setValue('medbot.selectedKakeraKeys', [...selectedKakeraTypes]);
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
    } catch { /* storage write failed,  non-critical */ }
  }

  // -- Mudae Status ($tu data), stored per Discord server --
  // Tracks claim availability, roll count, and $rt cooldown timestamps.
  let currentServerId = null;

  let mudaeStatus = {
    claimAvailable: null,   // true = can claim | false = on cooldown | null = unknown
    claimResetAt:   0,      // epoch ms when claim becomes available
    rollsLeft:      null,   // remaining rolls this period
    rollsMax:       null,   // max rolls (inferred from highest observed value)
    rollsResetAt:   0,      // epoch ms when rolls reset
    rtAvailable:    null,   // $rt availability (true/false/null)
    rtResetAt:      0,      // epoch ms when $rt becomes available
    lastUpdated:    0,      // epoch ms when this data was last synced
  };

  // Load $tu status data for the current server from Tampermonkey storage.
  function loadMudaeStatus() {
    try {
      if (!currentServerId) {
        mudaeStatus.claimAvailable = null; mudaeStatus.claimResetAt = 0;
        mudaeStatus.rollsLeft = null; mudaeStatus.rollsMax = null; mudaeStatus.rollsResetAt = 0;
        mudaeStatus.rtAvailable = null; mudaeStatus.rtResetAt = 0; mudaeStatus.lastUpdated = 0;
        return;
      }
      const allServers = JSON.parse(GM_getValue('medbot.tuServers', 'null')) || {};
      const serverData = allServers[currentServerId] || {};
      mudaeStatus.claimAvailable = serverData.claimAvailable ?? null;
      mudaeStatus.claimResetAt   = Number(serverData.claimResetAt) || 0;
      mudaeStatus.rollsLeft      = serverData.rollsLeft ?? null;
      mudaeStatus.rollsMax       = serverData.rollsMax ?? null;
      mudaeStatus.rollsResetAt   = Number(serverData.rollsResetAt) || 0;
      mudaeStatus.rtAvailable    = serverData.rtAvailable ?? null;
      mudaeStatus.rtResetAt      = Number(serverData.rtResetAt) || 0;
      mudaeStatus.lastUpdated    = Number(serverData.lastUpdated) || 0;
    } catch {}
  }

  // Persist $tu status data for the current server. 
  function saveMudaeStatus() {
    try {
      if (!currentServerId) return;
      const allServers = JSON.parse(GM_getValue('medbot.tuServers', 'null')) || {};
      allServers[currentServerId] = {
        claimAvailable: mudaeStatus.claimAvailable,
        claimResetAt:   mudaeStatus.claimResetAt,
        rollsLeft:      mudaeStatus.rollsLeft,
        rollsMax:       mudaeStatus.rollsMax,
        rollsResetAt:   mudaeStatus.rollsResetAt,
        rtAvailable:    mudaeStatus.rtAvailable,
        rtResetAt:      mudaeStatus.rtResetAt,
        lastUpdated:    mudaeStatus.lastUpdated,
      };
      GM_setValue('medbot.tuServers', JSON.stringify(allServers));
    } catch {}
  }


  // ===================================================================
  //  SECTION 3,  RUNTIME STATE
  //  Values that only live for the current session.
  // ===================================================================

  let botIsRunning           = false;   // is the auto-roll loop active?
  let infiniteModeEnabled    = false;   // keep rolling indefinitely (uses $us for rollcap recovery)
  let rollsRemaining         = 0;       // rolls left in a finite run
  let isWaitingForMudaeReply = false;   // true after sending a roll, until Mudae responds
  let nextRollTimer          = null;    // setTimeout ID for the next roll command
  let stallTimeoutTimer      = null;    // setTimeout ID for the stall guard
  let recoveryInProgress     = false;   // true while running rollcap recovery ($us)
  let pendingBotRollCount    = 0;       // rolls sent by bot not yet matched to own-message detection
  let activeGame             = null;    // currently running minigame name ('oh','oc','oq','ot') or null
  let channelPaused          = false;   // true when bot is paused due to wrong channel
  let isWaitingForTuReply    = false;   // true after sending $tu, waiting for Mudae's response

  // Game multipliers for sphere minigames ($oh, $oc, $oq, $ot)
  const gameMultipliers = { oh: 1, oc: 1, oq: 1, ot: 1 };


  // ===================================================================
  //  SECTION 4,  MESSAGE DEDUPLICATION CACHE
  //  Prevents processing the same Discord message twice. Each entry
  //  has a TTL and tracks which action types have been applied.
  // ===================================================================

  const messageDedupeCache = new Map();
  let lastCacheCleanupTime = 0;

  /**
   * Check if a message ID has already been processed for a given action type.
   * Registers the message if it hasn't been seen, or adds the new type.
   * @param {string} msgId   - Discord message ID
   * @param {string} [type]  - action type ('kakera', 'claim', etc.) or null for general
   * @returns {boolean} true if this message+type was already processed
   */
  function isMessageProcessed(msgId, type = null) {
    const now = Date.now();

    // Purge expired entries at most once per 30 seconds
    if (now - lastCacheCleanupTime > 30000) {
      lastCacheCleanupTime = now;
      for (const [id, entry] of messageDedupeCache) {
        if (entry.expiry <= now) messageDedupeCache.delete(id);
      }
    }

    // First time seeing this message
    if (!messageDedupeCache.has(msgId)) {
      const types = type ? new Set([type]) : new Set();
      messageDedupeCache.set(msgId, { expiry: now + MESSAGE_CACHE_TTL_MS, types });
      return false;
    }

    // Message exists,  check if this specific type was already handled
    const entry = messageDedupeCache.get(msgId);
    if (type) {
      if (entry.types.has(type)) return true;
      entry.types.add(type);
      entry.expiry = now + MESSAGE_CACHE_TTL_MS; // refresh TTL
      return false;
    }
    return true;
  }



  // ===================================================================
  //  SECTION 5,  UTILITY FUNCTIONS
  // ===================================================================

  // Strip query params from a URL so emoji URLs can be compared reliably.
  function normalizeUrl(url) {
    try {
      const parsed = new URL(url, location.origin);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return (url || '').split('?')[0];
    }
  }

  // Return a random integer between min and max (inclusive).
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Escape special regex characters in a string for use in RegExp.
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Promise-based delay.
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));


  // ===================================================================
  //  SECTION 6,  DISCORD DOM HELPERS
  //  Functions that query Discord's DOM to find chat elements, read
  //  message content, and identify Mudae bot messages.
  // ===================================================================

  // -- Chat input --

  // Find Discord's Slate editor (the message input box).
  const getChatInput = () =>
    document.querySelector('[data-slate-editor="true"],[role="textbox"][contenteditable="true"]');

  // -- Message list --

  // Find the scrollable message list (<ol>) for the current channel.
  const getMessageList = () =>
    document.querySelector(
      'ol[data-list-id="chat-messages"],' +
      '[role="list"][data-list-id="chat-messages"],' +
      'ol[aria-label^="Messages in "]'
    );

  // -- Mudae identification --

  // WeakMap cache so we don't re-scan the same element's username repeatedly.
  const mudaeMessageCache = new WeakMap();

  // Check if a message article element was sent by the Mudae bot.
  const isMudaeMessage = (msgEl) => {
    if (mudaeMessageCache.has(msgEl)) return mudaeMessageCache.get(msgEl);
    const isMudae = [...msgEl.querySelectorAll('[id^="message-username-"],[class*="username"]')]
      .some(node => node.textContent.trim().startsWith('Mudae'));
    mudaeMessageCache.set(msgEl, isMudae);
    return isMudae;
  };

  // -- Message content extraction --

  // Get the visible text content of a message.
  const getMessageText = (msgEl) =>
    (msgEl.querySelector('[id^="message-content-"],[class*="messageContent"]')?.innerText || '').trim();

  // Get the timestamp (epoch ms) of a message from its <time> element.
  const getMessageTimestamp = (msgEl) => {
    const timeEl = msgEl.querySelector('time[datetime]');
    return timeEl ? new Date(timeEl.getAttribute('datetime')).getTime() : null;
  };

  // -- Attachment menu --

  // Find the currently open channel-actions / attachment menu, if any.
  const getAttachmentMenu = () =>
    [...document.querySelectorAll('[role="menu"]')]
      .find(m => /channel actions|attachment/i.test(m.getAttribute('aria-label') || '')) || null;

  // -- Placeholder text --

  // Find the "Message #channel" placeholder element inside the chat input area.
  function getPlaceholder() {
    const editor = getChatInput();
    const parent = editor?.closest('[class*="channelTextArea"],[class*="textArea"],[class*="editor"]')
      || editor?.parentElement;
    return parent?.querySelector('[aria-hidden="true"]')
      || document.querySelector(
        '[aria-hidden="true"][data-slate-placeholder="true"],' +
        '[aria-hidden="true"][class*="placeholder"]'
      );
  }

  // -- User identity --

  /** Get the current user's Discord handle (e.g. "username#1234" or display name).
   *  Used to match Mudae's rollcap messages which address the user by handle. */
  function getOwnHandle() {
    return document.querySelector('[class*="panelSubtextContainer"] [class*="hovered"]')
      ?.textContent?.trim() || 'Unknown';
  }

  /** Get the current user's Discord username (without discriminator).
   *  Used for matching wish pings and tracking the user's own sent messages. */
  function getOwnUsername() {
    const el = document.querySelector('[data-username-with-effects]');
    return el?.getAttribute('data-username-with-effects') || el?.textContent?.trim() || 'Unknown';
  }

  // -- Message ID extraction --

  // Extract the numeric Discord message ID from an article element.
  function getMsgId(msgEl) {
    const contentEl = msgEl?.querySelector('[id^="message-content-"]');
    if (!contentEl) return null;
    const match = contentEl.id.match(/message-content-(\d+)/);
    return match ? match[1] : null;
  }

  // -- Sphere minigame helpers --

  // Get the emoji dataset ID from a game button (used in $oh/$oc/$oq/$ot).
  const getSphereEmojiId = (btn) => btn.querySelector('img.emoji')?.dataset?.id || null;

  // Get all game buttons from a Mudae message's accessories section.
  const getGameButtons = (msgEl) =>
    [...(msgEl.querySelector('[id^="message-accessories-"]')?.querySelectorAll('button') || [])];

  // -- Channel & server identification --

  // Check if the user is currently viewing the locked channel.
  function isOnLockedChannel() {
    if (!channelLockEnabled || !lockedChannelId) return true;
    const info = getCurrentChannelInfo();
    return !!(info && info.channelId === lockedChannelId && info.serverId === lockedServerId);
  }

  // Read the current channel name, ID, server name, and server ID from Discord's sidebar.
  function getCurrentChannelInfo() {
    const selectedLink = document.querySelector('li[class*="selected_"] a[aria-current="page"]')
      || document.querySelector('li[class*="selected_"] a[data-list-item-id^="channels___"]');
    if (!selectedLink) return null;

    // Extract channel name from the link's label
    const channelName = selectedLink.querySelector('[class*="name__"]')?.textContent.trim()
      || (selectedLink.getAttribute('aria-label') || '')
        .replace(/\s*\(.*?\)\s*$/, '')
        .replace(/^(?:[^,]+,\s+)+/, '')
        .trim() || '';

    // Parse server and channel IDs from the href (/channels/{serverId}/{channelId})
    const href  = selectedLink.getAttribute('href') || '';
    const match = href.match(/\/channels\/(\d+)\/(\d+)/);
    if (!match) return { channelName, channelId: null, serverName: null, serverId: null };

    const serverId  = match[1];
    const channelId = match[2];

    // Look up the server name from the guild navigation sidebar
    const guildItem  = document.querySelector(`[data-list-item-id="guildsnav___${serverId}"]`);
    const serverName = guildItem?.closest('[class*="listItem"]')
        ?.querySelector('[class*="guildNameText"]')?.textContent.trim()
      || guildItem?.querySelector('[class*="hiddenVisually"]')?.textContent.trim()
        .replace(/^[\d\w\s]+,\s+/, '') || null;

    return { channelName, channelId, serverName, serverId };
  }


  // ===================================================================
  //  SECTION 7,  DISCORD MESSAGE SENDING
  //  Injects text into Discord's Slate editor and simulates Enter to
  //  send. Uses paste for reliability, with execCommand fallback.
  // ===================================================================

  /**
   * Type a command into Discord's chat input and press Enter to send it.
   * @param {string} command - The text to send (e.g. "$wa", "$tu")
   * @returns {boolean} true if the input was found and the command was injected
   */
  function sendDiscordMessage(command) {
    const input = getChatInput();
    if (!input) return false;

    // Focus and select all existing text
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true, cancelable: true, key: 'a', code: 'KeyA', keyCode: 65, ctrlKey: true,
    }));

    // Attempt to paste the command text (most reliable method for Slate)
    let pasteSucceeded = false;
    try {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', command);
      pasteSucceeded = input.dispatchEvent(new ClipboardEvent('paste', {
        bubbles: true, cancelable: true, clipboardData: dataTransfer,
      }));
    } catch { /* paste failed,  fall through to execCommand */ }

    // Fallback: use deprecated execCommand if paste didn't work
    if (!pasteSucceeded) {
      try { document.execCommand('selectAll', false); } catch { /* ignore */ }
      try { document.execCommand('insertText', false, command); } catch { /* ignore */ }
    }

    // Press Enter after a short delay to send, then clear any leftover text
    setTimeout(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13,
      }));
      // Safety cleanup: select all + delete to clear any residual text
      setTimeout(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true, cancelable: true, key: 'a', code: 'KeyA', keyCode: 65, ctrlKey: true,
        }));
        input.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true, cancelable: true, key: 'Delete', code: 'Delete', keyCode: 46,
        }));
      }, 100);
    }, 60);

    return true;
  }



  // ===================================================================
  //  SECTION 8,  ROLL LOOP
  //  Controls the auto-roll lifecycle: scheduling rolls, waiting for
  //  Mudae responses, handling stalls, and starting/stopping the bot.
  // ===================================================================

  // Cancel both the next-roll and stall-guard timers.
  function clearTimers() {
    clearTimeout(nextRollTimer);     nextRollTimer     = null;
    clearTimeout(stallTimeoutTimer); stallTimeoutTimer  = null;
  }

  // Schedule the next roll command after a randomised delay.
  function scheduleNextRoll() {
    if (!botIsRunning || recoveryInProgress) return;
    clearTimers();
    nextRollTimer = setTimeout(() => {
      nextRollTimer = null;
      executeNextRoll();
    }, randomInt(ROLL_DELAY_MIN_MS, ROLL_DELAY_MAX_MS));
  }

  // Send the next roll command, manage counters, and arm the stall guard.
  function executeNextRoll() {
    if (!botIsRunning || recoveryInProgress) return;

    // Require $tu data,  the user must configure at least once per server
    if (!mudaeStatus.lastUpdated) {
      stopMedBot();
      console.warn('[MedBot] Stopped,  run Configure ($tu) for this server first');
      return;
    }

    // If channel lock is active and user navigated away, pause instead of sending
    if (!isOnLockedChannel()) {
      channelPaused = true;
      nextRollTimer = setTimeout(executeNextRoll, 1500);
      updateVisuals();
      return;
    }
    channelPaused = false;

    // Check if we've exhausted our roll count (finite mode only)
    if (!infiniteModeEnabled && rollsRemaining <= 0) { stopMedBot(); return; }

    // Send the roll command
    if (!sendDiscordMessage(selectedRollCommand)) return;
    pendingBotRollCount++;

    // Decrement local roll tracker
    if (mudaeStatus.rollsLeft !== null) {
      mudaeStatus.rollsLeft = Math.max(0, mudaeStatus.rollsLeft - 1);
      saveMudaeStatus();
    }

    // Finite mode: decrement remaining count
    if (!infiniteModeEnabled) {
      rollsRemaining--;
      if (rollsRemaining <= 0) {
        // Wait 5s for last Mudae reply before stopping
        nextRollTimer = setTimeout(stopMedBot, 5000);
        updateVisuals();
        return;
      }
    }

    isWaitingForMudaeReply = true;
    updateVisuals();

    // Stall guard: if Mudae doesn't respond within the timeout, continue anyway
    if (infiniteModeEnabled) {
      stallTimeoutTimer = setTimeout(() => {
        if (!botIsRunning || !isWaitingForMudaeReply) return;
        console.log('[MedBot] No Mudae reply for 10s,  continuing');
        isWaitingForMudaeReply = false;
        scheduleNextRoll();
      }, STALL_TIMEOUT_MS);
    }
  }

  // Called when a Mudae response is detected,  clears the wait state and queues next roll.
  function onMudaeResponseReceived() {
    if (!botIsRunning || recoveryInProgress || !isWaitingForMudaeReply) return;
    isWaitingForMudaeReply = false;
    clearTimers();
    scheduleNextRoll();
  }

  // Fully stop the bot and reset all run state.
  function stopMedBot() {
    clearTimers();
    botIsRunning = false;
    infiniteModeEnabled = false;
    isWaitingForMudaeReply = false;
    rollsRemaining = 0;
    recoveryInProgress = false;
    pendingBotRollCount = 0;
    channelPaused = false;
    updateVisuals();
    console.log('[MedBot] Stopped');
  }

  /** Start the auto-roll loop.
   *  @param {number}  count    - number of rolls (ignored if infinite)
   *  @param {boolean} infinite - enable infinite mode */
  function startMedBot(count, infinite) {
    stopMedBot();  // clean slate
    infiniteModeEnabled = !!infinite;
    rollsRemaining      = count;
    botIsRunning        = true;
    console.log('[MedBot] Starting', { infiniteModeEnabled, rollsRemaining });
    executeNextRoll();
  }


  // ===================================================================
  //  SECTION 9,  VISUAL FEEDBACK
  //  Updates the Discord chat placeholder text to show the bot's
  //  current state (running, paused, waiting, etc.).
  // ===================================================================

  // Update the chat input styling and placeholder text to reflect bot state.
  function updateVisuals(placeholder) {
    const input = getChatInput();
    if (!input) return;
    if (!placeholder) placeholder = getPlaceholder();

    if (botIsRunning || activeGame) {
      // Apply subtle highlight to the input area
      input.style.background   = 'linear-gradient(135deg, rgba(88,101,242,0.10), rgba(88,101,242,0.04))';
      input.style.borderRadius = '8px';
      input.style.transition   = 'all 0.25s ease';

      if (placeholder) {
        placeholder.style.color      = 'var(--text-muted)';
        placeholder.style.fontSize   = '0.92rem';
        placeholder.style.fontWeight = '500';

        // Build status label based on current state
        const modeLabel = infiniteModeEnabled ? 'Infinite' : `${rollsRemaining} left`;

        if (activeGame)              placeholder.textContent = `MedBot • $${activeGame} in progress...`;
        else if (recoveryInProgress) placeholder.textContent = 'MedBot • Rollcap recovery...';
        else if (channelPaused)      placeholder.textContent = `MedBot • ${modeLabel} • paused (wrong channel)`;
        else if (isWaitingForMudaeReply) placeholder.textContent = `MedBot • ${modeLabel} • waiting for Mudae...`;
        else if (nextRollTimer)      placeholder.textContent = `MedBot • ${modeLabel} • sending soon...`;
        else                         placeholder.textContent = `MedBot • ${modeLabel}`;
      }
    } else {
      // Restore original input styling
      input.style.background = input.style.borderRadius = input.style.transition = '';
      if (placeholder) {
        placeholder.style.color = placeholder.style.fontSize = placeholder.style.fontWeight = '';
        placeholder.textContent = placeholder.getAttribute('data-medbot-original') || '';
      }
    }
  }


  // ===================================================================
  //  SECTION 10,  KAKERA AUTO-CLICKING
  //  Scans Mudae messages for kakera reaction buttons and clicks any
  //  that match the user's selected kakera types.
  // ===================================================================

  // Safely click a button element.
  function clickButton(btn) {
    try { btn.click(); } catch { console.log('[MedBot] Failed to click button', btn); }
  }

  // Scan a Mudae message for kakera buttons and click matching types.
  function clickMatchingKakera(msgEl) {
    if (!autoKakeraEnabled || !mudaeStatus.lastUpdated || !isMudaeMessage(msgEl)) return;

    const msgId = getMsgId(msgEl);
    if (!msgId || isMessageProcessed(msgId, 'kakera')) return;

    // Find all kakera buttons whose emoji URL matches a selected type
    const matchingButtons = [...msgEl.querySelectorAll('button')].filter(btn => {
      const emojiImg = btn.querySelector('img.emoji');
      return emojiImg
        && selectedKakeraTypes.has(KAKERA_URL_TO_KEY.get(normalizeUrl(emojiImg.src)))
        && btn.closest('[id^="message-accessories-"]');
    });

    if (!matchingButtons.length) return;
    matchingButtons.forEach(clickButton);
  }


  // ===================================================================
  //  SECTION 11,  ROLLCAP RECOVERY
  //  When Mudae tells the user they've hit the roll limit, the bot
  //  automatically sends "$us 20" five times to unlock more rolls,
  //  then resumes rolling.
  // ===================================================================

  // Detect a rollcap message and run $us recovery if in infinite mode.
  async function handleRollcapRecovery(msgEl) {
    if (!botIsRunning || !infiniteModeEnabled || recoveryInProgress || !isMudaeMessage(msgEl)) return;

    const handle = getOwnHandle();
    if (handle === 'Unknown') return;

    // Match: "username, the roulette is limited to X uses per hour. Y min left."
    const text  = getMessageText(msgEl);
    const match = text.match(
      new RegExp(`^${escapeRegExp(handle)}, the roulette is limited to (\\d+) uses per hour\\.\\s*(\\d+) min left\\.`, 'i')
    );
    if (!match) return;

    const msgId = getMsgId(msgEl);
    if (!msgId || isMessageProcessed(msgId)) return;

    // Enter recovery mode
    recoveryInProgress = true;
    isWaitingForMudaeReply = false;
    clearTimers();
    updateVisuals();

    console.log('[MedBot] Rollcap,  sending $us 20 x5');
    await sleep(1000);

    // Send "$us 20" five times with delays between each
    for (let i = 0; i < 5; i++) {
      sendDiscordMessage('$us 20');
      if (i < 4) await sleep(1500);
    }

    await sleep(1500);
    recoveryInProgress = false;
    updateVisuals();

    // Resume rolling if the bot is still active
    if (botIsRunning) executeNextRoll();
  }



  // ===================================================================
  //  SECTION 12,  SPHERE MINIGAMES: SHARED CONSTANTS & FRAMEWORK
  //  Emoji IDs for coloured spheres used across all four minigames
  //  ($oh, $oc, $oq, $ot), plus the generic game runner.
  // ===================================================================

  // Discord emoji IDs for the sphere colours used in Mudae minigames
  const SPHERE_ID = {
    qmark:   '1437140748423270441',
    purple:  '1437140625844867244',
    blue:    '1437140639987929108',
    teal:    '1437140651614535680',
    green:   '1437140664193126441',
    yellow:  '1437140677187338310',
    orange:  '1437140688608432185',
    red:     '1437140700604137554',
    black:   '1437140725492879471',
    white:   '1437140737459486780',
    rainbow: '1437140713795227809',
  };

  // Reverse lookup: emoji ID -> colour name
  const ID_TO_COLOR = Object.fromEntries(
    Object.entries(SPHERE_ID).map(([colour, emojiId]) => [emojiId, colour])
  );

  // Check whether a message still has clickable (non-disabled) game buttons.
  const hasActiveGameButtons = (msgEl) =>
    getGameButtons(msgEl).some(btn => !btn.hasAttribute('disabled'));

  /**
   * Poll for a Mudae game message containing `keyword` with active buttons.
   * Scans the last 8 messages in the chat list at 300ms intervals.
   */
  async function waitForGameMessage(keyword, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      await sleep(300);
      const list = getMessageList();
      if (!list) continue;
      const recentArticles = [...list.querySelectorAll('[role="article"]')].slice(-8).reverse();
      for (const msgEl of recentArticles) {
        if (!isMudaeMessage(msgEl)) continue;
        if (!getMessageText(msgEl).includes(keyword)) continue;
        if (!hasActiveGameButtons(msgEl)) continue;
        return msgEl;
      }
    }
    return null;
  }

  /**
   * Wait for a specific button's migration-pending state to clear,
   * indicating the click has been processed by Discord.
   */
  async function waitForButtonProcessed(msgEl, buttonIndex, timeout = 8000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const btn = getGameButtons(msgEl)[buttonIndex];
      if (!btn || !btn.hasAttribute('data-migration-pending')) break;
      await sleep(100);
    }
    await sleep(500); // brief cooldown before next action
  }

  /**
   * Generic minigame runner. Sends the game command, waits for Mudae's
   * response, then delegates to the game-specific logic function.
   * @param {string}   gameName   - short name ('oh','oc','oq','ot')
   * @param {string}   keyword    - text to look for in Mudae's response
   * @param {number}   multiplier - how many rounds to play (1-10)
   * @param {Function} gameLogic  - async function(msgEl) with the game strategy
   */
  async function runGame(gameName, keyword, multiplier, gameLogic) {
    if (activeGame) return;
    activeGame = gameName;
    updateVisuals();

    sendDiscordMessage(multiplier > 1 ? `$${gameName} ${multiplier}` : `$${gameName}`);

    const msgEl = await waitForGameMessage(keyword);
    if (!msgEl) {
      console.warn(`[MedBot] $${gameName}: no response found`);
      activeGame = null;
      updateVisuals();
      return;
    }

    await sleep(1000);
    await gameLogic(msgEl);

    activeGame = null;
    updateVisuals();
    console.log(`[MedBot] $${gameName} complete`);
  }


  // ===================================================================
  //  SECTION 13,  AUTO $oh (SPHERE HUNT)
  //  Strategy: always click purple (free), then highest-value revealed
  //  spheres, then gamble on unknowns when clicks are running low.
  // ===================================================================

  // Point values for sphere colours,  higher = more valuable to click
  const SPHERE_VALUE = {
    [SPHERE_ID.rainbow]: 10, [SPHERE_ID.red]:    9, [SPHERE_ID.black]:  8,
    [SPHERE_ID.white]:   7,  [SPHERE_ID.orange]: 6, [SPHERE_ID.yellow]: 5,
    [SPHERE_ID.green]:   4,  [SPHERE_ID.teal]:   3, [SPHERE_ID.blue]:   2,
    [SPHERE_ID.purple]:  1,  [SPHERE_ID.qmark]:  0,
  };

  /**
   * Choose the best button index to click in $oh.
   * Priority: purple (free) -> highest value revealed -> unknowns/low-value when few clicks left.
   */
  function pickOhButtonIndex(buttons, alreadyClicked, clicksLeft) {
    let purpleIdx = -1, blueIdx = -1, tealIdx = -1;
    let bestValueIdx = -1, bestValueScore = -1;
    const unknownIndices = [];

    for (let i = 0; i < buttons.length; i++) {
      if (alreadyClicked.has(i)) continue;
      const emojiId = getSphereEmojiId(buttons[i]);
      const value   = SPHERE_VALUE[emojiId] ?? -1;
      if (value < 0) continue;

      if (emojiId === SPHERE_ID.purple)  { purpleIdx = i; continue; }
      if (emojiId === SPHERE_ID.qmark)   { unknownIndices.push(i); continue; }
      if (emojiId === SPHERE_ID.blue)    { if (blueIdx === -1) blueIdx = i; continue; }
      if (emojiId === SPHERE_ID.teal)    { if (tealIdx === -1) tealIdx = i; continue; }
      if (value > bestValueScore) { bestValueScore = value; bestValueIdx = i; }
    }

    // Purple is always free,  click it first
    if (purpleIdx !== -1) return purpleIdx;
    // Click the best revealed high-value sphere
    if (bestValueIdx !== -1) return bestValueIdx;
    // No more clicks available
    if (clicksLeft <= 0) return -1;

    // Pick a random unknown button if any exist
    const randomUnknown = unknownIndices.length > 0
      ? unknownIndices[Math.floor(Math.random() * unknownIndices.length)]
      : -1;

    // Last click,  prefer unknown gamble, then teal, then blue
    if (clicksLeft === 1) {
      if (randomUnknown !== -1) return randomUnknown;
      if (tealIdx !== -1) return tealIdx;
      return blueIdx;
    }

    // Multiple clicks left,  try blue first, then toss between unknown and teal
    if (blueIdx !== -1) return blueIdx;
    if (tealIdx !== -1 && randomUnknown !== -1) return Math.random() < 0.5 ? randomUnknown : tealIdx;
    if (tealIdx !== -1) return tealIdx;
    return randomUnknown;
  }

  // Run the $oh minigame: click 5 times, targeting highest-value spheres.
  async function runAutoOh() {
    await runGame('oh', 'times on the buttons below', gameMultipliers.oh, async (msgEl) => {
      const alreadyClicked = new Set();
      let clicksLeft = 5;

      while (true) {
        const buttons = getGameButtons(msgEl);
        if (!buttons.length) break;

        const idx = pickOhButtonIndex(buttons, alreadyClicked, clicksLeft);
        if (idx === -1) break;

        const emojiId = getSphereEmojiId(buttons[idx]);
        const isFreeClick = emojiId === SPHERE_ID.purple;

        alreadyClicked.add(idx);
        clickButton(buttons[idx]);
        if (!isFreeClick) clicksLeft--;

        console.log(`[MedBot] $oh: clicked index ${idx} (${emojiId}),  ${clicksLeft} clicks left`);
        updateVisuals();

        if (clicksLeft <= 0 && !isFreeClick) break;
        await waitForButtonProcessed(msgEl, idx);
      }
    });
  }


  // ===================================================================
  //  SECTION 14,  AUTO $oc (RED SPHERE HUNT)
  //  Strategy: use spatial inference to deduce where the red sphere is
  //  hidden on a 5×5 grid. Each revealed colour acts as a distance
  //  clue. Once red is found (or deduced), collect surrounding spheres
  //  in value order.
  // ===================================================================

  // Convert a flat button index (0-24) to [row, col] on the 5×5 grid.
  function indexToRowCol(idx) {
    return [Math.floor(idx / 5), idx % 5];
  }

  /**
   * Classify a button's relationship to the red sphere's position.
   * Returns a colour name indicating proximity (used as a spatial clue).
   */
  function classifyProximity(redIdx, buttonIdx) {
    const [redRow, redCol] = indexToRowCol(redIdx);
    const [row,    col]    = indexToRowCol(buttonIdx);
    const rowDist = Math.abs(row - redRow);
    const colDist = Math.abs(col - redCol);

    if (rowDist === 0 && colDist === 0) return 'red';
    if (rowDist + colDist === 1)        return 'orange';   // orthogonally adjacent
    if (rowDist === colDist)            return 'yellow';   // exact diagonal
    if (rowDist === 0 || colDist === 0) return 'green';    // same row or column
    return 'blue';                                          // everything else
  }

  /**
   * Given all revealed sphere observations, compute which grid positions
   * could possibly contain the red sphere. Eliminates positions whose
   * geometry contradicts the observed clue colours.
   */
  function computePossibleRedPositions(observations) {
    const candidates = new Set();

    for (let candidate = 0; candidate < 25; candidate++) {
      if (candidate === 12) continue; // centre cell is never red

      let isValid = true;

      for (const [buttonIdx, sphereId] of observations) {
        // If we clicked the candidate cell and it wasn't red, skip it
        if (buttonIdx === candidate) {
          if (sphereId !== SPHERE_ID.red) { isValid = false; break; }
          continue;
        }

        const colourName = ID_TO_COLOR[sphereId];
        if (!colourName) continue;

        // Check if the observed colour is geometrically consistent with
        // red being at the candidate position
        const [redRow, redCol] = indexToRowCol(candidate);
        const [row,    col]    = indexToRowCol(buttonIdx);
        const rowDist = Math.abs(row - redRow);
        const colDist = Math.abs(col - redCol);

        let geometryMatches;
        switch (colourName) {
          case 'orange': geometryMatches = rowDist + colDist === 1;                                break;
          case 'yellow': geometryMatches = rowDist === colDist && rowDist > 0;                     break;
          case 'green':  geometryMatches = rowDist === 0 || colDist === 0;                         break;
          case 'teal':   geometryMatches = rowDist === 0 || colDist === 0 || rowDist === colDist;  break;
          case 'blue':   geometryMatches = rowDist !== 0 && colDist !== 0 && rowDist !== colDist;  break;
          default:       geometryMatches = true;
        }

        if (!geometryMatches) { isValid = false; break; }
      }

      if (isValid) candidates.add(candidate);
    }

    return candidates;
  }

  /**
   * Pick the best cell to click in $oc for maximum information gain.
   * Uses an information-theoretic approach: choose the cell that best
   * partitions the remaining candidate positions into distinct groups.
   */
  function pickOcCell(candidates, alreadyClicked, buttons) {
    if (candidates.size === 0) return -1;

    let bestIdx = -1, bestScore = -Infinity;

    for (let i = 0; i < 25; i++) {
      if (i === 12) continue;                                   // skip centre
      if (alreadyClicked.has(i)) continue;                      // already revealed
      if (buttons[i] && getSphereEmojiId(buttons[i]) !== SPHERE_ID.qmark) continue; // already known

      // Count how each possible red position would colour this cell
      const colourCounts = new Map();
      for (const redPos of candidates) {
        const colour = classifyProximity(redPos, i);
        colourCounts.set(colour, (colourCounts.get(colour) || 0) + 1);
      }

      // Lower partition cost = more even split = more information gained
      let partitionCost = 0;
      for (const [colour, count] of colourCounts) {
        if (colour !== 'red') partitionCost += count * count;
      }

      const score = candidates.size - partitionCost / candidates.size;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }

    return bestIdx;
  }

  /**
   * Once red is found, return the remaining cells sorted by proximity
   * (closest/most valuable first): orange -> yellow -> green -> teal -> blue.
   */
  function getOcClickPriority(redIdx) {
    const proximityOrder = ['orange', 'yellow', 'green', 'teal', 'blue'];
    const buckets = { orange: [], yellow: [], green: [], teal: [], blue: [] };

    for (let i = 0; i < 25; i++) {
      if (i === redIdx) continue;
      const colour = classifyProximity(redIdx, i);
      if (buckets[colour]) buckets[colour].push(i);
    }

    return proximityOrder.flatMap(colour => buckets[colour]);
  }

  // Run the $oc minigame: deduce red sphere location using spatial clues.
  async function runAutoOc() {
    await runGame('oc', 'red sphere', gameMultipliers.oc, async (msgEl) => {
      const observations  = new Map();  // buttonIndex -> revealed sphere emoji ID
      const alreadyClicked = new Set();
      let clicksLeft = 5;
      let redIdx = -1;
      let clickPriority = null;         // ordered list of indices to click after finding red

      // Gather any spheres already revealed on the initial board
      getGameButtons(msgEl).forEach((btn, i) => {
        const id = getSphereEmojiId(btn);
        if (id && id !== SPHERE_ID.qmark) observations.set(i, id);
      });

      for (let turn = 0; turn < 5 && clicksLeft > 0; turn++) {
        const buttons = getGameButtons(msgEl);
        if (!buttons.length) break;

        let chosenIdx = -1;

        if (redIdx !== -1) {
          // Red already found,  click remaining cells in priority order
          for (const i of clickPriority) { if (!alreadyClicked.has(i)) { chosenIdx = i; break; } }
        } else {
          // Still searching,  narrow down candidates
          const candidates = computePossibleRedPositions(observations);
          console.log(`[MedBot] $oc: ${candidates.size} possible red positions remaining`);

          if (candidates.size === 1) {
            // Deduced without clicking,  switch to collection mode
            redIdx = [...candidates][0];
            clickPriority = [redIdx, ...getOcClickPriority(redIdx)];
            console.log(`[MedBot] $oc: deduced red at index ${redIdx} without clicking`);
            for (const i of clickPriority) { if (!alreadyClicked.has(i)) { chosenIdx = i; break; } }
          } else {
            chosenIdx = pickOcCell(candidates, alreadyClicked, buttons);
          }
        }

        if (chosenIdx === -1) break;

        alreadyClicked.add(chosenIdx);
        clickButton(buttons[chosenIdx]);
        clicksLeft--;
        console.log(`[MedBot] $oc: clicked index ${chosenIdx},  ${clicksLeft} clicks left`);
        updateVisuals();
        await waitForButtonProcessed(msgEl, chosenIdx);

        // Record the newly revealed sphere colour
        const updatedButtons = getGameButtons(msgEl);
        const revealedId = getSphereEmojiId(updatedButtons[chosenIdx]);
        if (revealedId && revealedId !== SPHERE_ID.qmark) {
          observations.set(chosenIdx, revealedId);
          if (revealedId === SPHERE_ID.red) {
            redIdx = chosenIdx;
            clickPriority = [redIdx, ...getOcClickPriority(redIdx)];
            console.log(`[MedBot] $oc: found red at index ${redIdx}`);
          }
        }
      }
    });
  }


  // ===================================================================
  //  SECTION 15,  AUTO $oq (PURPLE SPHERE HUNT)
  //  Strategy: each revealed clue sphere shows how many of its 8
  //  neighbours are purple. Use constraint propagation to identify
  //  definite purples (free clicks), then heuristic scoring to pick
  //  the most likely purple among unknowns.
  // ===================================================================

  // Clue values: how many adjacent purples each colour indicates
  const OQ_CLUE_VALUE = {
    [SPHERE_ID.blue]:   0,
    [SPHERE_ID.teal]:   1,
    [SPHERE_ID.green]:  2,
    [SPHERE_ID.yellow]: 3,
    [SPHERE_ID.orange]: 4,
  };

  // Precomputed neighbour indices for each cell (8-connected, respecting grid bounds)
  const OQ_NEIGHBOURS = Array.from({ length: 25 }, (_, i) => {
    const row = Math.floor(i / 5), col = i % 5, result = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) result.push(nr * 5 + nc);
      }
    }
    return result;
  });

  /**
   * Constraint propagation: iteratively deduce which cells must be purple
   * and which definitely aren't, based on clue values and neighbour counts.
   */
  function solveOqConstraints(revealed) {
    const mustBePurple = new Set();
    const cantBePurple = new Set();
    let madeProgress = true;

    while (madeProgress) {
      madeProgress = false;

      for (const [cellIdx, sphereId] of revealed) {
        const clue = OQ_CLUE_VALUE[sphereId];
        if (clue === undefined) continue;

        const neighbours     = OQ_NEIGHBOURS[cellIdx];
        const confirmedCount = neighbours.filter(n =>
          revealed.get(n) === SPHERE_ID.purple || mustBePurple.has(n)
        ).length;
        const unknowns = neighbours.filter(n =>
          !revealed.has(n) && !cantBePurple.has(n) && !mustBePurple.has(n)
        );
        const stillNeeded = clue - confirmedCount;

        if (stillNeeded === 0) {
          // All purples accounted for,  remaining unknowns can't be purple
          for (const n of unknowns) {
            if (!cantBePurple.has(n)) { cantBePurple.add(n); madeProgress = true; }
          }
        } else if (stillNeeded > 0 && stillNeeded === unknowns.length) {
          // Exactly enough unknowns to fill remaining,  all must be purple
          for (const n of unknowns) {
            if (!mustBePurple.has(n)) { mustBePurple.add(n); madeProgress = true; }
          }
        }
      }
    }

    return { definitePurple: mustBePurple, definiteEmpty: cantBePurple };
  }

  /**
   * Score each unrevealed cell by how likely it is to be purple,
   * based on the clue values of its revealed neighbours.
   */
  function computeOqPurpleScores(revealed, definiteEmpty = new Set()) {
    const scores  = new Array(25).fill(1.0);
    const skipped = new Set(definiteEmpty);

    for (const [cellIdx, sphereId] of revealed) {
      scores[cellIdx] = -1; // already revealed,  skip

      const clue = OQ_CLUE_VALUE[sphereId];
      if (clue === undefined) continue;

      const unrevealed = OQ_NEIGHBOURS[cellIdx].filter(n => !revealed.has(n));
      if (clue === 0) {
        // Zero adjacent purples,  all unrevealed neighbours are safe to skip
        unrevealed.forEach(n => skipped.add(n));
      } else {
        // Distribute the clue weight evenly across unrevealed neighbours
        const weight = clue / Math.max(unrevealed.length, 1);
        unrevealed.forEach(n => { scores[n] += weight; });
      }
    }

    skipped.forEach(n => { if (scores[n] > 0) scores[n] = 0; });
    return scores;
  }

  /** Pick the cell with the highest purple probability score. Tie-break
   *  favours cells with more unknown neighbours (more info if wrong). */
  function pickOqTargetIndex(scores, revealed) {
    let bestIdx = -1, bestScore = -1;

    for (let i = 0; i < 25; i++) {
      if (revealed.has(i) || scores[i] < 0) continue;
      const unknownNeighbourCount = OQ_NEIGHBOURS[i].filter(n => !revealed.has(n)).length;
      const adjustedScore = scores[i] + unknownNeighbourCount * 0.01;
      if (adjustedScore > bestScore) { bestScore = adjustedScore; bestIdx = i; }
    }

    return bestIdx;
  }

  // Run the $oq minigame: find 3 purple spheres using clue-based deduction.
  async function runAutoOq() {
    await runGame('oq', 'Find 3 purple spheres', gameMultipliers.oq, async (msgEl) => {
      let clicksLeft = Number(getMessageText(msgEl).match(/click\s+(\d+)\s+times/i)?.[1] ?? 7);
      const revealed = new Map(); // cellIndex -> sphere emoji ID

      while (clicksLeft > 0) {
        const buttons = getGameButtons(msgEl);

        // Priority 1: click any revealed red sphere (always click reds immediately)
        const redIdx = buttons.findIndex((btn, i) =>
          !revealed.has(i) && getSphereEmojiId(btn) === SPHERE_ID.red
        );
        if (redIdx !== -1) {
          clickButton(buttons[redIdx]);
          clicksLeft--;
          revealed.set(redIdx, SPHERE_ID.red);
          console.log(`[MedBot] $oq: clicked RED at index ${redIdx},  ${clicksLeft} clicks left`);
          updateVisuals();
          await waitForButtonProcessed(msgEl, redIdx);
          continue;
        }

        // Priority 2: click any cell we know for certain is purple (free click)
        const { definitePurple, definiteEmpty } = solveOqConstraints(revealed);
        const confirmedPurple = [...definitePurple].find(p => !revealed.has(p));
        if (confirmedPurple !== undefined) {
          clickButton(buttons[confirmedPurple]);
          console.log(`[MedBot] $oq: definite purple at index ${confirmedPurple} (free)`);
          updateVisuals();
          await waitForButtonProcessed(msgEl, confirmedPurple);
          const newId = getSphereEmojiId(getGameButtons(msgEl)[confirmedPurple]);
          if (newId) revealed.set(confirmedPurple, newId);
          continue;
        }

        // Priority 3: pick the highest-scoring unknown cell
        const scores = computeOqPurpleScores(revealed, definiteEmpty);
        const chosenIdx = pickOqTargetIndex(scores, revealed);
        if (chosenIdx === -1) break;

        clickButton(buttons[chosenIdx]);
        console.log(`[MedBot] $oq: idx=${chosenIdx} score=${scores[chosenIdx].toFixed(2)},  ${clicksLeft} left`);
        updateVisuals();
        await waitForButtonProcessed(msgEl, chosenIdx);

        const chosenSphereId = getSphereEmojiId(getGameButtons(msgEl)[chosenIdx]);
        if (chosenSphereId && chosenSphereId !== SPHERE_ID.qmark) revealed.set(chosenIdx, chosenSphereId);
        if (chosenSphereId !== SPHERE_ID.purple) clicksLeft--; // purple clicks are free
      }
    });
  }


  // ===================================================================
  //  SECTION 16,  AUTO $ot (FREE SPHERE COLLECTION)
  //  Strategy: click any revealed non-blue sphere (free), then gamble
  //  on unknowns when no free options remain. Blue spheres cost a click
  //  and are avoided until nothing else is available.
  // ===================================================================

  // Run the $ot minigame: collect free spheres, avoid blue until forced.
  async function runAutoOt() {
    await runGame('ot', 'colors are free', gameMultipliers.ot, async (msgEl) => {
      let blueClicksLeft = Number(getMessageText(msgEl).match(/click\s+(\d+)\s+times/i)?.[1] ?? 4);
      const alreadyClicked = new Set();

      while (true) {
        const buttons = getGameButtons(msgEl);
        if (!buttons.length) break;

        let freeIdx = -1, unknownIdx = -1, blueIdx = -1;

        // Scan for the best option in a single pass
        for (let i = 0; i < buttons.length; i++) {
          if (alreadyClicked.has(i) || buttons[i].hasAttribute('disabled')) continue;
          const emojiId = getSphereEmojiId(buttons[i]);

          // Non-blue, non-unknown = free click (always take these first)
          if (freeIdx === -1 && emojiId && emojiId !== SPHERE_ID.qmark && emojiId !== SPHERE_ID.blue) {
            freeIdx = i;
            break; // best possible option,  no need to keep scanning
          }
          // Unknown sphere,  might be free, might be blue
          if (unknownIdx === -1 && (!emojiId || emojiId === SPHERE_ID.qmark)) unknownIdx = i;
          // Known blue,  costs a click
          else if (blueIdx === -1 && emojiId === SPHERE_ID.blue) blueIdx = i;
        }

        // Choose: free > unknown (if clicks remain) > blue (if clicks remain)
        const chosenIdx = freeIdx !== -1
          ? freeIdx
          : blueClicksLeft > 0
            ? (unknownIdx !== -1 ? unknownIdx : blueIdx)
            : -1;

        if (chosenIdx === -1) break;

        alreadyClicked.add(chosenIdx);
        clickButton(buttons[chosenIdx]);
        console.log(`[MedBot] $ot: clicked index ${chosenIdx},  ${blueClicksLeft} blue clicks left`);
        updateVisuals();
        await waitForButtonProcessed(msgEl, chosenIdx);

        // Check what was revealed,  only blue costs a click
        const revealedId = getSphereEmojiId(getGameButtons(msgEl)[chosenIdx]);
        if (revealedId === SPHERE_ID.blue) {
          blueClicksLeft--;
          console.log(`[MedBot] $ot: revealed blue, ${blueClicksLeft} clicks left`);
        } else {
          console.log(`[MedBot] $ot: revealed non-blue (free), clicks unchanged`);
        }
      }
    });
  }



  // ===================================================================
  //  SECTION 17,  AUTO CLAIM
  //  Automatically claims characters from Mudae based on three
  //  independent criteria: wished by the user, within a kakera range,
  //  or from a specific series. Any one match triggers a claim.
  // ===================================================================

  // The blue kakera emoji ID,  used to locate the kakera value in embed footers
  const BLUE_KAKERA_EMOJI_ID = '469835869059153940';

  // Check if the embed footer says "Wished by" and includes the current user's @mention.
  function isWishedByCurrentUser(msgEl) {
    const content = msgEl.querySelector('[id^="message-content-"]');
    if (!content?.textContent?.trim().startsWith('Wished by')) return false;
    const username = getOwnUsername();
    return [...content.querySelectorAll('[class*="mention"]')]
      .some(mention => mention.textContent.trim() === `@${username}`);
  }

  /**
   * Extract the kakera value from a Mudae character embed.
   * Looks for the blue kakera emoji and reads the <strong> number before it.
   * @returns {number|null} kakera value, or null if not found
   */
  function getKakeraValue(msgEl) {
    const kakeraEmoji = msgEl.querySelector(`img.emoji[data-id="${BLUE_KAKERA_EMOJI_ID}"]`);
    if (!kakeraEmoji) return null;
    const prevElement = kakeraEmoji.closest('[class*="emojiContainer"]')?.previousElementSibling;
    return prevElement?.tagName === 'STRONG' ? (Number(prevElement.textContent.trim()) || null) : null;
  }

  /**
   * Extract the series/franchise name from a Mudae character embed.
   * The series name appears in the embed description before the first <strong> tag.
   */
  function getSeriesName(msgEl) {
    const description = msgEl.querySelector('[class*="embedDescription"]');
    if (!description) return null;
    let text = '';
    for (const node of description.childNodes) {
      if (node.nodeName === 'STRONG') break; // stop before the kakera value
      text += node.textContent;
    }
    return text.trim().replace(/\s+/g, ' ') || null;
  }

  // Check if the character embed has a "Belongs to" footer (already owned).
  const isAlreadyOwned = (msgEl) =>
    [...msgEl.querySelectorAll('[class*="embedFooterText"]')]
      .some(el => el.textContent.trim().startsWith('Belongs to'));

  // Find the heart/claim reaction button on a Mudae character embed.
  const getClaimButton = (msgEl) =>
    msgEl.querySelector('[id^="message-accessories-"] [class*="children"] button') || null;

  /**
   * Attempt to auto-claim a character from a Mudae message.
   * Checks all three claim criteria and only claims if at least one matches
   * AND the user has a claim available (per $tu status).
   */
  function tryAutoClaim(msgEl) {
    if (!isMudaeMessage(msgEl)) return;

    const msgId = getMsgId(msgEl);
    if (!msgId || isMessageProcessed(msgId, 'claim')) return;

    // Skip if no claim criteria are configured
    if (!autoClaimWishes && !(autoClaimMinKakera > 0 && autoClaimMaxKakera > 0) && !autoClaimSeries) return;

    // Don't try to claim characters that are already owned
    if (isAlreadyOwned(msgEl)) return;

    const claimButton = getClaimButton(msgEl);
    if (!claimButton) return;

    // Evaluate each claim criterion independently
    const kakeraValue   = getKakeraValue(msgEl);
    const isInKakeraRange = autoClaimMinKakera > 0 && autoClaimMaxKakera > 0
      && kakeraValue !== null && kakeraValue >= autoClaimMinKakera && kakeraValue <= autoClaimMaxKakera;
    const isWished      = autoClaimWishes && isWishedByCurrentUser(msgEl);
    const isInSeries    = !!autoClaimSeries
      && (getSeriesName(msgEl) || '').toLowerCase().includes(autoClaimSeries.toLowerCase());

    // At least one criterion must match
    if (!isWished && !isInKakeraRange && !isInSeries) return;

    // For wish and kakera-range claims, verify the user has a claim available
    const claimIsReady = mudaeStatus.claimAvailable === true
      || (mudaeStatus.claimAvailable === false && mudaeStatus.claimResetAt > 0 && Date.now() >= mudaeStatus.claimResetAt);
    if ((isWished || isInKakeraRange) && !claimIsReady) return;

    clickButton(claimButton);
    mudaeStatus.claimAvailable = false;
    saveMudaeStatus();
    console.log(`[MedBot] Auto-claimed,  kakera=${kakeraValue}, wished=${isWished}, series=${isInSeries}`);
  }


  // ===================================================================
  //  SECTION 18,  $tu RESPONSE PARSING
  //  Parse Mudae's $tu response to extract claim status, roll count,
  //  and $rt cooldown information.
  // ===================================================================

  /**
   * Parse a Mudae time string like "2h 30min" or "45min" into milliseconds.
   * Adds 1 minute buffer to account for Mudae's rounding.
   * @returns {number|null} duration in ms, or null if no time found
   */
  function parseMudaeTime(str) {
    if (!str) return null;
    const hours   = Number(str.match(/(\d+)\s*h/i)?.[1]   || 0);
    const minutes = Number(str.match(/(\d+)\s*min/i)?.[1]  || 0);
    return (hours || minutes) ? (hours * 60 + minutes + 1) * 60000 : null;
  }

  /**
   * Extract all status fields from a Mudae $tu response.
   * @param {string} text - the full text of the $tu message
   * @returns {Object} parsed fields (claimAvailable, rollsLeft, etc.)
   */
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

  /**
   * Check if a message looks like a $tu response addressed to the current user.
   * Must start with the user's handle and contain both roll count and claim info.
   */
  function isTuResponse(text) {
    const handle = getOwnHandle();
    if (handle !== 'Unknown' && !new RegExp(`^${escapeRegExp(handle)},`, 'i').test(text)) return false;
    return /you have \d+ rolls/i.test(text)
      && /(?:you can(?:'t)? claim|next claim reset)/i.test(text);
  }

  // Format a millisecond duration as a human-readable countdown string.
  function formatCountdown(ms) {
    if (ms <= 0) return 'now';
    const hours   = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    if (hours > 0)   return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }


  // ===================================================================
  //  SECTION 19,  $tu STATUS RENDERING & RESPONSE HANDLING
  //  Renders the Settings panel UI for channel lock, $tu status cards,
  //  and processes incoming $tu responses and cooldown messages.
  // ===================================================================

  // Render the channel lock toggle and breadcrumb in the Settings panel.
  function renderChannelInfo(container) {
    if (!container) return;
    const currentChannel = getCurrentChannelInfo();

    // Show locked channel info if lock is active, otherwise show current channel
    const displayInfo = channelLockEnabled && lockedChannelId
      ? { server: lockedServerName || '—', channel: lockedChannelName || '—' }
      : { server: currentChannel?.serverName || '—', channel: currentChannel?.channelName || '—' };

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

    // Bind the channel lock toggle
    container.querySelector('#medbot-channel-lock').addEventListener('change', e => {
      channelLockEnabled = e.target.checked;
      if (channelLockEnabled && currentChannel) {
        lockedChannelId   = currentChannel.channelId;
        lockedServerId    = currentChannel.serverId;
        lockedChannelName = currentChannel.channelName;
        lockedServerName  = currentChannel.serverName || '';
      }
      saveSettings();
      renderChannelInfo(container);
    });
  }

  /**
   * Check all $tu countdown timers and reset any that have expired.
   * Called periodically and before rendering the status panel.
   */
  function expireTimers() {
    const now = Date.now();
    const claimExpired = !mudaeStatus.claimAvailable && mudaeStatus.claimResetAt > 0 && now >= mudaeStatus.claimResetAt;
    const rollsExpired = mudaeStatus.rollsResetAt > 0 && now >= mudaeStatus.rollsResetAt;
    const rtExpired    = mudaeStatus.rtAvailable === false && mudaeStatus.rtResetAt > 0 && now >= mudaeStatus.rtResetAt;

    if (claimExpired) { mudaeStatus.claimAvailable = true;  mudaeStatus.claimResetAt = 0; }
    if (rollsExpired) { mudaeStatus.rollsLeft = mudaeStatus.rollsMax; mudaeStatus.rollsResetAt = 0; }
    if (rtExpired)    { mudaeStatus.rtAvailable = true;     mudaeStatus.rtResetAt = 0; }

    if (claimExpired || rollsExpired || rtExpired) saveMudaeStatus();
    return { claimExpired, rollsExpired, rtExpired };
  }

  // Render the $tu status cards (Claim, Rolls, $rt) in the Settings panel.
  function renderTuStatus(container) {
    if (!container) return;

    // Show empty state if never configured
    if (!mudaeStatus.lastUpdated) {
      container.innerHTML = '<div class="medbot-tu-empty">No data yet, click Configure to sync this server.</div>';
      return;
    }

    expireTimers();
    const now = Date.now();

    // Compute remaining time for each countdown
    const claimResetMs = mudaeStatus.claimResetAt - now;
    const rollsResetMs = mudaeStatus.rollsResetAt - now;
    const rtResetMs    = mudaeStatus.rtResetAt    - now;

    // Format "Updated X ago" label
    const ageMs   = now - mudaeStatus.lastUpdated;
    const ageText = ageMs < 60000   ? `${Math.floor(ageMs / 1000)}s ago`
                  : ageMs < 3600000 ? `${Math.floor(ageMs / 60000)}m ago`
                  :                   `${Math.floor(ageMs / 3600000)}h ago`;

    // Build claim badge
    const claimBadge = mudaeStatus.claimAvailable
      ? '<span class="medbot-tu-badge available">Available</span>'
      : '<span class="medbot-tu-badge unavailable">Unavailable</span>';

    const claimCountdown = claimResetMs > 0 ? formatCountdown(claimResetMs) : '—';
    const rollsCountdown = rollsResetMs > 0 ? formatCountdown(rollsResetMs) : '—';
    const rtCountdown    = rtResetMs > 0    ? formatCountdown(rtResetMs)    : '—';

    // Progress bar for rolls (percentage of max)
    const rollsPercent = mudaeStatus.rollsMax
      ? Math.round(((mudaeStatus.rollsLeft ?? 0) / mudaeStatus.rollsMax) * 100) : 0;

    // $rt card,  only shown if $rt data exists
    const rtCard = mudaeStatus.rtAvailable !== null ? `
        <div class="medbot-tu-card">
          <div class="medbot-tu-card-label">$rt</div>
          <div class="medbot-tu-card-main">
            ${mudaeStatus.rtAvailable
              ? '<span class="medbot-tu-badge available">Available</span>'
              : '<span class="medbot-tu-badge unavailable">Unavailable</span>'}
          </div>
          <div class="medbot-tu-card-sub">${rtCountdown}</div>
        </div>` : '';

    container.innerHTML = `
      <div class="medbot-tu-grid${mudaeStatus.rtAvailable !== null ? ' cols-3' : ' cols-2'}">
        <div class="medbot-tu-card">
          <div class="medbot-tu-card-label">Claim</div>
          <div class="medbot-tu-card-main">${claimBadge}</div>
          <div class="medbot-tu-card-sub">${claimCountdown}</div>
        </div>
        <div class="medbot-tu-card">
          <div class="medbot-tu-card-label">Rolls</div>
          <div class="medbot-tu-card-main"><span class="medbot-tu-rolls-num">${mudaeStatus.rollsLeft ?? '—'}</span></div>
          <div class="medbot-tu-progress"><div class="medbot-tu-progress-fill" style="width:${rollsPercent}%"></div></div>
          <div class="medbot-tu-card-sub">${rollsCountdown}</div>
        </div>${rtCard}
      </div>
      <div class="medbot-tu-updated">Updated ${ageText}</div>`;
  }

  // Find the $tu status container inside the currently open Settings panel.
  function getTuStatusContainer() {
    return document.querySelector('#medbot-backdrop [data-panel="settings"].active #medbot-tu-status');
  }

  /**
   * Process an incoming Mudae $tu response message.
   * Updates mudaeStatus with the parsed data and refreshes the UI.
   */
  function handleTuResponse(msgEl) {
    const text = getMessageText(msgEl);
    if (!isTuResponse(text)) return;

    const msgId = getMsgId(msgEl);
    if (!msgId || isMessageProcessed(msgId)) return;

    // Accept the response if we're actively waiting, or if $tu data exists
    // and the message is from the current minute (catches manual $tu usage)
    if (!isWaitingForTuReply) {
      if (!mudaeStatus.lastUpdated) return;
      const msgTime = getMessageTimestamp(msgEl);
      if (!msgTime || Math.floor(Date.now() / 60000) !== Math.floor(msgTime / 60000)) return;
    }

    const now    = Date.now();
    const parsed = parseTuMessage(text);

    // Update mudae status with parsed values
    mudaeStatus.claimAvailable = parsed.claimAvailable;
    mudaeStatus.claimResetAt   = parsed.claimResetMs != null ? now + parsed.claimResetMs : 0;
    mudaeStatus.rollsLeft      = parsed.rollsLeft;
    // Track the highest observed roll count as the maximum
    if (parsed.rollsLeft !== null && (mudaeStatus.rollsMax === null || parsed.rollsLeft > mudaeStatus.rollsMax)) {
      mudaeStatus.rollsMax = parsed.rollsLeft;
    }
    mudaeStatus.rollsResetAt = parsed.rollsResetMs != null ? now + parsed.rollsResetMs : 0;
    mudaeStatus.rtAvailable  = parsed.rtAvailable;
    mudaeStatus.rtResetAt    = parsed.rtResetMs    != null ? now + parsed.rtResetMs    : 0;
    mudaeStatus.lastUpdated  = now;
    saveMudaeStatus();

    // Update the Configure button if we were waiting for this response
    if (isWaitingForTuReply) {
      isWaitingForTuReply = false;
      const configureButton = document.querySelector('#medbot-backdrop #medbot-configure-tu');
      if (configureButton) { configureButton.textContent = 'Configure'; configureButton.disabled = false; }
    }

    renderTuStatus(getTuStatusContainer());
  }

  /**
   * Check if a message element is from Mudae,  either directly or as a
   * continuation message (grouped under the same username header).
   */
  function isMudaeOrContinuation(msgEl) {
    if (isMudaeMessage(msgEl)) return true;
    // For continuation messages, check the referenced username header
    const labelledBy = msgEl.getAttribute('aria-labelledby') || '';
    const match = labelledBy.match(/message-username-\d+/);
    if (!match) return false;
    const usernameEl = document.getElementById(match[0]);
    return usernameEl?.textContent?.trim().startsWith('Mudae') || false;
  }

  /**
   * Handle Mudae's claim-denied message ("next interval begins in X").
   * Updates the claim cooldown timer without requiring a full $tu refresh.
   */
  function handleClaimDenied(msgEl) {
    if (!isMudaeOrContinuation(msgEl)) return;

    // Only process messages from the current minute
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
    mudaeStatus.claimAvailable = false;
    mudaeStatus.claimResetAt   = now + ms;
    mudaeStatus.lastUpdated    = now;
    saveMudaeStatus();
    renderTuStatus(getTuStatusContainer());
    console.log(`[MedBot] Claim denied,  next interval in ${match[1]}`);
  }

  // Handle Mudae's $rt cooldown message and update the $rt timer.
  function handleRtCooldown(msgEl) {
    const text  = getMessageText(msgEl);
    const match = text.match(/cooldown of \$rt is not over\.\s*Time left:\s*((?:\d+\s*h\s*)?\d+\s*min)/i);
    if (!match) return;

    const msgId = getMsgId(msgEl);
    if (!msgId || isMessageProcessed(msgId)) return;

    const ms = parseMudaeTime(match[1]);
    if (ms == null) return;

    const now = Date.now();
    mudaeStatus.rtAvailable = false;
    mudaeStatus.rtResetAt   = now + ms;
    mudaeStatus.lastUpdated = now;
    saveMudaeStatus();
    renderTuStatus(getTuStatusContainer());
    console.log(`[MedBot] $rt cooldown,  ${match[1]}`);
  }


  // ===================================================================
  //  SECTION 20,  OWN COMMAND DETECTION
  //  Watches for the user's own messages to track manual roll usage
  //  and $rt commands, keeping mudaeStatus in sync.
  // ===================================================================

  // Detect and track the user's own roll/$rt commands sent in chat.
  function handleOwnCommandMessage(msgEl) {
    if (!msgEl || !mudaeStatus.lastUpdated) return;

    // Skip messages still being sent,  Discord uses a temporary ID during send,
    // which would cause a false duplicate detection on the real message later.
    if (msgEl.querySelector('[class*="isSending"]')) return;

    // Verify this message was sent by the current user
    const usernameEl = msgEl.querySelector('[id^="message-username-"] [class*="username"]');
    if (!usernameEl) return;
    const senderName = (usernameEl.getAttribute('data-text') || usernameEl.textContent || '').trim();
    const ownName = getOwnUsername();
    if (!senderName || ownName === 'Unknown' || senderName !== ownName) return;

    // Dedupe and freshness check
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

    // Track manual roll commands
    if (MUDAE_ROLL_COMMANDS.has(text)) {
      if (pendingBotRollCount > 0) {
        pendingBotRollCount--; // bot sent this,  already deducted in executeNextRoll
        return;
      }
      if (mudaeStatus.rollsLeft !== null && mudaeStatus.rollsLeft > 0) {
        mudaeStatus.rollsLeft = Math.max(0, mudaeStatus.rollsLeft - 1);
        mudaeStatus.lastUpdated = Date.now();
        saveMudaeStatus();
        renderTuStatus(getTuStatusContainer());
        console.log(`[MedBot] Manual roll detected (${text}), rollsLeft=${mudaeStatus.rollsLeft}`);
      }
      return;
    }

    // Track manual $rt command
    if (text === '$rt' && mudaeStatus.rtAvailable === true) {
      mudaeStatus.rtAvailable = false;
      mudaeStatus.rtResetAt = 0;
      mudaeStatus.lastUpdated = Date.now();
      saveMudaeStatus();
      renderTuStatus(getTuStatusContainer());
      console.log('[MedBot] Manual $rt detected, marked unavailable');
    }
  }



  // ===================================================================
  //  SECTION 21,  MESSAGE PROCESSING PIPELINE
  //  Central dispatcher that routes each new Discord message through
  //  all relevant handlers (own commands, kakera, claims, $tu, etc.).
  // ===================================================================

  // Process a single message element through all MedBot handlers.
  function processMessage(msgEl) {
    if (!msgEl) return;

    // Track the user's own roll/$rt commands
    handleOwnCommandMessage(msgEl);

    // Scan for kakera buttons at staggered intervals (Discord renders progressively)
    KAKERA_SCAN_DELAYS.forEach(delay => setTimeout(() => clickMatchingKakera(msgEl), delay));

    // Scan for claimable characters at staggered intervals
    CLAIM_SCAN_DELAYS.forEach(delay => setTimeout(() => tryAutoClaim(msgEl), delay));

    // Check for rollcap messages that need $us recovery
    handleRollcapRecovery(msgEl);

    // Handle Mudae-specific responses
    if (isMudaeMessage(msgEl)) {
      onMudaeResponseReceived();
      handleTuResponse(msgEl);
      handleRtCooldown(msgEl);
    }

    // Check for claim-denied messages (can come from Mudae continuation messages)
    handleClaimDenied(msgEl);
  }


  // ===================================================================
  //  SECTION 22,  DOM OBSERVERS
  //  MutationObservers that watch Discord's chat message list for new
  //  messages. Handles initial page load, channel switches, and DOM
  //  recycling where Discord may destroy and recreate the message list.
  // ===================================================================

  let chatObserver             = null;   // watches the message list for new messages
  let chatBootObserver         = null;   // watches document.body until the message list appears
  let observedMessageList      = null;   // the <ol> element currently being observed
  let chatListWatcherInterval  = null;   // periodic check that the message list is still in the DOM

  /**
   * Attach a MutationObserver to the given message list element.
   * Processes all new [role="article"] elements (messages) that appear.
   */
  function attachObserver(listEl) {
    if (!listEl || (observedMessageList === listEl && chatObserver)) return;

    chatObserver?.disconnect();
    observedMessageList = listEl;

    chatObserver = new MutationObserver(mutations => {
      const seenArticles = new Set();

      for (const { addedNodes } of mutations) {
        for (const node of addedNodes) {
          if (!(node instanceof Element)) continue;

          // The added node itself might be an article
          if (node.matches('[role="article"]')) seenArticles.add(node);

          // Or it might be nested inside/above an article
          const parentArticle = node.closest?.('[role="article"]');
          if (parentArticle) seenArticles.add(parentArticle);

          // Or it might contain articles as descendants
          node.querySelectorAll?.('[role="article"]').forEach(a => seenArticles.add(a));
        }
      }

      seenArticles.forEach(processMessage);
    });

    chatObserver.observe(listEl, { childList: true, subtree: true });

    // Process the last 15 messages already in the list (catches recent activity)
    [...listEl.querySelectorAll('[role="article"]')].slice(-15).forEach(processMessage);
  }

  /**
   * Wait for Discord to render the message list on page load or channel switch.
   * Once found, attach the main observer and start the liveness watcher.
   */
  function startBootObserver() {
    if (chatBootObserver) return;

    // Check if the message list already exists
    const existingList = getMessageList();
    if (existingList) {
      attachObserver(existingList);
      startLivenessWatcher();
      return;
    }

    // Otherwise, watch for it to appear
    chatBootObserver = new MutationObserver(() => {
      const list = getMessageList();
      if (!list) return;
      chatBootObserver.disconnect();
      chatBootObserver = null;
      attachObserver(list);
      startLivenessWatcher();
    });
    chatBootObserver.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Periodically check that the observed message list is still in the DOM.
   * Discord destroys and recreates the list on channel switches, so we need
   * to re-attach the observer when that happens.
   */
  function startLivenessWatcher() {
    if (chatListWatcherInterval) return;
    chatListWatcherInterval = setInterval(() => {
      if (observedMessageList && !document.contains(observedMessageList)) {
        // Message list was removed from DOM,  clean up and re-bootstrap
        chatObserver?.disconnect();
        chatObserver = null;
        observedMessageList = null;
        clearInterval(chatListWatcherInterval);
        chatListWatcherInterval = null;
        startBootObserver();
      }
    }, 1000);
  }


  // ===================================================================
  //  SECTION 23,  ATTACHMENT MENU INJECTION
  //  Adds a "MedBot" entry to Discord's attachment/channel-actions
  //  popup menu, providing quick access to the modal.
  // ===================================================================

  /**
   * Inject the MedBot menu item into a Discord popup menu.
   * Copies the styling from existing menu items for visual consistency.
   */
  function injectMenuButton(menu) {
    if (!menu || menu.querySelector('[data-medbot-injected]')) return;

    const scroller      = menu.querySelector('[class*="scroller"]') || menu;
    const firstMenuItem = scroller.querySelector('[role="menuitem"]');

    // Create the menu item element, mirroring Discord's structure
    const menuItem = document.createElement('div');
    menuItem.setAttribute('role', 'menuitem');
    menuItem.setAttribute('tabindex', '-1');
    menuItem.setAttribute('data-menu-item', 'true');
    menuItem.setAttribute('data-medbot-injected', 'true');
    if (firstMenuItem) menuItem.className = firstMenuItem.className;
    menuItem.style.position = 'relative';

    // Borrow class names from existing menu items for consistent styling
    const iconWrapClass = firstMenuItem?.querySelector('[class*="iconContainer"]')?.className || '';
    const labelClass    = firstMenuItem?.querySelector('[class*="label_"]')?.className || '';
    const svgClass      = firstMenuItem?.querySelector('svg')?.getAttribute('class') || '';

    menuItem.innerHTML = `
      <div class="${iconWrapClass}">
        <svg class="${svgClass}" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path fill="currentColor" d="M14 2L5 13H12L9 22L20 11H13Z"/>
        </svg>
      </div>
      <div class="${labelClass}">MedBot</div>
      <div class="medbot-menu-status${botIsRunning ? ' running' : ''}">
        ${botIsRunning ? '<span class="medbot-menu-status-dot"></span>LIVE' : 'AUTO'}
      </div>`;

    // Handle hover focus,  mirrors Discord's focus management for menu items
    menuItem.addEventListener('mouseenter', () => {
      menuItem.focus();
      const closestMenu = menuItem.closest('[role="menu"]');
      if (!closestMenu) return;
      let focusedClass = null;
      closestMenu.querySelectorAll('[role="menuitem"]').forEach(sibling => {
        if (sibling === menuItem) return;
        const siblingFocusedClass = [...sibling.classList].find(c => /^focused/.test(c));
        if (siblingFocusedClass) { focusedClass = siblingFocusedClass; sibling.classList.remove(siblingFocusedClass); }
      });
      if (focusedClass) menuItem.classList.add(focusedClass);
    });

    menuItem.addEventListener('mouseleave', () => {
      const focusedClass = [...menuItem.classList].find(c => /^focused/.test(c));
      if (focusedClass) menuItem.classList.remove(focusedClass);
    });

    // Open the MedBot modal on click
    menuItem.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openMedBotModal(); });

    // Insert at the top of the menu
    if (firstMenuItem) scroller.insertBefore(menuItem, firstMenuItem);
    else scroller.appendChild(menuItem);
  }

  // Watch for Discord popup menus and inject the MedBot button into relevant ones.
  function observeDiscordMenus() {
    new MutationObserver(mutations => {
      for (const { addedNodes } of mutations) {
        for (const node of addedNodes) {
          if (!(node instanceof Element)) continue;
          const menus = node.matches('[role="menu"]') ? [node] : [...node.querySelectorAll('[role="menu"]')];
          for (const menu of menus) {
            if (/channel actions|attachment/i.test(menu.getAttribute('aria-label') || '')) {
              injectMenuButton(menu);
            }
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });

    // Also check if a menu is already open
    injectMenuButton(getAttachmentMenu());
  }


  // ===================================================================
  //  SECTION 24,  STYLESHEET INJECTION
  //  Loads the external CSS resource and injects it into the page.
  // ===================================================================

  // Inject MedBot's CSS into the page (idempotent).
  function injectStyles() {
    if (document.getElementById('medbot-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'medbot-styles';
    styleEl.textContent = GM_getResourceText('medbot-css');
    document.head.appendChild(styleEl);
  }



  // ===================================================================
  //  SECTION 25,  MODAL UI
  //  The main MedBot configuration modal with tabbed panels:
  //    Send  ,  roll command & count
  //    Kakera,  auto-kakera toggle & type selection
  //    Claim ,  auto-claim by wish / kakera range / series
  //    Extra ,  sphere minigame launchers ($oh/$oc/$oq/$ot)
  //    Settings,  channel lock, $tu status, configure button
  // ===================================================================

  // Remove the modal from the DOM.
  function closeMedBotModal() {
    document.getElementById('medbot-backdrop')?.remove();
  }

  // Fetch and cache the MedBot GIF as a blob URL (fetched once per session).
  function loadMedBotGif() {
    return new Promise(resolve => {
      if (cachedGifBlobUrl) return resolve(cachedGifBlobUrl);
      GM_xmlhttpRequest({
        method: 'GET', url: MEDBOT_GIF_URL, responseType: 'blob',
        onload(xhr) {
          try { cachedGifBlobUrl = URL.createObjectURL(xhr.response); resolve(cachedGifBlobUrl); }
          catch { resolve(null); }
        },
        onerror() { resolve(null); },
      });
    });
  }

  // Build and display the MedBot configuration modal.
  async function openMedBotModal() {
    const gifSrc  = await loadMedBotGif();
    injectStyles();
    closeMedBotModal(); // remove any existing modal

    const username = getOwnUsername();
    const handle   = getOwnHandle();

    // -- Build modal DOM --
    const backdrop = document.createElement('div');
    backdrop.className = 'medbot-backdrop';
    backdrop.id        = 'medbot-backdrop';

    backdrop.innerHTML = `
      <div class="medbot-modal" role="dialog" aria-modal="true">

        <!-- GIF mascot (positioned above the modal) -->
        ${gifSrc ? `<div class="medbot-gif-wrap"><img class="medbot-gif" src="${gifSrc}" alt="" draggable="false"></div>` : ''}

        <!-- Header: title, user pill, status badge -->
        <div class="medbot-header">
          <div>
            <div class="medbot-title">MedBot</div>
            <div class="medbot-user-pill" title="${handle}"><span class="medbot-user-pill-dot"></span>${username}</div>
          </div>
          <div class="medbot-status-badge ${botIsRunning ? 'running' : 'idle'}">
            <span class="medbot-status-dot"></span>${botIsRunning ? 'Running' : 'Idle'}
          </div>
        </div>
        <div class="medbot-divider"></div>

        <!-- Tab bar -->
        <div class="medbot-tabs">
          <div class="medbot-tab-indicator"></div>
          <button class="medbot-tab active" data-tab="send">Send</button>
          <button class="medbot-tab" data-tab="kakera">Kakera</button>
          <button class="medbot-tab" data-tab="claim">Claim</button>
          <button class="medbot-tab" data-tab="extra">Extra</button>
          <button class="medbot-tab" data-tab="settings">Settings</button>
        </div>

        <!-- --- SEND PANEL --- -->
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

        <!-- --- KAKERA PANEL --- -->
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
            ${KAKERA_TYPES.map(k => `
              <label class="medbot-kakera-row${selectedKakeraTypes.has(k.key) ? ' selected' : ''}">
                <input type="checkbox" data-kakera-key="${k.key}" ${selectedKakeraTypes.has(k.key) ? 'checked' : ''}>
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

        <!-- --- CLAIM PANEL --- -->
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

          <!-- Kakera range claim -->
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

          <!-- Series claim -->
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

        <!-- --- EXTRA PANEL (Sphere Minigames) --- -->
        <div class="medbot-panel" data-panel="extra">
          ${[
            { id: 'oh', label: 'Auto $oh', desc: 'Randomly plays, claiming highest first' },
            { id: 'oc', label: 'Auto $oc', desc: 'Hunt red using spatial inference' },
            { id: 'oq', label: 'Auto $oq', desc: 'Use clue spheres to find purple spheres' },
            { id: 'ot', label: 'Auto $ot', desc: 'Click free spheres, avoid blue until forced' },
          ].map(game => `
          <div class="medbot-toggle-row" style="cursor:default">
            <div>
              <div class="medbot-toggle-label">${game.label}</div>
              <div class="medbot-toggle-sub">${game.desc}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
              <div class="medbot-multiplier-control">
                <button class="medbot-mult-btn" data-game="${game.id}" data-dir="-1" ${gameMultipliers[game.id] <= 1 ? 'disabled' : ''}>&#8249;</button>
                <span class="medbot-mult-display" id="medbot-${game.id}-mult">${gameMultipliers[game.id]}x</span>
                <button class="medbot-mult-btn" data-game="${game.id}" data-dir="1" ${gameMultipliers[game.id] >= 10 ? 'disabled' : ''}>&#8250;</button>
              </div>
              <button class="medbot-btn medbot-btn-primary" id="medbot-${game.id}">${activeGame === game.id ? 'Running' : 'Play'}</button>
            </div>
          </div>`).join('')}
          <div class="medbot-mini-note">$oh: Target highest value spheres.<br>$oc: Hunts red with 99% accuracy.<br>$oq: Tries to find all purple, to claim red.<br>$ot: Collects all free spheres, avoids blue until forced.</div>
        </div>

        <!-- --- SETTINGS PANEL --- -->
        <div class="medbot-panel" data-panel="settings">
          <div id="medbot-channel-info" class="medbot-tu-status"></div>
          <div id="medbot-tu-status" class="medbot-tu-status"></div>
          <div class="medbot-mini-note" style="margin-top:0;margin-bottom:14px">
            Clicking <strong style="color:var(--mb-accent)">Configure</strong> sends $tu and syncs status for the current server. (saved across servers)
          </div>
          <button class="medbot-btn medbot-btn-secondary" id="medbot-configure-tu" style="width:100%">Configure</button>
        </div>

        <!-- --- FOOTER ACTIONS --- -->
        <div class="medbot-actions">
          <div class="medbot-actions-left">
            ${botIsRunning ? '<button class="medbot-btn medbot-btn-danger" id="medbot-stop">Stop</button>' : ''}
          </div>
          <button class="medbot-btn medbot-btn-ghost" id="medbot-cancel">Cancel</button>
          <button class="medbot-btn medbot-btn-secondary" id="medbot-save" style="display:none">Save</button>
          <button class="medbot-btn medbot-btn-primary" id="medbot-start">${botIsRunning ? 'Restart' : 'Start'}</button>
        </div>
      </div>`;

    document.body.appendChild(backdrop);

    // -- Modal element references --
    const qs             = s => backdrop.querySelector(s);
    const rollCountInput = qs('#medbot-count');
    const infiniteToggle = qs('#medbot-infinite');
    const kakeraToggle   = qs('#medbot-auto-kakera');
    const wishToggle     = qs('#medbot-autoclaim-wishes');
    const claimMinInput  = qs('#medbot-claim-min');
    const claimMaxInput  = qs('#medbot-claim-max');
    const seriesInput    = qs('#medbot-claim-series');
    const saveButton     = qs('#medbot-save');
    const startButton    = qs('#medbot-start');
    const actionsLeft    = qs('.medbot-actions-left');
    const kakeraCheckboxes = [...backdrop.querySelectorAll('[data-kakera-key]')];
    const allTabs        = [...backdrop.querySelectorAll('.medbot-tab')];
    const allPanels      = [...backdrop.querySelectorAll('.medbot-panel')];

    // -- Sliding tab indicator --
    const tabIndicator = qs('.medbot-tab-indicator');
    function positionTabIndicator(tab) {
      if (!tabIndicator || !tab) return;
      tabIndicator.style.left  = `${tab.offsetLeft}px`;
      tabIndicator.style.width = `${tab.offsetWidth}px`;
    }
    // Wait one frame so layout dimensions are available
    requestAnimationFrame(() => positionTabIndicator(qs('.medbot-tab.active')));

    // Show/hide footer buttons depending on which tab is active.
    function syncFooterVisibility(tabName) {
      const isOnSend     = tabName === 'send';
      const hideFooter   = ['settings', 'extra', 'claim'].includes(tabName);
      if (saveButton)  saveButton.style.display  = (isOnSend || hideFooter) ? 'none' : '';
      if (startButton) startButton.style.display = isOnSend ? '' : 'none';
      if (actionsLeft) actionsLeft.style.display  = isOnSend ? '' : 'none';
    }

    // -- Tab switching --
    allTabs.forEach(tab => tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      allTabs.forEach(t => t.classList.toggle('active', t === tab));
      allPanels.forEach(p => p.classList.toggle('active', p.dataset.panel === tabName));
      positionTabIndicator(tab);
      syncFooterVisibility(tabName);
      // Render settings panel content when it becomes active
      if (tabName === 'settings') {
        renderChannelInfo(backdrop.querySelector('#medbot-channel-info'));
        renderTuStatus(backdrop.querySelector('#medbot-tu-status'));
      }
    }));
    syncFooterVisibility('send'); // initial state

    // Programmatically switch to the settings tab (used when $tu config is required).
    const navigateToSettingsTab = () => {
      const settingsTab = backdrop.querySelector('.medbot-tab[data-tab="settings"]');
      if (settingsTab) settingsTab.click();
    };

    // -- Roll command dropdown --
    const rollCommandSelect = qs('#medbot-roll-cmd');
    rollCommandSelect.addEventListener('change', () => {
      selectedRollCommand = rollCommandSelect.value;
      saveSettings();
    });

    // -- Infinite mode toggle disables count input --
    const syncInfiniteToggle = () => {
      const isInfinite = infiniteToggle.checked;
      rollCountInput.disabled = isInfinite;
      rollCountInput.style.opacity = isInfinite ? '0.35' : '1';
    };
    infiniteToggle.addEventListener('change', syncInfiniteToggle);
    syncInfiniteToggle();

    // -- Numeric-only enforcement on number inputs --
    [rollCountInput, claimMinInput, claimMaxInput].forEach(input =>
      input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); })
    );

    // -- Kakera range Set / Clear --
    const claimSetButton   = qs('#medbot-claim-set');
    const claimClearButton = qs('#medbot-claim-clear');
    const seriesSetButton  = qs('#medbot-series-set');
    const seriesClearButton = qs('#medbot-series-clear');

    // Lock/unlock the kakera range inputs based on whether a range is set.
    const setRangeInputsLocked = (locked) => {
      claimMinInput.disabled = locked;
      claimMaxInput.disabled = locked;
      claimSetButton.disabled = locked;
      claimMinInput.style.opacity = locked ? '0.5' : '1';
      claimMaxInput.style.opacity = locked ? '0.5' : '1';
    };

    // Lock/unlock the series input based on whether a series is set.
    const setSeriesInputLocked = (locked) => {
      seriesInput.disabled = locked;
      seriesSetButton.disabled = locked;
      seriesInput.style.opacity = locked ? '0.5' : '1';
    };

    claimSetButton.addEventListener('click', () => {
      if (!mudaeStatus.lastUpdated) { navigateToSettingsTab(); return; }
      const min = Number(claimMinInput.value.trim()) || 0;
      const max = Number(claimMaxInput.value.trim()) || 0;
      if (!min || !max || min > max) return;
      autoClaimMinKakera = min;
      autoClaimMaxKakera = max;
      saveSettings();
      setRangeInputsLocked(true);
    });
    claimClearButton.addEventListener('click', () => {
      claimMinInput.value = '';
      claimMaxInput.value = '';
      autoClaimMinKakera = 0;
      autoClaimMaxKakera = 0;
      saveSettings();
      setRangeInputsLocked(false);
    });

    // -- Series Set / Clear --
    seriesSetButton.addEventListener('click', () => {
      if (!mudaeStatus.lastUpdated) { navigateToSettingsTab(); return; }
      const value = seriesInput.value.trim();
      if (!value) return;
      autoClaimSeries = value;
      saveSettings();
      setSeriesInputLocked(true);
    });
    seriesClearButton.addEventListener('click', () => {
      seriesInput.value = '';
      autoClaimSeries = '';
      saveSettings();
      setSeriesInputLocked(false);
    });

    // -- Auto-claim wishes toggle (requires $tu data) --
    wishToggle.addEventListener('change', () => {
      if (wishToggle.checked && !mudaeStatus.lastUpdated) {
        wishToggle.checked = false;
        navigateToSettingsTab();
        return;
      }
      autoClaimWishes = wishToggle.checked;
      saveSettings();
    });

    // -- Kakera row selection visual sync --
    backdrop.querySelectorAll('.medbot-kakera-row').forEach(row =>
      row.addEventListener('change', () => row.classList.toggle('selected', row.querySelector('input').checked))
    );

    // -- Auto-kakera toggle (requires $tu data) --
    kakeraToggle.addEventListener('change', () => {
      if (kakeraToggle.checked && !mudaeStatus.lastUpdated) {
        kakeraToggle.checked = false;
        navigateToSettingsTab();
      }
    });

    // -- Minigame multiplier buttons --
    backdrop.querySelectorAll('.medbot-mult-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const gameId    = btn.dataset.game;
        const direction = Number(btn.dataset.dir);
        gameMultipliers[gameId] = Math.max(1, Math.min(10, gameMultipliers[gameId] + direction));
        const newValue = gameMultipliers[gameId];
        const display  = backdrop.querySelector(`#medbot-${gameId}-mult`);
        if (display) display.textContent = `${newValue}x`;
        // Update disabled state of sibling buttons
        const control = btn.closest('.medbot-multiplier-control');
        control.querySelector('[data-dir="-1"]').disabled = newValue <= 1;
        control.querySelector('[data-dir="1"]').disabled  = newValue >= 10;
      });
    });

    // -- Save & apply all modal settings --
    const applyAndSaveSettings = () => {
      autoKakeraEnabled  = kakeraToggle.checked;
      selectedKakeraTypes = new Set(kakeraCheckboxes.filter(el => el.checked).map(el => el.dataset.kakeraKey));
      autoClaimWishes    = wishToggle.checked;
      saveSettings();
    };

    // -- Footer button handlers --
    backdrop.querySelector('#medbot-save').addEventListener('click', () => { applyAndSaveSettings(); closeMedBotModal(); });
    backdrop.querySelector('#medbot-cancel').addEventListener('click', closeMedBotModal);
    backdrop.querySelector('#medbot-stop')?.addEventListener('click', () => { stopMedBot(); closeMedBotModal(); });
    backdrop.querySelector('#medbot-start').addEventListener('click', () => {
      if (!mudaeStatus.lastUpdated) {
        navigateToSettingsTab();
        return;
      }
      applyAndSaveSettings();
      const useInfinite = infiniteToggle.checked;
      const rollCount   = Number(rollCountInput.value.trim());
      if (!useInfinite && (!rollCount || !Number.isInteger(rollCount) || rollCount < 1)) {
        alert('Enter a number greater than 0, or enable infinite mode.');
        return;
      }
      startMedBot(rollCount, useInfinite);
      closeMedBotModal();
    });

    // -- Minigame play buttons --
    [[runAutoOh, 'oh'], [runAutoOc, 'oc'], [runAutoOq, 'oq'], [runAutoOt, 'ot']].forEach(([runFn, gameId]) =>
      qs(`#medbot-${gameId}`)?.addEventListener('click', () => { closeMedBotModal(); runFn(); })
    );

    // -- Configure ($tu) button --
    const configureButton = backdrop.querySelector('#medbot-configure-tu');
    configureButton?.addEventListener('click', () => {
      isWaitingForTuReply = true;
      sendDiscordMessage('$tu');
      configureButton.textContent = 'Sent,  waiting for reply…';
      configureButton.disabled = true;
      // Auto-reset button after 8s if no response
      setTimeout(() => { configureButton.textContent = 'Configure'; configureButton.disabled = false; }, 8000);
    });

    // -- Live $tu countdown refresh (1s interval while settings panel is open) --
    const tuRefreshInterval = setInterval(() => {
      if (!document.contains(backdrop)) { clearInterval(tuRefreshInterval); return; }
      const statusContainer = backdrop.querySelector('#medbot-tu-status');
      if (statusContainer?.closest('[data-panel="settings"].active')) renderTuStatus(statusContainer);
    }, 1000);

    // -- Close modal on backdrop click (not drag-from-modal) --
    let mouseDownOnBackdrop = false;
    backdrop.addEventListener('mousedown', e => { mouseDownOnBackdrop = e.target === backdrop; });
    backdrop.addEventListener('mouseup', e => {
      if (mouseDownOnBackdrop && e.target === backdrop) closeMedBotModal();
      mouseDownOnBackdrop = false;
    });

    // Auto-focus the roll count input
    setTimeout(() => rollCountInput.focus(), 10);
  }

  // ===================================================================
  //  SECTION 26,  BOOT / INITIALIZATION
  //  Wire up the global hotkey, load saved settings, inject styles,
  //  start observers, and begin the periodic housekeeping tick.
  // ===================================================================

  // Global hotkey: Ctrl+M opens the MedBot modal
  window.addEventListener('keydown', e => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      e.stopPropagation();
      openMedBotModal();
    }
  }, true);

  // Initialise
  loadSettings();
  injectStyles();
  observeDiscordMenus();
  startBootObserver();

  // -- Periodic housekeeping tick (every 700ms) --
  let housekeepingTick = 0;
  setInterval(() => {
    housekeepingTick++;

    // Update placeholder text and detect server changes
    const placeholder = getPlaceholder();
    if (placeholder && !placeholder.getAttribute('data-medbot-original')) {
      placeholder.setAttribute('data-medbot-original', placeholder.textContent || '');
    }
    updateVisuals(placeholder);

    // Detect server switches and reload per-server $tu data
    const detectedServerId = getCurrentChannelInfo()?.serverId || null;
    if (detectedServerId && detectedServerId !== currentServerId) {
      currentServerId = detectedServerId;
      loadMudaeStatus();
    }

    // Channel lock guard: pause if user navigated away from locked channel (every 2 ticks approx 1.4s)
    if (housekeepingTick % 2 === 0 && botIsRunning && channelLockEnabled && lockedChannelId) {
      if (isWaitingForMudaeReply && !isOnLockedChannel()) {
        isWaitingForMudaeReply = false;
        clearTimers();
        channelPaused = true;
        nextRollTimer = setTimeout(executeNextRoll, 1500);
        updateVisuals();
      }
    }

    // Expire stale cooldown timers (every 14 ticks ≈ 10s)
    if (housekeepingTick % 14 === 0) expireTimers();
  }, 700);

  console.log('[MedBot UI] Loaded v3.1');
})();
