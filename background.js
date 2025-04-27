let isRunning = false;
let currentTabId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startCommenting") {
    isRunning = true;
    currentTabId = message.tabId;
    startCommentingProcess(message);
  } else if (message.action === "stopCommenting") {
    isRunning = false;
  }
});

async function startCommentingProcess({
  postUrls,
  comments,
  minDelay,
  maxDelay,
  tabId,
}) {
  try {
    // Execute the async function to get username
    let userName = await executeScriptInTab(tabId, getCurrentUserNameAsync);

    if (!userName) {
      sendStatusUpdate(
        "Could not detect user name. Please make sure you are logged in.",
        "error"
      );
      sendComplete();
      return;
    }

    sendStatusUpdate(`Detected user: ${userName}`, "info");

    for (let i = 0; i < postUrls.length && isRunning; i++) {
      sendProgressUpdate(i, postUrls.length);

      // Navigate to post
      await chrome.tabs.update(tabId, { url: postUrls[i] });
      await waitForPageLoad(tabId);
      await sleep(3000); // Extra wait for dynamic content

      // Check if already commented
      const hasCommented = await executeScriptInTab(
        tabId,
        checkIfAlreadyCommented,
        userName
      );

      if (hasCommented) {
        sendStatusUpdate(`Already commented on post ${i + 1}`, "info");
      } else {
        // Select random comment
        const randomComment =
          comments[Math.floor(Math.random() * comments.length)];

        // Post comment
        const success = await executeScriptInTab(
          tabId,
          postCommentAsync,
          randomComment
        );

        if (success) {
          sendStatusUpdate(
            `Successfully commented on post ${i + 1}`,
            "success"
          );
        } else {
          sendStatusUpdate(`Failed to comment on post ${i + 1}`, "error");
        }
      }

      // Wait before next post
      if (i < postUrls.length - 1) {
        const delay =
          Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await sleep(delay);
      }
    }

    sendStatusUpdate("Commenting process completed!", "success");
  } catch (error) {
    sendStatusUpdate(`Error: ${error.message}`, "error");
  }

  sendComplete();
  isRunning = false;
}

function executeScriptInTab(tabId, func, args) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func,
        args: args ? [args] : [],
      },
      (results) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(results[0].result);
        }
      }
    );
  });
}

