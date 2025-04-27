document.addEventListener("DOMContentLoaded", function () {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const postUrlsInput = document.getElementById("postUrls");
  const commentsInput = document.getElementById("comments");
  const statusDiv = document.getElementById("status");
  const progressDiv = document.getElementById("progress");
  const minDelayInput = document.getElementById("minDelay");
  const maxDelayInput = document.getElementById("maxDelay");

  // Load saved data
  chrome.storage.local.get(
    ["postUrls", "comments", "minDelay", "maxDelay"],
    (result) => {
      if (result.postUrls) postUrlsInput.value = result.postUrls;
      if (result.comments) commentsInput.value = result.comments;
      if (result.minDelay) minDelayInput.value = result.minDelay;
      if (result.maxDelay) maxDelayInput.value = result.maxDelay;
    }
  );

  // Save data on change
  function saveData() {
    chrome.storage.local.set({
      postUrls: postUrlsInput.value,
      comments: commentsInput.value,
      minDelay: minDelayInput.value,
      maxDelay: maxDelayInput.value,
    });
  }

  postUrlsInput.addEventListener("change", saveData);
  commentsInput.addEventListener("change", saveData);
  minDelayInput.addEventListener("change", saveData);
  maxDelayInput.addEventListener("change", saveData);

  startBtn.addEventListener("click", async () => {
    const postUrls = postUrlsInput.value
      .trim()
      .split("\n")
      .filter((url) => url.trim());
    const comments = commentsInput.value
      .trim()
      .split("\n")
      .filter((comment) => comment.trim());
    const minDelay = parseInt(minDelayInput.value) * 1000;
    const maxDelay = parseInt(maxDelayInput.value) * 1000;

    if (postUrls.length === 0) {
      showStatus("Please enter at least one post URL", "error");
      return;
    }

    if (comments.length === 0) {
      showStatus("Please enter at least one comment", "error");
      return;
    }

    if (minDelay >= maxDelay) {
      showStatus("Min delay must be less than max delay", "error");
      return;
    }

    // Get current tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab.url.includes("facebook.com")) {
      showStatus("Please open Facebook first", "error");
      return;
    }

    // Start the commenting process
    startBtn.style.display = "none";
    stopBtn.style.display = "block";
    showStatus("Starting commenting process...", "info");

    chrome.runtime.sendMessage({
      action: "startCommenting",
      postUrls,
      comments,
      minDelay,
      maxDelay,
      tabId: tab.id,
    });
  });

  stopBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "stopCommenting" });
    resetUI();
  });

  // Listen for status updates
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "status") {
      showStatus(message.message, message.status);
    }
    if (message.type === "progress") {
      updateProgress(message.current, message.total);
    }
    if (message.type === "complete") {
      resetUI();
    }
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = "block";
  }

  function updateProgress(current, total) {
    progressDiv.textContent = `Progress: ${current}/${total} posts processed`;
  }

  function resetUI() {
    startBtn.style.display = "block";
    stopBtn.style.display = "none";
    progressDiv.textContent = "";
  }
});
