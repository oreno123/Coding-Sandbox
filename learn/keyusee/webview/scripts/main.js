import { DOWNLOAD_URL, features, painPoints, screenshots, workflow } from "./data.js";

const THEME_KEY = "keyusee-theme";

const painGrid = document.querySelector("#painGrid");
const featureGrid = document.querySelector("#featureGrid");
const workflowList = document.querySelector("#workflowList");
const shotTrack = document.querySelector("#shotTrack");
const siteLoader = document.querySelector("#siteLoader");
const themeToggle = document.querySelector("#themeToggle");
const themeLabel = document.querySelector("#themeLabel");
const currentYear = document.querySelector("#currentYear");
const header = document.querySelector(".site-header");
const heroVideoTrigger = document.querySelector("#heroVideoTrigger");
const heroShotLink = document.querySelector("#heroShotLink");
const heroShotPreview = document.querySelector("#heroShotPreview");
const shotLightbox = document.querySelector("#shotLightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const lightboxTitle = document.querySelector("#lightboxTitle");
const lightboxClose = document.querySelector("#lightboxClose");
const lightboxPrev = document.querySelector("#lightboxPrev");
const lightboxNext = document.querySelector("#lightboxNext");
const videoLightbox = document.querySelector("#videoLightbox");
const videoLightboxClose = document.querySelector("#videoLightboxClose");
const videoLightboxPlayer = document.querySelector("#videoLightboxPlayer");
let lightboxLastFocus = null;
let currentScreenshotIndex = 0;
let heroShotIndex = 0;
let heroShotTimer = null;
let loaderDismissed = false;
const CLICK_FX_POOL_SIZE = 12;

function hideSiteLoader() {
  if (!siteLoader || loaderDismissed) return;
  loaderDismissed = true;
  siteLoader.classList.add("is-hidden");
  window.setTimeout(() => {
    siteLoader.hidden = true;
    document.body.classList.remove("is-loading");
  }, 300);
}

function initSiteLoader() {
  if (!siteLoader) return;
  if (document.readyState === "complete") {
    hideSiteLoader();
    return;
  }
  window.addEventListener("load", hideSiteLoader, { once: true });
  window.setTimeout(hideSiteLoader, 2200);
}

function initClickFeedback() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!document.body) return;

  const layer = document.createElement("div");
  layer.className = "click-fx-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);

  const pool = Array.from({ length: CLICK_FX_POOL_SIZE }, () => {
    const node = document.createElement("span");
    node.className = "click-fx-ring";
    layer.appendChild(node);
    return { node, animation: null };
  });

  let poolIndex = 0;

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) return;
      if (!(event.target instanceof Element)) return;

      const slot = pool[poolIndex];
      poolIndex = (poolIndex + 1) % CLICK_FX_POOL_SIZE;

      slot.animation?.cancel();

      const x = event.clientX - 36;
      const y = event.clientY - 36;
      const endScale = event.pointerType === "touch" ? 2.1 : 1.7;
      const startTransform = `translate3d(${x}px, ${y}px, 0) scale(0.24)`;
      const endTransform = `translate3d(${x}px, ${y}px, 0) scale(${endScale})`;

      slot.node.style.transform = startTransform;
      slot.node.style.opacity = "0.28";

      const animation = slot.node.animate(
        [
          { transform: startTransform, opacity: 0.28 },
          { transform: endTransform, opacity: 0 }
        ],
        {
          duration: 450,
          easing: "cubic-bezier(0.2, 0.72, 0.22, 1)",
          fill: "forwards"
        }
      );

      slot.animation = animation;
      animation.onfinish = () => {
        if (slot.animation === animation) {
          slot.node.style.opacity = "0";
        }
      };
    },
    { passive: true }
  );
}

function renderPainPoints() {
  if (!painGrid) return;
  painGrid.innerHTML = painPoints
    .map(
      (item) => `
      <article class="pain-card reveal tilt">
        <h3>${item.title}</h3>
        <div class="pain-item">
          <p><strong>市场痛点：</strong>${item.pain}</p>
        </div>
        <div class="pain-item">
          <p><strong>可遇录屏（keyusee）解决方式：</strong>${item.solution}</p>
        </div>
      </article>
    `
    )
    .join("");
}

