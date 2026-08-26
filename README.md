# NEO OS runner

`index.html` is a one-file launcher for web-based HTML code runners. It loads the NEO OS build from jsDelivr, so it does not depend on JavaScript being enabled for `file:///` pages.

The two buttons let a user open the same app in an `about:blank` tab or ask the browser to enter fullscreen. Fullscreen permission and the browser's exit banner are controlled by the browser itself.

The `neo-os/` directory holds the latest static NEO OS build. `games/` includes a ready-to-play Tetris page; add additional game HTML files and catalog entries there when you are ready to expand the library.
