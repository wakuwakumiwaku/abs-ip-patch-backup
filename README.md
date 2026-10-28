# Audiobookshelf IP Address Patch (Web Interface Backup)

This repository contains a patched version of the Audiobookshelf web client (/app/client/dist) that automatically displays the server's IP address (or 192.168.1.32 if accessed via localhost) under the logo and on the login page.

## Purpose

Audiobookshelf updates (recreating the Docker container) will wipe out internal modifications. This backup allows you to persist the **IP Address Display** feature permanently by mounting these files instead of using the default ones inside the container.

## How to Use (Restore/Apply)

To apply this patched interface to your Audiobookshelf instance so it survives updates, follow one of the options below.

### Option A: Docker Compose (Recommended)

Add a new volume mapping to your **docker-compose.yml** file under the **audiobookshelf** service. Point it to the folder where you cloned this repository.

```yaml
services:
  audiobookshelf:
    image: ghcr.io/advplyr/audiobookshelf:latest
    volumes:
      # --- ADD THIS LINE ---
      - ./abs-ip-patch-backup:/app/client/dist
      # ---------------------
      
      # Existing volumes...
      - ./config:/config
      - ./metadata:/metadata
      - ./audiobooks:/audiobooks
```

### Option B: Docker Run command

Add the **-v** flag to your run command pointing to the downloaded folder:

```bash
docker run -d \
  -v "G:\Path\To\abs-ip-patch-backup:/app/client/dist" \
  ... other flags ... \
  ghcr.io/advplyr/audiobookshelf:latest
```

## How it works

1.  **Saved interface**: The `index.html` files contain an inline IP patcher that runs on an interval.
2.  **Smart Detection**:
    *   If you browse via **localhost** or **127.0.0.1**, it displays **192.168.1.32** so you know the correct LAN IP.
    *   Otherwise, it displays the hostname from the address bar.
3.  **Standalone script**: The root-level `ip-display.js` can be loaded independently. It patches existing matching headings/brands on startup and observes DOM changes to restore removed badges without duplicating them. The saved HTML does not load this standalone script; its lifecycle changes do not change the inline patcher.

## Standalone script tests

With Node.js and Playwright (including its Chromium browser) available, run:

```bash
node --test --test-concurrency=1 tests/ip-display.test.mjs
```

For an installation outside this checkout or another compatible browser, set
`PLAYWRIGHT_MODULE` to the module's absolute path, `BROWSER_TYPE` to `firefox`,
`chromium` or `webkit`, and optionally `BROWSER_EXECUTABLE` to its executable.
The runner always uses a headless browser and fresh private contexts. It executes
the actual standalone script against synthetic DOM fixtures, intercepts fixture
navigation without a server, and rejects unexpected page requests/errors.
It does not load the saved application or contact an Audiobookshelf deployment.

---
*Auto-generated backup by Gemini CLI.*
