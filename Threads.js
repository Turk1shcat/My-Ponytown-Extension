
const debugSettings = {
    mode: {Name: "mode", Enabled: false},
    processing: {Name: "processing", Enabled: false},
};

function log(type, ...messages){
    if (debugSettings.mode.Enabled === true) {
        if (debugSettings[type] !== null && debugSettings[type].Enabled === true) {
        console.log(...messages);
        };
    };
};

export class ThreadManager {
  constructor(chatEnhancer) {
    this.chatEnhancer = chatEnhancer;
    this.threads = new Map();
    this.activeThread = null;
    this.threadChannels = new Set(
      "Whisper"
    );

    this.initThreadStyle();
  };

  initThreadStyle() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
    document.head.appendChild(link);

    const threadStyle = document.createElement("style");
    threadStyle.id = "thread-style";
    threadStyle.textContent = `
    .thread-frame        {
                            max-width: calc(100% - 10px);
                            min-width: fit-content;
                            height: 50px;
                            width: 190px;
                            overflow: hidden;
                            padding-left: 10px;
                            padding-right: 10px;
                            text-shadow: 1px 1px 1px #000;
                            margin-bottom: 10px;
                            background-color: rgba(0, 0, 0, 0.2);
                            border-color: rgba(200, 200, 200, 0.4);
                            border-style: solid;
                            border-width: 1px;
                            border-radius: 3px;
                            align-items: center;
                        }
    .thread-timestamp   {
                            font-size: smaller;
                            margin-right: 5px
                        }
     .thread-name       {
                            display: inline;
                        }             
    .thread-button      {
                            align-items: center;
                            min-width: fit-content;
                            max-width: calc(100% - 10px);
                            width: 200px;
                            height: 50px;
                            left: 45px;
                            position: absolute;
                            z-index: 1;
                        }
    .exit-button        {
                            width: 36px;
                            height: 36px;
                            position: absolute;
                            top: 0;
                            right: 0;
                        }
    `;
    document.head.appendChild(threadStyle);
  };

  getMessageId(message) {
    //log(debugSettings.mode.Name, message);
    let messageId = "";

    const nameSpan = message.querySelector(".chat-line-name-content");
    nameSpan.childNodes.forEach(child => {
      if (child.nodeName === "IMG") messageId += child.getAttribute("alt") || "";
      else  messageId += child.textContent || "";
    });

    return messageId;
  }

  processMessages(messages) {
    messages.forEach(message => {
      if (message.classList.contains("thread-frame")) {
        log(debugSettings.processing.Name, "Thread Frame");
        log(debugSettings.processing.Name, message);
        return;
      };

      const messageId = this.getMessageId(message);
      if (messageId === "") {
        log(debugSettings.processing.Name, "Deleting ts for no name:");
        log(debugSettings.processing.Name, message);

        message.remove();
        return;
      };

      if (this.threads.has(messageId)) { // existing thread
        log(debugSettings.processing.Name, "existing thread");
        log(debugSettings.processing.Name, messageId);

        const existingThread = this.threads.get(messageId);
        existingThread.pushMessage(message);
      }
      else {
        log(debugSettings.processing.Name, "creating thread");
        log(debugSettings.processing.Name, messageId);

        const newThread = this.createThread(messageId);
        newThread.pushMessage(message);
      };
      
      log(debugSettings.processing.Name, "Deleting ts");
      log(debugSettings.processing.Name, message);
      message.remove();
    });
  };

  processReading(messages) {
    messages.forEach(message => {
      if (this.activeThread === null) {
        log(debugSettings.processing.Name, "ts null");
        log(debugSettings.processing.Name, message);
        return;
      };

      const messageId = this.getMessageId(message);
      if (messageId !== this.activeThread.threadId) {
        log(debugSettings.processing.Name, "Deleting ts because not part of thread");
        log(debugSettings.processing.Name, message);
        message.remove();
        return;
      };

      log(debugSettings.processing.Name, "%cadded message to thread", "color: cyan");
      log(debugSettings.processing.Name, messageId);

      const existingThread = this.threads.get(messageId);
      if (!existingThread.threadMessages.has(message)) {
        existingThread.pushMessage(message);
      };

      this.chatEnhancer.processMessage(message);
      
    });
  };

  channelSwitched() {
    this.activeThread = null;
    this.threads.clear();
  };

  createThread(id) {
    const thread = new Thread(this, id);
    this.threads.set(id, thread);
    return thread;
  };
};

