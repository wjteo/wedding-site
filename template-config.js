(function () {
  const CONFIG_PATH = "config/content.json";
  const COUNTDOWN_LABELS = ["days", "hours", "minutes"];

  function setMeta(config) {
    if (config.meta && typeof config.meta.title === "string") {
      document.title = config.meta.title;
    }
    if (config.meta && typeof config.meta.description === "string") {
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute("content", config.meta.description);
    }
  }

  function getWeddingDateParts(config) {
    const raw = config && config.event && config.event.weddingDate;
    if (typeof raw !== "string") return null;
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    return { year, month, day };
  }

  function formatHeroDate(parts) {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
    const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" })
      .format(date)
      .toUpperCase();
    return `${parts.day} ${month} ${parts.year}`;
  }

  function formatLongDate(parts) {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(date);
  }

  function formatFooterDate(parts) {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(date);
  }

  function updateCountdownValues(parts) {
    const section = document.querySelector("#countdown");
    if (!section) return;

    const target = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0).getTime();
    const now = Date.now();
    const diff = Math.max(0, target - now);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const values = { days, hours, minutes };

    const labels = Array.from(section.querySelectorAll("*"))
      .filter((el) => COUNTDOWN_LABELS.includes((el.textContent || "").trim().toLowerCase()));

    labels.forEach((labelEl) => {
      const key = (labelEl.textContent || "").trim().toLowerCase();
      const valueEl = labelEl.previousElementSibling;
      if (!valueEl || typeof values[key] !== "number") return;
      valueEl.textContent = String(values[key]).padStart(2, "0");
    });
  }

  function applyWeddingDate(config) {
    const parts = getWeddingDateParts(config);
    if (!parts) return;

    const heroDate = document.querySelector("#hero p");
    if (heroDate) heroDate.textContent = formatHeroDate(parts);

    const countdownSubtitle = document.querySelector("#countdown p");
    if (countdownSubtitle) countdownSubtitle.textContent = `Until ${formatLongDate(parts)}`;

    const footerDate = document.querySelector("footer .section-eyebrow");
    if (footerDate) footerDate.textContent = formatFooterDate(parts);

    updateCountdownValues(parts);
    if (window.__templateCountdownTimer) {
      clearInterval(window.__templateCountdownTimer);
    }
    window.__templateCountdownTimer = setInterval(() => updateCountdownValues(parts), 60000);
  }

  function buildGoogleMapsUrl(query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  function applyWeddingEventsMap(config) {
    const weddingEvents = config && config.content && config.content.weddingEvents;
    if (!weddingEvents || typeof weddingEvents !== "object") return;

    const map = weddingEvents.map;
    if (!map || typeof map.query !== "string" || !map.query.trim()) return;

    const openMapsSelector =
      weddingEvents.text &&
      weddingEvents.text.openInMaps &&
      typeof weddingEvents.text.openInMaps.selector === "string"
        ? weddingEvents.text.openInMaps.selector
        : "#wedding-events > div:last-child > button:nth-child(1)";

    const targetUrl = buildGoogleMapsUrl(map.query.trim());

    let attempts = 0;
    const maxAttempts = 180;
    function attachOverride() {
      attempts += 1;
      const button = document.querySelector(openMapsSelector);
      if (button && !button.__templateMapOverrideApplied) {
        button.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.open(targetUrl, "_blank", "noopener,noreferrer");
          },
          true
        );
        button.__templateMapOverrideApplied = true;
        return;
      }
      if (attempts < maxAttempts) {
        requestAnimationFrame(attachOverride);
      }
    }

    requestAnimationFrame(attachOverride);
  }

  function applyIntroConfig(config) {
    const introConfig = config && config.content && config.content.intro;
    const introEnabled = !(introConfig && introConfig.enabled === false);

    function findBundledIntroOverlay() {
      return Array.from(document.querySelectorAll("div.fixed.inset-0.z-50")).find((node) => {
        const videos = node.querySelectorAll("video");
        return videos.length >= 2;
      });
    }

    function removeBundledIntroOverlay() {
      const overlay = findBundledIntroOverlay();
      if (!overlay) return;

      overlay.querySelectorAll("video").forEach((video) => {
        try {
          video.pause();
          video.removeAttribute("src");
          video.load();
        } catch (err) {
          // Ignore cleanup errors while replacing/removing built-in intro.
        }
      });

      overlay.remove();
    }

    if (introEnabled) {
      if (document.body.__templateIntroObserver) {
        document.body.__templateIntroObserver.disconnect();
        document.body.__templateIntroObserver = null;
      }

      if (document.body.__templateIntroEnhancerObserver) {
        document.body.__templateIntroEnhancerObserver.disconnect();
        document.body.__templateIntroEnhancerObserver = null;
      }

      // Match production behavior: when intro is enabled, do not interfere with bundled intro logic.
      document.body.style.overflow = "";
      return;
    }

    function removeOverlay() {
      removeBundledIntroOverlay();
      document.body.style.overflow = "";
    }

    removeOverlay();

    if (!document.body.__templateIntroObserver) {
      const observer = new MutationObserver(() => removeOverlay());
      observer.observe(document.body, { childList: true, subtree: true });
      document.body.__templateIntroObserver = observer;
    }
  }

  function applyOurStoryContent(config) {
    const ourStory = config && config.content && config.content.ourStory;
    if (!ourStory || typeof ourStory !== "object") return;

    const text = ourStory.text;
    if (!text || typeof text !== "object") return;

    const section = document.querySelector("#our-story");
    if (!section) return;

    const collapsedLabel = text.toggleClosed && typeof text.toggleClosed.text === "string"
      ? text.toggleClosed.text
      : null;
    const expandedLabel = text.toggleOpen && typeof text.toggleOpen.text === "string"
      ? text.toggleOpen.text
      : null;
    const paragraphEntries = Object.keys(text)
      .filter((key) => /^paragraph\d+$/.test(key) && text[key] && typeof text[key].text === "string")
      .sort((a, b) => Number(a.replace("paragraph", "")) - Number(b.replace("paragraph", "")))
      .map((key) => text[key].text);

    const styleId = "template-our-story-visibility";
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    if (paragraphEntries.length > 0) {
      styleEl.textContent = `#our-story-content .pt-10 > div:nth-child(n+${paragraphEntries.length + 1}){display:none !important;}`;
    } else {
      styleEl.textContent = "";
    }

    function queueOurStorySync() {
      if (section.__templateOurStoryPendingObserver) {
        section.__templateOurStoryPendingObserver.disconnect();
      }

      const observer = new MutationObserver(() => {
        if (!section.querySelector("#our-story-content")) return;

        observer.disconnect();
        section.__templateOurStoryPendingObserver = null;
        syncOurStory();
      });

      observer.observe(section, { childList: true, subtree: true });
      section.__templateOurStoryPendingObserver = observer;

      requestAnimationFrame(() => {
        if (section.querySelector("#our-story-content")) {
          if (section.__templateOurStoryPendingObserver) {
            section.__templateOurStoryPendingObserver.disconnect();
            section.__templateOurStoryPendingObserver = null;
          }
          syncOurStory();
        }
      });
    }

    function syncOurStory() {
      const button = section.querySelector('button[aria-controls="our-story-content"]');
      if (button) {
        const expanded = button.getAttribute("aria-expanded") === "true";
        if (expanded && expandedLabel) {
          button.textContent = expandedLabel;
        } else if (!expanded && collapsedLabel) {
          button.textContent = collapsedLabel;
        }
      }

      const paragraphs = section.querySelectorAll("#our-story-content .pt-10 p");
      paragraphs.forEach((node, index) => {
        node.parentElement.style.display = index < paragraphEntries.length ? "" : "none";
      });
      paragraphEntries.forEach((paragraphText, index) => {
        const node = paragraphs[index];
        if (!node) return;
        node.textContent = paragraphText;
        node.parentElement.style.display = "";
      });
    }

    syncOurStory();

    const button = section.querySelector('button[aria-controls="our-story-content"]');
    if (button && !button.__templateOurStoryBound) {
      button.addEventListener("click", () => {
        queueOurStorySync();
      });
      button.__templateOurStoryBound = true;
    }
  }

  function getGalleryFolder(config) {
    const galleryConfig = config && config.content && config.content.gallery;
    if (galleryConfig && typeof galleryConfig.folder === "string" && galleryConfig.folder.trim()) {
      return galleryConfig.folder.replace(/^\/+|\/+$/g, "");
    }
    return "gallery";
  }

  function normalizeGalleryPath(folder, value) {
    if (typeof value !== "string" || !value.trim()) return null;

    const cleaned = value.trim();
    if (/^https?:\/\//i.test(cleaned) || cleaned.startsWith("/")) {
      return cleaned;
    }

    if (cleaned.startsWith("./")) {
      return `${folder}/${cleaned.slice(2)}`;
    }

    if (cleaned.startsWith(`${folder}/`)) {
      return cleaned;
    }

    return `${folder}/${cleaned}`;
  }

  async function fetchGalleryManifest(folder) {
    try {
      const response = await fetch(`${folder}/manifest.json`, { cache: "no-store" });
      if (!response.ok) return [];

      const payload = await response.json();
      const files = Array.isArray(payload) ? payload : Array.isArray(payload.files) ? payload.files : [];
      return files
        .map((value) => normalizeGalleryPath(folder, value))
        .filter((value) => typeof value === "string");
    } catch (err) {
      return [];
    }
  }

  async function fetchGalleryDirectoryListing(folder) {
    try {
      const response = await fetch(`${folder}/`, { cache: "no-store" });
      if (!response.ok) return [];

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const images = new Set();
      const imagePattern = /\.(jpe?g|png|webp|gif|avif)$/i;

      Array.from(doc.querySelectorAll("a[href]")).forEach((anchor) => {
        const href = anchor.getAttribute("href") || "";
        if (!imagePattern.test(href)) return;

        const path = normalizeGalleryPath(folder, href.replace(/^\.\//, ""));
        if (path) images.add(path);
      });

      return Array.from(images).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    } catch (err) {
      return [];
    }
  }

  async function resolveGalleryImagePaths(config) {
    const folder = getGalleryFolder(config);
    const galleryConfig = config && config.content && config.content.gallery;

    if (galleryConfig && Array.isArray(galleryConfig.files) && galleryConfig.files.length > 0) {
      const files = galleryConfig.files
        .map((value) => normalizeGalleryPath(folder, value))
        .filter((value) => typeof value === "string");
      if (files.length > 0) return files;
    }

    const manifestFiles = await fetchGalleryManifest(folder);
    if (manifestFiles.length > 0) return manifestFiles;

    return fetchGalleryDirectoryListing(folder);
  }

  function isPrimaryGalleryWrapper(el) {
    const img = el.querySelector("img");
    if (!img) return false;
    const alt = (img.getAttribute("alt") || "").trim();
    return /^Gallery moment(\s+\d+)?$/i.test(alt);
  }

  function applyGalleryImagesToDom(paths) {
    if (!Array.isArray(paths) || paths.length === 0) return;

    const marquee = document.querySelector("#our-story .animate-marquee");
    if (!marquee) return;

    const wrappers = Array.from(marquee.children);
    let primaryWrappers = wrappers.filter(isPrimaryGalleryWrapper);
    if (primaryWrappers.length === 0) return;

    // Remove the existing duplicated set (used for the seamless marquee loop);
    // it gets rebuilt below to match the resized primary set.
    wrappers.slice(primaryWrappers.length, primaryWrappers.length * 2).forEach((el) => el.remove());

    // Grow or shrink the primary slot count to match the number of manifest photos,
    // since the built marquee only ships with a fixed number of placeholder slots.
    while (primaryWrappers.length < paths.length) {
      const clone = primaryWrappers[primaryWrappers.length - 1].cloneNode(true);
      primaryWrappers[primaryWrappers.length - 1].insertAdjacentElement("afterend", clone);
      primaryWrappers.push(clone);
    }
    while (primaryWrappers.length > paths.length) {
      primaryWrappers.pop().remove();
    }

    // The built marquee's images are "h-80 w-auto" (height fixed, width derived
    // from each image's own aspect ratio). Before an image loads, the browser
    // uses its width/height attributes (4:5, from the original template photos)
    // to reserve space; once the actual photo loads, real user photos are
    // square, so the box visibly widened. With 44 images loading progressively
    // (loading="lazy"), each one widening the marquee track mid-scroll caused
    // the CSS animation's translateX(-50%) - resolved against the track's
    // *current* width - to jump every time. Locking the box to a fixed aspect
    // ratio (matching the actual square photos) makes every image's rendered
    // width deterministic from the start, so the track width never changes
    // after load.
    const GALLERY_ASPECT_RATIO = "1 / 1";

    primaryWrappers.forEach((wrapper, index) => {
      const img = wrapper.querySelector("img");
      if (!img) return;
      img.setAttribute("src", paths[index]);
      img.setAttribute("alt", `Gallery moment ${index + 1}`);
      img.style.aspectRatio = GALLERY_ASPECT_RATIO;
    });

    primaryWrappers.forEach((wrapper) => {
      const clone = wrapper.cloneNode(true);
      const clonedImg = clone.querySelector("img");
      if (clonedImg) {
        clonedImg.setAttribute("alt", "");
        clonedImg.style.aspectRatio = GALLERY_ASPECT_RATIO;
      }
      marquee.appendChild(clone);
    });
  }

  function applyGalleryFromFolder(config) {
    let attempts = 0;
    const maxAttempts = 180;

    async function tryApply() {
      attempts += 1;
      const primaryImages = Array.from(document.querySelectorAll("#our-story .animate-marquee img")).filter((img) => {
        const alt = (img.getAttribute("alt") || "").trim();
        return alt.startsWith("Gallery moment");
      });

      if (primaryImages.length === 0) {
        if (attempts < maxAttempts) {
          requestAnimationFrame(tryApply);
        }
        return;
      }

      const paths = await resolveGalleryImagePaths(config);
      if (!paths.length) {
        console.warn("Template gallery not applied: no images found in gallery folder.");
        return;
      }

      applyGalleryImagesToDom(paths);
    }

    requestAnimationFrame(tryApply);
  }

  function findTransportSection() {
    const sections = Array.from(document.querySelectorAll("section"));
    return sections.find((section) => {
      const heading = section.querySelector("h2");
      if (!heading) return false;
      return heading.textContent && heading.textContent.trim() === "Wedding Day Transportation";
    });
  }

  const TRANSPORT_ICONS = {
    bus: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bus w-4 h-4" aria-hidden="true"><path d="M8 6v6"></path><path d="M15 6v6"></path><path d="M2 12h19.6"></path><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"></path><circle cx="7" cy="18" r="2"></circle><path d="M9 18h5"></path><circle cx="16" cy="18" r="2"></circle></svg>',
    "map-pin": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin w-4 h-4" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>',
    parking: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-parking w-4 h-4" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 17V7h4a3 3 0 0 1 0 6H9"></path></svg>'
  };

  function applyTransportModes(config) {
    const transportConfig = config && config.content && config.content.transport;
    const modes = transportConfig && Array.isArray(transportConfig.modes) ? transportConfig.modes : null;
    if (!modes || modes.length === 0) return;

    const section = findTransportSection();
    if (!section) return;

    const grid = section.querySelector(".grid.sm\\:grid-cols-2, .grid[class*='grid-cols-']");
    if (!grid) return;

    let cards = Array.from(grid.children);
    if (cards.length === 0) return;

    // The compiled stylesheet only ships the grid-cols utilities actually used at
    // build time (e.g. grid-cols-2), so a plain class swap to grid-cols-3 has no
    // matching CSS rule. Inject the column count directly instead.
    grid.classList.add("template-transport-grid");
    const styleId = "template-transport-grid-style";
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `@media (min-width: 640px) { .template-transport-grid { grid-template-columns: repeat(${modes.length}, minmax(0, 1fr)); } }`;

    while (cards.length < modes.length) {
      const clone = cards[cards.length - 1].cloneNode(true);
      cards[cards.length - 1].insertAdjacentElement("afterend", clone);
      cards.push(clone);
    }
    while (cards.length > modes.length) {
      cards.pop().remove();
    }

    cards.forEach((card, index) => {
      const mode = modes[index];
      if (!mode) return;

      const iconWrap = card.children[0];
      if (iconWrap) {
        iconWrap.innerHTML = TRANSPORT_ICONS[mode.icon] || TRANSPORT_ICONS.bus;
      }

      const heading = card.querySelector("h3");
      if (heading && typeof mode.title === "string") heading.textContent = mode.title;

      const paragraphs = card.querySelectorAll("p");
      if (paragraphs[0] && typeof mode.label === "string") paragraphs[0].textContent = mode.label;
      if (paragraphs[1] && typeof mode.description === "string") paragraphs[1].textContent = mode.description;

      const existingLink = card.querySelector(".template-mode-link");
      if (existingLink) existingLink.remove();

      if (mode.link && typeof mode.link.text === "string" && typeof mode.link.href === "string") {
        const link = document.createElement("a");
        link.href = mode.link.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = mode.link.text;
        link.className =
          "template-mode-link inline-flex items-center gap-2 font-body text-xs tracking-[0.15em] uppercase text-gold hover:text-sage-dark transition-colors border-b border-gold/40 hover:border-sage-dark pb-0.5 mt-2";
        card.appendChild(link);
      }
    });
  }

  function applyTransportMap() {
    const section = findTransportSection();
    if (!section) return;

    const paragraphs = Array.from(section.querySelectorAll("p"));
    const target = paragraphs.find((p) => /please indicate your transportation/i.test(p.textContent || ""));
    if (!target) return;

    const img = document.createElement("img");
    img.src = "/assets/annotated-mandai-map.png";
    img.alt = "Map to Meranti Ballroom";
    img.className = "w-full rounded-lg mb-6";
    target.replaceWith(img);

    const divider = img.previousElementSibling;
    if (divider && divider.tagName === "DIV" && divider.classList.contains("h-px")) {
      divider.remove();
    }
  }

  function applyTransportDecor() {
    const section = findTransportSection();
    if (!section) return;

    const shell = section.querySelector('img[src*="transport-shell"]');
    const palms = section.querySelector('img[src*="transport-palms"]');
    const surfboard = section.querySelector('img[src*="transport-surfboard-bag"]');
    const car = section.querySelector('img[src*="transport-car"]');
    const mapImg = section.querySelector('img[src*="annotated-mandai-map"]');

    if (shell) shell.remove();
    if (surfboard) surfboard.remove();

    // Palms: bottom-right corner of the transport section's content area. Anchored to
    // the inner max-w-3xl wrapper (not the outer <section>) so the base lines up with
    // the visible card edge instead of floating in the section's bottom padding.
    if (palms) {
      palms.style.top = "";
      const contentWrapper = section.querySelector(".max-w-3xl.mx-auto.relative") || section;
      contentWrapper.appendChild(palms);
      palms.className = "absolute bottom-0 -right-4 w-36 md:w-44 h-auto select-none pointer-events-none z-10";
    }

    // Car: overlaid at the boundary between the mode cards and the map, left-aligned.
    // Absolutely positioned (not in normal flow) so it can overlap the card and the
    // sections above/below it without pushing the map down.
    if (car && mapImg && mapImg.parentElement) {
      const container = mapImg.parentElement;
      container.appendChild(car);
      car.className = "absolute -left-4 w-32 md:w-40 h-auto select-none pointer-events-none z-20";

      const positionCar = () => {
        const carHeight = car.offsetHeight || 96;
        car.style.top = `${mapImg.offsetTop - carHeight / 2}px`;
      };

      if (car.complete) {
        positionCar();
      } else {
        car.addEventListener("load", positionCar, { once: true });
      }
      requestAnimationFrame(positionCar);
    }
  }

  function applySectionToggles(config) {
    const sectionMap = {
      hero: document.querySelector("#hero"),
      countdown: document.querySelector("#countdown"),
      welcome: document.querySelector("#welcome"),
      weddingEvents: document.querySelector("#wedding-events"),
      dressCode: document.querySelector("#dress-code"),
      dayProgram: document.querySelector("#day-program"),
      ourStory: document.querySelector("#our-story"),
      weekend: document.querySelector("#important-info"),
      transport: findTransportSection(),
      accommodations: document.querySelector("#accommodations"),
      rsvp: document.querySelector("#rsvp"),
      footer: document.querySelector("footer")
    };

    const content = config.content || {};
    Object.keys(sectionMap).forEach((key) => {
      const sectionConfig = content[key];
      if (!sectionConfig || typeof sectionConfig !== "object") return;
      if (typeof sectionConfig.enabled !== "boolean") return;
      const el = sectionMap[key];
      if (!el) return;
      el.style.display = sectionConfig.enabled ? "" : "none";
    });
  }

  function applyTextOverrides(config) {
    function applyInsertedText(node, override, locationKey) {
      const tagName = typeof override.tagName === "string" ? override.tagName : "p";
      const insertPosition = override.insert === "before" ? "beforebegin" : "afterend";
      const marker = `template-insert-${locationKey}`;
      const siblingKey = insertPosition === "beforebegin" ? "previousElementSibling" : "nextElementSibling";
      const existing = node[siblingKey];

      if (existing && existing.dataset && existing.dataset.templateInsert === marker) {
        existing.textContent = String(override.text || "");
        existing.className = typeof override.className === "string" ? override.className : "";
        return;
      }

      const inserted = document.createElement(tagName);
      inserted.dataset.templateInsert = marker;
      inserted.textContent = String(override.text || "");
      if (typeof override.className === "string") {
        inserted.className = override.className;
      }
      node.insertAdjacentElement(insertPosition, inserted);
    }

    const normalizeOverrides = (content) => {
      if (!content || typeof content !== "object") {
        return [];
      }

      const flattened = [];
      Object.keys(content).forEach((sectionKey) => {
        const sectionConfig = content[sectionKey];
        if (!sectionConfig || typeof sectionConfig !== "object") return;

        const sectionOverrides = sectionConfig.text;
        if (!sectionOverrides || typeof sectionOverrides !== "object") return;

        Object.keys(sectionOverrides).forEach((locationKey) => {
          const override = sectionOverrides[locationKey];
          if (!override || typeof override !== "object") return;
          flattened.push({
            ...override,
            section: sectionKey,
            location: locationKey
          });
        });
      });

      return flattened;
    };

    const overrides = normalizeOverrides(config.content);
    overrides.forEach((override) => {
      if (!override || typeof override.selector !== "string") return;
      const nodes = document.querySelectorAll(override.selector);
      if (!nodes.length) return;

      if (typeof override.index === "number") {
        const node = nodes[override.index];
        if (!node) return;
        if (typeof override.insert === "string" && typeof override.text === "string") {
          applyInsertedText(node, override, override.location || "inserted");
        } else if (typeof override.attribute === "string") {
          node.setAttribute(override.attribute, String(override.text || ""));
        } else if (typeof override.html === "string") {
          node.innerHTML = override.html;
        } else if (typeof override.text === "string") {
          if (node.childElementCount > 0 && override.allowStructureReplace !== true) {
            return;
          }
          node.textContent = override.text;
        }
        return;
      }

      nodes.forEach((node) => {
        if (typeof override.insert === "string" && typeof override.text === "string") {
          applyInsertedText(node, override, override.location || "inserted");
        } else if (typeof override.attribute === "string") {
          node.setAttribute(override.attribute, String(override.text || ""));
        } else if (typeof override.html === "string") {
          node.innerHTML = override.html;
        } else if (typeof override.text === "string") {
          if (node.childElementCount > 0 && override.allowStructureReplace !== true) {
            return;
          }
          node.textContent = override.text;
        }
      });
    });
  }

  function hideRsvpPortrait() {
    const rsvp = document.querySelector("#rsvp");
    if (!rsvp) return;
    const img = rsvp.querySelector('img[src*="rsvp-portrait"]');
    if (img && img.parentElement) {
      img.parentElement.style.display = "none";
    }
  }

  function hideFooterCredit() {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const link = footer.querySelector('a[href*="thedigitalyes.com"]');
    if (link && link.parentElement) {
      link.parentElement.style.display = "none";
    }
  }

  function applyRsvpQuestionsRedesign() {
    const CHILDREN_MAX = 9;
    const CHECKED_DOT_HTML =
      '<span data-state="checked" class="flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle h-2.5 w-2.5 fill-current text-current"><circle cx="12" cy="12" r="10"></circle></svg></span>';

    // The "attending" answer conditionally mounts/unmounts the adults-count and
    // transportation fields elsewhere in this form (toggling to "Regretfully
    // declines" and back recreates fresh DOM nodes with none of our patches
    // applied). So this whole sync has to be safely re-runnable, driven by a
    // MutationObserver watching for that remount rather than a one-shot setup.
    function syncRsvpQuestions(form) {
      const labels = Array.from(form.querySelectorAll("label"));

      // "Number of guests attending" -> "Number of adults attending", plus a new
      // children counter cloned from the same stepper markup (the original stepper
      // is a React-controlled widget with no native <input>, so a fresh click
      // handler is wired up here for the cloned copy).
      const adultsLabel = labels.find((l) => /number of (guests|adults) attending/i.test(l.textContent || ""));
      const adultsBlock = adultsLabel ? adultsLabel.closest(".space-y-3") : null;

      // Skip if a valid children counter is already sitting right after the
      // current adults block: this sync also re-runs every time the counter's
      // own +/- buttons are clicked (their DOM mutations trigger the same
      // MutationObserver), and recreating it unconditionally on every run would
      // reset the count back to 0 on every click. Only rebuild when it's
      // actually missing or stale (e.g. after a real remount).
      const existingChildrenBlock =
        adultsBlock && adultsBlock.nextElementSibling && adultsBlock.nextElementSibling.classList.contains("template-children-count")
          ? adultsBlock.nextElementSibling
          : null;

      if (!existingChildrenBlock) {
        // Clean up any stale/orphaned clone left over from a remount before
        // creating a fresh one.
        form.querySelectorAll(".template-children-count").forEach((el) => el.remove());
      }

      if (adultsLabel && adultsBlock) {
        adultsLabel.textContent = "Number of adults attending *";

        const adultsCountEl = adultsBlock.querySelector("span.w-10.text-center");
        if (adultsCountEl) adultsCountEl.setAttribute("data-rsvp-field", "adultCount");
      }

      if (adultsLabel && adultsBlock && !existingChildrenBlock) {
        const childrenBlock = adultsBlock.cloneNode(true);
        childrenBlock.classList.add("template-children-count");

        const childrenLabel = childrenBlock.querySelector("label");
        if (childrenLabel) {
          childrenLabel.textContent = "Number of children (below 12 years old) attending *";
        }

        // adultsBlock may currently include its own "Guest 2/3 name" fields
        // (added by React once adult count > 1) if the adult count happened to
        // be above 1 at clone time; strip that out before adding our own
        // independent "Child N name" fields below.
        const strayNamesContainer = childrenBlock.querySelector(".space-y-3.pt-2");
        if (strayNamesContainer) strayNamesContainer.remove();

        const buttons = childrenBlock.querySelectorAll("button");
        const minusBtn = buttons[0];
        const plusBtn = buttons[1];
        const countEl = childrenBlock.querySelector("span.w-10.text-center");
        if (countEl) countEl.setAttribute("data-rsvp-field", "childrenCount");

        const namesContainer = document.createElement("div");
        namesContainer.className = "space-y-3 pt-2 template-children-names";
        childrenBlock.appendChild(namesContainer);

        const nameInputTemplate = adultsBlock.querySelector('input[id="fullName"]');
        const nameInputClass = nameInputTemplate
          ? nameInputTemplate.className
          : "flex h-10 w-full rounded-md border px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm mt-2 bg-ivory border-gold/30 text-sage-dark placeholder:text-sage-dark/50 focus:border-gold";
        const labelTemplate = adultsLabel;
        const labelClass = labelTemplate ? labelTemplate.className : "text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-sage-dark font-medium";

        // Mirrors the adult "Guest N name" fields that already appear/disappear
        // as the (React-controlled) adult stepper changes: add/remove one
        // "Child N name" field per child as this independently-managed stepper
        // changes, always trimming/growing from the tail so earlier entries
        // keep whatever the guest already typed.
        function renderNameFields() {
          const existingWrappers = Array.from(namesContainer.children);
          while (existingWrappers.length > count) {
            namesContainer.removeChild(existingWrappers.pop());
          }
          for (let i = existingWrappers.length + 1; i <= count; i++) {
            const wrapper = document.createElement("div");
            const label = document.createElement("label");
            label.className = labelClass;
            label.setAttribute("for", `child-${i}`);
            label.textContent = `Child ${i} name *`;
            const input = document.createElement("input");
            input.className = nameInputClass;
            input.id = `child-${i}`;
            input.required = true;
            input.maxLength = 120;
            input.placeholder = "Enter child's full name";
            wrapper.appendChild(label);
            wrapper.appendChild(input);
            namesContainer.appendChild(wrapper);
          }
        }

        let count = 0;
        function render() {
          if (countEl) countEl.textContent = String(count);
          if (minusBtn) minusBtn.disabled = count <= 0;
          if (plusBtn) plusBtn.disabled = count >= CHILDREN_MAX;
          renderNameFields();
        }
        if (minusBtn) {
          minusBtn.addEventListener("click", () => {
            if (count > 0) count -= 1;
            render();
          });
        }
        if (plusBtn) {
          plusBtn.addEventListener("click", () => {
            if (count < CHILDREN_MAX) count += 1;
            render();
          });
        }
        render();

        adultsBlock.insertAdjacentElement("afterend", childrenBlock);
      }

      // "Transportation" -> "Will you be self-driving?" yes/no. The existing
      // radiogroup widget (Radix-style button[role=radio] + hidden native input +
      // label, all already wired up by React for click/toggle behavior) has its
      // selection fully taken over below; skip if this exact node was already
      // wired (marked via data-rsvp-selfdriving-wired) so re-syncs on unrelated
      // mutations don't re-attach duplicate listeners.
      const selfDrivingLabel = labels.find((l) => /^(transportation\b|will you be self-driving\?)/i.test((l.textContent || "").trim()));
      const selfDrivingGroup = selfDrivingLabel && selfDrivingLabel.parentElement
        ? selfDrivingLabel.parentElement.querySelector('[role="radiogroup"]')
        : null;

      if (selfDrivingLabel && selfDrivingGroup && !selfDrivingGroup.hasAttribute("data-rsvp-selfdriving-wired")) {
        selfDrivingLabel.textContent = "Will you be self-driving? *";

        const options = Array.from(selfDrivingGroup.querySelectorAll('[role="radio"]'));
        const newValues = ["yes", "no"];
        const newLabels = ["Yes", "No"];
        options.forEach((btn, index) => {
          const newValue = newValues[index];
          const newLabelText = newLabels[index];
          if (!newValue) return;

          const wrapper = btn.parentElement;
          const hiddenInput = wrapper ? wrapper.querySelector('input[type="radio"]') : null;
          const optionLabel = wrapper ? wrapper.querySelector("label") : null;

          btn.setAttribute("value", newValue);
          if (hiddenInput) hiddenInput.setAttribute("value", newValue);
          if (optionLabel && newLabelText) optionLabel.textContent = newLabelText;
        });

        // The underlying Radix radio group always starts with its first option
        // ("Yes") pre-selected with no easy way to change that default via
        // clicks alone, and that selection needs to survive remounts too. So
        // this group's selection is fully taken over here: React's own click
        // handling is blocked (capture-phase preventDefault/stopPropagation,
        // same technique used for the Maps button override) and replaced with
        // plain state management, defaulting to "No" instead.
        function setChecked(selected) {
          options.forEach((opt) => {
            const isSelected = opt === selected;
            opt.setAttribute("aria-checked", isSelected ? "true" : "false");
            opt.setAttribute("data-state", isSelected ? "checked" : "unchecked");
            // The filled dot is a child <span><svg> that React only renders when
            // checked (not a CSS toggle driven by data-state), so its actual
            // presence has to be managed here too.
            opt.innerHTML = isSelected ? CHECKED_DOT_HTML : "";
            const hiddenInput = opt.parentElement ? opt.parentElement.querySelector('input[type="radio"]') : null;
            if (hiddenInput) hiddenInput.checked = isSelected;
          });
        }

        options.forEach((btn) => {
          btn.addEventListener(
            "click",
            (event) => {
              event.preventDefault();
              event.stopPropagation();
              setChecked(btn);
            },
            true
          );
        });

        // Default to "No".
        setChecked(options[1] || null);
        selfDrivingGroup.setAttribute("data-rsvp-selfdriving-wired", "true");
      }
    }

    let attempts = 0;
    const maxAttempts = 180;
    let isSyncing = false;

    function guardedSync(form) {
      if (isSyncing) return;
      isSyncing = true;
      try {
        syncRsvpQuestions(form);
      } finally {
        // Let the MutationObserver callback triggered by the mutations just
        // made (if any) run and see isSyncing still true, then release it.
        Promise.resolve().then(() => {
          isSyncing = false;
        });
      }
    }

    function attachRedesign() {
      attempts += 1;
      const rsvpSection = document.querySelector("#rsvp");
      const form = rsvpSection ? rsvpSection.querySelector("form") : null;

      if (!rsvpSection || !form) {
        if (attempts < maxAttempts) requestAnimationFrame(attachRedesign);
        return;
      }
      if (rsvpSection.__templateRsvpQuestionsRedesigned) return;

      guardedSync(form);

      const observer = new MutationObserver(() => {
        const currentForm = rsvpSection.querySelector("form");
        if (currentForm) guardedSync(currentForm);
      });
      observer.observe(rsvpSection, { childList: true, subtree: true });

      rsvpSection.__templateRsvpQuestionsRedesigned = true;
    }

    requestAnimationFrame(attachRedesign);
  }

  function applyRsvpSubmission(config) {
    const rsvpConfig = config && config.content && config.content.rsvp;
    const endpoint =
      rsvpConfig && rsvpConfig.submission && typeof rsvpConfig.submission.endpoint === "string"
        ? rsvpConfig.submission.endpoint.trim()
        : "";
    if (!endpoint) return;

    function findRadiogroupByLabelText(form, labelSubstring) {
      const labels = Array.from(form.querySelectorAll("label"));
      const label = labels.find((l) => (l.textContent || "").toLowerCase().includes(labelSubstring));
      if (!label || !label.parentElement) return null;
      return label.parentElement.querySelector('[role="radiogroup"]');
    }

    function getRadioValue(radiogroup) {
      if (!radiogroup) return "";
      const checked = radiogroup.querySelector('[role="radio"][data-state="checked"]');
      return checked ? checked.getAttribute("value") || "" : "";
    }

    function showStatus(form, submitButton, message, isError) {
      let status = form.querySelector(".template-rsvp-status");
      if (!status) {
        status = document.createElement("p");
        status.className = "template-rsvp-status text-center text-sm mt-3";
        submitButton.insertAdjacentElement("afterend", status);
      }
      status.textContent = message;
      status.style.color = isError ? "#b91c1c" : "#3f6212";
    }

    let attempts = 0;
    const maxAttempts = 180;

    function attachOverride() {
      attempts += 1;
      const form = document.querySelector("#rsvp form");
      const submitButton = form ? form.querySelector('button[type="submit"]') : null;

      if (form && submitButton && !form.__templateRsvpOverrideApplied) {
        form.addEventListener(
          "submit",
          (event) => {
            event.preventDefault();
            event.stopPropagation();

            const fullNameEl = form.querySelector("#fullName");
            const messageEl = form.querySelector("#message");
            const websiteEl = form.querySelector("#website");
            const adultCountEl = form.querySelector('[data-rsvp-field="adultCount"]');
            const childrenCountEl = form.querySelector('[data-rsvp-field="childrenCount"]');
            const attendingGroup = findRadiogroupByLabelText(form, "attending");
            const selfDrivingGroup = findRadiogroupByLabelText(form, "self-driving");

            // Additional adult guest names (Guest 2, Guest 3, ...) that React
            // adds as the adult stepper increases, plus this template's own
            // "Child N name" fields added alongside the children stepper.
            const additionalGuestNames = Array.from(form.querySelectorAll('input[id^="guest-"]')).map((el) =>
              el.value.trim()
            );
            const childrenNames = Array.from(form.querySelectorAll('input[id^="child-"]')).map((el) => el.value.trim());

            const payload = {
              fullName: fullNameEl ? fullNameEl.value.trim() : "",
              attending: getRadioValue(attendingGroup),
              adultCount: adultCountEl ? parseInt(adultCountEl.textContent.trim(), 10) : 1,
              additionalGuestNames,
              childrenCount: childrenCountEl ? parseInt(childrenCountEl.textContent.trim(), 10) : 0,
              childrenNames,
              selfDriving: getRadioValue(selfDrivingGroup),
              message: messageEl ? messageEl.value.trim() : "",
              website: websiteEl ? websiteEl.value : ""
            };

            submitButton.disabled = true;
            showStatus(form, submitButton, "Sending...", false);

            fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            })
              .then((response) =>
                response
                  .json()
                  .catch(() => ({}))
                  .then((data) => ({ ok: response.ok, data }))
              )
              .then(({ ok, data }) => {
                if (ok && data && data.ok !== false) {
                  showStatus(form, submitButton, "Thank you! Your RSVP has been received.", false);
                } else {
                  submitButton.disabled = false;
                  showStatus(form, submitButton, (data && data.error) || "Something went wrong. Please try again.", true);
                }
              })
              .catch(() => {
                submitButton.disabled = false;
                showStatus(form, submitButton, "Network error. Please try again.", true);
              });
          },
          true
        );
        form.__templateRsvpOverrideApplied = true;
        return;
      }

      if (attempts < maxAttempts) {
        requestAnimationFrame(attachOverride);
      }
    }

    requestAnimationFrame(attachOverride);
  }

  function applyConfig(config) {
    setMeta(config);
    applySectionToggles(config);
    applyTextOverrides(config);
    applyWeddingDate(config);
    applyWeddingEventsMap(config);
    applyOurStoryContent(config);
    applyGalleryFromFolder(config);
    applyIntroConfig(config);
    applyTransportModes(config);
    applyTransportMap();
    applyTransportDecor();
    applyRsvpQuestionsRedesign();
    applyRsvpSubmission(config);
    hideRsvpPortrait();
    hideFooterCredit();
  }

  async function loadConfig() {
    try {
      const response = await fetch(CONFIG_PATH, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load template config");
      }
      const config = await response.json();
      return config;
    } catch (err) {
      console.warn("Template config not applied:", err);
      return null;
    }
  }

  function whenAppReady(callback) {
    let attempts = 0;
    const maxAttempts = 120;

    function tick() {
      attempts += 1;
      const appReady = document.querySelector("#hero") || document.querySelector("main section");
      if (appReady) {
        callback();
        return;
      }
      if (attempts < maxAttempts) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }

  loadConfig().then((config) => {
    if (!config) return;
    whenAppReady(() => applyConfig(config));
  });
})();
