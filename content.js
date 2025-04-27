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
    // Find comment input field with multiple selectors
    let commentBox = document.querySelector(
      '[aria-label="Write a comment..."], [aria-label="Write a comment"], [placeholder*="Write a comment"], [data-lexical-editor="true"]'
    );

    if (!commentBox) {
      throw new Error("Comment box not found");
    }

    // Click to focus
    commentBox.click();
    await new Promise((resolve) => setTimeout(resolve, 500));

    // For modern Facebook editor, we need to work with the contenteditable div
    if (commentBox.getAttribute("contenteditable") === "true") {
      // Clear existing content
      commentBox.innerHTML = "";

      // Create and insert text node
      const textNode = document.createTextNode(commentText);
      commentBox.appendChild(textNode);

      // Trigger input event
      const inputEvent = new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: commentText,
      });
      commentBox.dispatchEvent(inputEvent);
    } else {
      // Fallback for older version
      commentBox.textContent = commentText;
      commentBox.value = commentText;
    }

    // Wait a bit for Facebook to process
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Find and click submit button
    const submitButton = document.querySelector(
      '[aria-label="Comment"], [aria-label="Post"]'
    );

    if (submitButton && !submitButton.disabled) {
      submitButton.click();
      return true;
    }

    // Fallback: simulate Enter key press
    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    });
    commentBox.dispatchEvent(enterEvent);

    return true;
  } catch (error) {
    console.error("Error posting comment:", error);
    return false;
  }
}