export class Thread {
  constructor(threadManager, id) {
    this.threadManager = threadManager;
    this.threadId = id; // name of the whisperer
    this.threadMessages = new Set();
    this.latestMessage;
    this.threadButton = this.generateThreadButton();
  };

  generateThreadButton() {
    this.threadGenerated = true;

    const scrollInner = document.querySelector(".chat-log-scroll-inner");

    const threadFrame = document.createElement("div");
    const threadNotification = document.createElement("span");
    const threadTimeStamp = document.createElement("span");
    const threadName = document.createElement("span");
    const threadNameContent = document.createElement("span");
    const enterButton = document.createElement("button");

    threadFrame.classList.add("thread-frame");
    threadTimeStamp.classList.add("thread-timestamp");
    threadName.classList.add("thread-name");
    threadNameContent.classList.add("threat-name-content");
    enterButton.classList.add("thread-button");

    enterButton.addEventListener("click", () => this.showThreadMessages());
    
    threadNameContent.textContent = this.threadId;
    if (this.latestMessage) {
      threadTimeStamp.textContent = this.latestMessage.querySelector(".chat-line-timestamp").textContent;
    };
    
    
    scrollInner.appendChild(threadFrame);
    threadFrame.appendChild(threadTimeStamp);
    threadFrame.appendChild(threadName);
    threadFrame.appendChild(enterButton);

    threadName.appendChild(document.createTextNode("["));
    threadName.appendChild(threadNameContent);
    threadName.appendChild(document.createTextNode("]"));

    this.threadButton = threadFrame;
    return threadFrame;
  };


  showThreadMessages() {;
    if (this.threadManager.activeThread !== null) {
        // log(debugSettings.mode.Name, "Reading Thread");
        return;
    };
    this.threadManager.activeThread = this;
    this.generateThreadMessages();
  };

  generateThreadMessages() {
    const scrollOuter = document.querySelector(".chat-log-scroll-outer");
    const scrollInner = document.querySelector(".chat-log-scroll-inner");
    const exitButton = document.createElement("button");
    const arrowIcon = document.createElement("i");

    arrowIcon.className = "fa-solid fa-arrow-left";
    exitButton.classList.add("exit-button");

    exitButton.addEventListener("click", () => this.exitThreadMessages());

    scrollOuter.appendChild(exitButton);
    exitButton.appendChild(arrowIcon);

    this.threadManager.threads.forEach((thread) => {
        // log(debugSettings.mode.Name, thread);
        // log(debugSettings.mode.Name, thread.threadButton);
        if (thread.threadButton) thread.threadButton.remove();
    });
    this.threadMessages.forEach(message => {
        scrollInner.appendChild(message);
    });

    console.log(scrollInner.scrollHeight);
    console.log(scrollOuter.offsetHeight);
    scrollOuter.scrollTo({
      top: scrollInner.scrollHeight - scrollOuter.offsetHeight,
      left: 0,
      behavior: "smooth"
    });
  };

  exitThreadMessages() {
    this.threadManager.activeThread = null;
    // log(debugSettings.mode.Name, "Made False")

    const scrollOuter = document.querySelector(".chat-log-scroll-outer");
    const scrollInner = document.querySelector(".chat-log-scroll-inner");
    scrollInner.replaceChildren();

    const exitButton = scrollOuter.querySelector(".exit-button");
    exitButton.remove();

    this.threadManager.threads.forEach((thread) => {
        if (thread.threadButton) thread.generateThreadButton();
    });
  };

  pushMessage(message) {
    this.threadMessages.add(message);
    this.latestMessage = message;

    const messageTimestamp = message.querySelector(".chat-line-timestamp");
    const threadFrameTimestamp = this.threadButton.querySelector(".thread-timestamp");

    // log(debugSettings.mode.Name, messageTimestamp.textContent);
    threadFrameTimestamp.textContent = messageTimestamp.textContent;
  };
};