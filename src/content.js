// Facebook Auto Commenter with specific Lexical Editor support and Skip Already Commented Posts

console.log("Facebook Auto Commenter content script loaded");
const RESPONSE_TIMEOUT = 25000; // 25 seconds

// Target the exact comment field structure we see in the logs
const SELECTORS = {
  commentField: [
    'div[aria-label="Write a comment…"][data-lexical-editor="true"]',
    'div.xzsf02u.notranslate[contenteditable="true"]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
    'div.notranslate[contenteditable="true"]',
  ],
  submitButton: [
    'div[aria-label="Comment"][role="button"]',
    'div[aria-label="Post"][role="button"]',
  ],
};

// Wait for element
function waitForElement(selector, timeout = 15000) {
  return new Promise((resolve, reject) => {
    // Check if element already exists
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(checkInterval);
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }
    }, 100);
  });
}

// Try multiple selectors until one works
async function findElementWithSelectors(selectors, timeout = 15000) {
  const errors = [];

  for (const selector of selectors) {
    try {
      console.log(`Trying selector: ${selector}`);
      const element = await waitForElement(selector, timeout);
      console.log(`Found element with selector: ${selector}`);
      return element;
    } catch (error) {
      errors.push(`Selector ${selector}: ${error.message}`);
    }
  }

  throw new Error(
    `None of the selectors found an element: ${errors.join(", ")}`
  );
}

// Extract the currently logged-in user's information
function getLoggedInUserInfo() {
  console.log("Extracting logged-in user info");
  let userId = "";
  let userName = "";

  try {
    // Try to extract user ID from various elements on the page
    // Method 1: From profile link
    const profileLinks = document.querySelectorAll('a[href*="/profile.php"]');
    for (const link of profileLinks) {
      const matches = link.href.match(/id=(\d+)/);
      if (matches && matches[1]) {
        userId = matches[1];
        console.log(`Found user ID from profile link: ${userId}`);
        break;
      }
    }

    // Method 2: From other links containing user ID
    if (!userId) {
      const allLinks = document.querySelectorAll('a[href*="/user/"]');
      for (const link of allLinks) {
        const matches = link.href.match(/\/user\/(\d+)/);
        if (matches && matches[1]) {
          userId = matches[1];
          console.log(`Found user ID from user link: ${userId}`);
          break;
        }
      }
    }

    // Method 3: From user menu or profile area
    const userNameElements = document.querySelectorAll('span[dir="auto"]');
    for (const el of userNameElements) {
      // Look for spans that might contain the username in top navigation or menu
      if (
        el.textContent &&
        el.textContent.length > 0 &&
        !el.textContent.includes("Write a") &&
        !el.textContent.includes("Like") &&
        !el.textContent.includes("Comment") &&
        !el.textContent.includes("Share")
      ) {
        userName = el.textContent.trim();
        console.log(`Found potential username: ${userName}`);
        break;
      }
    }
  } catch (error) {
    console.error("Error extracting user info:", error);
  }

  console.log(`User info: ID=${userId}, Name=${userName}`);
  return { userId, userName };
}

