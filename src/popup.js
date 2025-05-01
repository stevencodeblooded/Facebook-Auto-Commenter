// Popup script for Facebook Auto Commenter
import authManager from "./auth.js";

class FacebookCommenter {
  constructor() {
    // Delay initialization to ensure DOM is fully loaded
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.initialize());
    } else {
      this.initialize();
    }
  }

  initialize() {
    this.initializeElements();
    this.initializeAuth();
    this.bindEvents();
    this.completionModal = document.getElementById("completionModal");
    this.closeCompletionBtn = document.getElementById("closeCompletionModal");
  }

  initializeElements() {
    // Login elements
    this.loginOverlay = document.getElementById("login-page");
    this.appContainer = document.getElementById("app-container");
    this.passwordInput = document.getElementById("password");
    this.rememberCheckbox = document.getElementById("remember");
    this.loginBtn = document.getElementById("login-btn");
    this.logoutBtn = document.getElementById("logout-btn");
    this.loginErrorEl = document.getElementById("login-error");

    // Original elements
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
    this.skippedPostsEl = document.getElementById("skippedPosts");
    this.successMessagesEl = document.getElementById("successMessages");
    this.errorMessagesEl = document.getElementById("errorMessages");

    // History elements
    this.tabButtons = document.querySelectorAll(".tab-button");
    this.tabPanels = document.querySelectorAll(".tab-panel");
    this.successfulList = document.getElementById("successful-list");
    this.skippedList = document.getElementById("skipped-list");
    this.failedList = document.getElementById("failed-list");
    this.clearHistoryBtn = document.getElementById("clearHistoryBtn");
    this.emptyMessages = document.querySelectorAll(".empty-message");

    // Count elements
    this.successfulCountEl = document.getElementById("successful-count");
    this.skippedCountEl = document.getElementById("skipped-count");
    this.failedCountEl = document.getElementById("failed-count");

    // Initialize count elements
    this.successfulCountEl.textContent = "0";
    this.skippedCountEl.textContent = "0";
    this.failedCountEl.textContent = "0";
    this.successfulCountEl.classList.add("empty");
    this.skippedCountEl.classList.add("empty");
    this.failedCountEl.classList.add("empty");

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

  // Initialize authentication
  async initializeAuth() {
    // First check if remote password needs to be fetched
    await authManager.checkRemotePassword();

    // Check if user is already authenticated
    const isAuthenticated = await authManager.isAuthenticated();

    if (isAuthenticated) {
      this.showApp();
      this.restoreState();
      this.loadCommentHistory();
    } else {
      this.showLogin();
    }
  }

  // Show login overlay
  showLogin() {
    this.loginOverlay.style.display = "block";
    this.appContainer.style.display = "none";
    this.passwordInput.focus();
  }

  // Show main app
  showApp() {
    this.loginOverlay.style.display = "none";
    this.appContainer.style.display = "block";
  }

  // Handle login
  async handleLogin() {
    const password = this.passwordInput.value;
    const remember = this.rememberCheckbox.checked;

    if (!password) {
      this.loginErrorEl.textContent = "Please enter a password";
      return;
    }

    const success = await authManager.login(password, remember);

    if (success) {
      this.showApp();
      this.restoreState();
      this.loadCommentHistory();
      this.passwordInput.value = ""; // Clear password field
      this.loginErrorEl.textContent = "";
    } else {
      this.loginErrorEl.textContent = "Invalid password";
      this.passwordInput.select();
    }
  }

  // Handle logout
  async handleLogout() {
    await authManager.logout();
    this.showLogin();
  }

  // Show completion modal with summary
  showCompletionModal(stats) {
    console.log("Showing completion modal with stats:", stats);
    const modal = document.getElementById("completionModal");
    const summary = document.getElementById("completionSummary");

    // Create summary content
    let summaryHTML = `<p>Commenting process completed successfully!</p><div class="completion-stats">`;

    // Only add stats with values > 0
    if (stats.successful > 0) {
      summaryHTML += `
      <div class="stat-item stat-success">
        <span>Successful:</span>
        <span class="stat-count">${stats.successful}</span>
      </div>`;
    }

    if (stats.skipped > 0) {
      summaryHTML += `
      <div class="stat-item stat-warning">
        <span>Skipped:</span>
        <span class="stat-count">${stats.skipped}</span>
      </div>`;
    }

    if (stats.failed > 0) {
      summaryHTML += `
      <div class="stat-item stat-error">
        <span>Failed:</span>
        <span class="stat-count">${stats.failed}</span>
      </div>`;
    }

    summaryHTML += `</div>`;
    summary.innerHTML = summaryHTML;

    // Show the modal with animation
    modal.classList.add("visible");

    // Add event listeners to close modal
    const closeBtn = document.getElementById("closeCompletionModal");
    closeBtn.addEventListener("click", () => this.closeCompletionModal());

    // Close when clicking outside the modal
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.closeCompletionModal();
      }
    });
  }

  // Close the completion modal
  closeCompletionModal() {
    const modal = document.getElementById("completionModal");
    modal.classList.remove("visible");
  }

  bindEvents() {
    // Authentication events
    this.loginBtn.addEventListener("click", () => this.handleLogin());
    this.passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.handleLogin();
    });
    this.logoutBtn.addEventListener("click", () => this.handleLogout());

    // Original events
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

    // Tab switching in history section
    this.tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const tabName = button.getAttribute("data-tab");
        this.switchTab(tabName);
      });
    });

    // Clear history button
    this.clearHistoryBtn.addEventListener("click", () => this.clearHistory());

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case "commentProgress":
          this.updateProgress(request.currentIndex, request.totalPosts);
          if (request.success) {
            this.addSuccessMessage(
              `Successfully commented on post ${request.currentIndex}: "${request.usedComment}"`
            );
            // Add to successful URLs in UI
            if (request.url) {
              this.addUrlToHistory(
                request.url,
                "successful",
                request.usedComment
              );
            }
          } else {
            this.addErrorMessage(
              `Failed to comment on post ${request.currentIndex}`
            );
            // Add to failed URLs in UI
            if (request.url) {
              this.addUrlToHistory(
                request.url,
                "failed",
                request.error || "Unknown error"
              );
            }
          }
          break;
        case "commentSkipped":
          // Handle skipped post notification
          this.updateProgress(request.currentIndex, request.totalPosts);
          this.updateSkippedPosts();
          this.addSuccessMessage(
            `Skipped post ${request.currentIndex}: ${request.message}`
          );
          // Add to skipped URLs in UI
          if (request.url) {
            this.addUrlToHistory(request.url, "skipped", request.message);
          }
          break;
        case "commentError":
          this.addErrorMessage(request.error);
          // Add to failed URLs in UI if URL is provided
          if (request.url) {
            this.addUrlToHistory(request.url, "failed", request.error);
          }
          break;
        case "commentingComplete":
          console.log("Received completion message:", request);
          this.resetUI();
          this.addSuccessMessage(request.message);

          // Update skipped posts display in completion message
          if (request.skippedPosts > 0) {
            this.skippedPostsEl.textContent = `Skipped posts: ${request.skippedPosts}`;
          }

          // Get the final counts for the completion modal
          chrome.runtime.sendMessage(
            { action: "getCommentHistory" },
            (history) => {
              if (history) {
                // Calculate counts from latest history
                const successfulCount = history.successfulUrls
                  ? history.successfulUrls.length
                  : 0;
                const skippedCount = history.skippedUrls
                  ? history.skippedUrls.length
                  : 0;
                const failedCount = history.failedUrls
                  ? history.failedUrls.length
                  : 0;

                // Get counts from current session only (if available in request)
                const sessionStats = {
                  successful: request.successfulCount || successfulCount,
                  skipped: request.skippedPosts || skippedCount,
                  failed: request.failedCount || failedCount,
                };

                // Show completion modal with stats
                this.showCompletionModal(sessionStats);
              }
            }
          );

          // Refresh history to show the latest
          this.loadCommentHistory();
          break;
      }
    });
  }

  // Switch between tabs in history section
  switchTab(tabName) {
    // Update tab buttons
    this.tabButtons.forEach((button) => {
      if (button.getAttribute("data-tab") === tabName) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });

    // Update tab panels
    this.tabPanels.forEach((panel) => {
      if (panel.id === `${tabName}-tab`) {
        panel.classList.add("active");
      } else {
        panel.classList.remove("active");
      }
    });
  }

  // Update counts in tab buttons
  updateTabCounts(successfulCount, skippedCount, failedCount) {
    // Update successful count
    this.successfulCountEl.textContent = successfulCount;
    if (successfulCount > 0) {
      this.successfulCountEl.classList.remove("empty");
      // Add animation class for a brief moment
      this.successfulCountEl.classList.add("updated");
      setTimeout(() => {
        this.successfulCountEl.classList.remove("updated");
      }, 300);
    } else {
      this.successfulCountEl.classList.add("empty");
    }

    // Update skipped count
    this.skippedCountEl.textContent = skippedCount;
    if (skippedCount > 0) {
      this.skippedCountEl.classList.remove("empty");
      this.skippedCountEl.classList.add("updated");
      setTimeout(() => {
        this.skippedCountEl.classList.remove("updated");
      }, 300);
    } else {
      this.skippedCountEl.classList.add("empty");
    }

    // Update failed count
    this.failedCountEl.textContent = failedCount;
    if (failedCount > 0) {
      this.failedCountEl.classList.remove("empty");
      this.failedCountEl.classList.add("updated");
      setTimeout(() => {
        this.failedCountEl.classList.remove("updated");
      }, 300);
    } else {
      this.failedCountEl.classList.add("empty");
    }
  }

  // Load comment history from storage
  loadCommentHistory() {
    chrome.runtime.sendMessage({ action: "getCommentHistory" }, (history) => {
      if (history) {
        // Clear existing lists
        this.successfulList.innerHTML = "";
        this.skippedList.innerHTML = "";
        this.failedList.innerHTML = "";

        let successfulCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        // Populate successful URLs
        if (history.successfulUrls && history.successfulUrls.length > 0) {
          document.querySelector(
            "#successful-tab .empty-message"
          ).style.display = "none";
          history.successfulUrls.forEach((item) => {
            this.addUrlToHistoryUI(
              item.url,
              "successful",
              item.timestamp,
              item.comment
            );
          });
          successfulCount = history.successfulUrls.length;
        } else {
          document.querySelector(
            "#successful-tab .empty-message"
          ).style.display = "block";
        }

        // Populate skipped URLs
        if (history.skippedUrls && history.skippedUrls.length > 0) {
          document.querySelector("#skipped-tab .empty-message").style.display =
            "none";
          history.skippedUrls.forEach((item) => {
            this.addUrlToHistoryUI(
              item.url,
              "skipped",
              item.timestamp,
              item.reason
            );
          });
          skippedCount = history.skippedUrls.length;
        } else {
          document.querySelector("#skipped-tab .empty-message").style.display =
            "block";
        }

        // Populate failed URLs
        if (history.failedUrls && history.failedUrls.length > 0) {
          document.querySelector("#failed-tab .empty-message").style.display =
            "none";
          history.failedUrls.forEach((item) => {
            this.addUrlToHistoryUI(
              item.url,
              "failed",
              item.timestamp,
              item.reason
            );
          });
          failedCount = history.failedUrls.length;
        } else {
          document.querySelector("#failed-tab .empty-message").style.display =
            "block";
        }

        // Update tab counts
        this.updateTabCounts(successfulCount, skippedCount, failedCount);
      }
    });
  }

  // Add URL to history list in UI
  addUrlToHistoryUI(url, type, timestamp, comment) {
    const list =
      type === "successful"
        ? this.successfulList
        : type === "skipped"
        ? this.skippedList
        : this.failedList;

    const urlItem = document.createElement("div");
    urlItem.className = "url-item";

    const urlRow = document.createElement("div");
    urlRow.className = "url-row";

    const urlLink = document.createElement("a");
    urlLink.href = url;
    urlLink.target = "_blank";
    urlLink.title = url;

    // Truncate URL for display
    const displayUrl = this.truncateUrl(url);
    urlLink.textContent = displayUrl;

    const timeSpan = document.createElement("span");
    timeSpan.className = "time";
    timeSpan.textContent = this.formatTimestamp(timestamp);

    urlRow.appendChild(urlLink);
    urlRow.appendChild(timeSpan);
    urlItem.appendChild(urlRow);

    // Add status indicator based on type
    const statusIndicator = document.createElement("span");
    if (type === "successful") {
      statusIndicator.className = "status-success";
      urlLink.prepend(statusIndicator);
    } else if (type === "skipped") {
      statusIndicator.className = "status-warning";
      urlLink.prepend(statusIndicator);
    } else {
      statusIndicator.className = "status-error";
      urlLink.prepend(statusIndicator);
    }

    // Add comment or reason if available
    if (comment) {
      const commentDiv = document.createElement("div");
      commentDiv.className = type === "successful" ? "comment" : "reason";
      commentDiv.textContent = type === "successful" ? `"${comment}"` : comment;
      urlItem.appendChild(commentDiv);
    }

    list.appendChild(urlItem);

    // Hide empty message
    const emptyMessage = list.parentNode.querySelector(".empty-message");
    if (emptyMessage) {
      emptyMessage.style.display = "none";
    }
  }

  // Add URL to history (both UI and background)
  addUrlToHistory(url, type, comment) {
    // Add to UI
    this.addUrlToHistoryUI(url, type, Date.now(), comment);

    // Update count in tab button
    this.updateCountForNewItem(type);

    // No need to send to background as it already records this
    // This is only used for real-time UI updates during an active commenting session
  }

  // Update count when a new item is added
  updateCountForNewItem(type) {
    // Get current counts
    const successfulCount = parseInt(this.successfulCountEl.textContent) || 0;
    const skippedCount = parseInt(this.skippedCountEl.textContent) || 0;
    const failedCount = parseInt(this.failedCountEl.textContent) || 0;

    // Update the respective count
    if (type === "successful") {
      this.updateTabCounts(successfulCount + 1, skippedCount, failedCount);
    } else if (type === "skipped") {
      this.updateTabCounts(successfulCount, skippedCount + 1, failedCount);
    } else if (type === "failed") {
      this.updateTabCounts(successfulCount, skippedCount, failedCount + 1);
    }
  }

  // Clear history
  clearHistory() {
    if (confirm("Are you sure you want to clear your comment history?")) {
      chrome.runtime.sendMessage(
        { action: "clearCommentHistory" },
        (response) => {
          if (response.success) {
            // Clear UI
            this.successfulList.innerHTML = "";
            this.skippedList.innerHTML = "";
            this.failedList.innerHTML = "";

            // Show empty messages
            this.emptyMessages.forEach((msg) => {
              msg.style.display = "block";
            });

            // Reset counts
            this.updateTabCounts(0, 0, 0);
          }
        }
      );
    }
  }

  // Helper to truncate long URLs
  truncateUrl(url) {
    const maxLength = 40;
    if (url.length <= maxLength) return url;

    // Remove http/https and www
    let cleaned = url.replace(/^(https?:\/\/)?(www\.)?/, "");

    // If still too long, truncate the middle
    if (cleaned.length > maxLength) {
      const start = cleaned.substring(0, maxLength / 2 - 2);
      const end = cleaned.substring(cleaned.length - maxLength / 2 + 2);
      return start + "..." + end;
    }

    return cleaned;
  }

  // Format timestamp to readable date/time
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();

    // If today, show time only
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    // If this year, show date without year
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }

    // Otherwise show full date
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "2-digit",
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

export default FacebookCommenter;
