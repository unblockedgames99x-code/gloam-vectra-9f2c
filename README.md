# Unblocked Games site-maker runner

`index.html` is the small, one-file launcher for web-based HTML code runners. It fetches the exact `unblocked-games.html` site-maker file from jsDelivr, so it does not depend on JavaScript being enabled for `file:///` pages. The launcher is pinned to commit `c169c02e6bf7beaff8235109c93cc8ebaced822d` so CDN branch caching cannot mix versions.

The two buttons let a user open the same app in an `about:blank` tab or ask the browser to enter fullscreen. Fullscreen permission and the browser's exit banner are controlled by the browser itself.

## Included site files

- `unblocked-games.html` — the exact full site-maker HTML used by the launcher.
- `neo-os/` — the included static NEO OS files, wallpapers, and browser runtime used by the full site.
- `games/` — the complete game catalog and its media (3,989 catalog entries).
- `netlify/functions/` — the account, chat, music-preview, and wallpaper-discovery server-function source.
- `learning-zones.html`, `pages/`, `static/`, `icons/`, and root support files — the rest of the published Learning Zones site source. The original root page is named `learning-zones.html` so the small runner can remain the repository's `index.html`.

jsDelivr serves static files only. The server-function source is included here, but account/chat/discovery endpoints need a serverless deployment such as Netlify to run.

The repository contains every large game and wallpaper asset. jsDelivr's GitHub endpoint does not serve files over 20 MB or packages over its default size limit, so those particular assets need an approved higher jsDelivr limit or another permitted static host before they can be delivered through a code runner.
