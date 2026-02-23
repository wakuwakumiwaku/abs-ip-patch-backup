(function() {
  // 1. Detect the browser's current address
  const currentHost = window.location.hostname;
  
  // 2. Define the "Real" LAN IP (Detected during setup)
  // If the server moves, this specific fallback will need updating,
  // but this is the only way to show it while browsing Localhost.
  const LAN_IP = "192.168.1.32";

  let displayIP = currentHost;

  // 3. Logic: If Localhost, show LAN IP. Otherwise show dynamic handle.
  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
      displayIP = LAN_IP;
  }

  console.log("ABS-IP-PATCH: Host=" + currentHost + ", Display=" + displayIP);

  function createIpElement() {
    const div = document.createElement("div");
    div.innerText = displayIP;
    div.className = "injected-ip-display";
    div.style.fontSize = "0.75rem"; // Small text
    div.style.color = "#9ca3af";    // Grey
    div.style.fontWeight = "normal";
    div.style.lineHeight = "1.2";
    div.style.marginTop = "2px";
    return div;
  }

  function patchTarget(target) {
    if (!target || target.dataset.ipPatched) return;
    
    // Ensure vertical stacking
    const displayStyle = window.getComputedStyle(target).display;
    if (displayStyle !== 'flex') {
        target.style.display = 'flex';
        target.style.flexDirection = 'column';
    }
    
    // Center logic for Login page (H1), Left align for Navbar
    if (target.tagName === 'H1') {
        target.style.alignItems = 'center';
    } else {
        target.style.alignItems = 'flex-start';
    }

    const ipDiv = createIpElement();
    target.appendChild(ipDiv);
    target.dataset.ipPatched = "true";
  }

  const observer = new MutationObserver((mutations) => {
    // A. Login Page (Look for H1 "Audiobookshelf")
    const h1s = document.querySelectorAll("h1");
    h1s.forEach(h1 => {
        if (h1.innerText.trim().toLowerCase().includes("audiobookshelf")) {
            patchTarget(h1);
        }
    });

    // B. Main Navbar (Look for Logo Text)
    const logos = document.querySelectorAll(".logo-text, .brand, a.navbar-brand, .server-name");
    logos.forEach(el => {
        if (el.innerText.trim().toLowerCase().includes("audiobookshelf")) {
             patchTarget(el);
        }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
