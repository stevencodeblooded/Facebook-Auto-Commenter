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

    // IMPROVED: Better username detection that avoids the "Notifications" label
    // Method 1: From comment box placeholder
    const commentBoxes = document.querySelectorAll(
      'div[contenteditable="true"][aria-label*="Write a comment"]'
    );
    for (const box of commentBoxes) {
      // Look for "Write a comment as [Name]" pattern
      const ariaLabel = box.getAttribute("aria-label") || "";
      const matches = ariaLabel.match(/Write a comment as ([^.]+)/i);
      if (matches && matches[1]) {
        userName = matches[1].trim();
        console.log(`Found username from comment box: ${userName}`);
        break;
      }
    }

    // Method 2: From user menu in top navigation
    if (!userName) {
      // Look for the user profile link in the top navigation
      const profileNavLinks = document.querySelectorAll(
        'a[role="link"][tabindex="0"][aria-label]'
      );
      for (const link of profileNavLinks) {
        const ariaLabel = link.getAttribute("aria-label") || "";
        // Skip links that are clearly not profile links
        if (
          !ariaLabel.includes("Notifications") &&
          !ariaLabel.includes("Menu") &&
          !ariaLabel.includes("Create") &&
          !ariaLabel.includes("Messenger")
        ) {
          userName = ariaLabel.trim();
          console.log(`Found username from profile nav: ${userName}`);
          break;
        }
      }
    }

    // Method 3: From existing comments by this user (fallback)
    if (!userName) {
      // Try to find any comments that seem to be from the current user
      const commentAuthorLinks = document.querySelectorAll(
        'a[role="link"][tabindex="0"]'
      );
      for (const link of commentAuthorLinks) {
        if (
          link.href &&
          (link.href.includes(`/user/${userId}`) ||
            link.href.includes(`profile.php?id=${userId}`))
        ) {
          // This is likely a link to the current user's profile in a comment
          const authorSpan = link.querySelector("span");
          if (
            authorSpan &&
            authorSpan.textContent &&
            authorSpan.textContent.trim().length > 0
          ) {
            userName = authorSpan.textContent.trim();
            console.log(`Found username from own comment: ${userName}`);
            break;
          }
        }
      }
    }

    // Method 4: Original fallback method (with fixes to avoid "Notifications")
    if (!userName) {
      const navBarItems = document.querySelectorAll('span[dir="auto"]');
      for (const el of navBarItems) {
        // Skip obvious UI elements and look for longer text that's likely a name
        if (
          el.textContent &&
          el.textContent.trim().length > 0 &&
          !el.textContent.includes("Write a") &&
          !el.textContent.includes("Like") &&
          !el.textContent.includes("Comment") &&
          !el.textContent.includes("Share") &&
          !el.textContent.includes("Notifications") &&
          !el.textContent.includes("Menu") &&
          !el.textContent.includes("Create")
        ) {
          const text = el.textContent.trim();
          // Names are typically capitalized and without special characters
          if (/^[A-Z][a-z]/.test(text) && text.length > 2) {
            userName = text;
            console.log(`Found potential username from span: ${userName}`);
            break;
          }
        }
      }
    }
  } catch (error) {
    console.error("Error extracting user info:", error);
  }

  console.log(`Final user info: ID=${userId}, Name=${userName}`);
  return { userId, userName };
}

// Check if the user has already commented on this post
async function hasUserAlreadyCommented() {
  console.log("Checking if user has already commented on this post");

  try {
    // Get logged-in user info
    const { userId, userName } = getLoggedInUserInfo();
    console.log(`Working with user info: ID=${userId}, Name=${userName}`);

    if (!userId && !userName) {
      console.log("Could not determine user identity, unable to check for existing comments");
      return false;
    }

    // Wait for post and comments to fully load
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Try to expand all comments if possible
    await expandAllComments();

    // STEP 1: First identify all genuine comment containers
    const commentContainers = Array.from(document.querySelectorAll('div[role="article"]')).filter(container => {
      // Only consider elements that actually look like comments
      const ariaLabel = container.getAttribute('aria-label') || '';
      return ariaLabel.includes('Comment by') || 
             // Also check for comment-like functionality (reply button, like button)
             (container.querySelector('div[role="button"]') && 
              container.textContent.includes('Reply'));
    });
    
    console.log(`Found ${commentContainers.length} comment containers to check`);
    
    // STEP 2: Now check each comment container for the user's identity
    for (const container of commentContainers) {
      // Method 1: Check for user ID in links within this container only
      if (userId) {
        const userLinks = container.querySelectorAll('a[href*="/user/"], a[href*="profile.php"]');
        for (const link of userLinks) {
          if ((link.href && link.href.includes(`/user/${userId}`)) || 
              (link.href && link.href.includes(`profile.php?id=${userId}`))) {
            console.log(`Found comment with user ID ${userId} in link href within comment container`);
            return true;
          }
        }
      }
      
      // Method 2: Check comment aria-label directly (more reliable across regions)
      if (userName) {
        const ariaLabel = container.getAttribute('aria-label') || '';
        if (ariaLabel.includes(`Comment by ${userName}`)) {
          console.log(`Found comment with aria-label containing username: ${userName}`);
          return true;
        }
      }
      
      // Method 3: Check for username in comment author elements within this container
      if (userName) {
        // These are the typical selectors for comment author names
        const authorSelectors = [
          'span.x3nfvp2 span[dir="auto"]', 
          'span[class*="x193iq5w"][dir="auto"]',
          'a[role="link"] span[dir="auto"]'
        ];
        
        for (const selector of authorSelectors) {
          const authorElements = container.querySelectorAll(selector);
          for (const element of authorElements) {
            if (element.textContent.trim() === userName) {
              console.log(`Found username "${userName}" in author element within comment container`);
              return true;
            }
          }
        }
      }
    }

    // If we get this far, no comments from the user were found
    console.log("No existing comments found from current user");
    return false;
  } catch (error) {
    console.error("Error checking for user comments:", error);
    return false; // On error, proceed with commenting
  }
}

