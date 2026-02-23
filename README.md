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

1.  **ip-display.js**: A custom script located in the `_nuxt/` directory that detects the hostname.
2.  **Smart Detection**: 
    *   If you browse via **localhost**, it displays **192.168.1.32** so you know the correct LAN IP.
    *   If you browse via a **real IP**, it displays that specific IP.
3.  **Injection**: The `index.html` files have been modified to load this script automatically on startup.

---
*Auto-generated backup by Gemini CLI.*
