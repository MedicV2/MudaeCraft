// ==UserScript==
// @name         MudaeCraft
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  Auto-clicks specific kakera buttons.
// @author       Medc
// @match        https://discord.com/channels/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==

// CSS
GM_addStyle(`.switch {position: relative;display: inline-block;width: 60px;height: 24px;}.switch input {opacity: 0;width: 0;height: 0;}.slider {position: absolute;cursor: pointer;top: 2px;left: 0;right: 0;bottom: 0;background-color: #ccc;transition: .4s;height: 20px;}.slider:before {position: absolute;content: "";height: 18px;width: 18px;left: 4px;bottom: 1px;background-color: white;transition: .4s;}input:checked + .slider {background-color: #2196F3;}input:focus + .slider {box-shadow: 0 0 1px #2196F3;}input:checked + .slider:before {transform: translateX(26px);}.slider.round {border-radius: 34px;}.slider.round:before {border-radius: 50%;}.settings-label {display: inline-block;width: 140px;color: #FFFFFF;text-align: right;margin-right: 12px;}#detailedSettingsPanel {display: none;position: absolute;left: 100%;top: 0;width: 300px;background-color: #36393F;padding: 10px;border-radius: 8px;box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);z-index: 10001;}#toggleContainer {display: flex;align-items: center;justify-content: center;}#saveButtonContainer {text-align: center;margin-top: 20px;}.settingsIcon {margin-left: 10px;cursor: pointer;display: flex;align-items: center;justify-content: center;}.settings-container {display: flex;flex-direction: column;align-items: flex-start;padding: 10px;}.settings-item {margin-bottom: 10px;}.settings-label {font-weight: bold;margin-bottom: 5px;color: #ccc;}.expander {display: flex;justify-content: flex-end;width: 100%;margin-top: 5px;}.expander-icon {cursor: pointer;fill: #ccc;transition: transform 0.3s ease;font-size: 24px;margin-left: 8px;}.expander-icon.open {transform: rotate(45deg);}input[type='number']::-webkit-inner-spin-button, input[type='number']::-webkit-outer-spin-button {-webkit-appearance: inner-spin-button !important;opacity: 1 !important;}input[type='number'] {-moz-appearance: textfield !important;}`);

