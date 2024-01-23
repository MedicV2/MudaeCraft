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

GM_addStyle(`
    /* The switch - the box around the slider */
    .switch {
        position: relative;
        display: inline-block;
        width: 60px; /* Adjust width as needed */
        height: 24px; /* Reduced height for the switch */
    }

    /* Hide default HTML checkbox */
    .switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }

    /* The slider */
    .slider {
        position: absolute;
        cursor: pointer;
        top: 2px; /* Center the slider inside the switch */
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        -webkit-transition: .4s;
        transition: .4s;
        height: 20px; /* Adjust slider height */
    }

    .slider:before {
        position: absolute;
        content: "";
        height: 18px; /* Adjust circle height */
        width: 18px; /* Adjust circle width */
        left: 4px;
        bottom: 1px; /* Center the circle vertically */
        background-color: white;
        -webkit-transition: .4s;
        transition: .4s;
    }

    input:checked + .slider {
        background-color: #2196F3;
    }

    input:focus + .slider {
        box-shadow: 0 0 1px #2196F3;
    }

    input:checked + .slider:before {
        -webkit-transform: translateX(26px);
        -ms-transform: translateX(26px);
        transform: translateX(26px);
    }

    /* Rounded sliders */
    .slider.round {
        border-radius: 34px;
    }

    .slider.round:before {
        border-radius: 50%;
    }

    /* Labels */
    .settings-label {
        display: inline-block;
        width: 140px; /* Adjust width as needed for your longest label */
        color: #FFFFFF;
        text-align: right;
        margin-right: 12px; /* Space between label and switch */
    }

    /* Arrow and Detailed Settings Panel Styles */
    #detailedSettingsPanel {
        display: none; /* Hidden by default */
        position: absolute;
        left: 100%;
        top: 0;
        width: 300px;
        background-color: #36393F; /* Discord's dark theme color */
        padding: 10px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        overflow: hidden;
        z-index: 10001; /* Ensure it's above other elements */
    }

    #toggleContainer {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    #saveButtonContainer {
        text-align: center;
        margin-top: 20px;
    }

    .settingsIcon {
        margin-left: 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .settings-container {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 10px;
    }

    .settings-item {
        margin-bottom: 10px;
    }

    .settings-label {
        font-weight: bold;
        margin-bottom: 5px;
        color: #ccc;
    }

    .expander {
        display: flex;
        justify-content: flex-end;
        width: 100%;
        margin-top: 5px;
    }

    .expander-icon {
        cursor: pointer;
    }

    #saveButtonContainer {
        width: 100%;
        margin-top: 15px;
    }

    .save-settings-button {
        /* styles for the save button */
        background-color: #5865F2;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 20px;
        width: 100%;
    }

    .expander-icon {
        /* styles for the expander SVG */
        cursor: pointer;
        fill: #ccc;
        transition: transform 0.3s ease;
    }

    .expander-icon.open {
        /* Style when the expander is "open" */
        transform: rotate(45deg); /* Example style */
    }

.expander-icon {
    cursor: pointer;
    margin-left: 8px; /* Space from the slider */
    font-size: 24px; /* Size of the '+' symbol */
}

    .expander-icon.open {
        /* Changes the '+' to a '-' when the panel is open */
        content: '-'; /* CSS won't affect this, so we'll handle it in JS */
    }

        input[type='number']::-webkit-inner-spin-button,
    input[type='number']::-webkit-outer-spin-button {
        -webkit-appearance: inner-spin-button !important;
        opacity: 1 !important;
    }

    input[type='number'] {
        -moz-appearance: textfield !important;
    }
`);

