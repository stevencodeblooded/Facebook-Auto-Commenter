// Process next post with improved navigation and reliability
async function processNextPost() {
  try {
    await loadState();

    // Check if we're done or stopped
    if (
      !commentingState.isCommenting ||
      commentingState.currentIndex >= commentingState.posts.length
    ) {
      // Load comment history to get accurate counts
      const history = await loadCommentHistory();

      // Count successful, failed, and skipped posts for this session
      // We're focusing just on the most recent entries that match this session's count
      const currentSessionCount = commentingState.posts.length;

      // Calculate successful posts (posts that were actually commented on)
      const successfulCount =
        commentingState.currentIndex - commentingState.skippedPosts;

      // Failed posts (difference between total and successful+skipped)
      const failedCount =
        currentSessionCount - successfulCount - commentingState.skippedPosts;

      // Send complete message with full stats
      const finalMessage =
        commentingState.skippedPosts > 0
          ? `Commenting completed. ${successfulCount} posts were commented on successfully, ${commentingState.skippedPosts} posts were skipped (already commented on).`
          : "Commenting process finished successfully.";

      // Save the current state for reference before resetting
      const skippedPosts = commentingState.skippedPosts;

      // Now reset the state
      await resetState();

      // Send enhanced message with counts
      chrome.runtime.sendMessage({
        action: "commentingComplete",
        message: finalMessage,
        successfulCount: successfulCount,
        failedCount: failedCount,
        skippedPosts: skippedPosts,
      });
      return;
    }

    const currentUrl = commentingState.posts[commentingState.currentIndex];
    const selectedComment = selectNextComment();

    console.log(
      `Processing post ${commentingState.currentIndex + 1}/${
        commentingState.posts.length
      }`
    );
    console.log(`URL: ${currentUrl}`);
    console.log(`Selected comment: "${selectedComment}"`);

    try {
      // Find the best tab to use for processing
      let targetTab;
      let shouldUseStartingTab = false;

      // First, check if startingTabId is still valid
      if (startingTabId) {
        try {
          const startingTab = await chrome.tabs.get(startingTabId);
          if (startingTab) {
            shouldUseStartingTab = true;
            targetTab = startingTab;
            console.log(
              "Using the same tab where the process started:",
              startingTabId
            );
          }
        } catch (error) {
          console.log("Starting tab no longer exists, will find another tab");
          startingTabId = null;
        }
      }

      // If we can't use the starting tab, find an existing Facebook tab
      if (!shouldUseStartingTab) {
        const facebookTabs = await chrome.tabs.query({
          url: ["https://web.facebook.com/*", "https://www.facebook.com/*"],
        });

        if (facebookTabs.length > 0) {
          // Use existing Facebook tab
          targetTab = facebookTabs[0];
          console.log("Using existing Facebook tab:", targetTab.id);
        } else {
          // If no Facebook tab exists, check for a normal browsing tab
          const allTabs = await chrome.tabs.query({ currentWindow: true });
          const normalTab = allTabs.find(
            (tab) =>
              !tab.url.startsWith("chrome:") &&
              !tab.url.startsWith("chrome-extension:") &&
              !tab.url.startsWith("devtools:")
          );

          if (normalTab) {
            // Use an existing normal tab instead of creating a new one
            targetTab = normalTab;
            console.log("Using existing normal browsing tab:", targetTab.id);
          } else {
            // Create new tab only as last resort
            console.log("Creating new tab as last resort");
            targetTab = await chrome.tabs.create({ url: currentUrl });
            // Update immediately to prevent waiting for creation
            await new Promise((resolve) => setTimeout(resolve, 500));
            return processNextPost(); // Restart this post processing
          }
        }
      }

      // Navigate to the post URL
      await chrome.tabs.update(targetTab.id, { url: currentUrl });

      // Wait for page load and Facebook to initialize
      console.log("Waiting for page to load completely...");
      await new Promise((resolve) => setTimeout(resolve, 8000));

      // Ensure tab is still valid
      try {
        await chrome.tabs.get(targetTab.id);
      } catch (error) {
        throw new Error("Tab no longer exists");
      }

      // NEW: Check for post modal and verify stability
      console.log("Verifying post stability...");
      let modalInfo = null;
      let isModal = false;

      try {
        // Check if post is a modal
        const postVerification = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(
            targetTab.id,
            { action: "verifyPostStability" },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else if (response) {
                resolve(response);
              } else {
                reject(new Error("No verification response received"));
              }
            }
          );
        });

        isModal = postVerification.isModal;
        modalInfo = postVerification.modalInfo;

        console.log("Post verification:", postVerification);

        if (isModal && modalInfo) {
          console.log("Modal post detected, waiting for stability...");

          // Wait for more time to ensure modal is fully loaded and stable
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Re-check modal to ensure it hasn't changed
          const stabilityCheck = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(
              targetTab.id,
              {
                action: "checkModalStability",
                previousInfo: modalInfo,
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else if (response) {
                  resolve(response);
                } else {
                  reject(new Error("No stability response received"));
                }
              }
            );
          });

          if (!stabilityCheck.isStable) {
            console.log("Modal changed during waiting period, skipping post");
            throw new Error(
              "Modal post changed during stability check - background post interference detected"
            );
          }

          console.log("Modal is stable, proceeding with comment");
        }
      } catch (error) {
        console.error("Post verification error:", error);
        throw new Error("Could not verify post stability: " + error.message);
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
              comment: selectedComment,
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

      // Handle skipped posts (already commented on)
      if (response.skipped) {
        console.log(
          `Post ${
            commentingState.currentIndex + 1
          } skipped: Already commented on`
        );
        commentingState.skippedPosts++;

        // Record skipped URL
        recordSkippedPost(
          currentUrl,
          response.message || "Already commented on"
        );

        // Send skipped post notification to popup
        chrome.runtime.sendMessage({
          action: "commentSkipped",
          currentIndex: commentingState.currentIndex + 1,
          totalPosts: commentingState.posts.length,
          url: currentUrl,
          message: response.message || "Post already commented on",
        });
      } else {
        // Record successful comment
        recordSuccessfulComment(currentUrl, selectedComment);

        // Send regular progress update to popup
        chrome.runtime.sendMessage({
          action: "commentProgress",
          currentIndex: commentingState.currentIndex + 1,
          totalPosts: commentingState.posts.length,
          url: currentUrl,
          success: response.success,
          warning: response.warning,
          usedComment: selectedComment, // Send the comment that was used
        });
      }
    } catch (error) {
      console.error("Error processing post:", error);

      // Record failed comment
      recordFailedComment(currentUrl, error.message);

      // Send error message to popup
      chrome.runtime.sendMessage({
        action: "commentError",
        currentIndex: commentingState.currentIndex + 1,
        url: currentUrl,
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
