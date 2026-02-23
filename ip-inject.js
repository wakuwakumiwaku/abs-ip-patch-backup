(function() {
  const ip = window.location.hostname;
  document.title = "Audiobookshelf (" + ip + ")";
  
  function patch() {
    // Check for "Audiobookshelf" text in various elements
    const els = document.querySelectorAll('h1, h2, .logo-text, .brand, .title, .header-text');
    els.forEach(el => {
      if (el.innerText.trim().includes('Audiobookshelf') && !el.dataset.ipDone) {
        const div = document.createElement('div');
        div.innerText = ip;
        div.style.fontSize = '14px';
        div.style.color = '#888';
        div.style.fontWeight = 'normal';
        div.style.marginTop = '2px';
        div.style.display = 'block';
        el.appendChild(div);
        el.dataset.ipDone = 'true';
        
        // Fix for flex containers to stack vertically
        if (el.style.display !== 'flex') {
           el.style.display = 'flex';
           el.style.flexDirection = 'column';
           el.style.alignItems = (el.tagName === 'H1') ? 'center' : 'flex-start';
        }
      }
    });
  }

  setInterval(patch, 1000);
  patch();
})();
