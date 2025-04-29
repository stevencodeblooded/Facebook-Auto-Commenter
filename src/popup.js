// Popup script for Facebook Auto Commenter

class FacebookCommenter {
  constructor() {
    this.initializeElements();
    this.bindEvents();
    this.restoreState();
  }

  initializeElements() {
    this.postUrlsInput = document.getElementById("postUrls");
    this.commentTextInput = document.getElementById("commentText");
    this.delayInput = document.getElementById("delay");
    this.randomizeCheckbox = document.getElementById("randomize");
    this.startBtn = document.getElementById("startCommentingBtn");
    this.stopBtn = document.getElementById("stopCommentingBtn");
    this.currentStatusEl = document.getElementById("currentStatus");
    this.postProgressEl = document.getElementById("postProgress");
    this.successMessagesEl = document.getElementById("successMessages");
    this.errorMessagesEl = document.getElementById("errorMessages");
  }

  bindEvents() {
    this.startBtn.addEventListener("click", () => this.startCommenting());
    this.stopBtn.addEventListener("click", () => this.stopCommenting());

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case "commentProgress":
          this.updateProgress(request.currentIndex, request.totalPosts);
          if (request.success) {
            this.addSuccessMessage(
              `Successfully commented on post ${request.currentIndex}`
            );
          } else {
            this.addErrorMessage(
              `Failed to comment on post ${request.currentIndex}`
            );
          }
          break;
        case "commentingComplete":
          this.resetUI();
          this.addSuccessMessage(request.message);
          break;
        case "commentError":
          this.addErrorMessage(request.error);
          break;
      }
    });
  }

  restoreState() {
    // Retrieve current commenting state when popup is opened
    chrome.runtime.sendMessage({ action: "getCommentingState" }, (state) => {
      if (state.isCommenting) {
        // Restore UI to reflect ongoing commenting process
        this.postUrlsInput.value = state.posts.join("\n");
        this.commentTextInput.value = state.comment;
        this.delayInput.value = state.delay;
        this.randomizeCheckbox.checked = state.randomize;

        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;

        this.updateProgress(state.currentIndex, state.posts.length);
        this.currentStatusEl.textContent = "Commenting in progress...";
      }
    });
  }

  clearMessages() {
    this.successMessagesEl.innerHTML = "";
    this.errorMessagesEl.innerHTML = "";
  }

  addSuccessMessage(message) {
    const messageEl = document.createElement("div");
    messageEl.textContent = message;
    this.successMessagesEl.appendChild(messageEl);
  }

  addErrorMessage(message) {
    const messageEl = document.createElement("div");
    messageEl.textContent = message;
    this.errorMessagesEl.appendChild(messageEl);
  }

  updateProgress(current, total) {
    this.postProgressEl.textContent = `Commenting: ${current} of ${total} posts`;
  }

  resetUI() {
    this.startBtn.disabled = false;
    this.stopBtn.disabled = true;
    this.currentStatusEl.textContent = "Commenting finished.";
    this.postProgressEl.textContent = "";
  }

  startCommenting() {
    // Clear previous messages
    this.clearMessages();

    // Validate inputs
    const postUrls = this.postUrlsInput.value
      .trim()
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    const commentText = this.commentTextInput.value.trim();
    const delay = parseInt(this.delayInput.value, 10);
    const randomize = this.randomizeCheckbox.checked;

    if (postUrls.length === 0 || !commentText) {
      this.addErrorMessage("Please enter post URLs and comment text.");
      return;
    }

    // Send message to background script to start commenting
    chrome.runtime.sendMessage(
      {
        action: "startCommenting",
        posts: postUrls,
        comment: commentText,
        delay: delay,
        randomize: randomize,
      },
      (response) => {
        if (response.success) {
          this.startBtn.disabled = true;
          this.stopBtn.disabled = false;
          this.currentStatusEl.textContent = "Commenting started...";
        }
      }
    );
  }

  stopCommenting() {
    // Send message to background script to stop commenting
    chrome.runtime.sendMessage({ action: "stopCommenting" }, (response) => {
      if (response.success) {
        this.resetUI();
        this.addErrorMessage("Commenting process was manually stopped.");
      }
    });
  }
}

// Initialize the commenter when the popup loads
document.addEventListener("DOMContentLoaded", () => {
  new FacebookCommenter();
});