function waitForPageLoad(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.onUpdated.addListener(function listener(tabIdUpdated, info) {
      if (tabIdUpdated === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendStatusUpdate(message, status) {
  chrome.runtime.sendMessage({ type: "status", message, status });
}

function sendProgressUpdate(current, total) {
  chrome.runtime.sendMessage({ type: "progress", current, total });
}

function sendComplete() {
  chrome.runtime.sendMessage({ type: "complete" });
}

// Content script functions to be injected
async function getCurrentUserNameAsync() {
  try {
    // Method 1: Try to get from the profile dropdown when it's open
    const profileDropdownName = document.querySelector(
      'a[href="/me/"] span.x193iq5w'
    );
    if (profileDropdownName && profileDropdownName.textContent) {
      return profileDropdownName.textContent.trim();
    }

    // Method 2: Check profile menu button and wait properly
    const profileButton = document.querySelector('[aria-label="Your profile"]');
    if (profileButton) {
      // Click to open profile dropdown
      profileButton.click();

      // Wait for dropdown to open
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const nameInDropdown = document.querySelector(
        'a[href="/me/"] span.x193iq5w'
      );

      let name = null;
      if (nameInDropdown && nameInDropdown.textContent) {
        name = nameInDropdown.textContent.trim();
      }

      // Close the dropdown by clicking elsewhere
      document.body.click();

      if (name) return name;
    }

    // Method 3: Try to find from any visible profile references
    const accountSettings = document.querySelector('[aria-label*="Account"]');
    if (accountSettings) {
      const nameElement = accountSettings.querySelector("span.x193iq5w");
      if (nameElement && nameElement.textContent) {
        return nameElement.textContent.trim();
      }
    }

    return null;
  } catch (error) {
    console.error("Error getting user name:", error);
    return null;
  }
}

function checkIfAlreadyCommented(userName) {
  try {
    // Look for all comment articles
    const comments = document.querySelectorAll('[role="article"]');

    for (const comment of comments) {
      // Look for the comment author's name in the specific structure Facebook uses
      const authorNames = comment.querySelectorAll(
        'a[role="link"] span.x193iq5w'
      );

      for (const nameElement of authorNames) {
        // Check if this span contains the user's name
        if (
          nameElement.textContent &&
          nameElement.textContent.trim() === userName
        ) {
          // Also verify this is actually the author's name and not something else
          // by checking if it's within the comment header structure
          const parentLink = nameElement.closest('a[role="link"]');
          if (parentLink && parentLink.href.includes("comment_id=")) {
            return true;
          }
        }
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking for existing comments:", error);
    return false;
  }
}

async function postCommentAsync(commentText) {
  try {
    console.log("Starting comment process...");

    // First, find the comment button by its aria-label
    const commentButton = document.querySelector(
      '[aria-label="Leave a comment"]'
    );
    if (!commentButton) {
      console.error("Comment button not found");
      throw new Error("Comment button not found");
    }

    console.log("Found comment button, clicking...");
    commentButton.click();

    // Wait for the comment modal to appear
    console.log("Waiting for comment modal...");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Find the comment modal
    const commentModal = document.querySelector('[role="dialog"]');
    if (!commentModal) {
      console.error("Comment modal not found");
      throw new Error("Comment modal not found");
    }

    console.log("Comment modal appeared");

    // Find the comment input within the modal
    console.log("Looking for comment input in modal...");
    let commentBox =
      commentModal.querySelector('[contenteditable="true"]') ||
      commentModal.querySelector('[data-lexical-editor="true"]') ||
      commentModal.querySelector('[aria-label*="Write a comment"]');

    if (!commentBox) {
      // If not found in modal, check the entire document
      commentBox = document.querySelector(
        '[contenteditable="true"][data-lexical-editor="true"]'
      );
    }

    if (!commentBox) {
      console.error("Comment box not found in modal");
      throw new Error("Comment box not found in modal");
    }

    console.log("Found comment box, focusing...");
    // Focus on the comment box
    commentBox.focus();
    commentBox.click();

    // Wait for focus to settle
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Clear any existing content
    commentBox.innerHTML = "";

    // Insert the comment text
    console.log(`Inserting comment text: "${commentText}"`);
    const paragraph = document.createElement("p");
    paragraph.textContent = commentText;
    commentBox.appendChild(paragraph);

    // Trigger input event
    const inputEvent = new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: commentText,
    });
    commentBox.dispatchEvent(inputEvent);

    // Wait for Facebook to process
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Find and click the submit button
    console.log("Looking for submit button...");
    const submitButton =
      commentModal.querySelector('[aria-label="Comment"]') ||
      commentModal.querySelector('[aria-label="Post"]') ||
      document.querySelector('[aria-label="Comment"]') ||
      document.querySelector('[aria-label="Post"]');

    if (submitButton && !submitButton.disabled) {
      console.log("Found submit button, clicking...");
      submitButton.click();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log("Comment posted successfully");

      // Close the modal
      await closeCommentModal();

      return true;
    }

    // Fallback: try pressing Enter
    console.log("No submit button found, trying Enter key...");
    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    });
    commentBox.dispatchEvent(enterEvent);

    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log("Comment posted using Enter key");

    // Close the modal
    await closeCommentModal();

    return true;
  } catch (error) {
    console.error("Error posting comment:", error);
    return false;
  }
}

async function closeCommentModal() {
  try {
    console.log("Attempting to close comment modal...");

    // Find the close button using the selector from your screenshot
    const closeButton = document.querySelector('[aria-label="Close"]');
    if (closeButton) {
      closeButton.click();
      console.log("Close button clicked");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return true;
    }

    // Fallback: try pressing Escape key
    const escapeEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(escapeEvent);
    console.log("Escape key pressed");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    console.error("Error closing modal:", error);
  }
}
