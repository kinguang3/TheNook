import { allTags, authors, books, getBooksForTopic, getTopic, series } from "./data.js";

const FAVORITES_KEY = "casebook-favorites";
const NOTES_KEY = "casebook-notes";
const RATINGS_KEY = "casebook-ratings";

const state = {
  activeTag: "全部",
  favorites: readStorage(FAVORITES_KEY, []),
  notes: readStorage(NOTES_KEY, {}),
  ratings: readStorage(RATINGS_KEY, {}),
};
let timelineObserver = null;

document.addEventListener("DOMContentLoaded", () => {
  setupRain();

  const page = document.body.dataset.page;
  if (page === "home") {
    renderHomePage();
  }

  if (page === "topic") {
    renderTopicPage();
  }
});

function renderHomePage() {
  renderTagFilters();
  renderTimeline();
  renderCollection();
  setupTimelineProgress();
  setupFootprints();
}

function renderTopicPage() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type");
  const id = params.get("id");

  const topic = getTopic(type, id);
  const topicBooks = getBooksForTopic(type, id).sort((a, b) => a.year - b.year);

  const titleEl = document.querySelector("#topic-title");
  const descriptionEl = document.querySelector("#topic-description");
  const linksEl = document.querySelector("#topic-links");
  const gridEl = document.querySelector("#topic-grid");
  const metaEl = document.querySelector("#topic-meta");

  if (!topic || !titleEl || !descriptionEl || !linksEl || !gridEl || !metaEl) {
    if (titleEl) titleEl.textContent = "未找到对应专题";
    if (descriptionEl) descriptionEl.textContent = "请返回时间线，重新选择作者或系列专题。";
    if (metaEl) metaEl.textContent = "0 条记录";
    return;
  }

  const label = type === "author" ? "作者" : "系列";
  titleEl.textContent = `${topic.name} / ${label}专题`;
  descriptionEl.textContent = topic.summary;
  metaEl.textContent = `${topicBooks.length} 条相关书目`;

  linksEl.innerHTML = "";

  if (type === "author") {
    const relatedSeries = [...new Set(topicBooks.map((book) => book.seriesId).filter(Boolean))];
    relatedSeries.forEach((seriesId) => {
      const seriesTopic = series[seriesId];
      if (!seriesTopic) return;
      linksEl.append(createTopicLink(`系列：${seriesTopic.name}`, `./topic.html?type=series&id=${seriesId}`));
    });
  }

  if (type === "series") {
    const relatedAuthors = [...new Set(topicBooks.map((book) => book.authorId))];
    relatedAuthors.forEach((authorId) => {
      const authorTopic = authors[authorId];
      if (!authorTopic) return;
      linksEl.append(createTopicLink(`作者：${authorTopic.name}`, `./topic.html?type=author&id=${authorId}`));
    });
  }

  topicBooks.forEach((book) => {
    const article = document.createElement("article");
    article.className = "topic-card";
    article.innerHTML = `
      <p class="eyebrow">[${book.year}] ${book.readTime}</p>
      <div class="cover-block ${book.coverTone}">
        <span class="cover-mark">${book.coverMark}</span>
      </div>
      <h3>${book.title}</h3>
      <p>${book.author} / ${book.seriesName}</p>
      <div class="tag-pills">
        ${book.tags.map((tag) => `<span class="tag-pill">${tag}</span>`).join("")}
      </div>
      <p>${escapeHtml(getDisplayNote(book))}</p>
    `;
    gridEl.append(article);
  });
}