function renderFeatures() {
  if (!featureGrid) return;
  featureGrid.innerHTML = features
    .map(
      (item) => `
      <article class="feature-card reveal tilt">
        <div class="feature-icon">${item.icon}</div>
        <h3>${item.title}</h3>
        <p>${item.description}</p>
      </article>
    `
    )
    .join("");
}

function renderWorkflow() {
  if (!workflowList) return;
  workflowList.innerHTML = workflow
    .map(
      (item) => `
      <li class="reveal tilt">
        <h3>${item.title}</h3>
        <p>${item.description}</p>
      </li>
    `
    )
    .join("");
}

function renderScreenshots() {
  if (!shotTrack) return;
  shotTrack.innerHTML = screenshots
    .map(
      (item, index) => `
      <article class="shot-card tilt">
        <button
          class="shot-preview"
          type="button"
          data-preview-index="${index}"
          aria-label="预览大图：${item.title}"
        >
          <div class="shot-frame" style="--shot-ratio: ${item.ratio || "16 / 9"}; --shot-focus: ${
            item.focus || "center"
          };">
            <img src="${item.src}" alt="${item.alt}" loading="lazy" decoding="async" />
          </div>
        </button>
        <h3>${item.title}</h3>
        <p>${item.description}</p>
      </article>
    `
    )
    .join("");
}

function showLightboxImage(index) {
  if (!lightboxImage || !lightboxTitle || screenshots.length === 0) return;
  const total = screenshots.length;
  currentScreenshotIndex = (index + total) % total;
  const shot = screenshots[currentScreenshotIndex];
  lightboxImage.src = shot.src;
  lightboxImage.alt = shot.alt || shot.title;
  lightboxTitle.textContent = shot.title;
}

function openLightbox(index) {
  if (!shotLightbox || !lightboxImage || !lightboxTitle) return;
  lightboxLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  showLightboxImage(index);
  shotLightbox.hidden = false;
  document.body.style.overflow = "hidden";
  lightboxNext?.focus();
}

function closeLightbox() {
  if (!shotLightbox || !lightboxImage) return;
  shotLightbox.hidden = true;
  lightboxImage.src = "";
  document.body.style.overflow = "";
  lightboxLastFocus?.focus();
  lightboxLastFocus = null;
}

function navigateLightbox(step) {
  if (shotLightbox?.hidden) return;
  showLightboxImage(currentScreenshotIndex + step);
}

function renderHeroShot() {
  if (!heroShotPreview || screenshots.length === 0) return;
  const shot = screenshots[heroShotIndex];
  heroShotPreview.src = shot.src;
  heroShotPreview.alt = shot.alt || shot.title;
  heroShotPreview.style.objectPosition = shot.focus || "center";
}

function startHeroShotLoop() {
  if (!heroShotPreview || screenshots.length <= 1 || heroShotTimer) return;
  heroShotTimer = window.setInterval(() => {
    heroShotIndex = (heroShotIndex + 1) % screenshots.length;
    renderHeroShot();
  }, 2600);
}

function stopHeroShotLoop() {
  if (!heroShotTimer) return;
  window.clearInterval(heroShotTimer);
  heroShotTimer = null;
}

function openVideoLightbox() {
  if (!videoLightbox || !videoLightboxPlayer) return;
  videoLightbox.hidden = false;
  document.body.style.overflow = "hidden";
  const playPromise = videoLightboxPlayer.play();
  if (playPromise?.catch) {
    playPromise.catch(() => {});
  }
  videoLightboxClose?.focus();
}

function closeVideoLightbox() {
  if (!videoLightbox || !videoLightboxPlayer) return;
  videoLightbox.hidden = true;
  videoLightboxPlayer.pause();
  document.body.style.overflow = "";
}

function getPreferredTheme() {
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem(THEME_KEY, theme);
  if (themeLabel) {
    themeLabel.textContent = theme === "dark" ? "亮色" : "暗色";
  }
}

function initTheme() {
  setTheme(getPreferredTheme());
  themeToggle?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    setTheme(current === "dark" ? "light" : "dark");
  });
}

function initDownloadLinks() {
  const links = document.querySelectorAll("[data-download-link]");
  if (!links.length) return;
  links.forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    link.href = DOWNLOAD_URL;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
}

function initReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
}

