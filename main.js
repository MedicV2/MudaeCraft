// ==UserScript==
// @name         KakeraCraft
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  Auto-clicks specific kakera buttons.
// @author       Medc
// @match        https://discord.com/channels/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==

GM_addStyle(`/* The switch - the box around the slider */.switch {  position: relative;  display: inline-block;  width: 60px;  height: 34px;}/* Hide default HTML checkbox */.switch input {  opacity: 0;  width: 0;  height: 0;}/* The slider */.slider {  position: absolute;  cursor: pointer;  top: 0;  left: 0;  right: 0;  bottom: 0;  background-color: #ccc;  -webkit-transition: .4s;  transition: .4s;}.slider:before {  position: absolute;  content: "";  height: 26px;  width: 26px;  left: 4px;  bottom: 4px;  background-color: white;  -webkit-transition: .4s;  transition: .4s;}input:checked + .slider {  background-color: #2196F3;}input:focus + .slider {  box-shadow: 0 0 1px #2196F3;}input:checked + .slider:before {  -webkit-transform: translateX(26px);  -ms-transform: translateX(26px);  transform: translateX(26px);}/* Rounded sliders */.slider.round {  border-radius: 34px;}.slider.round:before {  border-radius: 50%;} /* Arrow and Detailed Settings Panel Styles */  #detailedSettingsPanel {    display: none; /* Hidden by default */    position: absolute;    left: 100%;    top: 0;    width: 300px;    background-color: #36393F; /* Discord's dark theme color */    padding: 10px;    border-radius: 8px;    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);    overflow: hidden;    z-index: 10001; /* Ensure it's above other elements */  } #toggleContainer {    display: flex;    align-items: center;    justify-content: center;  }  #saveButtonContainer {    text-align: center;    margin-top: 20px; /* Adjust the spacing as needed */  }  .settingsIcon {    margin-left: 10px; /* Adjust the spacing as needed */    cursor: pointer;    display: flex;    align-items: center;    justify-content: center;  }`);

