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
    this.multiCommentModeCheckbox = document.getElementById("multiCommentMode");
    this.commentCounter = document.getElementById("commentCounter");
    this.commentInstructions = document.getElementById("commentInstructions");
    this.startBtn = document.getElementById("startCommentingBtn");
    this.stopBtn = document.getElementById("stopCommentingBtn");
    this.currentStatusEl = document.getElementById("currentStatus");
    this.postProgressEl = document.getElementById("postProgress");
    this.skippedPostsEl = document.getElementById("skippedPosts"); // Element for skipped posts count
    this.successMessagesEl = document.getElementById("successMessages");
    this.errorMessagesEl = document.getElementById("errorMessages");

    // Initialize comment counter
    this.commentCounter.textContent = "1 comment detected";

    // Hide instructions by default
    this.commentInstructions.style.display = "none";

    // Initialize skipped posts count if element exists
    if (this.skippedPostsEl) {
      this.skippedPostsEl.textContent = "Skipped posts: 0";
    } else {
      // Create it if it doesn't exist
      this.skippedPostsEl = document.createElement("div");
      this.skippedPostsEl.id = "skippedPosts";
      this.skippedPostsEl.textContent = "Skipped posts: 0";
      this.postProgressEl.parentNode.insertBefore(
        this.skippedPostsEl,
        this.postProgressEl.nextSibling
      );
    }
  }

  bindEvents() {
    this.startBtn.addEventListener("click", () => this.startCommenting());
    this.stopBtn.addEventListener("click", () => this.stopCommenting());

    // Listen for changes in the comment text area to update comment count
    this.commentTextInput.addEventListener("input", () =>
      this.updateCommentCount()
    );

    // Toggle multi-comment mode
    this.multiCommentModeCheckbox.addEventListener("change", () => {
      this.commentInstructions.style.display = this.multiCommentModeCheckbox
        .checked
        ? "block"
        : "none";
      this.updateCommentCount();
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case "commentProgress":
          this.updateProgress(request.currentIndex, request.totalPosts);
          if (request.success) {
            this.addSuccessMessage(
              `Successfully commented on post ${request.currentIndex}: "${request.usedComment}"`
            );
          } else {
            this.addErrorMessage(
              `Failed to comment on post ${request.currentIndex}`
            );
          }
          break;
        case "commentSkipped":
          // Handle skipped post notification
          this.updateProgress(request.currentIndex, request.totalPosts);
          this.updateSkippedPosts();
          this.addSuccessMessage(
            `Skipped post ${request.currentIndex}: ${request.message}`
          );
          break;
        case "commentingComplete":
          this.resetUI();
          this.addSuccessMessage(request.message);
          // Update skipped posts display in completion message
          if (request.skippedPosts > 0) {
            this.skippedPostsEl.textContent = `Skipped posts: ${request.skippedPosts}`;
          }
          break;
        case "commentError":
          this.addErrorMessage(request.error);
          break;
      }
    });
  }

  // Parse comments based on double line breaks when in multi-comment mode
  parseComments(text) {
    if (!this.multiCommentModeCheckbox.checked) {
      return [text];
    }

    // Split by double line breaks (paragraph breaks)
    const comments = text
      .split(/\n\s*\n+/)
      .map((comment) => comment.trim())
      .filter((comment) => comment);
    return comments.length > 0 ? comments : [text];
  }

  // Update the comment count display
  updateCommentCount() {
    const comments = this.parseComments(this.commentTextInput.value);
    const count = comments.length;
    this.commentCounter.textContent = `${count} comment${
      count !== 1 ? "s" : ""
    } detected`;
  }

  restoreState() {
    // Retrieve current commenting state when popup is opened
    chrome.runtime.sendMessage({ action: "getCommentingState" }, (state) => {
      if (state && state.isCommenting) {
        // Restore UI to reflect ongoing commenting process
        this.postUrlsInput.value = state.posts.join("\n");

        // Restore comment text
        if (Array.isArray(state.comments)) {
          // Handle multi-comment mode
          this.multiCommentModeCheckbox.checked = true;
          this.commentInstructions.style.display = "block";
          this.commentTextInput.value = state.comments.join("\n\n");
        } else {
          // Handle single comment mode
          this.multiCommentModeCheckbox.checked = false;
          this.commentInstructions.style.display = "none";
          this.commentTextInput.value = state.comment || "";
        }

        this.updateCommentCount();
        this.delayInput.value = state.delay;
        this.randomizeCheckbox.checked = state.randomize;

        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;

        this.updateProgress(state.currentIndex, state.posts.length);
        // Update skipped posts count if available
        if (state.skippedPosts !== undefined) {
          this.skippedPostsEl.textContent = `Skipped posts: ${state.skippedPosts}`;
        }
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
    // Auto-scroll to bottom
    this.successMessagesEl.scrollTop = this.successMessagesEl.scrollHeight;
  }

  addErrorMessage(message) {
    const messageEl = document.createElement("div");
    messageEl.textContent = message;
    this.errorMessagesEl.appendChild(messageEl);
    // Auto-scroll to bottom
    this.errorMessagesEl.scrollTop = this.errorMessagesEl.scrollHeight;
  }

  updateProgress(current, total) {
    this.postProgressEl.textContent = `Commenting: ${current} of ${total} posts`;
  }

  updateSkippedPosts() {
    // Get current state to update skipped posts count
    chrome.runtime.sendMessage({ action: "getCommentingState" }, (state) => {
      if (state && state.skippedPosts !== undefined) {
        this.skippedPostsEl.textContent = `Skipped posts: ${state.skippedPosts}`;
      }
    });
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

    // Parse comments based on multi-comment mode
    const commentText = this.commentTextInput.value.trim();
    const comments = this.parseComments(commentText);

    const delay = parseInt(this.delayInput.value, 10);
    const randomize = this.randomizeCheckbox.checked;
    const multiCommentMode = this.multiCommentModeCheckbox.checked;

    if (postUrls.length === 0 || comments.length === 0 || !commentText) {
      this.addErrorMessage("Please enter post URLs and comment text.");
      return;
    }

    // Reset skipped posts counter
    this.skippedPostsEl.textContent = "Skipped posts: 0";

    // Send message to background script to start commenting
    chrome.runtime.sendMessage(
      {
        action: "startCommenting",
        posts: postUrls,
        comments: comments,
        comment: multiCommentMode ? null : commentText, // For backward compatibility
        multiCommentMode: multiCommentMode,
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
