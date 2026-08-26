# NEO OS runner

`index.html` is the small, one-file launcher for web-based HTML code runners. It fetches the complete NEO OS build from jsDelivr, so it does not depend on JavaScript being enabled for `file:///` pages.

The two buttons let a user open the same app in an `about:blank` tab or ask the browser to enter fullscreen. Fullscreen permission and the browser's exit banner are controlled by the browser itself.

## Included site files

- `neo-os/` — the current complete static NEO OS build, including its wallpapers and browser runtime.
- `games/` — the complete game catalog and its media (3,989 catalog entries).
- `netlify/functions/` — the account, chat, music-preview, and wallpaper-discovery server-function source.
- `learning-zones.html`, `pages/`, `static/`, `icons/`, and root support files — the rest of the published Learning Zones site source. The original root page is named `learning-zones.html` so the small runner can remain the repository's `index.html`.

jsDelivr serves static files only. The server-function source is included here, but account/chat/discovery endpoints need a serverless deployment such as Netlify to run.