(function() {
    'use strict';

    // ALL SRC URLS UED ON EACH KAKERA CLAIM BUTTON
    let autoClaimIsActive = false;
    let waifuClaimIsActive = false; //Slider
    let waifuKakeraValueIsActive = false; //Checkbox to set claim value
    let waifuValue = ""

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

    const kakeraClaimSources = [kakera.purple, kakera.orange, kakera.red, kakera.rainbow]; // ONLY ONES THAT YOU WANT TO AUTO CLAIM


    // Arrow function to make fancy logs
    const richLog = (str,color,size) => {
        console.log(`%c${str}`, `color: ${color}; font-size: ${size}px; font-weight: bold;`);
    }


    const kakeraClaim = (node) => {
        if (!autoClaimIsActive) return; // Do nothing if auto claim is not active

        for (let source of kakeraClaimSources) {
            const img = node.querySelector(`img[src="${source}"]`);
            if (img) {
                richLog(`Button with specified image (${source}) found. Attempting to click...`, 'lightgreen', 15);
                node.click();
                richLog('Button clicked.', 'lightgreen', 50);
                break;
            }
        }
    };


    const claimWaifu = (node, node1) => {
        if (!waifuClaimIsActive) return;
        // Set laters card and button.
        var latestCard = node
        var latestButton = node1

        console.log(latestCard)
        console.log(latestButton)

        // Select description from latest card.
        var descriptionDiv = node.querySelector('.embedDescription__33443 strong');
        var numberFound = false;

        // The kakera value is inside <strong></strong> tags, so we get that number if it exists.
        if (descriptionDiv.tagName.toLowerCase() === 'strong') {
            var number = parseInt(descriptionDiv.textContent, 10);
            console.log(number);
            if (!isNaN(number) && number > document.getElementById('waifuKakeraValue').value && waifuKakeraValueIsActive) {// If the kakera value on the card is higher than X, find the corresponding button and if it is found, click it.
                numberFound = true;
                var button = latestButton.querySelector('button.component__43381');
                if (button) {
                    button.click();
                }
            }
        }
    }

    // Gets called whenever the HTML updates. (DOM mutation)
    const callback = (mutationsList, observer) => {
        // loop that iterates through the mutationsList. The mutationsList parameter contains information about the mutations that occurred in the DOM since the observer was set up.
        for (let mutation of mutationsList) {
            // If child nodes (elements) are added or removed from the observed DOM elements.
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    // Kakera claim
                    if (node.nodeType === 1 && node.querySelectorAll) {
                        node.querySelectorAll('.component__43381.button_afdfd9.lookFilled__19298.colorPrimary__6ed40.sizeSmall__71a98.grow__4c8a4').forEach(kakeraClaim);
                    }
                    // Waifu claim based off kakera value
                    if (node.nodeType === 1 && node.querySelectorAll) {
                        const gridNodes = Array.from(node.querySelectorAll('.grid_c7c4e6'));
                        const containerNodes = Array.from(node.querySelectorAll('.container_d09a0b'));
                        gridNodes.forEach(gridNode => {
                            containerNodes.forEach(containerNode => {
                                claimWaifu(gridNode, containerNode);
                            });
                        });
                    }
                });
            }
        }
    };


    /*===============================================================================================================================================================*/

    // Reinitialize Script Functionality
    function reinitializeScript() {

        // Reinitialize Observers
        startObserving();
        startBodyObservation();

        // Reinitialize Settings Button
        checkAndInsertSettingsButton();
    }


    const observer = new MutationObserver(callback);
    let observationTimeout = null; // Initialize the timeout variable

    const startObserving = () => {
        const targetNode = document.querySelector('.scrollerInner__059a5');

        if (targetNode) {
            // If the target node exists, observe it and clear any existing timeout
            if (observationTimeout) {
                clearTimeout(observationTimeout);
                observationTimeout = null;
            }
            const config = { childList: true, subtree: true };
            observer.observe(targetNode, config);
            richLog('Observation started on .scrollerInner__059a5', 'lightgreen', 25);
        } else {
            // If the target node does not exist and there's no active timeout, set a new timeout
            if (!observationTimeout) {
                richLog('Waiting for .scrollerInner__059a5 to appear...', 'orange', 25);
                observationTimeout = setTimeout(startObserving, 1000);
            }
        }
    };
    startObserving();


    function checkAndInsertSettingsButton() {
        if (!document.getElementById('kakeraSettingsButton')) {
            insertSettingsButton();
        }
    }

    let bodyObserver = null;
    const startBodyObservation = () => {
        const config = { childList: true, subtree: true };
        if (!bodyObserver) {
            bodyObserver = new MutationObserver(bodyObserverCallback);
        } else {
            bodyObserver.disconnect();
        }
        bodyObserver.observe(document.body, config);
    };

    const bodyObserverCallback = (mutationsList, observer) => {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check for a more specific condition to avoid infinite reinitialization
                if (specificConditionForReinitialization()) {
                    reinitializeScript();
                }
            }
        }
    };

    function specificConditionForReinitialization() {
        // Example condition: check if the settings button is missing
        return !document.getElementById('kakeraSettingsButton');
    }

    // Start observing for body changes
    startBodyObservation();

    /*--------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*--------------------------------------------------------------------------------------------------------------------------------------------------------------*/

    // Function to create the modal if it doesn't exist or return it if it does
    function getOrCreateSettingsModal() {
        let modal = document.getElementById('kakeraSettingsModal');
        if (!modal) {
            // Create the modal
            modal = document.createElement('div');
            modal.id = 'kakeraSettingsModal';
            // Apply Discord's style to the modal
            modal.style = `position: fixed; z-index: 10000; left: 50%; top: 50%; transform: translate(-50%, -50%);
                           width: 400px; background-color: #36393F; padding: 20px; border-radius: 8px;
                           box-shadow: 0 2px 10px 0 rgba(0, 0, 0, 0.2); color: #DCDDDE; display: none;`;
            document.body.appendChild(modal);
        }
        return modal;
    }

    // Function to toggle the settings modal
    function toggleSettingsModal() {
        const modal = getOrCreateSettingsModal();
        if (modal.style.display === 'block') {
            modal.style.display = 'none';
        } else {
            modal.style.display = 'block';
        }
    }

    // Function to toggle detailed settings panel
    function toggleDetailedSettings() {
        const detailedSettings = document.getElementById('detailedSettingsPanel');
        const settingsIcon = document.getElementById('detailedSettingsArrow');

        if (detailedSettings.style.display === 'block') {
            detailedSettings.style.display = 'none';
            // Change SVG to "+"
            settingsIcon.innerHTML = '<path d="M13 6a1 1 0 1 0-2 0v5H6a1 1 0 1 0 0 2h5v5a1 1 0 1 0 2 0v-5h5a1 1 0 1 0 0-2h-5V6Z"></path>';
        } else {
            detailedSettings.style.display = 'block';
            // Change SVG to "-"
            settingsIcon.innerHTML = '<path d="M19 13H5a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2Z"></path>';
        }
    }


    // Function to create the detailed settings panel with checkboxes and kakera images
    function createDetailedSettingsPanel() {
        let detailedSettingsPanel = document.getElementById('detailedSettingsPanel');
        if (!detailedSettingsPanel) {
            detailedSettingsPanel = document.createElement('div');
            detailedSettingsPanel.id = 'detailedSettingsPanel';
            detailedSettingsPanel.style = `display: none; position: absolute; left: 100%; top: 0; width: 300px;
                                       background-color: #2F3136; padding: 10px; border-radius: 8px;
                                       box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);`;

            // Populate the panel with checkboxes and images
            detailedSettingsPanel.innerHTML = Object.keys(kakera).map(color => `
            <label style="color: #BBB; display: flex; align-items: center; margin: 5px 0;">
                <input type="checkbox" id="kakera${color.charAt(0).toUpperCase() + color.slice(1)}">
                <img src="${kakera[color]}" style="width: 20px; height: 20px; margin-right: 10px;">
                ${color.charAt(0).toUpperCase() + color.slice(1)}
            </label>`);
        }
        return detailedSettingsPanel;
    }

    function createSettingRow(settingName, toggleId, isActive, expanderId, settingsPanelCreator) {
        const settingRow = document.createElement('div');
        settingRow.className = 'settings-item';

        const settingLabel = document.createElement('div');
        settingLabel.className = 'settings-label';
        settingLabel.textContent = settingName;
        settingRow.appendChild(settingLabel);

        const toggleAndExpanderContainer = document.createElement('div');
        toggleAndExpanderContainer.style.display = 'flex';
        toggleAndExpanderContainer.style.alignItems = 'center';

        const settingToggle = createSwitch(toggleId, isActive);
        const settingExpander = createExpander(expanderId);

        // Place the expander next to the switch on the right side
        toggleAndExpanderContainer.appendChild(settingToggle);
        toggleAndExpanderContainer.appendChild(settingExpander);
        settingRow.appendChild(toggleAndExpanderContainer);

        const settingPanel = settingsPanelCreator();
        settingRow.appendChild(settingPanel);

        // Add event listener to the expander to toggle the settings panel and change the expander symbol
        settingExpander.addEventListener('click', () => {
            toggleSettingsPanel(settingPanel, settingExpander);
        });

        return settingRow;
    }


    function createExpanderSVG(id, isExpanded) {
        const svgNS = "http://www.w3.org/2000/svg";
        const expander = document.createElementNS(svgNS, "svg");
        expander.setAttribute("class", `expander-icon ${isExpanded ? 'open' : ''}`);
        expander.setAttribute("width", "24");
        expander.setAttribute("height", "24");
        expander.setAttribute("viewBox", "0 0 24 24");
        expander.setAttribute("fill", "currentColor");
        expander.innerHTML = isExpanded ?
            '<path d="M19 13H5a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2Z"></path>' : // For '-'
        '<path d="M13 6a1 1 0 1 0-2 0v5H6a1 1 0 1 0 0 2h5v5a1 1 0 1 0 2 0v-5h5a1 1 0 1 0 0-2h-5V6Z"></path>'; // For '+'
        expander.id = id;
        expander.style.cursor = 'pointer';
        return expander;
    }

    function toggleExpander(expander) {
        const isExpanded = expander.classList.contains('open');
        if (isExpanded) {
            expander.classList.remove('open');
            expander.innerHTML = '<path d="M13 6a1 1 0 1 0-2 0v5H6a1 1 0 1 0 0 2h5v5a1 1 0 1 0 2 0v-5h5a1 1 0 1 0 0-2h-5V6Z"></path>';
        } else {
            expander.classList.add('open');
            expander.innerHTML = '<path d="M19 13H5a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2Z"></path>';
        }
    }

    // Function to build and insert settings content into the modal
    function populateSettingsContent() {
        makeModalDraggable() // Make modal draggable

        const modal = getOrCreateSettingsModal();
        modal.innerHTML = ''; // Clear existing content to prevent duplication.


        const settingsContainer = document.createElement('div');
        settingsContainer.className = 'settings-container';
        modal.appendChild(settingsContainer);

        // Create Auto Kakera Reaction setting row
        const autoKakeraRow = createSettingRow(
            'Auto Kakera Reaction:',
            'autoClaimToggle',
            autoClaimIsActive,
            'autoClaimSettingsExpander',
            createAutoClaimSettingsPanel
        );
        settingsContainer.appendChild(autoKakeraRow);

        // Create Auto Claim Waifus setting row
        const autoClaimWaifusRow = createSettingRow(
            'Auto Claim Waifus:',
            'waifuClaimToggle',
            waifuClaimIsActive,
            'waifuClaimSettingsExpander',
            createWaifuClaimSettingsPanel
        );
        settingsContainer.appendChild(autoClaimWaifusRow);

        // Add the Save button
        const saveButton = document.createElement('button');
        saveButton.id = 'saveSettingsButton';
        saveButton.textContent = 'Save';
        saveButton.className = 'save-settings-button';
        saveButton.addEventListener('click', saveKakeraSettings);
        saveButton.style = 'background-color: #5865F2; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;';

        const saveButtonContainer = document.createElement('div');
        saveButtonContainer.id = 'saveButtonContainer';
        saveButtonContainer.appendChild(saveButton);
        settingsContainer.appendChild(saveButtonContainer);

        loadKakeraSettings() //Load all saved settings
    }

    function createSwitch(id, isActive) {
        const switchLabel = document.createElement('label');
        switchLabel.className = 'switch';
        switchLabel.innerHTML = `<input type="checkbox" id="${id}" ${isActive ? 'checked' : ''}><span class="slider round"></span>`;
        return switchLabel;
    }

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


    function toggleSettingsPanel(panel, expander) {
        const isPanelOpen = panel.style.display === 'block';
        panel.style.display = isPanelOpen ? 'none' : 'block';
        expander.innerHTML = isPanelOpen ? '+' : '-'; // Toggle between + and -
    }

    // Function to create the Auto Claim Settings Panel
    function createAutoClaimSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'autoClaimSettingsPanel';
        panel.style = `display: none; position: absolute; left: 100%; top: 0; width: 300px;
                   background-color: #2F3136; padding: 10px; border-radius: 8px;
                   box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);`;

        panel.innerHTML = Object.keys(kakera).map(color => `
        <label style="color: #BBB; display: flex; align-items: center; margin: 5px 0;">
            <input type="checkbox" id="kakera${color.charAt(0).toUpperCase() + color.slice(1)}">
            <img src="${kakera[color]}" style="width: 20px; height: 20px; margin-right: 10px;">
            ${color.charAt(0).toUpperCase() + color.slice(1)}
        </label>
    `).join('');


        panel.addEventListener('mousedown', function(e) {
            e.stopPropagation(); // Stop propagation (Makes them non draggable)
        });


        return panel;
    }


    // Function to create the Waifu Claim Settings Panel
    function createWaifuClaimSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'waifuClaimSettingsPanel';
        panel.style = `display: none; position: absolute; left: 100%; top: 0; width: 300px;
                   background-color: #2F3136; padding: 10px; border-radius: 8px;
                   box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);`;

        // Create the increment and decrement buttons
        const incrementButton = document.createElement('button');
        incrementButton.innerText = '▲';
        incrementButton.style = 'margin-left: 5px;';

        const decrementButton = document.createElement('button');
        decrementButton.innerText = '▼';
        decrementButton.style = 'margin-left: 5px;';

        // Function to inc and dec values
        function incrementValue() {const numberInput = document.getElementById('waifuKakeraValue');numberInput.value = Number(numberInput.value) + 50;}
        function decrementValue() {const numberInput = document.getElementById('waifuKakeraValue');const newValue = Number(numberInput.value) - 50;
            numberInput.value = newValue >= 0 ? newValue : 0; // Prevent the value from going below 0
        }

        // Click event for inc and dec buttons
        incrementButton.addEventListener('click', incrementValue);
        decrementButton.addEventListener('click', decrementValue);

        // Hold functionality for inc and dec buttons
        incrementButton.addEventListener('mousedown', function() {
            const intervalId = setInterval(incrementValue, 100);
            // Clear interval on mouse up or leaving the button
            incrementButton.addEventListener('mouseup', function() { clearInterval(intervalId); });
            incrementButton.addEventListener('mouseleave', function() { clearInterval(intervalId); });
        });

        decrementButton.addEventListener('mousedown', function() {
            const intervalId = setInterval(decrementValue, 100);
            // Clear interval on mouse up or leaving the button
            decrementButton.addEventListener('mouseup', function() { clearInterval(intervalId); });
            decrementButton.addEventListener('mouseleave', function() { clearInterval(intervalId); });
        });

        // Append the buttons and number input to a div
        const inputGroup = document.createElement('div');
        inputGroup.style = 'display: flex; align-items: center;';
        inputGroup.innerHTML = `
        <img src="${kakera.blue}" style="width: 20px; height: 20px; margin-right: 10px;">
        <input type="number" id="waifuKakeraValue" style="margin-left: 10px;" step="50" min="0" placeholder="Value">`;

        // Append the inputGroup to the panel
        panel.appendChild(inputGroup);

        // Append the increment and decrement buttons to the inputGroup
        inputGroup.appendChild(decrementButton);
        inputGroup.appendChild(incrementButton);

        const checkboxLabel = document.createElement('label');
        checkboxLabel.style = 'display: flex; align-items: center; margin-left: 10px;';
        checkboxLabel.innerHTML = `
        <input type="checkbox" id="waifuKakeraValueCheckbox">`;

        // Append the checkbox to the inputGroup
        inputGroup.appendChild(checkboxLabel);

        const textarea = document.createElement('textarea');
        textarea.id = 'waifuClaimTextarea';
        textarea.style = 'width: 100%; height: 100px; margin-top: 20px; resize: both;';

        // Append the textarea to the panel
        panel.appendChild(textarea);

        panel.addEventListener('mousedown', function(e) {
            e.stopPropagation(); // Stop propagation (Makes them non-draggable)
        });

        return panel;
    }


    // Function to toggle auto claim on/off without closing the modal
    function toggleAutoClaim() {
        // Save the auto claim state
        autoClaimIsActive = document.getElementById('autoClaimToggle').checked;
        GM_setValue('autoClaim', autoClaimIsActive ? 'ON' : 'OFF'); // Saving as 'ON'/'OFF' string

        console.log('Auto-claim is now:', autoClaimIsActive ? 'ON' : 'OFF');
    }

    // Function to toggle Waifu Claim functionality
    function toggleWaifuClaim() {
        // Save the auto-claim state
        waifuClaimIsActive = document.getElementById('waifuClaimToggle').checked;
        GM_setValue('waifuClaimToggle', waifuClaimIsActive ? 'ON' : 'OFF'); // Saving as 'ON'/'OFF' string

        console.log('Waifu-claim is now:', waifuClaimIsActive ? 'ON' : 'OFF');
    }


    // Function to save kakera settings
    function saveKakeraSettings() {

        toggleAutoClaim();
        toggleWaifuClaim();

        //Save the value and check states of the WaifuClaim Modal
        waifuValue = document.getElementById('waifuKakeraValue').value;
        GM_setValue('waifuKakeraValue', waifuValue);

        waifuKakeraValueIsActive = document.getElementById('waifuKakeraValueCheckbox').checked;
        GM_setValue('waifuKakeraValueCheckbox', waifuKakeraValueIsActive);

        // Save the waifu claim toggle state
        waifuClaimIsActive = document.getElementById('waifuClaimToggle').checked;
        GM_setValue('waifuClaimToggle', waifuClaimIsActive ? 'ON' : 'OFF');

        // Retrieve the checkbox values and store them
        const kakeraSettings = {
            purple: document.getElementById('kakeraPurple').checked,
            blue: document.getElementById('kakeraBlue').checked,
            teal: document.getElementById('kakeraTeal').checked,
            green: document.getElementById('kakeraGreen').checked,
            yellow: document.getElementById('kakeraYellow').checked,
            white: document.getElementById('kakeraWhite').checked,
            orange: document.getElementById('kakeraOrange').checked,
            red: document.getElementById('kakeraRed').checked,
            rainbow: document.getElementById('kakeraRainbow').checked,
        };

        GM_setValue('kakeraSettings', JSON.stringify(kakeraSettings));

        //Update the KakeraClaimSources
        updateKakeraClaimSources(kakeraSettings);
        console.log('Kakera settings saved:', kakeraSettings);

        toggleSettingsModal(); // Close the modal after saving
    }

    // Function to load settings and update the claim sources
    function loadKakeraSettings() {

        const kakeraSettings = JSON.parse(GM_getValue('kakeraSettings', '{}'));

        // Update checkboxes based on saved settings
        for (let color in kakeraSettings) {
            let checkbox = document.getElementById(`kakera${color.charAt(0).toUpperCase() + color.slice(1)}`);
            if (checkbox) {
                checkbox.checked = kakeraSettings[color];
            }
        }


        GM_getValue('waifuKakeraValue', waifuValue);
        GM_getValue('waifuKakeraValueCheckbox', waifuKakeraValueIsActive);

        document.getElementById('waifuKakeraValue').value = waifuValue ;
        document.getElementById('waifuKakeraValueCheckbox').checked = waifuKakeraValueIsActive;
        // Load the toggle states
        autoClaimIsActive = GM_getValue('autoClaim', 'OFF') === 'ON';
        waifuClaimIsActive = GM_getValue('waifuClaimToggle', 'OFF') === 'ON';


        // Update the toggle switches
        document.getElementById('autoClaimToggle').checked = autoClaimIsActive;
        document.getElementById('waifuClaimToggle').checked = waifuClaimIsActive;



        // Update kakeraClaimSources based on loaded settings
        updateKakeraClaimSources(kakeraSettings);
    }

    // Function to update the kakeraClaimSources based on settings
    function updateKakeraClaimSources(settings) {
        kakeraClaimSources.length = 0; // Clear the current sources
        for (let color in settings) {
            if (settings[color]) {
                kakeraClaimSources.push(kakera[color]);
            }
        }
        console.log('Updated kakeraClaimSources:', kakeraClaimSources);
    }


    // Insert the button into Discord's UI
    const insertSettingsButton = () => {
        const buttonsContainer = document.querySelector('.buttons_ce5b56');

        if (buttonsContainer && !document.getElementById('kakeraSettingsButton')) {
            // Create the settings button
            const settingsButton = document.createElement('button');
            settingsButton.id = 'kakeraSettingsButton';
            settingsButton.textContent = 'MudaeCraft';
            settingsButton.onclick = () => {
                toggleSettingsModal();
                populateSettingsContent();
            };
            settingsButton.style = `background-color: #5865F2; color: white; border: none; padding: 2px 5px;
                                    margin-left: 5px; border-radius: 4px; cursor: pointer`;
            settingsButton.className = 'button_afdfd9 lookBlank__7ca0a colorBrand_b2253e grow__4c8a4'; // Discord classes for styling
            settingsButton.onmouseover = () => showGifAnimation(settingsButton);
            settingsButton.onmouseout = hideGifAnimation;
            // Append the button to the container
            buttonsContainer.appendChild(settingsButton);
        } else {
            setTimeout(insertSettingsButton, 1000); // Retry if the container is not found
        }
    };

    function makeModalDraggable() {
        const modal = getOrCreateSettingsModal();
        let isMouseDown = false;
        let offsetX = 0, offsetY = 0;

        modal.addEventListener('mousedown', function(e) {
            isMouseDown = true;
            offsetX = e.clientX - parseInt(window.getComputedStyle(modal).left);
            offsetY = e.clientY - parseInt(window.getComputedStyle(modal).top);
            modal.style.cursor = 'move';
        });

        document.addEventListener('mouseup', function() {
            isMouseDown = false;
            modal.style.cursor = 'default';
        });

        document.addEventListener('mousemove', function(e) {
            if (isMouseDown) {
                modal.style.left = `${e.clientX - offsetX}px`;
                modal.style.top = `${e.clientY - offsetY}px`;
            }
        });
    }


    // Function to insert animated GIF
    function insertDancingGif() {
        const gifUrl = 'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExeDY3bjllcW5raGJndWxjMjVpcW9ldXVlbmZnM3FqeXZ4Z2JveWhiOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/6QJ110U9TFhs084nyw/giphy.gif';
        let gif = document.getElementById('dancingGif');

        if (!gif) {
            // Create the GIF element
            gif = document.createElement('img');
            gif.id = 'dancingGif';
            gif.src = gifUrl;
            gif.style = `width: 50px; height: 50px; position: absolute;
                     top: 0; left: 0; opacity: 0; transition: opacity 0.5s, top 0.5s; pointer-events: none;`;
            document.body.appendChild(gif);
        }

        return gif;
    }

    // Function to show the GIF animation
    function showGifAnimation(button) {
        const gif = insertDancingGif();
        const buttonRect = button.getBoundingClientRect();

        // Position the GIF just above the button
        gif.style.top = `${buttonRect.top - gif.height}px`;
        gif.style.left = `${buttonRect.left + 10}px`;

        // Show the GIF
        gif.style.opacity = '1';
    }

    // Function to hide the GIF animation
    function hideGifAnimation() {
        const gif = document.getElementById('dancingGif');

        // Hide the GIF
        gif.style.opacity = '0';
    }

    insertSettingsButton();


})()
