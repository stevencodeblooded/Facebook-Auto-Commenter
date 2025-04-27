// Content script to help with Facebook interactions
// This file runs in the context of the Facebook page

// Helper function to wait for an element to appear
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      } else {
        setTimeout(checkElement, 100);
      }
    };

    checkElement();
  });
}

// Monitor for dynamic content changes
const observer = new MutationObserver((mutations) => {
  // You can add specific reactions to DOM changes here if needed
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getCurrentUserName") {
    const userName = getCurrentUserName();
    sendResponse({ userName });
  } else if (message.action === "checkIfAlreadyCommented") {
    const hasCommented = checkIfAlreadyCommented(message.userName);
    sendResponse({ hasCommented });
  } else if (message.action === "postComment") {
    postComment(message.commentText).then((success) => {
      sendResponse({ success });
    });
    return true; // Keep message channel open for async response
  }
});

function getCurrentUserName() {
  try {
    // Method 1: Check profile menu button
    const profileButton = document.querySelector('[aria-label="Your profile"]');
    if (profileButton) {
      const nameSpan = profileButton.querySelector("span");
      if (nameSpan && nameSpan.textContent) {
        return nameSpan.textContent.trim();
      }
    }

    // Method 2: Check account menu
    const accountMenu = document.querySelector('[aria-label*="Account"]');
    if (accountMenu) {
      const nameElement = accountMenu.querySelector("span");
      if (nameElement && nameElement.textContent) {
        return nameElement.textContent.trim();
      }
    }

    // Method 3: Check profile dropdown
    const profileDropdown = document.querySelector(
      '[role="navigation"] [aria-label*="Profile"]'
    );
    if (profileDropdown) {
      const nameElement = profileDropdown.querySelector("span");
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
      // Check if comment author matches user name
      const authorElements = comment.querySelectorAll('a[role="link"] span');
      for (const element of authorElements) {
        if (element.textContent && element.textContent.trim() === userName) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking for existing comments:", error);
    return false;
  }
}

async function postComment(commentText) {
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
    const commentModal = await waitForElement('[role="dialog"]', 3000);
    console.log("Comment modal appeared");

    // Wait a bit for the modal to fully render
    await new Promise((resolve) => setTimeout(resolve, 1000));

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
