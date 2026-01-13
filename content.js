let isShredding = false;
let observer = null;
let keysPressed = {}; 

function initShredder() {
    // 1. Check Dictionary
    if (typeof morphemeMap === 'undefined') {
        console.error("Dictionary missing!");
        return;
    }

    const sortedKeys = Object.keys(morphemeMap).sort((a, b) => b.length - a.length);

    // 2. Status Indicator
    const statusBox = document.createElement("div");
    statusBox.style.position = "fixed";
    statusBox.style.top = "10px";
    statusBox.style.right = "10px";
    statusBox.style.padding = "5px 10px";
    statusBox.style.background = "grey";
    statusBox.style.color = "white";
    statusBox.style.zIndex = "2147483647";
    statusBox.style.fontFamily = "monospace";
    statusBox.style.borderRadius = "5px";
    statusBox.style.fontSize = "14px";
    statusBox.style.display = "none";
    statusBox.innerText = "SHREDDER: OFF";
    document.body.appendChild(statusBox);

    // 3. Translation Logic
    function translateEntireString(text) {
        let remaining = text;
        let result = "";
        
        while (remaining.length > 0) {
            let found = false;
            let lowerRemaining = remaining.toLowerCase();

            for (const key of sortedKeys) {
                if (lowerRemaining.startsWith(key)) {
                    result += morphemeMap[key];
                    remaining = remaining.slice(key.length);
                    found = true;
                    break;
                }
            }

            if (!found) {
                result += remaining[0]; 
                remaining = remaining.slice(1);
            }
        }
        return result;
    }

    // 4. Process Node (With Backup Saving)
    function processNode(node) {
        if (node.nodeType !== 3) return;
        
        const text = node.nodeValue;
        if (!text.trim()) return;

        const parentTag = node.parentElement ? node.parentElement.tagName : "";
        if (["SCRIPT", "STYLE", "CODE", "TEXTAREA", "NOSCRIPT", "INPUT"].includes(parentTag)) return;
        
        // Safety: Don't translate if it looks like we already did (to avoid loops)
        // AND check if we are in "Shredding Mode"
        if (!isShredding) return;

        // SAVE THE ORIGINAL TEXT
        // We attach a hidden property '_original' to the DOM node itself
        if (!node._original) {
            node._original = text;
        }

        // Only translate if we haven't already (check if current text matches backup)
        // This prevents re-shredding shredded text
        if (node.nodeValue === node._original) {
            const newText = translateEntireString(text);
            if (newText !== text) {
                node.nodeValue = newText;
            }
        }
    }

    // 5. Restore Node (The Undo Function)
    function restoreNode(node) {
        if (node.nodeType === 3 && node._original) {
            node.nodeValue = node._original;
            delete node._original; // Clear memory
        }
    }

    // Walker for Shredding
    function walkAndShred(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while (node = walker.nextNode()) {
            processNode(node);
        }
    }

    // Walker for Restoring
    function walkAndRestore(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while (node = walker.nextNode()) {
            restoreNode(node);
        }
    }

    // 6. Toggle Functions
    function startShredding() {
        if (isShredding) return;
        isShredding = true;
        
        statusBox.style.display = "block";
        statusBox.style.background = "red";
        statusBox.innerText = "SHREDDER: ON";

        // Ruin the page
        walkAndShred(document.body);

        // Turn on security camera
        if (!observer) {
            observer = new MutationObserver((mutations) => {
                if (!isShredding) return;
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 3) processNode(node);
                        else if (node.nodeType === 1) walkAndShred(node);
                    });
                });
            });
        }
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function stopShredding() {
        if (!isShredding) return;
        isShredding = false;
        
        statusBox.style.background = "green";
        statusBox.innerText = "SHREDDER: RESTORED";
        
        // Stop watching for new text
        if (observer) {
            observer.disconnect();
            observer = null;
        }

        // RESTORE EVERYTHING
        walkAndRestore(document.body);

        // Hide box after 2 seconds
        setTimeout(() => {
            if (!isShredding) statusBox.style.display = "none";
        }, 2000);
    }

    function toggleShredder() {
        if (!isShredding) startShredding();
        else stopShredding();
    }

    // 7. Input Safety
    function isTyping() {
        const el = document.activeElement;
        const tag = el.tagName.toLowerCase();
        const type = el.type ? el.type.toLowerCase() : "";
        return (tag === 'input' && type !== 'checkbox' && type !== 'radio') || 
               tag === 'textarea' || 
               el.isContentEditable;
    }

    // 8. Key Listener (T+R)
    document.addEventListener("keydown", (e) => {
        if (isTyping()) return;

        keysPressed[e.key.toLowerCase()] = true;

        if (keysPressed['t'] && keysPressed['r']) {
            toggleShredder();
            keysPressed = {}; 
        }
    });

    document.addEventListener("keyup", (e) => {
        delete keysPressed[e.key.toLowerCase()];
    });

    console.log("Shredder Ready. Hold T + R to toggle.");
}

initShredder();
