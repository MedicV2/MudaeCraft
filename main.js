// ==UserScript==
// @name         Kakera Farm
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Auto-clicks specific kakera buttons.
// @author       Medc
// @match        https://discord.com/channels/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    //ALL SRC URLS UED ON EACH KAKERA CLAIM BUTTON
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

    const kakera_src = Object.values(kakera); //The array with all used kakera urls
    const kakeraClaimSources = [kakera.purple, kakera.orange, kakera.red, kakera.rainbow]; // ONLY ONES THAT YOU WANT TO AUTO CLAIM

    //Arrow function to make fancy logs
    const richLog = (str,color,size) => {
        console.log(`%c${str}`, `color: ${color}; font-size: ${size}px; font-weight: bold;`);
    }

    // Function to check for kakera value and click the button if it surpasses a certain amount
    const checkKakeraValueAndClick = (node) => {
        const gridElements = node.querySelectorAll('.grid_c7c4e6'); //These are the waifu cards
        const containerElements = node.querySelectorAll('.container_d09a0b'); // These are the claim buttons
        const cards = Array.from(gridElements).concat(Array.from(containerElements)); //Waifu cards + claim buttons

        //If any cards+buttons have been found
        if (cards.length > 0) {
            const latestCard = cards[cards.length - cards.length / 2 - 1]; // Gets the latest sent card (devided by two since both the cards and buttons are added together)
            const latestButton = cards[cards.length - 1]; // Gets the button that matches the latest sent card (-1 on both since an array starts counting from 0 whilst array.length starts from 1)
            const descriptionDiv = latestCard.querySelector('.embedDescription__33443 strong'); //Gets the description from the latest sent card.
            let numberFound = false;

            if (descriptionDiv && descriptionDiv.tagName.toLowerCase() === 'strong') { //The kakera value is inside <strong></strong> tags, so we get that number if it exists.
                const number = parseInt(descriptionDiv.textContent, 10);
                if (!isNaN(number) && number > 50) { //If the kakera value on the card is higher than X, find the corresponding button and if it is found, click it.
                    numberFound = true;
                    const button = latestButton.querySelector('button.component__43381');
                    if (button) {
                        button.click();
                    }
                }
            }
        }
    };

    const clickButton = (node) => {
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

    const callback = (mutationsList, observer) => {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.matches('.component__43381.button_afdfd9.lookFilled__19298.colorPrimary__6ed40.sizeSmall__71a98.grow__4c8a4')) {
                        clickButton(node); // Kakera claim logic
                        checkKakeraValueAndClick(node); // Waifu claim logic
                    }
                    // Check for nested buttons
                    if (node.nodeType === 1 && node.querySelectorAll) {
                        node.querySelectorAll('.component__43381.button_afdfd9.lookFilled__19298.colorPrimary__6ed40.sizeSmall__71a98.grow__4c8a4').forEach(clickButton);
                    }
                });
            }
        }
    };

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
})();
