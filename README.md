# HN Skin

A Chrome extension that changes the layout of Hacker News. It works on top of the existing site, so voting, replying, hiding, favouriting and logging in still use HN's own pages and endpoints.

Not affiliated with, endorsed by, or connected to Hacker News or Y Combinator.

![Story list](docs/stories-light.png)

| Thread | Dark theme |
| --- | --- |
| ![Thread](docs/thread-light.png) | ![Dark thread](docs/thread-dark.png) |

## Features

**Layout**
- Single column with a selectable width (S / M / L)
- Light, dark, sepia, or system theme
- Sans or serif text, 14–20 px, and a choice of accent colour
- Lines starting with `>` render as block quotes; code blocks use a monospace font

**Threads**
- Collapsible comments, by clicking the thread line or the comment header
- Comments added since the last visit to a thread are marked
- Option to show top-level comments only
- Inline reply form
- `OP` and `you` labels

**Story lists**
- Site favicons and labels for Ask / Show / Launch / Tell HN
- Opened stories are dimmed
- Upvote and hide without a page reload

**Past front pages**
- The Past tab has a date heading, previous/next day arrows, a row of nearby days and a calendar to pick any date back to 2007

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
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the repo folder.
4. Open [news.ycombinator.com](https://news.ycombinator.com).

It should also work in other Chromium-based browsers.

## How it works

HN serves table-based HTML. The content scripts parse it into plain objects, build a new interface from them, and remove the original layout. Comment HTML is moved over as-is rather than re-parsed. Actions call the same endpoints HN's own `hn.js` uses.

```
manifest.json
src/
  background.js        favicon fetcher (HN's CSP blocks third-party images)
  shared/settings.js   defaults, load/save, apply prefs to <html>
  content/
    skin.css           all styles, scoped under html.hnx
    early.js           document_start: apply theme, hide original layout
    util.js            DOM helper, icons, time formatting, toast
    store.js           local read history (last visit, highest comment id seen)
    parse.js           HN markup → plain objects
    ui.js              top bar, votes, composer, help overlay
    list.js            story lists, past-day navigator
    comments.js        threads, comment lists, inline replies
    keyboard.js        shortcuts and focus
    main.js            page detection, rendering, fallback
  popup/               settings UI
scripts/make_icons.py  regenerates icons/ (no dependencies)
```

Pages without a custom layout (profiles, submit, login, FAQ) keep HN's markup with the theme applied. If rendering throws an error, the page reloads once without the extension. The extension can also be turned off from the popup.

## Privacy

Read history (which threads were opened and when) is stored in `chrome.storage.local` and never leaves the browser. The only external requests are for site favicons, fetched through DuckDuckGo's icon service; these can be turned off in the popup.

## Development

There is no build step. After editing, reload the extension in `chrome://extensions` and refresh HN.

```sh
python3 scripts/make_icons.py   # regenerate icons
zip -r hn-skin.zip manifest.json icons src -x '*.DS_Store'   # package
```

## Disclaimer

Hacker News is a trademark of Y Combinator. This is an independent project; it is not affiliated with or endorsed by Hacker News or Y Combinator.