function renderTagFilters() {
  const filterRoot = document.querySelector("#tag-filters");
  if (!filterRoot) return;

  const tags = ["全部", ...allTags];
  filterRoot.innerHTML = "";

  tags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tag-button${tag === state.activeTag ? " active" : ""}`;
    button.textContent = tag;
    button.addEventListener("click", () => {
      state.activeTag = tag;
      renderTagFilters();
      renderTimeline();
    });
    filterRoot.append(button);
  });
}

function renderTimeline() {
  const listEl = document.querySelector("#timeline-list");
  const metaEl = document.querySelector("#results-meta");
  if (!listEl || !metaEl) return;

  const filteredBooks = books
    .filter((book) => state.activeTag === "全部" || book.tags.includes(state.activeTag))
    .sort((a, b) => a.year - b.year);

  metaEl.textContent = `${filteredBooks.length} 本书 / 当前筛选：${state.activeTag}`;
  listEl.innerHTML = "";

  filteredBooks.forEach((book, index) => {
    const article = document.createElement("article");
    const layoutSide = index % 2 === 0 ? "left" : "right";
    article.className = `timeline-item ${layoutSide}`;
    article.dataset.bookId = book.id;
    article.innerHTML = `
      <div class="card-layout">
        <div class="cover-block ${book.coverTone}">
          <span class="cover-mark">${book.coverMark}</span>
        </div>

        <div>
          <div class="card-meta">
            <span>[${book.year}]</span>
            <span>${book.readTime}</span>
            <span>${book.author}</span>
          </div>

          <div class="card-title-row">
            <div>
              <h3 class="card-title">${book.title}</h3>
              <p class="meta-text">${book.seriesName}</p>
            </div>
            <button
              type="button"
              class="favorite-button${state.favorites.includes(book.id) ? " active" : ""}"
              data-favorite-id="${book.id}"
            >
              ${state.favorites.includes(book.id) ? "[x] 已收藏" : "[+] 加入收藏"}
            </button>
          </div>

          <div class="card-links">
            <a class="info-link" href="./topic.html?type=author&id=${book.authorId}">作者专题</a>
            ${book.seriesId ? `<a class="info-link" href="./topic.html?type=series&id=${book.seriesId}">系列专题</a>` : ""}
          </div>

          <p class="card-description">${escapeHtml(book.blurb)}</p>

          <div class="tag-pills">
            ${book.tags.map((tag) => `<span class="tag-pill">${tag}</span>`).join("")}
          </div>

          <div class="rating-row">
            <span class="meta-text">评分</span>
            <div class="star-group" data-rating-id="${book.id}">
              ${createStars(book.id)}
            </div>
            <span class="meta-text" data-rating-value="${book.id}">${getBookRating(book)} / 5</span>
          </div>

          <div class="review-box">
            <p class="review-label">读后感</p>
            <textarea
              class="review-textarea"
              data-note-id="${book.id}"
              placeholder="写下你的判断、动机分析或余味。"
            >${escapeHtml(getDisplayNote(book))}</textarea>
            <p class="review-text" data-note-preview="${book.id}">${escapeHtml(getDisplayNote(book))}</p>
          </div>
        </div>
      </div>
    `;
    listEl.append(article);
  });

  bindCardEvents(listEl);
  observeTimelineItems();
}

function bindCardEvents(root) {
  root.querySelectorAll("[data-favorite-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.favoriteId;
      toggleFavorite(id);
      renderTimeline();
      renderCollection();
    });
  });

  root.querySelectorAll("[data-rating-id]").forEach((group) => {
    group.querySelectorAll(".star-button").forEach((star) => {
      star.addEventListener("click", () => {
        const id = group.dataset.ratingId;
        const value = Number(star.dataset.starValue);
        state.ratings[id] = value;
        writeStorage(RATINGS_KEY, state.ratings);
        renderTimeline();
        renderCollection();
      });
    });
  });

  root.querySelectorAll("[data-note-id]").forEach((textarea) => {
    textarea.addEventListener(
      "input",
      debounce(() => {
        const id = textarea.dataset.noteId;
        state.notes[id] = textarea.value.trim();
        writeStorage(NOTES_KEY, state.notes);

        const preview = document.querySelector(`[data-note-preview="${id}"]`);
        if (preview) {
          preview.textContent = getDisplayNote(findBook(id));
        }

        renderCollection();
      }, 220),
    );
  });
}

function renderCollection() {
  const collectionList = document.querySelector("#collection-list");
  const metaEl = document.querySelector("#collection-meta");
  if (!collectionList || !metaEl) return;

  const favoriteBooks = books.filter((book) => state.favorites.includes(book.id));
  metaEl.textContent = favoriteBooks.length ? `${favoriteBooks.length} 本已收藏` : "还没有加入收藏";
  collectionList.innerHTML = "";

  if (!favoriteBooks.length) {
    const empty = document.createElement("div");
    empty.className = "collection-item";
    empty.innerHTML = `
      <div>
        <strong>[ ] 收藏夹为空</strong>
        <p>在时间线中点击“加入收藏”，这里会同步显示你保留下来的案件与读后感。</p>
      </div>
    `;
    collectionList.append(empty);
    return;
  }

  favoriteBooks.forEach((book) => {
    const item = document.createElement("article");
    item.className = "collection-item";
    item.innerHTML = `
      <div>
        <strong>${book.title} / ${book.author}</strong>
        <p>${escapeHtml(getDisplayNote(book))}</p>
      </div>
      <span class="meta-text">${getBookRating(book)} / 5</span>
    `;
    collectionList.append(item);
  });
}

function observeTimelineItems() {
  const items = document.querySelectorAll(".timeline-item");
  if (!items.length) return;

  if (timelineObserver) {
    timelineObserver.disconnect();
  }

  timelineObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          return;
        }

        entry.target.classList.remove("visible");
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -6% 0px" },
  );

  items.forEach((item) => timelineObserver.observe(item));
}

function setupTimelineProgress() {
  const progressEl = document.querySelector("#timeline-progress");
  const timelineEl = document.querySelector("#timeline-root");
  if (!progressEl || !timelineEl) return;

  const update = () => {
    const rect = timelineEl.getBoundingClientRect();
    const total = rect.height + window.innerHeight;
    const visible = clamp(window.innerHeight - rect.top, 0, total);
    progressEl.style.height = `${(visible / total) * 100}%`;
  };

  const onScroll = rafThrottle(update);
  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
}

function setupRain() {
  const canvas = document.querySelector("#rain-layer");
  if (!canvas) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const drops = [];
  let animationId = 0;
  let width = 0;
  let height = 0;
  let density = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const buildDrops = () => {
    density = Math.min(80, Math.floor(window.innerWidth / 22));
    drops.length = 0;

    for (let index = 0; index < density; index += 1) {
      drops.push(createDrop(width, height));
    }
  };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    buildDrops();
  };

  const draw = () => {
    context.clearRect(0, 0, width, height);
    context.lineWidth = 1;

    for (const drop of drops) {
      context.strokeStyle = `rgba(220, 226, 235, ${drop.alpha})`;
      context.beginPath();
      context.moveTo(drop.x, drop.y);
      context.lineTo(drop.x - drop.wind, drop.y + drop.length);
      context.stroke();

      drop.y += drop.speed;
      drop.x -= drop.wind * 0.22;

      if (drop.y > height + 20 || drop.x < -20) {
        Object.assign(drop, createDrop(width, height, true));
      }
    }

    animationId = window.requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener("resize", debounce(resize, 120));

  if (!reducedMotion) {
    draw();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && animationId) {
      window.cancelAnimationFrame(animationId);
      animationId = 0;
      return;
    }

    if (!document.hidden && !animationId && !reducedMotion) {
      draw();
    }
  });
}

function setupFootprints() {
  const layer = document.querySelector("#footprints-layer");
  if (!layer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const STRIDE = 72;
  const HALF_STRIDE = STRIDE / 2;
  const STEP_MS = 1200;
  const FADE_IN_MS = 220;
  const HOLD_MS = 480;
  const FADE_END_MS = 1320;
  const LATERAL = 16;
  const PRINT_W = 34;
  const MAX_OPACITY = 0.5;
  const SPLAY = 14;
  const PATH_INSET = 12;
  const Y_TOP = 120;
  const Y_BOTTOM_GAP = 96;

  const buildPrint = (foot) => {
    const el = document.createElement("div");
    el.className = `footprint foot-${foot}`;
    el.innerHTML = `
      <span class="footprint-toe t1"></span>
      <span class="footprint-toe t2"></span>
      <span class="footprint-toe t3"></span>
      <span class="footprint-toe t4"></span>
      <span class="footprint-sole"></span>
      <span class="footprint-heel"></span>
    `;
    return el;
  };

  const leftEl = buildPrint("left");
  const rightEl = buildPrint("right");
  layer.append(leftEl, rightEl);

  const walker = {
    dir: 1,
    cx: -90,
    gaitMs: 0,
    n: 0,
  };

  const diag = () => {
    const vw = window.innerWidth;
    const x0 = PATH_INSET;
    const y0 = Y_TOP;
    const x1 = vw - PATH_INSET;
    const y1 = Math.max(y0 + 200, document.documentElement.scrollHeight - Y_BOTTOM_GAP);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    return { x0, y0, x1, y1, ux: dx / len, uy: dy / len };
  };

  const footOpacity = (phase) => {
    if (phase >= FADE_END_MS) return 0;
    if (phase < FADE_IN_MS) return phase / FADE_IN_MS;
    if (phase < FADE_IN_MS + HOLD_MS) return 1;
    return 1 - (phase - FADE_IN_MS - HOLD_MS) / (FADE_END_MS - FADE_IN_MS - HOLD_MS);
  };

  let lastFrame = 0;
  const tick = (now) => {
    const dt = Math.min(lastFrame ? now - lastFrame : 16, 48);
    lastFrame = now;

    const { x0, y0, x1, y1, ux, uy } = diag();

    walker.gaitMs += dt;
    while (walker.gaitMs >= STEP_MS) {
      walker.gaitMs -= STEP_MS;
      walker.n += 1;
      const front = walker.cx + walker.dir * (HALF_STRIDE + PRINT_W / 2) * ux;
      if (walker.dir === 1 ? front >= x1 : front <= x0) {
        walker.dir *= -1;
      } else {
        walker.cx += walker.dir * HALF_STRIDE * ux;
      }
    }

    const cy = y0 + ((walker.cx - x0) / (x1 - x0)) * (y1 - y0);

    const lastFoot = walker.n % 2;
    const leftPhase = walker.gaitMs + (lastFoot === 0 ? 0 : STEP_MS);
    const rightPhase = walker.gaitMs + (lastFoot === 1 ? 0 : STEP_MS);

    leftEl.style.opacity = String(footOpacity(leftPhase) * MAX_OPACITY);
    rightEl.style.opacity = String(footOpacity(rightPhase) * MAX_OPACITY);

    const perpX = -uy;
    const perpY = ux;
    const place = (el, along, across) => {
      el.style.left = `${walker.cx + walker.dir * along * ux + across * perpX}px`;
      el.style.top = `${cy + walker.dir * along * uy + across * perpY}px`;
    };
    place(leftEl, lastFoot === 0 ? HALF_STRIDE : -HALF_STRIDE, -LATERAL / 2);
    place(rightEl, lastFoot === 1 ? HALF_STRIDE : -HALF_STRIDE, LATERAL / 2);

    const travelAngle = 90 + (Math.atan2(walker.dir * uy, walker.dir * ux) * 180) / Math.PI;
    leftEl.style.transform = `rotate(${travelAngle - SPLAY}deg)`;
    rightEl.style.transform = `rotate(${travelAngle + SPLAY}deg)`;

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}
function createTopicLink(text, href) {
  const anchor = document.createElement("a");
  anchor.className = "topic-link";
  anchor.href = href;
  anchor.textContent = text;
  return anchor;
}

function createStars(bookId) {
  const score = getBookRating(findBook(bookId));

  return Array.from({ length: 5 }, (_, index) => {
    const value = index + 1;
    return `
      <button
        type="button"
        class="star-button${value <= score ? " active" : ""}"
        data-star-value="${value}"
        aria-label="评分 ${value} 星"
      >★</button>
    `;
  }).join("");
}

function toggleFavorite(id) {
  if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter((entry) => entry !== id);
  } else {
    state.favorites = [...state.favorites, id];
  }

  writeStorage(FAVORITES_KEY, state.favorites);
}

function getBookRating(book) {
  return state.ratings[book.id] ?? book.rating;
}

function getDisplayNote(book) {
  return state.notes[book.id] || book.note;
}

function findBook(id) {
  return books.find((book) => book.id === id);
}

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createDrop(width, height, resetAbove = false) {
  return {
    x: Math.random() * width,
    y: resetAbove ? Math.random() * -height * 0.2 : Math.random() * height,
    length: 10 + Math.random() * 16,
    speed: 3.8 + Math.random() * 4.6,
    wind: 1 + Math.random() * 1.4,
    alpha: 0.08 + Math.random() * 0.18,
  };
}

function debounce(callback, wait) {
  let timeoutId = 0;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), wait);
  };
}

function rafThrottle(callback) {
  let ticking = false;

  return (...args) => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      callback(...args);
      ticking = false;
    });
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