(function() {
    'use strict';

    // ALL SRC URLS UED ON EACH KAKERA CLAIM BUTTON
    let autoClaimIsActive = false;

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

    const kakera_src = Object.values(kakera); // The array with all used kakera urls, Will be used in the claim function that hasn't been added yet
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
            if (!isNaN(number) && number > 119) {// If the kakera value on the card is higher than X, find the corresponding button and if it is found, click it.
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

      // Reinitialize Script Functionality
    function reinitializeScript() {
        // Reinitialize Auto Claim Active State
        autoClaimIsActive = GM_getValue('autoClaim', 'OFF') === 'ON';

        // Reinitialize Observers
        startObserving();
        startBodyObservation();

        // Reinitialize Settings Button
        checkAndInsertSettingsButton();
    }


    const observer = new MutationObserver(callback);

    const startObserving = () => {
        const targetNode = document.querySelector('.scrollerInner__059a5');

        if (targetNode) {
            const config = { childList: true, subtree: true };
            observer.observe(targetNode, config);
            richLog('Observation started on .scrollerInner__059a5', 'lightgreen', 25);
        } else {
            richLog('Waiting for .scrollerInner__059a5 to appear...','orange', 25);
            setTimeout(startObserving, 1000);
        }
    };

    startObserving();
    // Make sure it is defined from the start
    autoClaimIsActive = GM_getValue('autoClaim', 'OFF') === 'ON';
    /*===============================================================================================================================================================*/
    function checkAndInsertSettingsButton() {
        if (!document.getElementById('kakeraSettingsButton')) {
            insertSettingsButton();
        }
    }
    let bodyObserver = null
    const startBodyObservation = () => {
        const config = { childList: true, subtree: true };
        if(!bodyObserver){var bodyObserver = new MutationObserver(bodyObserverCallback);}
        else {bodyObserver.disconnect()}
        bodyObserver.observe(document.body, config)
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
            </label>
        `).join('');
        }
        return detailedSettingsPanel;
    }


    // Function to build and insert settings content into the modal
    function populateSettingsContent() {
        const modal = getOrCreateSettingsModal();

        // Create SVG element for the settings icon
        const svgNS = "http://www.w3.org/2000/svg";
        let settingsIcon = document.createElementNS(svgNS, "svg");
        settingsIcon.setAttribute("id", "detailedSettingsArrow"); // Set the id here
        settingsIcon.setAttribute("width", "24"); // You can adjust the size if needed
        settingsIcon.setAttribute("height", "24");
        settingsIcon.setAttribute("viewBox", "0 0 24 24");
        settingsIcon.setAttribute("fill", "currentColor");
        settingsIcon.innerHTML = '<path d="M13 6a1 1 0 1 0-2 0v5H6a1 1 0 1 0 0 2h5v5a1 1 0 1 0 2 0v-5h5a1 1 0 1 0 0-2h-5V6Z"></path>';

        // Set the innerHTML of the modal
        // Set the innerHTML of the modal
        modal.innerHTML = `<div style="color: #FFF; text-align: center; margin-bottom: 16px; font-size: 20px; font-weight: bold;">MudaeCraft</div><div style="text-align: center;"><div style="color: #FFF; margin-bottom: 8px;">Auto Kakera Claim:</div><div id="toggleContainer"><label class="switch"><input type="checkbox" id="autoClaimToggle"><span class="slider round"></span></label></div></div><div id="saveButtonContainer"><button id="saveSettingsButton" style="background-color: #5865F2; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Save</button></div>`;


        // Append the SVG icon to the toggle container
        const toggleContainer = modal.querySelector('#toggleContainer');
        toggleContainer.appendChild(settingsIcon);

        // Append the detailed settings panel (created earlier) to the modal
        const detailedSettingsPanel = createDetailedSettingsPanel();
        modal.appendChild(detailedSettingsPanel);

        // Add event listeners
        document.getElementById('autoClaimToggle').addEventListener('change', toggleAutoClaim);
        settingsIcon.addEventListener('click', toggleDetailedSettings);
        document.getElementById('saveSettingsButton').addEventListener('click', saveKakeraSettings);

        // Load the saved settings
        loadKakeraSettings();
    }



    // Function to toggle auto claim on/off without closing the modal
    function toggleAutoClaim() {
        // Save the auto-claim state
        autoClaimIsActive = document.getElementById('autoClaimToggle').checked;
        GM_setValue('autoClaim', autoClaimIsActive ? 'ON' : 'OFF'); // Saving as 'ON'/'OFF' string

        // Log the state for debugging purposes
        console.log('Auto-claim is now:', autoClaimIsActive ? 'ON' : 'OFF');
    }

    // Function to save kakera settings
    function saveKakeraSettings() {
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

        // Log the settings for debugging purposes
        console.log('Kakera settings saved:', kakeraSettings);

        toggleSettingsModal(); // Close the modal after saving
    }

    // Function to load settings and update the claim sources
    function loadKakeraSettings() {
        // Load and apply the auto-claim toggle state
        autoClaimIsActive = GM_getValue('autoClaim', 'OFF') === 'ON';
        document.getElementById('autoClaimToggle').checked = autoClaimIsActive;

        const kakeraSettings = JSON.parse(GM_getValue('kakeraSettings', '{}'));

        // Update checkboxes based on saved settings
        for (let color in kakeraSettings) {
            let checkbox = document.getElementById(`kakera${color.charAt(0).toUpperCase() + color.slice(1)}`);
            if (checkbox) {
                checkbox.checked = kakeraSettings[color];
            }
        }

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
        const buttonsContainer = document.querySelector('.buttons_ce5b56'); // Adjust the class name if necessary

        if (buttonsContainer && !document.getElementById('kakeraSettingsButton')) {
            // Create the settings button
            const settingsButton = document.createElement('button');
            settingsButton.id = 'kakeraSettingsButton';
            settingsButton.textContent = 'MudaeCraft'; // You can use an icon here if you prefer
            settingsButton.onclick = () => {
                toggleSettingsModal();
                populateSettingsContent();
            };
            settingsButton.style = `background-color: #5865F2; color: white; border: none; padding: 2px 5px;
                                    margin-left: 5px; border-radius: 4px; cursor: pointer`;
            settingsButton.className = 'button_afdfd9 lookBlank__7ca0a colorBrand_b2253e grow__4c8a4'; // Add Discord classes for styling
            settingsButton.onmouseover = () => showGifAnimation(settingsButton);
            settingsButton.onmouseout = hideGifAnimation;
            // Append the button to the container
            buttonsContainer.appendChild(settingsButton);
        } else {
            setTimeout(insertSettingsButton, 1000); // Retry if the container is not found
        }
    };

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
