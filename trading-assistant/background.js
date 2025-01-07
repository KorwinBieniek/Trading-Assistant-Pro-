// Creates a floating window for the trading assistant when the extension icon is clicked
chrome.action.onClicked.addListener(() => {
    chrome.windows.create({
        url: 'popup.html',
        type: 'popup', // Using popup type for better window management
        width: 800,
        height: 600,
        top: 100,
        left: 100,
        focused: true // Ensures window gets focus when created
    }, (createdWindow) => {
        console.log('Floating window created:', createdWindow);

        // Try to set window as always on top - useful for trading
        if (chrome.windows.alwaysOnTop) {
            chrome.windows.update(createdWindow.id, { alwaysOnTop: true }, () => {
                if (chrome.runtime.lastError) {
                    console.warn('alwaysOnTop is not supported on this platform.');
                } else {
                    console.log('Window is now always on top.');
                }
            });
        } else {
            console.warn('alwaysOnTop feature is not supported on this platform.');
        }
    });
});