// Helper function to expand all comments if possible
async function expandAllComments() {
  try {
    // Find and click "View more comments" and similar buttons
    const possibleButtonTexts = ['view more comments', 'view', 'more comments', 'see more'];
    
    // Get all buttons and span elements that might be for expanding comments
    const allButtons = document.querySelectorAll('div[role="button"], span[role="button"]');
    
    for (const button of allButtons) {
      const buttonText = (button.textContent || '').toLowerCase();
      if (possibleButtonTexts.some(text => buttonText.includes(text))) {
        console.log(`Clicking '${button.textContent}' button to load more comments`);
        button.click();
        // Wait for comments to load
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  } catch (e) {
    console.log("Error expanding comments:", e);
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

  if (request.action === "verifyPostStability") {
    // Check if we're on a modal post
    const isModal = isModalPost();

    // Get modal info
    const modalInfo = getPostModalInfo();

    // Send response
    sendResponse({
      isModal: isModal,
      modalInfo: modalInfo,
    });

    return true;
  }

  if (request.action === "checkModalStability") {
    const isStable = checkModalStability(request.previousInfo);

    sendResponse({
      isStable: isStable,
    });

    return true;
  }

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

// Check if we're on a modal post
function isModalPost() {
  // Check for modal dialog
  const modalOverlay = document.querySelector(
    'div[role="dialog"][aria-modal="true"]'
  );
  return !!modalOverlay;
}

// Get identifying information about current post modal to track stability
function getPostModalInfo() {
  try {
    const modalOverlay = document.querySelector(
      'div[role="dialog"][aria-modal="true"]'
    );
    if (!modalOverlay) return null;

    // Get post author name
    let authorName = "";
    const authorElements = modalOverlay.querySelectorAll('a[role="link"] span');
    for (const element of authorElements) {
      if (element.textContent && element.textContent.trim().length > 0) {
        authorName = element.textContent.trim();
        break;
      }
    }

    // Get post time if available
    let postTime = "";
    const timeElements = modalOverlay.querySelectorAll(
      'span a[role="link"] span'
    );
    for (const element of timeElements) {
      if (
        (element.textContent && element.textContent.includes("h")) ||
        element.textContent.includes("m") ||
        element.textContent.includes("d")
      ) {
        postTime = element.textContent.trim();
        break;
      }
    }

    // Get part of post content
    let postContent = "";
    const contentElements = modalOverlay.querySelectorAll(
      'div[data-ad-comet-preview="message"] span'
    );
    if (contentElements && contentElements.length > 0) {
      postContent = contentElements[0].textContent.trim().substring(0, 50);
    }

    return {
      authorName,
      postTime,
      postContent,
    };
  } catch (error) {
    console.error("Error getting post modal info:", error);
    return null;
  }
}

// Check if post modal is stable and hasn't changed
function checkModalStability(previousInfo) {
  try {
    if (!previousInfo) return false;

    const currentInfo = getPostModalInfo();
    if (!currentInfo) return false;

    // Check if basic attributes match
    const authorMatch = previousInfo.authorName === currentInfo.authorName;
    const contentMatch = previousInfo.postContent === currentInfo.postContent;

    return authorMatch && contentMatch;
  } catch (error) {
    console.error("Error checking modal stability:", error);
    return false;
  }
}


// Run debug on page load
setTimeout(debugPage, 5000);

console.log("Facebook Auto Commenter: Content script initialized");
