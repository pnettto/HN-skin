# HN Skin

A Chrome extension that makes Hacker News calmer and easier to read. It keeps everything HN does, including voting, replying, hiding, favouriting, and logging in, and changes how it looks and how you get around.

![Story list](docs/stories-light.png)

| Threads | Dark mode, new comments highlighted |
| --- | --- |
| ![Thread](docs/thread-light.png) | ![Dark thread](docs/thread-dark.png) |

## What it does

**Reading**
- A readable column with modern type, generous line height, and a width you can choose (S / M / L)
- Light, dark, sepia, or automatic theme, with no flash of the old page on load
- Sans or serif text, from 14 to 20 px, and eight accent colours
- `> quoted` lines become real block quotes, and code blocks get proper monospace styling
- Downvoted comments fade the way HN intends and become fully readable on hover

**Threads**
- Coloured thread lines. Click a line or a comment header to collapse a whole branch.
- Collapsed comments show how many replies they hide
- **New since your last visit**: comments posted since you last opened a thread are highlighted. Press `n` to jump through them. The story list also shows a `+N` badge on comment counts.
- **Top-level only** mode for skimming big threads
- Reply inline without leaving the page (`⌘/Ctrl + Enter` sends)
- `OP` and `you` badges, and green names for new accounts
- A reading progress bar and a back-to-top button

**Past front pages**
- The **Past** tab has a day navigator. Step a day back or forward with the arrows or with `[` / `]`. You can also pick any date back to HN's launch in 2007, click a day in the week strip, or jump back a week, month, year, or five years.

**Story lists**
- Clean rows with site favicons, `Ask HN`, `Show HN`, `Launch HN`, and `Tell HN` badges, and year and `[pdf]` tags
- Stories you've opened are dimmed
- One-click upvote, and hiding a story happens in place without a page reload

**Keyboard** (press `?` on any page)

| Key | Lists | Comments |
| --- | --- | --- |
| `j` / `k` | next / previous story | next / previous comment |
| `J` / `K` | — | next / previous sibling |
| `o` / `Enter` | open link | `o` opens the story link |
| `c` | open comments | — |
| `x` / `Enter` | — | collapse / expand |
| `p` | — | go to parent |
| `n` | next page | next new comment |
| `[` / `]` | previous / next day (Past) | — |
| `u` | upvote | upvote |
| `r` | — | reply |
| `T` | — | toggle top-level only |
| `/` `t` `?` | search · cycle theme · help | |

Settings are in the toolbar popup.

<img src="docs/popup.png" width="300" alt="Settings popup">

## Install (unpacked)

1. Clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the repo folder.
4. Visit [news.ycombinator.com](https://news.ycombinator.com).

It works in any Chromium browser (Chrome, Edge, Brave, Arc).

## How it works

HN serves plain table-based HTML. The content scripts parse it into data, build a new interface from that data, and remove the original layout. Comment HTML is moved over, not re-parsed, so HN's sanitising still applies. All actions go to HN's own endpoints, the same way HN's `hn.js` does.

```
manifest.json
src/
  background.js        favicon fetcher (HN's CSP blocks third-party images)
  shared/settings.js   defaults, load/save, apply prefs to <html>
  content/
    skin.css           every style, scoped under html.hnx
    early.js           document_start: theme + hide old layout (no flash)
    util.js            DOM helper, icons, time formatting, toast
    store.js           local read history (last visit, max comment id seen)
    parse.js           HN markup → plain objects
    ui.js              top bar, votes, composer, help overlay
    list.js            story lists
    comments.js        threads, comment lists, inline replies
    keyboard.js        shortcuts and focus
    main.js            page detection, rendering, fallback
  popup/               settings UI
scripts/make_icons.py  regenerates icons/ (no dependencies)
```

**Fallbacks.** Pages it doesn't redesign, such as profiles, submit, login, and the FAQ, keep HN's markup with the new theme applied. If a render ever throws, the page reloads once as plain HN. You can also switch the extension off from the popup.

**Privacy.** Read history (which threads you opened and when) stays in `chrome.storage.local` on your machine. The only outside request is for site favicons, which the extension fetches through DuckDuckGo's icon service. You can turn favicons off in the popup.

## Development

There is no build step. Edit the files, then click the reload icon on the extension's card in `chrome://extensions` and refresh HN.

```sh
python3 scripts/make_icons.py   # regenerate icons
zip -r hn-skin.zip manifest.json icons src -x '*.DS_Store'   # package for the Chrome Web Store
```
