# MudaeCraft

MudaeCraft is a Tampermonkey script designed to enhance your Discord experience with the Mudae bot. It automatically claims kakera sources and characters based on customizable thresholds.

## Features

- **Auto Kakera Claim**: Automatically click kakera reactions in Discord messages.
- **Auto Waifu Claim**: Automatically claim characters with a kakera value above a specified threshold.
- **Customizable Settings**: User-friendly interface to customize which kakera types to claim and the minimum kakera value for waifus.

## Installation

1. **Install Tampermonkey**: Ensure you have the Tampermonkey extension installed in your browser.
   - [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Microsoft Edge](https://www.microsoft.com/en-us/p/tampermonkey/9nblggh5162s)

2. **Add the Script**:
   - Open Tampermonkey and click "Create a new script".
   - Copy the entire MudaeCraft script into the editor.
   - Save the script.

## Usage

- **Discord Integration**: The script runs automatically on the Discord channels where Mudae bot is active.
- **Settings Panel**: Click the **MudaeCraft** button in Discord to open the settings panel.
  - **Auto Kakera Reaction**: Toggle auto-claim for kakera types.
  - **Auto Claim Waifus**: Set the minimum kakera value for auto-claiming waifus.

### Settings

1. **Auto Kakera Reaction**: Enable or disable automatic claiming of specific kakera types (e.g., purple, orange, red).
2. **Auto Claim Waifus**:
   - Set the minimum kakera value.
   - Toggle the feature on or off.

### UI Components

- **Settings Button**: Located in the Discord UI, opens the MudaeCraft settings.
- **Draggable Modal**: Contains options to customize the script's behavior.
- **Increment/Decrement Buttons**: Adjust the kakera value threshold for waifu claims.

### Example

Here’s how the settings modal looks in the Discord interface:

![Settings Modal Example](https://i.imgur.com/your-image-url.png)

## Script Details

```javascript
// ==UserScript==
// @name         MudaeCraft
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Mudae Helper, Automatically claim Kakera sources & Automatically claim characters with a kakera > a given value.
// @author       Medc
// @match        https://discord.com/channels/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==
```

## CSS

The script includes custom styles for toggles, buttons, and the settings modal to blend seamlessly with Discord's interface.

## Support

For questions or support, please open an issue on the GitHub repository.

## License

This project is licensed under the MIT License.

---

Enjoy your enhanced Mudae experience with MudaeCraft! Happy claiming!