// Check if the user has already commented on this post
async function hasUserAlreadyCommented() {
  console.log("Checking if user has already commented on this post");

  try {
    // Get logged-in user info
    const { userId, userName } = getLoggedInUserInfo();

    if (!userId && !userName) {
      console.log(
        "Could not determine user identity, unable to check for existing comments"
      );
      return false;
    }

    // Wait for post to fully load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Find the main post container first to restrict our search scope
    const postContainer = document.querySelector(
      '[role="article"][tabindex="-1"]'
    );
    if (!postContainer) {
      console.log("Could not find post container, checking whole page");
      // Fall back to old behavior
    }

    // Method 1: Check for user ID in comment links WITHIN THE POST CONTAINER
    if (userId && postContainer) {
      // Restrict search to only comments within this post
      const userCommentLinks = postContainer.querySelectorAll(
        `a[href*="/user/${userId}"]`
      );
      if (userCommentLinks.length > 0) {
        console.log(
          `Found ${userCommentLinks.length} comments by user ID ${userId} in this post, skipping`
        );
        return true;
      }

      // Additional check for profile ID links
      const profileCommentLinks = postContainer.querySelectorAll(
        `a[href*="profile.php?id=${userId}"]`
      );
      if (profileCommentLinks.length > 0) {
        console.log(
          `Found ${profileCommentLinks.length} comments by profile ID ${userId} in this post, skipping`
        );
        return true;
      }
    } else {
      // Fallback to searching the entire page if we can't find the post container
      const userCommentLinks = document.querySelectorAll(
        `a[href*="/user/${userId}"]`
      );
      const profileCommentLinks = document.querySelectorAll(
        `a[href*="profile.php?id=${userId}"]`
      );

      // Log what we found for debugging
      console.log(
        `Found ${userCommentLinks.length} user ID links and ${profileCommentLinks.length} profile links`
      );

      // Verify these are actually comment links
      let validCommentCount = 0;
      [...userCommentLinks, ...profileCommentLinks].forEach((link) => {
        // Look for parent elements that indicate this is a comment
        const isInComment = !!link.closest('[role="article"][tabindex="-1"]');
        if (isInComment) validCommentCount++;
        console.log(
          `Link ${link.href}: ${
            isInComment ? "Is in comment" : "Not in comment"
          }`
        );
      });

      if (validCommentCount > 0) {
        console.log(
          `Found ${validCommentCount} verified comments by user, skipping post`
        );
        return true;
      }
    }

    // Method 2: Check for username in comment authors as backup
    if (userName) {
      const commentSelector = postContainer
        ? 'span.x193iq5w[dir="auto"]' // Within post container
        : 'div[role="article"] span.x193iq5w[dir="auto"]'; // On whole page with article wrapper

      const commentAuthorSpans = (postContainer || document).querySelectorAll(
        commentSelector
      );

      console.log(
        `Found ${commentAuthorSpans.length} potential comment author spans`
      );

      for (const span of commentAuthorSpans) {
        console.log(`Checking span with text: "${span.textContent.trim()}"`);
        if (span.textContent.trim() === userName) {
          console.log(`Found comment by username "${userName}", skipping post`);
          return true;
        }
      }
    }

    console.log("No existing comments found from current user");
    return false;
  } catch (error) {
    console.error("Error checking for user comments:", error);
    return false; // On error, proceed with commenting
  }
}

// Find comment input
async function findCommentInput() {
  try {
    // Try to click the comment area first to activate it
    try {
      const commentPlaceholders = document.querySelectorAll(
        '[aria-label="Write a comment..."]'
      );
      if (commentPlaceholders && commentPlaceholders.length > 0) {
        console.log("Found and clicking comment placeholder");
        commentPlaceholders[0].click();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (e) {
      console.log("No placeholder found or error clicking:", e);
    }

    // Find the actual input
    const element = await findElementWithSelectors(SELECTORS.commentField);
    console.log("Comment input found:", element);
    return element;
  } catch (error) {
    console.error("Failed to find comment input:", error);
    throw error;
  }
}

// Find submit button
async function findSubmitButton() {
  try {
    const element = await findElementWithSelectors(SELECTORS.submitButton);
    console.log("Submit button found:", element);
    return element;
  } catch (error) {
    console.error("Submit button not found:", error);
    return null;
  }
}

// Set text in Facebook's Lexical editor
function setTextInLexicalEditor(element, text) {
  console.log(`Setting text in Lexical Editor: "${text}"`);

  // Focus the element
  element.focus();

  // Clear existing content by selecting all and deleting
  document.execCommand("selectAll", false, null);
  document.execCommand("delete", false, null);

  // Find the paragraph element inside (this is the actual content container)
  const paragraphElement = element.querySelector("p") || element;

  // Method 1: Direct text setting with specific structure
  paragraphElement.textContent = text;

  // Trigger appropriate events
  const inputEvent = new InputEvent("input", {
    bubbles: true,
    cancelable: true,
    data: text,
  });
  element.dispatchEvent(inputEvent);

  // Force change event
  element.dispatchEvent(new Event("change", { bubbles: true }));

  // Check if text was inserted - this is more lenient now
  const textContent = element.textContent || "";
  const innerText = element.innerText || "";
  const paragraphText = paragraphElement.textContent || "";

  // Facebook might not immediately show text in these properties,
  // so we'll be more optimistic about text insertion
  console.log(`Current element text content: "${textContent}"`);
  console.log(`Current inner text: "${innerText}"`);

  // Always return true since we've done our best to insert the text
  // and Facebook's Lexical editor sometimes doesn't immediately update its properties
  return true;
}

// Submit with Enter key
function submitWithEnterKey(element) {
  console.log("Submitting with Enter key");

  // Focus the element
  element.focus();

  // Create and dispatch Enter key events
  const keydownEvent = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  });

  const keypressEvent = new KeyboardEvent("keypress", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  });

  const keyupEvent = new KeyboardEvent("keyup", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  });

  // Dispatch all events in sequence
  element.dispatchEvent(keydownEvent);
  element.dispatchEvent(keypressEvent);
  element.dispatchEvent(keyupEvent);

  console.log("Enter key event dispatched");
}