function initTilt() {
  const cards = document.querySelectorAll(".tilt");
  cards.forEach((card) => {
    card.addEventListener("mousemove", (event) => {
      if (window.matchMedia("(max-width: 980px)").matches) return;
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const rotX = (0.5 - py) * 5;
      const rotY = (px - 0.5) * 7;
      card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

function initScreenshotPreview() {
  if (!shotTrack || !shotLightbox) return;
  shotTrack.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest(".shot-preview");
    if (!(trigger instanceof HTMLButtonElement)) return;
    const index = Number.parseInt(trigger.dataset.previewIndex || "0", 10);
    openLightbox(Number.isNaN(index) ? 0 : index);
  });

  shotLightbox.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-lightbox-close='true']")) {
      closeLightbox();
    }
  });

  lightboxClose?.addEventListener("click", closeLightbox);
  lightboxPrev?.addEventListener("click", () => navigateLightbox(-1));
  lightboxNext?.addEventListener("click", () => navigateLightbox(1));
  document.addEventListener("keydown", (event) => {
    if (shotLightbox.hidden) return;
    if (event.key === "Escape") {
      closeLightbox();
      return;
    }
    if (event.key === "ArrowLeft") {
      navigateLightbox(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      navigateLightbox(1);
    }
  });
}

function initHeroMedia() {
  if (heroShotPreview) {
    renderHeroShot();
    startHeroShotLoop();

    heroShotLink?.addEventListener("mouseenter", stopHeroShotLoop);
    heroShotLink?.addEventListener("mouseleave", startHeroShotLoop);
    heroShotLink?.addEventListener("focusin", stopHeroShotLoop);
    heroShotLink?.addEventListener("focusout", startHeroShotLoop);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopHeroShotLoop();
      } else {
        startHeroShotLoop();
      }
    });
  }

  heroVideoTrigger?.addEventListener("click", openVideoLightbox);
  videoLightbox?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-video-lightbox-close='true']")) {
      closeVideoLightbox();
    }
  });
  videoLightboxClose?.addEventListener("click", closeVideoLightbox);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && videoLightbox && !videoLightbox.hidden) {
      closeVideoLightbox();
    }
  });
}

function initHeader() {
  const sections = [...document.querySelectorAll("main section[id]")];
  const navLinks = [...document.querySelectorAll(".nav a")];

  const activateNav = () => {
    const offset = window.scrollY + 200;
    let current = "";
    sections.forEach((section) => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (offset >= top && offset < top + height) {
        current = section.getAttribute("id") || "";
      }
    });
    navLinks.forEach((link) => {
      const isMatch = link.getAttribute("href") === `#${current}`;
      link.classList.toggle("is-active", isMatch);
    });
  };

  activateNav();
  window.addEventListener("scroll", () => {
    activateNav();
    if (!header) return;
    header.classList.toggle("is-condensed", window.scrollY > 24);
  });
}

function initCounters() {
  const counters = [...document.querySelectorAll("[data-counter]")];
  if (!counters.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = Number(el.getAttribute("data-counter")) || 0;
        const duration = 900;
        const start = performance.now();

        const tick = (now) => {
          const progress = Math.min(1, (now - start) / duration);
          const value = Math.round(progress * target);
          el.textContent = String(value);
          if (progress < 1) {
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
        observer.unobserve(el);
      });
    },
    { threshold: 0.5 }
  );
  counters.forEach((counter) => observer.observe(counter));
}

function initBackgroundParallax() {
  const orbA = document.querySelector(".bg-orb--a");
  const orbB = document.querySelector(".bg-orb--b");
  window.addEventListener("mousemove", (event) => {
    if (!orbA || !orbB || window.matchMedia("(max-width: 980px)").matches) return;
    const x = (event.clientX / window.innerWidth - 0.5) * 12;
    const y = (event.clientY / window.innerHeight - 0.5) * 12;
    orbA.style.transform = `translate(${x}px, ${y}px)`;
    orbB.style.transform = `translate(${-x}px, ${-y}px)`;
  });
}

function initYear() {
  if (currentYear) currentYear.textContent = String(new Date().getFullYear());
}

function bootstrap() {
  initSiteLoader();
  initClickFeedback();
  renderPainPoints();
  renderFeatures();
  renderWorkflow();
  renderScreenshots();

  initDownloadLinks();
  initTheme();
  initReveal();
  initTilt();
  initHeroMedia();
  initScreenshotPreview();
  initHeader();
  initCounters();
  initBackgroundParallax();
  initYear();
}

bootstrap();
