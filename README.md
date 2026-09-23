# Clockwork Garden

[Play in your browser](https://brotatotes.github.io/clockwork-garden/)

A small, original browser musical toy. Plant mechanical flowers, move them through a melody bed, and grow vines that answer with quiet notes.

## Open and play

Download and open **Clockwork-Garden.html** in a current browser. No installation, server or internet connection is required. Press **Wake the garden** to hear the example. Start with your device volume low.

- Choose one of four seeds, then click an empty space or press **Plant selected seed**. Each species has its own synthesized voice and pattern.
- Move a flower upward for higher notes and rightward for a later start. Drag with a mouse, use the visible movement buttons, or focus a flower and use arrow keys. Delete removes a focused flower.
- Select a flower, press **Grow a vine**, then select another flower. The second flower replies quietly one eighth note later. Replies cannot trigger further replies. Each flower has one outgoing vine at most.
- On a phone, swipe the garden horizontally to reach later notes. Tap to select and use the movement buttons. You can also plant by tapping empty spaces.
- **Pause the garden** stops sound. Waking starts the phrase again. Moving to another tab pauses the garden, and returning does not start it automatically. Volume zero mutes.

There are 16 timing columns and eight pitch rows. Notes come from C major pentatonic. Velvet Moss plays one octave lower. Up to 16 flowers fit in a garden, with tempo from 60 to 120 BPM.

## Save and share privately

**Save here** stores the composition in this browser. Use **Load saved** to restore it, including after reopening the same HTML file. Storage rules differ between browsers and file locations. Export before moving or renaming the HTML, changing browsers, clearing browser data or leaving private browsing.

**Export garden** downloads a small JSON composition file. **Import garden** opens that file without starting sound. Invalid files are rejected without replacing your garden.

**Share code** produces a composition code. Send the code and HTML file to a recipient. They open the HTML, choose Share code, paste the code and press Open code. Copy the selected text manually if automatic clipboard access is unavailable. For the hosted garden, append the complete code beginning with `#garden=` to `https://brotatotes.github.io/clockwork-garden/` to share a playable link. The composition stays in the URL fragment and is not sent to the hosting server.

**Clear bed** and **Example garden** replace the current composition without saving it. Save or export first if you want to keep your changes. There is no undo.

## Privacy and originality

No accounts, network requests, analytics, cloud services, runtime AI, recordings or external assets. Music is synthesized locally with Web Audio. The botanical SVG artwork, styling and code were created for this project. Serif fonts use installed system fonts and are not bundled.

## Source and rebuilding

The standalone HTML is also readable source. The companion source package contains the separated files and tests.

Run `python3 build.py` to reproduce both `Clockwork-Garden.html` and the identical GitHub Pages entry point `index.html` from `index.template.html`, `style.css`, `engine.js` and `app.js`. The build uses only the Python standard library. No package installation is required to play or build.

Tests require Node.js and, for browser checks, Python Playwright and Chromium. The browser tests use the local Linux snap Chromium path `/snap/bin/chromium` and its accessible temporary directory. Adapt these test-only paths for another system.

```
python3 build.py
node tests/core.cjs
node tests/editing.cjs
python3 tests/browser_core.py
python3 tests/browser_editing.py
python3 tests/browser_polish.py
xvfb-run -a python3 tests/browser_verify.py
xvfb-run -a node tests/browser_lifecycle.cjs
```

## Review limits

This first playable is available on GitHub Pages and as a downloadable standalone HTML file. Automated testing covers Chromium on Linux with desktop and emulated phone inputs. Actual audio signals are measured, including offline synthesis, but this is not a subjective listening review. Physical phones, Safari, Firefox and screen-reader use have not been tested. Your listening and play feedback remain valuable.
