<div align="center">

<img src="https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExZWc4aWpiM3E0NWt0ZGFjbG04aWhvbTE1YzJuMjhucXN3ODhzeXM5dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/bXufANMxyrNihW1iTv/giphy.gif" width="80px">

# MedBot: Mudae automation inside the browser.

**Mudae automation for Discord. Auto roll, kakera, claims and minigames.**

[![Version](https://img.shields.io/badge/version-3.0-5865f2?style=flat-square)](https://github.com/MedicV2/MedBot)
[![Platform](https://img.shields.io/badge/platform-Tampermonkey-orange?style=flat-square)](https://www.tampermonkey.net/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

[![Install](https://img.shields.io/badge/Install%20Script-Click%20Here-5865f2?style=for-the-badge&logo=tampermonkey)](https://raw.githubusercontent.com/MedicV2/MedBot/main/medbot.user.js)

</div>

---

## Features

### Auto Roll
Set a roll count or flip on **Infinite Mode**. The bot keeps rolling and automatically burns `$us` to recover the rollcap when it hits the limit. Press `Ctrl+M` to open the panel, pick your roll command (`$wa`, `$w`, `$wg`, etc.) and go.

### Auto Kakera
Automatically clicks kakera buttons the moment they appear on a roll. You pick exactly which types to collect (purple, blue, teal, green, yellow, orange, red, rainbow, light, dark, chaos) in any combination.

### Auto Claim
Three independent claim modes, all usable together:
| Mode | How it works |
|---|---|
| **Wishes** | Claims any character wished by your account |
| **Kakera range** | Claims characters whose kakera value falls between your min and max |
| **Series** | Claims any character from a series matching your filter |

### Auto Minigames
One-click runners for all four Mudae sphere games, each with a 1x-10x multiplier:

| Game | Strategy |
|---|---|
| `$oh` | Targets highest value spheres first, free purples on the side |
| `$oc` | Uses spatial inference to deduce the red sphere (~99% accuracy) |
| `$oq` | Constraint propagation to locate all three purple spheres |
| `$ot` | Collects free spheres first, only spends clicks on blue when forced |

### Channel Lock
Lock the bot to a specific channel and server. If you switch channels mid-roll, the bot pauses and resumes automatically when you come back.

### Status Display
The Discord chat input shows live bot status: rolls left, waiting for Mudae, rollcap recovery in progress, wrong channel, etc.

---

## Installation

> **Requires [Tampermonkey](https://www.tampermonkey.net/).** Install it for your browser first.

| Browser | Link |
|---|---|
| Chrome | [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) |
| Edge | [Microsoft Store](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) |

Once Tampermonkey is installed, click the button below and it will open an install prompt automatically:

[![Install](https://img.shields.io/badge/Install%20MedBot-5865f2?style=for-the-badge&logo=tampermonkey&logoColor=white)](https://raw.githubusercontent.com/MedicV2/MedBot/main/medbot.user.js)

---

## Setup

After installing, open Discord in your browser and head to a Mudae channel.

1. Press **`Ctrl+M`** or click the **+** in the chat box and select **MedBot** to open the panel
2. Go to the **Settings** tab and click **Configure** (this sends `$tu` and syncs your roll/claim cooldowns)
3. Configure whatever features you want, then hit **Start**

> Configure needs to be run once per server. The data is saved and reused across sessions.

---

## Usage

Two ways to open MedBot:
- Click the **+** button in the Discord chat box and select **MedBot** from the menu
- Press **`Ctrl+M`** anywhere on Discord

| Shortcut | Action |
|---|---|
| `Ctrl+M` | Open / close the MedBot panel |

The panel has five tabs:

- **Send** - pick roll command, set count or toggle infinite mode
- **Kakera** - enable auto kakera and select which types to collect
- **Claim** - set up wish/range/series auto claiming
- **Extra** - run `$oh`, `$oc`, `$oq`, `$ot` with optional multipliers
- **Settings** - configure server sync and channel lock

---

## License

MIT. Do whatever you want with it, but keep the copyright notice intact.
<meta name="google-site-verification" content="Z0y1v2MykduOE2opOu2rVqb_qDbP1jXYk3S0dx02EUs" />
Copyright (c) 2026 [MedicV2](https://github.com/MedicV2)

