(async () => {
  const ThreadModule = await import("./Threads.js");
  //console.log(ThreadModule);

  const debugSettings = {
    mode: {Name: "mode", Enabled: true},
    chatLog: {Name: "chatLog", Enabled: false},
    observer: {Name: "observer", Enabled: false},
  };

  const default_colors = {
      general: "#caffc0",
      whisper: "#40d483",
      party: "#89f6c7",
  };

  function log(type, ...messages){
    if (debugSettings.mode.Enabled === true) {
      if (debugSettings[type] !== null && debugSettings[type].Enabled === true) {
        console.log(...messages);
      };
    };
  };


  class ChatEnhancer {
    constructor() {
      this.recordedName = "";
      this.currentChatType = 0; // general: 0, whisper: 1, party: 2
      this.threadManager = new ThreadModule.ThreadManager(this);
      //this.processedMessages = new WeakSet();
      //this.messageQueue = [];
      this.maxSize = 100;
      this.lastProcessedIndex = 0;
      this.currentActiveTab = "";
      this.observers = [];
      this.debounceTimer = null;
      
      this.initStyles();
      this.init();
    };

    // Initialize styles once
    initStyles() {
      const chatStyle = document.createElement("style");
      chatStyle.id = "message-colors";
      chatStyle.textContent = `
        .enhanced-self-message          { color:${default_colors.general}  !important; }
        .enhanced-self-message.whisper  { color:${default_colors.whisper}  !important; }
        .enhanced-self-message.party    { color:${default_colors.party}    !important; }
      `;
      document.head.appendChild(chatStyle);
    };

    // Main initialization
    init() {
      console.log(`%cDEBUG MODE: ${debugSettings.mode.Enabled}`, "color: yellow");
      this.setupMessageListener();
      this.fetchName();
      this.detectPlay();
    };

    // Clean up observers
    cleanup() {
      this.observers.forEach(observer => observer.disconnect());
      this.observers = [];
    };

    // Fetch and observe username changes
    fetchName() {
      const nameObserver = new MutationObserver(mutations => {
        const nameInput = document.querySelector("emoji-input input");
        if (nameInput && nameInput.value !== this.recordedName) {
          this.recordedName = nameInput.value;
          this.resetProcessing();
        };
      });

      function observeName() {
        const container = document.querySelector(".home-content");
        //log(container)
        if (container) {
          nameObserver.observe(container, {
            childList: true,
            subtree: true
          });
          this.observers.push(nameObserver);
          return true;
        }
        return false;
      };

      if (!observeName()) {
        const fallbackObserver = new MutationObserver(() => {
          if (observeName()) {
            fallbackObserver.disconnect();
          };
        });
        fallbackObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
        this.observers.push(fallbackObserver);
      };
    };

    detectPlay() {
      const playObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === "attributes" && mutation.attributeName === "class") {
            if (document.body.classList.contains("playing")) this.setupObsevers();
          };
        });
      });
      playObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class"]
      });
      this.observers.push(playObserver);
    };

    setupMessageListener() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "updateColor") {
          log(debugSettings.observer.Name, "Received colors:", request.colors);

          const styleElement = document.querySelector("#message-colors");
          styleElement.textContent = `
            .enhanced-self-message          { color: ${request.colors.general} !important; }
            .enhanced-self-message.whisper  { color: ${request.colors.whisper} !important; }
            .enhanced-self-message.party    { color: ${request.colors.party}   !important; }
          `;

          this.resetProcessing();
          this.debounceProcessMessages();

          sendResponse({ success: true });
        };
      });
    };

    setupTabObserver() {
      const tabs = document.querySelectorAll(".chat-log-tabs a");
      if (!tabs.length){
        log(debugSettings.observer.Name, "Failed to Retrieve Tabs!");
        return;
      };
      const tabObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === "attributes" && mutation.attributeName === "class") {
            if (mutation.target.classList.contains("active")) {
              //log(mutation.target)
              this.currentActiveTab = mutation.target.textContent.trim();
              this.handleTabChange();
            };
          };
        });
      });

      tabs.forEach(tab => {
        tabObserver.observe(tab, {
          attributes: true,
          attributeFilter: ["class"],
        });

        if (tab.classList.contains("active")) this.currentActiveTab = tab.textContent.trim();
      });
      this.observers.push(tabObserver);
    };

    // Observe container changes
    // this function is called when the tab is changed or when a new message appears
    // when the tab is changed, messages are appended synchonrously 
    setupContainerObserver() {
      const container = document.querySelector(".chat-log-scroll-inner");
      if (!container) {
        log(debugSettings.observer.Name, "Failed to retrieve container!");
        return;
      };
      const containerObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.target == container && mutation.addedNodes.length > 0) {
            log(debugSettings.observer.Name, "%cContainer Observer detected change", "color: yellow");
            //log(this.currentActiveTab);
            if (this.currentActiveTab === "Whisper") {
              this.processThreads();
            }
            else this.debounceProcessMessages();
          };
        });
      });

      containerObserver.observe(container, {
        childList: true,
        subtree: true
      });
      this.observers.push(containerObserver);
    };

    setupSwapboxObserver() {
      const swapbox = document.querySelector("swap-box > div");
      const listRects = new Object();
      let selectedCharacter = "";

      const toolTipObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === "attributes" && mutation.attributeName === "style") {
            const rect = mutation.target.getBoundingClientRect();
            const center = (rect.top + rect.bottom)/2;
            //log(rect.left, center,  mutation.target.getAttribute("style"));
            
            Object.keys(listRects).forEach(key => {
              const listRectCenter = (listRects[key].top + listRects[key].bottom)/2;
              if (center + 5 > listRectCenter && center - 5 < listRectCenter){
                const listItem = document.querySelector(`#${key}`);
                //log(listItem);

                const charName = listItem.querySelector("emoji-span");
                //log(charName);
                //log(charName.getAttribute("title"));
                if (charName && charName.getAttribute("title") !== selectedCharacter) {
                  selectedCharacter = charName.getAttribute("title");
                };
              };
            });
          };
        });
      });

      const swapboxObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === "attributes" && mutation.attributeName === "class") {
            //log(mutation.target.classList);
            if (!mutation.target.classList.contains("show")) {
              toolTipObserver.disconnect();
              Object.keys(listRects).forEach(key => {
                delete listRects[key];
              });

              if (selectedCharacter !== "") {
                //log(`selected character: ${selectedCharacter}!`)
                this.recordedName = selectedCharacter;
                this.resetProcessing();
                selectedCharacter == "";
              };
            };

            const virtualList = document.querySelector(".character-select-list");
            const characterTooltip = document.querySelector("character-list-tooltip > div");
            if (virtualList === null || characterTooltip === null) return;

            //log(virtualList);
            //log(characterTooltip);

            virtualList.childNodes.forEach(child => {
              //log(child);
              if (child.nodeName !== "LI") return;
              const rect = child.getBoundingClientRect();
              //log(child.getAttribute("id"), rect.left, (rect.top + rect.bottom)/2);
              listRects[child.getAttribute("id")] = rect;
            });

            toolTipObserver.observe(characterTooltip, {
              attributes: true,
              attributeFilter: ["style"],
            });
          };
        });
      });

      swapboxObserver.observe(swapbox, {
        attributes: true,
        attributeFilter: ["class"],
      });
      this.observers.push(swapboxObserver);
      this.observers.push(toolTipObserver);
    };

    setupChatboxObserver() {
      const chatLog = document.querySelector("chat-log");
      const chatBoxType = document.querySelector(".chat-box-type")
      chatBoxType.classList.add("enhanced-self-message");
      const chatBoxTypeName = document.querySelector(".chat-box-type-name");
      const chatBoxTypeObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.target.textContent === "say") {
            this.currentChatType = 0; // general
            if (chatBoxType.classList.contains("party")) chatBoxType.classList.remove("party");
            if (chatBoxType.classList.contains("whisper")) chatBoxType.classList.remove("whisper");
          }
          else if (mutation.target.textContent === "party") {
            this.currentChatType = 2; // party
            if (chatBoxType.classList.contains("whisper")) chatBoxType.classList.remove("whisper");
            if (!chatBoxType.classList.contains("party")) chatBoxType.classList.add("party");
          }
          else {
            this.currentChatType = 1; // whisper
            if (chatBoxType.classList.contains("party")) chatBoxType.classList.remove("party");
            if (!chatBoxType.classList.contains("whisper")) chatBoxType.classList.add("whisper");
          };
          
        });
      });

      chatBoxTypeObserver.observe(chatBoxTypeName, {
        //attributes: true,
        //childList: true,
        subtree: true,
        characterData: true
      });
      this.observers.push(chatBoxTypeObserver);
      
      
      const chatBox = document.querySelector("chat-box");

      const chatBoxDiv = chatBox.querySelector("div");
      const chatTypeDiv = chatBoxDiv.querySelectorAll("div")[9];

      const textAreaDiv = chatBox.querySelector(".chat-textarea-wrap");
      const textArea = chatBox.querySelector("textarea");
      textArea.wrap = "on";
      textArea.setAttribute("style", `height: 100% !important;`);
      //log(textAreaDiv.getAttribute("style"))
      textAreaDiv.setAttribute("style", 
        `
        background: rgba(0, 0, 0, 0.65);
        max-height: none !important;
        `
      );
      chatBoxDiv.setAttribute("style", 
        `
        bottom: 0;
        height: 172px !important;
        left: 0;
        margin-top: -5px;
        max-width: 500px;
        padding-right: 5px;
        padding-top: 5px;
        position: absolute;
        right: 0;
        `
      );
      chatTypeDiv.setAttribute("style", 
        `
        --party-color: #97d8ff;
        --whisper-color: #ffa1df;
        height: 172px !important;
        `
      );
      textAreaDiv.setAttribute("style", 
        `
        background: rgba(0, 0, 0, 0.65);
        max-height: none !important;  
        height: 172px !important;
        `
      );

      const chatBoxDivObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === "attributes" && mutation.attributeName === "hidden") {
            if (mutation.target.hidden === false) { // open
              chatLog.setAttribute("style", `${chatLog.getAttribute("style").split("bottom")[0]} bottom: 172px !important;`);
            }
            else {                                  // closed
              chatLog.setAttribute("style", `${chatLog.getAttribute("style").split(";")[0]};`);
            };
          };
        });
      });
      chatBoxDivObserver.observe(chatBoxDiv, {
        attributes: true,
        attributeFilter: ["hidden"]
      });
      this.observers.push(chatBoxDivObserver);
    };

    setupObsevers() {
      this.setupTabObserver();
      this.setupContainerObserver();
      this.setupSwapboxObserver();
      this.setupChatboxObserver();
    };

    
    handleTabChange() {
      this.resetProcessing();
      if (this.currentActiveTab === "Party") this.removeWhispers();
      if (this.threadManager.threadChannels.has(this.currentActiveTab)) this.processThreads();
      else this.threadManager.channelSwitched();
    };

    
    resetProcessing() {
      //this.processedMessages = new WeakSet();
      //this.messageQueue = [];
      this.lastProcessedIndex = 0;
    };

    
    debounceProcessMessages() {
      //log(`debounce: %c${this.debounceTimer}`, "color: blue");
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
      this.debounceTimer = setTimeout(() => {
        this.processMessages();
      }, 100);
    };

    
    getMessages() {
      const allMessages = document.querySelectorAll("#chat-log .chat-log-scroll-inner > .chat-line");
      const allMessagesLength = allMessages.length;
      //if (allMessagesLength === 100) this.resetProcessing();
      //log(allMessages)
      log(debugSettings.chatLog.Name, "%cFROM: getMessages()", "color: red");
      log(debugSettings.chatLog.Name, `Messages Last Index: %c${allMessagesLength - 1}`, "color: blue");
      log(debugSettings.chatLog.Name, `Index: %c${this.lastProcessedIndex}`, "color: blue");
      const returnMessages = Array.from(allMessages).slice(this.lastProcessedIndex);
      this.lastProcessedIndex = (allMessagesLength === 100) ?
        this.lastProcessedIndex = allMessagesLength - 1 :
        this.lastProcessedIndex = allMessagesLength; 

      return returnMessages;
    };

    
    processMessages() {
      const messages = this.getMessages();
      //log(messages);
      log(debugSettings.chatLog.Name, "%cFROM: processMessages()", "color: red");
      //log("%cRUNNING FUNCTION", "color: pink");
      log(debugSettings.chatLog.Name, `Returned Length: %c${messages.length}`, "color: blue");
      if (messages.length <= 0) return;
      messages.forEach((message, index) => {
        this.processMessage(message);
      });
    };

    
    processMessage(message) {
      //if (this.processedMessages.has(message)) return;
      message.classList.add("enhanced-processed");
      //this.processedMessages.add(message);
      //this.messageQueue.push(message);

      log(debugSettings.chatLog.Name, "%cFROM: processMessage()", "color: red");
      
      // if (this.messageQueue.length > this.maxSize) {
      //   const oldestMessage = this.messageQueue.shift();
      //   this.processedMessages.delete(oldestMessage);
      // };
      //log(this.processedMessages)

      log(debugSettings.chatLog.Name, message);

      const isSelfMessage = this.isSelfMessage(message);
      log(debugSettings.chatLog.Name, `is self message: ${isSelfMessage}`)

      if (isSelfMessage) this.applyColor(message);
      
    };

    applyColor(message){
      //log(message)
      //log("%cApplying Color!", "color: yellow")
      const outerNameSpan = message.querySelector(".chat-line-name");
      outerNameSpan.classList.add("enhanced-self-message");
      message.classList.add("enhanced-self-message");

      const isWhisper = message.classList.contains("chat-line-whisper");
      const isParty = message.classList.contains("chat-line-party");
      if (isWhisper) {
        message.classList.add("whisper");
        outerNameSpan.classList.add("whisper");
      }
      else if (isParty) {
        message.classList.add("party");
        outerNameSpan.classList.add("party");
      }
      
    };

    isSelfMessage(message) {
      const nameSpan = message.querySelector(".chat-line-name");
      if (!nameSpan) return false;
      //log(nameSpan)

      const isToWhisper = message.querySelector(".chat-line-label").nextSibling.textContent === "To ";
      if (isToWhisper) return true;

      const innerNameSpan = nameSpan.querySelector(".chat-line-name-content");
      let name = "";
      innerNameSpan.childNodes.forEach(child => {
        if (child.nodeName === "IMG") {
          name += child.getAttribute("alt") || "";
        } else {
          name += child.textContent || "";
        };
      });
      /*
      if (name === this.recordedName) {
        log(`%c${this.recordedName} | ${name}`, "color: yellow");
      }
      else {
        log(`%c${this.recordedName} | ${name}`);
      };
      */
      return name === this.recordedName;
    };

    processThreads() {
      /*
        TODO:
          Add notifications!
      */

      // log(debugSettings.mode.Name, "processing threads");
      const messages = this.getMessages();
      if (messages.length <= 0) return;

      if (this.threadManager.activeThread !== null) {
        log(debugSettings.mode.Name, "reading thread");
        this.threadManager.processReading(messages);
      }
      else {
        log(debugSettings.mode.Name, "not reading thread");
        // log(debugSettings.mode.Name, messages);
        this.threadManager.processMessages(messages);
      };
      
    };

    removeWhispers() {
      const whispers = document.querySelectorAll(".chat-line-whisper");
      //log(whispers)
      
      whispers.forEach(whisper => {
        whisper.remove();
      });
    };
  };


  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      new ChatEnhancer()
    });
  } else {
    new ChatEnhancer();
  };
})();
