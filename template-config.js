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

  function findTransportSection() {
    const sections = Array.from(document.querySelectorAll("section"));
    return sections.find((section) => {
      const heading = section.querySelector("h2");
      if (!heading) return false;
      return heading.textContent && heading.textContent.trim() === "Wedding Day Transportation";
    });
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

  function applyConfig(config) {
    setMeta(config);
    applySectionToggles(config);
    applyTextOverrides(config);
    applyWeddingDate(config);
    applyWeddingEventsMap(config);
    applyOurStoryContent(config);
    applyIntroConfig(config);
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
