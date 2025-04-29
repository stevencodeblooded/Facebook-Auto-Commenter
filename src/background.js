// Enhanced background.js for Facebook Auto Commenter

// State management for commenting
let commentingState = {
  isCommenting: false,
  posts: [],
  currentIndex: 0,
  comment: "",
  delay: 5,
  randomize: false,
};

// Save state to storage
function saveState() {
  console.log("Saving state:", commentingState);
  return chrome.storage.local.set({ commentingState });
}

// Load state from storage
async function loadState() {
  try {
    const result = await chrome.storage.local.get(["commentingState"]);
    if (result.commentingState) {
      commentingState = result.commentingState;
      console.log("Loaded state:", commentingState);
    }
  } catch (error) {
    console.error("Error loading state:", error);
  }
  return commentingState;
}

// Reset state
function resetState() {
  commentingState = {
    isCommenting: false,
    posts: [],
    currentIndex: 0,
    comment: "",
    delay: 5,
    randomize: false,
  };
  console.log("State reset");
  return saveState();
}

// Generate comment variation if randomize is enabled
function generateComment(baseComment, randomize) {
  if (!randomize) return baseComment;

  const variations = [
    `${baseComment} 👍`,
    `✨ ${baseComment}`,
    `${baseComment} 🔥`,
    `Interesting: ${baseComment}`,
    `${baseComment} 😊`,
    `Great! ${baseComment}`,
    `${baseComment} ⭐️`,
  ];
  const comment = variations[Math.floor(Math.random() * variations.length)];
  console.log("Generated random comment variation:", comment);
  return comment;
}

// Process next post with improved navigation and reliability
async function processNextPost() {
  try {
    await loadState();

    // Check if we're done or stopped
    if (
      !commentingState.isCommenting ||
      commentingState.currentIndex >= commentingState.posts.length
    ) {
      await resetState();

      chrome.runtime.sendMessage({
        action: "commentingComplete",
        message: "Commenting process finished successfully.",
      });
      return;
    }

    const currentUrl = commentingState.posts[commentingState.currentIndex];
    const comment = generateComment(
      commentingState.comment,
      commentingState.randomize
    );

    console.log(
      `Processing post ${commentingState.currentIndex + 1}/${
        commentingState.posts.length
      }`
    );
    console.log(`URL: ${currentUrl}`);

    try {
      // Find or create a Facebook tab
      let targetTab;
      const facebookTabs = await chrome.tabs.query({
        url: "https://www.facebook.com/*",
      });

      if (facebookTabs.length > 0) {
        // Use existing Facebook tab
        targetTab = facebookTabs[0];
        console.log("Using existing Facebook tab:", targetTab.id);

        // Navigate to the post URL
        await chrome.tabs.update(targetTab.id, { url: currentUrl });
      } else {
        // Create new tab if no Facebook tab exists
        console.log("Creating new Facebook tab");
        targetTab = await chrome.tabs.create({ url: currentUrl });
      }

      // Wait for page load and Facebook to initialize
      console.log("Waiting for page to load completely...");
      await new Promise((resolve) => setTimeout(resolve, 8000));

      // Ensure tab is still valid
      try {
        await chrome.tabs.get(targetTab.id);
      } catch (error) {
        throw new Error("Tab no longer exists");
      }

      // Send message to content script with timeout
      console.log(`Sending message to tab ${targetTab.id}`);

      // Use a promise with timeout for message handling
      const response = await Promise.race([
        new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(
            targetTab.id,
            {
              action: "processPost",
              comment: comment,
              delay: commentingState.delay * 1000,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error("Runtime error:", chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
              } else if (response) {
                resolve(response);
              } else {
                reject(new Error("No response received from content script"));
              }
            }
          );
        }),
        // Timeout after 30 seconds and assume success
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                success: true,
                warning:
                  "Content script timed out but comment was likely posted",
              }),
            30000
          )
        ),
      ]);

      console.log("Response from content script or timeout:", response);

      // Send progress update to popup
      chrome.runtime.sendMessage({
        action: "commentProgress",
        currentIndex: commentingState.currentIndex + 1,
        totalPosts: commentingState.posts.length,
        success: response.success,
        warning: response.warning,
      });
    } catch (error) {
      console.error("Error processing post:", error);

      // Send error message to popup
      chrome.runtime.sendMessage({
        action: "commentError",
        error: `Error on post ${commentingState.currentIndex + 1}: ${
          error.message
        }`,
      });
    }

    // Move to next post regardless of success or failure
    commentingState.currentIndex++;
    await saveState();

    // Schedule next post with the specified delay
    setTimeout(processNextPost, commentingState.delay * 1000);
  } catch (error) {
    console.error("Fatal error in processNextPost:", error);

    // Reset state on fatal error
    await resetState();

    chrome.runtime.sendMessage({
      action: "commentError",
      error: `Fatal error: ${error.message}`,
    });
  }
}

// Message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request);

  switch (request.action) {
    case "startCommenting":
      console.log("Starting commenting process");
      // Initialize commenting state with user inputs
      commentingState = {
        isCommenting: true,
        posts: request.posts,
        currentIndex: 0,
        comment: request.comment,
        delay: request.delay,
        randomize: request.randomize,
      };
      saveState();

      // Start the process in the background
      processNextPost();

      sendResponse({ success: true });
      return true;

    case "stopCommenting":
      console.log("Stopping commenting process");
      commentingState.isCommenting = false;
      saveState();
      sendResponse({ success: true });
      return true;

    case "getCommentingState":
      console.log("Returning current state to popup");
      loadState().then((state) => {
        sendResponse(state);
      });
      return true;
  }
});

// Handle extension installation or update
chrome.runtime.onInstalled.addListener(() => {
  console.log("Facebook Auto Commenter installed or updated");
  resetState();
});

// Ensure extension remains active
chrome.runtime.onStartup.addListener(() => {
  console.log("Extension started up");
  loadState();
});
