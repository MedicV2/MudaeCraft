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

    const kakera_src = Object.values(kakera); //The array with all used kakera urls, Will be used in the claim function that hasn't been added yet
    const kakeraClaimSources = [kakera.purple, kakera.orange, kakera.red, kakera.rainbow]; // ONLY ONES THAT YOU WANT TO AUTO CLAIM

    //Arrow function to make fancy logs
    const richLog = (str,color,size) => {
        console.log(`%c${str}`, `color: ${color}; font-size: ${size}px; font-weight: bold;`);
    }


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


    const claimWaifu = (node, node1) => {

        var latestCard = node
        var latestButton = node1

        console.log(latestCard)
        console.log(latestButton)
        //Select description from latest card.
        // Check if node is an Element node
        if (node.nodeType !== 1) {
            console.error("Provided node is not an element node");
            return;
        }

        try {
            var descriptionDiv = node.querySelector('.embedDescription__33443 strong');
            console.log("Description div:", descriptionDiv);

            // Additional check to ensure descriptionDiv is found
            if (!descriptionDiv) {
                console.error('Description div not found');
                return;
            }

            var numberFound = false;

            if (descriptionDiv.tagName.toLowerCase() === 'strong') {
                console.log('GETS HERE')
                var number = parseInt(descriptionDiv.textContent, 10);
                console.log(number);
                if (!isNaN(number) && number > 50) {
                    numberFound = true;
                    var button = latestButton.querySelector('button.component__43381');
                    if (button) {
                        button.click();
                    } else {
                        console.error('Button not found in the latest card');
                    }
                }
            }
               } catch (error) {
        console.error("Error in claimWaifu:", error);
    }
        }


        //Gets called whenever the HTML updates. (DOM mutation)
        const callback = (mutationsList, observer) => {
            // loop that iterates through the mutationsList. The mutationsList parameter contains information about the mutations that occurred in the DOM since the observer was set up.
            for (let mutation of mutationsList) {
                //If child nodes (elements) are added or removed from the observed DOM elements.
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        // Check for nested buttons
                        if (node.nodeType === 1 && node.querySelectorAll) {
                            node.querySelectorAll('.component__43381.button_afdfd9.lookFilled__19298.colorPrimary__6ed40.sizeSmall__71a98.grow__4c8a4').forEach(clickButton);
                        }
                        // Check for nested buttons
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