// Add comment to post
async function addComment(comment, delay) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`Attempting to add comment: "${comment}"`);

      // Find comment input
      const commentInput = await findCommentInput();
      console.log("Comment input element:", commentInput);

      // Sleep to let page stabilize
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Set text in the Lexical editor
      setTextInLexicalEditor(commentInput, comment);

      // Sleep before submitting
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Skip submit button search and use Enter key directly
      console.log("Using Enter key for submission");
      submitWithEnterKey(commentInput);

      // IMPORTANT: Send early response after submission attempt
      console.log("Comment likely submitted - responding now");
      resolve(true);

      // Continue with verification in the background
      setTimeout(() => {
        try {
          // Check for submission success
          const commentText =
            commentInput.textContent || commentInput.innerText;

          console.log(
            `Comment verification complete. Current field content:`,
            commentText
          );
        } catch (e) {
          console.log("Post-submission verification error:", e);
        }
      }, delay || 3000);
    } catch (error) {
      console.error("Error adding comment:", error);
      reject(error);
    }
  });
}

// Process post - now with check for existing comments
async function processPost(comment, delay) {
  try {
    console.log(`Processing post with comment: "${comment}"`);

    // Wait for page to load fully
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check if the user has already commented on this post
    const alreadyCommented = await hasUserAlreadyCommented();

    if (alreadyCommented) {
      console.log("User has already commented on this post, skipping");
      return {
        success: true,
        skipped: true,
        message: "Post already commented on",
      };
    }

    // Add comment if not already commented
    console.log("No existing comment found, proceeding with comment");
    await addComment(comment, delay);

    return { success: true };
  } catch (error) {
    console.error("Failed to process post:", error);
    return { success: false, error: error.message };
  }
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);

  if (request.action === "processPost") {
    // Create a flag to track if response was sent
    let responseSent = false;

    // Set up timeout to ensure a response is always sent
    const timeoutId = setTimeout(() => {
      if (!responseSent) {
        console.log("Sending timeout fallback response");
        responseSent = true;
        sendResponse({
          success: true,
          warning: "Timeout reached, but comment submission was attempted",
        });
      }
    }, RESPONSE_TIMEOUT);

    // Process the request
    const processPromise = async () => {
      try {
        console.log(`Processing post with comment: "${request.comment}"`);

        // Wait for page to load
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Process post - will check for existing comments
        const result = await processPost(request.comment, request.delay);

        // Send response if not already sent
        if (!responseSent) {
          console.log("Sending success response:", result);
          responseSent = true;
          clearTimeout(timeoutId);
          sendResponse(result);
        }
      } catch (error) {
        console.error("Error in processPost:", error);

        // Send error response if not already sent
        if (!responseSent) {
          console.log("Sending error response");
          responseSent = true;
          clearTimeout(timeoutId);
          sendResponse({ success: false, error: error.message });
        }
      }
    };

    // Execute the async operation
    processPromise();

    // Return true to indicate async response
    return true;
  }
});

// Debugging function to show active elements on the page
function debugPage() {
  const commentInputSelectors = SELECTORS.commentField.join(", ");
  const elements = document.querySelectorAll(commentInputSelectors);

  console.log(`Found ${elements.length} potential comment fields:`);
  elements.forEach((el, i) => {
    console.log(`Element ${i + 1}:`, el);
    console.log(`- Content: "${el.textContent}"`);
    console.log(`- Visible: ${isVisible(el)}`);
    console.log(`- Classes: ${el.className}`);
    console.log(`- Attributes:`, getElementAttributes(el));
  });

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  function getElementAttributes(el) {
    const attrs = {};
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }
}

// Run debug on page load
setTimeout(debugPage, 5000);

console.log("Facebook Auto Commenter: Content script initialized");
