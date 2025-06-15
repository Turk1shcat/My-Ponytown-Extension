chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateColor") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, request, (response) => {
                sendResponse(response);
            });
        });
        return true;
    }
});