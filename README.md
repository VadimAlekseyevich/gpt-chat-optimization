# GPT Chat Optimization (v0.1.0)

Privacy-first Chrome / Edge Manifest V3 extension for **opt-in** rendering optimization of long ChatGPT threads.

## What it does

- By default, **OFF**. Turn it on using the extension toolbar popup.
- When a chat contains **40+ DOM message nodes**, the extension injects one small CSS stylesheet with `content-visibility: auto` and `contain-intrinsic-size: auto 420px` for `[data-message-author-role]`.
- Turning OFF removes the stylesheet immediately (on storage change).
- The popup shows whether the feature is active, waiting, unsupported, or disabled after an error.
- Uses a five-second, low-frequency message-count check. No full-document `MutationObserver`.

**What it does not do:** It does not delete, move, archive, read, log, or transmit chat messages; it does not inject external scripts, alter the message editor, intercept ChatGPT network traffic, or hook into ChatGPT APIs.

## Install locally

1. Download this repository as ZIP, then unpack it (or clone the repository).
2. In Chrome open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the **repository root** (the folder containing `manifest.json`).
5. Open or reload `https://chatgpt.com/`, click the extension icon, and opt in.
6. Disable using the same switch at any time.

Only the `storage` extension permission is declared; the content script matches **only `https://chatgpt.com/*`**. No analytics, remote execution, auto-update URL, external assets, or `host_permissions` are requested.

## Development

- Requirements for tests: Node.js 18+; no npm dependencies or install step.
- Run `npm test` or `npm run check` from the repository root.
- File map: `manifest.json`, `src/content.js`, `src/popup.html`, `src/popup.css`, `src/popup.js`, `tests/`.

## Safety and limitations

- This is **not an official OpenAI extension**.
- `content-visibility: auto` is intended to skip rendering off-screen content. It is **not a guarantee of reduced memory or increased speed**. Results depend on the browser, layout, and thread.
- CSS containment can cause temporary scroll jumps when estimated and actual message sizes differ. This is why the feature is opt-in and reversible. If you see jumping, flickering, broken formatting, or selection/search issues, switch it OFF.
- The DOM selector is based on the public ChatGPT UI and may change. Unknown page layouts will generally result in no optimization, but automated tests cannot prove compatibility with every future ChatGPT update.
- The ON/OFF setting is shared across ChatGPT tabs in this browser profile. No chat contents or visited chat IDs are stored.
- Closing/reloading the tab or disabling/removing the extension also drops its injected stylesheet.
- Chrome-installed extension updates are outside the static review of v0.1.0; review each release and its permissions before updating.

## Manual acceptance checklist (must be completed in real Chrome/Edge)

- [ ] Load a short chat; active mode remains OFF even after opting in (under 40 messages).
- [ ] Load a long chat (40+ messages); popup indicates active and messages remain present.
- [ ] Scroll rapidly up/down, expand code blocks and tables, inspect images and links.
- [ ] Send a prompt, watch streaming, edit/regenerate a message.
- [ ] Switch between two chats, reload, and use browser find/copy text.
- [ ] Toggle OFF during each test; confirm immediate appearance restoration.
- [ ] Check DevTools console and performance profile with ON and OFF.

**Release gate:** Do not claim browser compatibility or performance gains until these manual checks pass. The automated suite covers deterministic safety/logic checks only.

## License

MIT — see `LICENSE`.