(() => {
    'use strict';

    // Flags to control the state of auto-claiming features
    let autoClaimIsActive = false; // Auto-claim for kakera
    let waifuClaimIsActive = false; // Auto-claim for waifus
    let waifuKakeraValueIsActive = false; // Check if waifu kakera value comparison is active
    let waifuValue = ""; // Holds the kakera value threshold for claiming waifus

    // URLs for kakera emojis used in the script
    const kakera = {
        purple: "https://cdn.discordapp.com/emojis/609264156347990016.webp?size=44&quality=lossless",
        blue: "https://cdn.discordapp.com/emojis/469835869059153940.webp?size=44&quality=lossless",
        teal: "https://cdn.discordapp.com/emojis/609264180851376132.webp?size=44&quality=lossless",
        green: "https://cdn.discordapp.com/emojis/609264166381027329.webp?size=44&quality=lossless",
        yellow: "https://cdn.discordapp.com/emojis/605112931168026629.webp?size=44&quality=lossless",
        white: "https://cdn.discordapp.com/emojis/815961697918779422.webp?size=44&quality=lossless",
        orange: "https://cdn.discordapp.com/emojis/605112954391887888.webp?size=44&quality=lossless",
        red: "https://cdn.discordapp.com/emojis/605112980295647242.webp?size=44&quality=lossless",
        rainbow: "https://cdn.discordapp.com/emojis/608192076286263297.webp?size=44&quality=lossless"
    };

    // URLs for specific character emojis (Ram and Rem) for Next and Back buttons to prevent clicking them when auto waifu claim is on.
    const RamRem = {
        rem: "https://cdn.discordapp.com/emojis/847502744176820256.webp?size=44&quality=lossless",
        ram: "https://cdn.discordapp.com/emojis/847502746025459792.webp?size=44&quality=lossless",
    };

    // Sources of kakera claims, initialized with specific colors
    const kakeraClaimSources = [kakera.purple, kakera.orange, kakera.red, kakera.rainbow];

    // Helper function to log messages with specific styles
    const richLog = (str, color, size) => {
        console.log(`%c${str}`, `color: ${color}; font-size: ${size}px; font-weight: bold;`);
    };

    // Function to claim kakera if the feature is active
    const kakeraClaim = (node) => {
        if (!autoClaimIsActive) return; // Exit if auto-claim is not active

        // Iterate through the sources and try to find matching images in the node (kakera src)
        kakeraClaimSources.forEach(source => {
            const img = node.querySelector(`img[src="${source}"]`);
            if (img) {
                richLog(`Button with specified image (${source}) found. Attempting to click...`, 'lightgreen', 15);
                node.click(); // Click the button
                richLog('Button clicked.', 'lightgreen', 50);
            }
        });
    };

    // Function to claim waifus based on kakera value if the feature is active
    const claimWaifu = (node, node1) => {
        if (!waifuClaimIsActive) return; // Exit if waifu-claim is not active

        // Find the description div and parse the kakera value
        const descriptionDiv = node.querySelector('.embedDescription_ad0b71 strong');
        if (descriptionDiv && descriptionDiv.tagName.toLowerCase() === 'strong') {
            const number = parseInt(descriptionDiv.textContent, 10); // Parse the kakera value
            if (!isNaN(number) && number > document.getElementById('waifuKakeraValue').value && waifuKakeraValueIsActive) {
                // Check if the kakera value is higher than the set threshold
                const button = node1.querySelector('.button_dd4f85');
                if (button) {
                    const imgs = button.querySelectorAll('img');
                    // Ensure none of the images are in the excluded list
                    if (Array.from(imgs).every(img => !Object.values(kakera).includes(img.src) && !Object.values(RamRem).includes(img.src))) {
                        button.click(); // Click the claim button
                    }
                }
            }
        }
    };

    // Callback function for MutationObserver to handle added nodes
    const callback = (mutationsList) => {
        mutationsList.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.querySelectorAll) {
                        // Find buttons to claim kakera
                        node.querySelectorAll('.button_dd4f85.lookFilled_dd4f85.colorPrimary_dd4f85.sizeSmall_dd4f85.grow_dd4f85').forEach(kakeraClaim);

                        // Find and iterate over grid and container nodes to claim waifus
                        const gridNodes = node.querySelectorAll('.grid_ad0b71');
                        const containerNodes = node.querySelectorAll('.container_e426aa');
                        gridNodes.forEach(gridNode => {
                            containerNodes.forEach(containerNode => {
                                claimWaifu(gridNode, containerNode);
                            });
                        });
                    }
                });
            }
        });
    };

    // MutationObserver for monitoring changes in the DOM
    const observer = new MutationObserver(callback);
    let observationTimeout = null;

    // Function to start observing the target node
    const startObserving = () => {
        const targetNode = document.querySelector('.scrollerInner_e2e187'); // Main container to observe
        if (targetNode) {
            clearTimeout(observationTimeout);
            observationTimeout = null;
            observer.observe(targetNode, { childList: true, subtree: true }); // Start observing child and subtree changes
            richLog('Observation started on .scrollerInner_e2e187', 'lightgreen', 25);
        } else if (!observationTimeout) {
            richLog('Waiting for .scrollerInner_e2e187 to appear...', 'orange', 25);
            observationTimeout = setTimeout(startObserving, 1000); // Retry observing after 1 second if target not found
        }
    };
    startObserving();

    let bodyObserver = null; // Observer for body changes

    // Function to start observing the body for changes
    const startBodyObservation = () => {
        if (!bodyObserver) {
            bodyObserver = new MutationObserver(bodyObserverCallback);
        } else {
            bodyObserver.disconnect();
        }
        bodyObserver.observe(document.body, { childList: true, subtree: true });
    };

    // Callback function for body observer
    const bodyObserverCallback = (mutationsList) => {
        mutationsList.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                if (!document.getElementById('kakeraSettingsButton')) {
                    reinitializeScript(); // Reinitialize if settings button is not found
                }
            }
        });
    };
    startBodyObservation();

    // Function to reinitialize the script components
    function reinitializeScript() {
        startObserving();
        startBodyObservation();
        checkAndInsertSettingsButton(); // Ensure settings button is inserted
    }

    // Function to check and insert the settings button in the UI
    function checkAndInsertSettingsButton() {
        if (!document.getElementById('kakeraSettingsButton')) {
            insertSettingsButton();
        }
    }

    // Function to get or create the settings modal in the DOM
    function getOrCreateSettingsModal() {
        let modal = document.getElementById('kakeraSettingsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'kakeraSettingsModal';
            modal.style = `
                position: fixed; z-index: 10000; left: 50%; top: 50%; transform: translate(-50%, -50%);
                width: 400px; background-color: #36393F; padding: 20px; border-radius: 8px;
                box-shadow: 0 2px 10px 0 rgba(0, 0, 0, 0.2); color: #DCDDDE; display: none;
            `;
            document.body.appendChild(modal); // Append modal to the document body
        }
        return modal;
    }

    // Function to toggle the visibility of the settings modal
    function toggleSettingsModal() {
        const modal = getOrCreateSettingsModal();
        modal.style.display = modal.style.display === 'block' ? 'none' : 'block'; // Toggle display property
    }

    // Function to create a detailed settings panel for kakera
    function createDetailedSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'detailedSettingsPanel';
        panel.style = `
            display: none; position: absolute; left: 100%; top: 0; width: 300px;
            background-color: #2F3136; padding: 10px; border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        `;
        // Create checkboxes for each kakera color
        panel.innerHTML = Object.keys(kakera).map(color => `
            <label style="color: #BBB; display: flex; align-items: center; margin: 5px 0;">
                <input type="checkbox" id="kakera${color.charAt(0).toUpperCase() + color.slice(1)}">
                <img src="${kakera[color]}" style="width: 20px; height: 20px; margin-right: 10px;">
                ${color.charAt(0).toUpperCase() + color.slice(1)}
            </label>
        `).join('');
        return panel;
    }

    // Function to create a settings panel for waifu claims
    function createWaifuClaimSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'waifuClaimSettingsPanel';
        panel.style = `
            display: none; position: absolute; left: 100%; top: 0; width: 300px;
            background-color: #2F3136; padding: 10px; border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        `;

        // Buttons to increment or decrement the kakera value
        const incrementButton = document.createElement('button');
        incrementButton.innerText = '▲';
        incrementButton.style.marginLeft = '5px';

        const decrementButton = document.createElement('button');
        decrementButton.innerText = '▼';
        decrementButton.style.marginLeft = '5px';

        // Event listeners for changing the kakera value
        incrementButton.addEventListener('click', () => changeWaifuValue(50));
        decrementButton.addEventListener('click', () => changeWaifuValue(-50));

        // Adding event listeners for holding the button to change the value continuously
        incrementButton.addEventListener('mousedown', () => holdChangeWaifuValue(50, incrementButton));
        decrementButton.addEventListener('mousedown', () => holdChangeWaifuValue(-50, decrementButton));

        // Input group for kakera value input and checkboxes
        const inputGroup = document.createElement('div');
        inputGroup.style = 'display: flex; align-items: center;';
        inputGroup.innerHTML = `
            <img src="${kakera.blue}" style="width: 20px; height: 20px; margin-right: 10px;">
            <input type="number" id="waifuKakeraValue" style="margin-left: 10px;" step="50" min="0" placeholder="Value">
        `;
        inputGroup.appendChild(decrementButton);
        inputGroup.appendChild(incrementButton);

        // Checkbox to activate kakera value comparison
        const checkboxLabel = document.createElement('label');
        checkboxLabel.style = 'display: flex; align-items: center; margin-left: 10px;';
        checkboxLabel.innerHTML = `<input type="checkbox" id="waifuKakeraValueCheckbox">`;
        inputGroup.appendChild(checkboxLabel);

        // Text area for additional notes or settings
        const textarea = document.createElement('textarea');
        textarea.id = 'waifuClaimTextarea';
        textarea.style = 'width: 100%; height: 100px; margin-top: 20px; resize: both;';

        panel.appendChild(inputGroup);
        panel.appendChild(textarea);
        return panel;
    }

    // Function to create a setting row with a toggle switch and optional expander
    function createSettingRow(settingName, toggleId, isActive, expanderId, settingsPanelCreator) {
        const settingRow = document.createElement('div');
        settingRow.className = 'settings-item';

        const settingLabel = document.createElement('div');
        settingLabel.className = 'settings-label';
        settingLabel.textContent = settingName; // Label for the setting
        settingRow.appendChild(settingLabel);

        const toggleAndExpanderContainer = document.createElement('div');
        toggleAndExpanderContainer.style.display = 'flex';
        toggleAndExpanderContainer.style.alignItems = 'center';

        const settingToggle = createSwitch(toggleId, isActive); // Toggle switch element
        const settingExpander = createExpander(expanderId); // Expander element

        toggleAndExpanderContainer.appendChild(settingToggle);
        toggleAndExpanderContainer.appendChild(settingExpander);
        settingRow.appendChild(toggleAndExpanderContainer);

        const settingPanel = settingsPanelCreator(); // Create the associated settings panel
        settingRow.appendChild(settingPanel);

        // Event listener for expanding/collapsing the settings panel
        settingExpander.addEventListener('click', () => {
            toggleSettingsPanel(settingPanel, settingExpander);
        });

        return settingRow;
    }

    // Function to create a toggle switch
    function createSwitch(id, isActive) {
        const switchLabel = document.createElement('label');
        switchLabel.className = 'switch';
        switchLabel.innerHTML = `<input type="checkbox" id="${id}" ${isActive ? 'checked' : ''}><span class="slider round"></span>`;
        return switchLabel;
    }

    // Function to create an expander (+/-) button
    function createExpander(id) {
        const expander = document.createElement('div');
        expander.className = 'expander-icon';
        expander.id = id;
        expander.innerHTML = '+';
        expander.style.cursor = 'pointer';
        expander.style.fontSize = '24px';
        expander.style.marginLeft = '8px';
        return expander;
    }

    // Function to toggle a settings panel open or closed
    function toggleSettingsPanel(panel, expander) {
        const isPanelOpen = panel.style.display === 'block';
        panel.style.display = isPanelOpen ? 'none' : 'block'; // Toggle display
        expander.innerHTML = isPanelOpen ? '+' : '-'; // Change expander icon
    }

    // Function to populate the content of the settings modal
    function populateSettingsContent() {
        makeModalDraggable(); // Make the modal draggable
        const modal = getOrCreateSettingsModal();
        modal.innerHTML = ''; // Clear existing content

        const settingsContainer = document.createElement('div');
        settingsContainer.className = 'settings-container';
        modal.appendChild(settingsContainer);

        // Create settings rows for auto kakera reaction and waifu claiming
        const autoKakeraRow = createSettingRow(
            'Auto Kakera Reaction:',
            'autoClaimToggle',
            autoClaimIsActive,
            'autoClaimSettingsExpander',
            createDetailedSettingsPanel
        );
        settingsContainer.appendChild(autoKakeraRow);

        const autoClaimWaifusRow = createSettingRow(
            'Auto Claim Waifus:',
            'waifuClaimToggle',
            waifuClaimIsActive,
            'waifuClaimSettingsExpander',
            createWaifuClaimSettingsPanel
        );
        settingsContainer.appendChild(autoClaimWaifusRow);

        // Save button to save the settings
        const saveButton = document.createElement('button');
        saveButton.id = 'saveSettingsButton';
        saveButton.textContent = 'Save';
        saveButton.className = 'save-settings-button';
        saveButton.style = `
            background-color: #5865F2; color: white; border: none;
            padding: 10px 20px; border-radius: 4px; cursor: pointer;
        `;
        saveButton.addEventListener('click', saveKakeraSettings);

        const saveButtonContainer = document.createElement('div');
        saveButtonContainer.id = 'saveButtonContainer';
        saveButtonContainer.appendChild(saveButton);
        settingsContainer.appendChild(saveButtonContainer);

        loadKakeraSettings(); // Load existing settings from storage
    }

    // Function to change the kakera value in the input field
    function changeWaifuValue(amount) {
        const numberInput = document.getElementById('waifuKakeraValue');
        numberInput.value = Math.max(0, Number(numberInput.value) + amount); // Ensure the value doesn't go below 0
    }

    // Function to hold the change in waifu value on button hold
    function holdChangeWaifuValue(amount, button) {
        const intervalId = setInterval(() => changeWaifuValue(amount), 100); // Change value every 100ms
        const clear = () => clearInterval(intervalId); // Clear interval on mouse up or leave
        button.addEventListener('mouseup', clear);
        button.addEventListener('mouseleave', clear);
    }

    // Function to toggle auto-claim for kakera
    function toggleAutoClaim() {
        autoClaimIsActive = document.getElementById('autoClaimToggle').checked; // Get the toggle state
        GM_setValue('autoClaim', autoClaimIsActive ? 'ON' : 'OFF'); // Save state to storage
        console.log('Auto-claim is now:', autoClaimIsActive ? 'ON' : 'OFF');
    }

    // Function to toggle waifu claim feature
    function toggleWaifuClaim() {
        waifuClaimIsActive = document.getElementById('waifuClaimToggle').checked; // Get the toggle state
        GM_setValue('waifuClaimToggle', waifuClaimIsActive ? 'ON' : 'OFF'); // Save state to storage
        console.log('Waifu-claim is now:', waifuClaimIsActive ? 'ON' : 'OFF');
    }

    // Function to save all kakera settings
    function saveKakeraSettings() {
        toggleAutoClaim();
        toggleWaifuClaim();
        waifuValue = document.getElementById('waifuKakeraValue').value; // Get kakera value input
        GM_setValue('waifuKakeraValue', waifuValue); // Save to storage
        waifuKakeraValueIsActive = document.getElementById('waifuKakeraValueCheckbox').checked; // Get checkbox state
        GM_setValue('waifuKakeraValueCheckbox', waifuKakeraValueIsActive);

        // Save kakera settings based on checkboxes
        const kakeraSettings = Object.fromEntries(
            Object.keys(kakera).map(color => [color, document.getElementById(`kakera${color.charAt(0).toUpperCase() + color.slice(1)}`).checked])
        );

        GM_setValue('kakeraSettings', JSON.stringify(kakeraSettings)); // Save to storage
        updateKakeraClaimSources(kakeraSettings); // Update the sources list
        console.log('Kakera settings saved:', kakeraSettings);
        toggleSettingsModal(); // Close settings modal
    }

    // Function to load kakera settings from storage
    function loadKakeraSettings() {
        const kakeraSettings = JSON.parse(GM_getValue('kakeraSettings', '{}'));

        // Load kakera checkbox states from storage
        Object.entries(kakeraSettings).forEach(([color, checked]) => {
            const checkbox = document.getElementById(`kakera${color.charAt(0).toUpperCase() + color.slice(1)}`);
            if (checkbox) checkbox.checked = checked;
        });

        // Load waifu kakera value and checkbox state
        waifuValue = GM_getValue('waifuKakeraValue', waifuValue);
        waifuKakeraValueIsActive = GM_getValue('waifuKakeraValueCheckbox', waifuKakeraValueIsActive);

        // Set inputs with loaded values
        document.getElementById('waifuKakeraValue').value = waifuValue;
        document.getElementById('waifuKakeraValueCheckbox').checked = waifuKakeraValueIsActive;

        // Load and set auto-claim toggle states
        autoClaimIsActive = GM_getValue('autoClaim', 'OFF') === 'ON';
        waifuClaimIsActive = GM_getValue('waifuClaimToggle', 'OFF') === 'ON';

        document.getElementById('autoClaimToggle').checked = autoClaimIsActive;
        document.getElementById('waifuClaimToggle').checked = waifuClaimIsActive;

        updateKakeraClaimSources(kakeraSettings); // Update the sources list based on settings
    }

    // Function to update the list of kakera claim sources
    function updateKakeraClaimSources(settings) {
        kakeraClaimSources.length = 0; // Clear current sources list
        Object.entries(settings).forEach(([color, checked]) => {
            if (checked) kakeraClaimSources.push(kakera[color]); // Add checked sources
        });
        console.log('Updated kakeraClaimSources:', kakeraClaimSources);
    }

    // Function to insert the settings button into the UI
    const insertSettingsButton = () => {
        const buttonsContainer = document.querySelector('.buttons_d0696b'); // Container for buttons
        if (buttonsContainer && !document.getElementById('kakeraSettingsButton')) {
            const settingsButton = document.createElement('button');
            settingsButton.id = 'kakeraSettingsButton';
            settingsButton.textContent = 'MudaeCraft'; // Button text
            settingsButton.onclick = () => {
                toggleSettingsModal();
                populateSettingsContent();
            };
            settingsButton.style = `
                background-color: #5865F2; color: white; border: none;
                padding: 2px 5px; margin-left: 5px; border-radius: 4px; cursor: pointer;
            `;
            settingsButton.className = 'button_afdfd9 lookBlank__7ca0a colorBrand_b2253e grow__4c8a4';
            settingsButton.onmouseover = () => showGifAnimation(settingsButton); // Show GIF on hover
            settingsButton.onmouseout = hideGifAnimation; // Hide GIF on mouse out
            buttonsContainer.appendChild(settingsButton);
        } else {
            setTimeout(insertSettingsButton, 1000); // Retry after 1 second if container not found
        }
    };

    // Function to make the settings modal draggable
    function makeModalDraggable() {
        const modal = getOrCreateSettingsModal();
        let isMouseDown = false; // Flag for drag state
        let offsetX = 0, offsetY = 0; // Offset for dragging

        // Mouse down event to start dragging
        modal.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            offsetX = e.clientX - parseInt(window.getComputedStyle(modal).left);
            offsetY = e.clientY - parseInt(window.getComputedStyle(modal).top);
            modal.style.cursor = 'move'; // Change cursor to move
        });

        // Mouse up event to stop dragging
        document.addEventListener('mouseup', () => {
            isMouseDown = false;
            modal.style.cursor = 'default'; // Reset cursor
        });

        // Mouse move event to handle dragging
        document.addEventListener('mousemove', (e) => {
            if (isMouseDown) {
                modal.style.left = `${e.clientX - offsetX}px`; // Update modal position
                modal.style.top = `${e.clientY - offsetY}px`;
            }
        });
    }

    // Function to insert a dancing GIF in the UI
    function insertDancingGif() {
        const gifUrl = 'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExeDY3bjllcW5raGJndWxjMjVpcW9ldXVlbmZnM3FqeXZ4Z2JveWhiOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/6QJ110U9TFhs084nyw/giphy.gif';
        let gif = document.getElementById('dancingGif');
        if (!gif) {
            gif = document.createElement('img');
            gif.id = 'dancingGif';
            gif.src = gifUrl; // Set GIF source
            gif.style = `
                width: 50px; height: 50px; position: absolute;
                top: 0; left: 0; opacity: 0; transition: opacity 0.5s, top 0.5s; pointer-events: none;
            `;
            document.body.appendChild(gif);
        }
        return gif;
    }

    // Function to show a GIF animation when hovering over the settings button
    function showGifAnimation(button) {
        const gif = insertDancingGif();
        const buttonRect = button.getBoundingClientRect(); // Get button position

        gif.style.top = `${buttonRect.top - gif.height}px`; // Position GIF above the button
        gif.style.left = `${buttonRect.left + 10}px`; // Position slightly to the right
        gif.style.opacity = '1'; // Make GIF visible
    }

    // Function to hide the GIF animation
    function hideGifAnimation() {
        const gif = document.getElementById('dancingGif');
        gif.style.opacity = '0'; // Make GIF invisible
    }

    // Initialize the script by inserting the settings button
    insertSettingsButton();
})();
