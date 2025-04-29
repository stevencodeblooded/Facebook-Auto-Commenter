# Facebook Auto Commenter

A Chrome extension that automatically adds comments to multiple Facebook posts, saving you time and effort.

## Features

- **Bulk Commenting**: Add the same comment to multiple Facebook posts with just a few clicks
- **Skip Already Commented Posts**: Automatically detects and skips posts you've already commented on
- **Comment Randomization**: Option to add slight variations to your comments
- **Configurable Delay**: Set the time between comments to appear more natural
- **Progress Tracking**: Monitor commenting progress with detailed statistics

## Installation

1. Download the extension files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension folder
5. The Facebook Auto Commenter icon should appear in your Chrome toolbar

## How to Use

1. **Prepare Your Posts**: Collect the URLs of Facebook posts you want to comment on
2. **Open the Extension**: Click the Facebook Auto Commenter icon in your Chrome toolbar
3. **Enter Details**:
   - Paste your list of Facebook post URLs (one per line)
   - Type your comment
   - Set delay between comments (in seconds)
   - Optionally enable comment randomization
4. **Start Commenting**: Click "Start Commenting" to begin the process
5. **Monitor Progress**: The extension will show:
   - Current progress (x of y posts)
   - Number of skipped posts (already commented on)
   - Success and error messages

## Smart Skipping Feature

The extension now intelligently detects posts you've already commented on:

- It extracts your Facebook user ID and username from the page
- Checks each post for your existing comments before attempting to add a new one
- Displays "Skipped" messages for posts you've already commented on
- Keeps track of how many posts were skipped in the current session

This feature prevents duplicate comments and makes the process more efficient.

## Troubleshooting

If the extension doesn't work properly:

- Make sure you're logged into Facebook in your Chrome browser
- Check if Facebook has updated its interface (which might require extension updates)
- Try increasing the delay between comments if Facebook is rate-limiting your actions
- Refresh the page if the comment fields don't appear to be loading properly

## Privacy and Security

- This extension operates entirely within your browser
- Your Facebook credentials are never accessed or stored
- No data is sent to external servers
- Comment text and URLs are stored locally in your browser for convenience

## Technical Support

If you encounter any issues or have questions about using the extension, please contact the developer.

---

Enjoy a more efficient Facebook engagement experience!