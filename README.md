# Facebook Auto Commenter Extension

A Chrome extension that automatically comments on Facebook posts.

## Features

- Comment on multiple Facebook posts in one go
- Support for multiple comments with random selection
- Customizable delay between comments
- Skip already commented posts
- Track comment history (successful, skipped, failed)
- Password protection for controlled access

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right)
4. Click "Load unpacked" and select the extension folder
5. The extension icon should appear in your Chrome toolbar

## Usage

1. Click the extension icon to open it
2. Enter the password to access the tool (default: "autocommenter2024")
3. Enter Facebook post URLs (one per line)
4. Enter your comment(s)
5. Configure settings if needed:
   - For multiple comments, check "Use multiple comments mode" and separate comments with blank lines
   - Set delay between comments (in seconds)
   - Enable randomization if desired
6. Click "Start Commenting" to begin
7. The extension will navigate to each post and add your comment(s)
8. View results in the History section

## Remote Password Control

The extension is designed to check for an updated password from a remote source. To change the password remotely:

### Option 1: Using GitHub

1. Create a public GitHub repository
2. Add a file named `password.txt` containing only the password text
3. Get the raw URL of this file (click on the file, then click "Raw" button)
4. Update the `remotePasswordUrl` in `src/auth.js` to this URL:
   ```javascript
   this.remotePasswordUrl = "https://raw.githubusercontent.com/stevencodeblooded/password-repo/refs/heads/main/password.txt";
   ```

### Option 2: Using Other Static Hosting

1. Create a simple text file containing only the password
2. Host it on any static file hosting service (Netlify, Vercel, AWS S3, etc.)
3. Make sure the URL is publicly accessible
4. Update the `remotePasswordUrl` in `src/auth.js`

### Security Notes

- The remote password source should be accessible without authentication
- The extension will fall back to the default password if it can't reach the remote source
- Users will remain logged in for 7 days if they check "Remember for 7 days"
- To force all users to re-authenticate, simply change the remote password

## Files Structure

- `manifest.json` - Extension configuration
- `src/popup.html` - Main UI with login overlay
- `src/popup.js` - UI logic and main functionality
- `src/auth.js` - Authentication module
- `src/background.js` - Background processing script
- `src/content.js` - Content script for Facebook interaction
- `styles/popup.css` - Styling for the extension UI

## Default Password

The default fallback password is: `autocommenter2024`

This password is used when the extension cannot fetch the remote password or during first-time setup.