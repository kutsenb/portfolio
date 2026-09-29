// =========================================================================
// Theme toggle
// Applies a saved theme preference on load (falling back to the visitor's
// OS preference), and lets the sun/moon button in the header flip between
// light and dark, persisting the choice in localStorage.
// =========================================================================

(function () {
  var STORAGE_KEY = "theme";
  var root = document.documentElement;

  function getPreferredTheme() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  function applyTheme(theme) {
    if (theme === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme");
    }
  }

  // Apply immediately so there's no flash of the wrong theme.
  applyTheme(getPreferredTheme());

  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.getElementById("theme-toggle");
    if (!toggle) return;

    toggle.addEventListener("click", function () {
      var isLight = root.getAttribute("data-theme") === "light";
      var next = isLight ? "dark" : "light";
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next);
    });
  });
})();

// =========================================================================
// Project photo thumbnails + lightbox
// Each .photo-row on the page names an image prefix (e.g. "solar"). Since
// this is a static site with no server-side directory listing, we just
// try loading images/<prefix>-1.jpg, -2.jpg, ... up to MAX_PHOTOS and
// keep whichever ones actually exist. That way a project's row fills in
// automatically as photos are added to images/, and a project with none
// yet renders nothing instead of broken image icons.
// =========================================================================

(function () {
  var MAX_PHOTOS_PER_PROJECT = 10;

  function tryLoadPhoto(row, prefix, title, index) {
    return new Promise(function (resolve) {
      var src = "images/" + prefix + "-" + index + ".jpg";
      var probe = new Image();
      probe.onload = function () {
        var thumb = document.createElement("img");
        thumb.src = src;
        thumb.alt = title + " — photo " + index;
        thumb.addEventListener("click", function () {
          openLightbox(src, thumb.alt);
        });
        resolve(thumb);
      };
      probe.onerror = function () {
        resolve(null);
      };
      probe.src = src;
    });
  }

  function loadPhotoRow(row) {
    var prefix = row.getAttribute("data-photos");
    var title = row.getAttribute("data-title") || "";
    if (!prefix) return;

    var attempts = [];
    for (var i = 1; i <= MAX_PHOTOS_PER_PROJECT; i++) {
      attempts.push(tryLoadPhoto(row, prefix, title, i));
    }

    Promise.all(attempts).then(function (thumbs) {
      thumbs.forEach(function (thumb) {
        if (thumb) row.appendChild(thumb);
      });
      if (row.children.length > 0) row.classList.add("has-photos");
    });
  }

  var lightbox, lightboxImg;

  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt;
    lightbox.classList.add("open");
  }

  function closeLightbox() {
    lightbox.classList.remove("open");
    lightboxImg.src = "";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var rows = document.querySelectorAll(".photo-row[data-photos]");
    var mosaicImages = document.querySelectorAll(".mosaic-item img");
    if (rows.length === 0 && mosaicImages.length === 0) return;

    lightbox = document.createElement("div");
    lightbox.className = "lightbox-overlay";
    lightboxImg = document.createElement("img");
    lightbox.appendChild(lightboxImg);
    document.body.appendChild(lightbox);

    lightbox.addEventListener("click", closeLightbox);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeLightbox();
    });

    rows.forEach(loadPhotoRow);

    mosaicImages.forEach(function (img) {
      img.addEventListener("click", function () {
        openLightbox(img.src, img.alt);
      });
    });
  });
})();

// =========================================================================
// GitHub contributions graph, with a Conway's Game of Life easter egg
// This is a static site with no backend, so real contribution data is
// fetched client-side from a well-known CORS-enabled community mirror
// (github-contributions-api.jogruber.de, the same source used by several
// open-source "GitHub calendar" widgets) instead of GitHub's own graph
// endpoint, which blocks cross-origin requests. Results are cached in
// localStorage for the day so navigating between pages doesn't refetch.
//
// Clicking (or pressing Enter/Space on) the graph seeds Conway's Game of
// Life from that real data and plays it for up to 36 generations, fading
// each cell between "dead" and "alive" every 160ms, then settles back to
// the real graph after a short pause. Clicking again mid-run resets it
// immediately. If the data can't be loaded, the widget just stays hidden.
// =========================================================================

(function () {
  var USERNAME = "kutsenb";
  var API_URL = "https://github-contributions-api.jogruber.de/v4/" + USERNAME + "?y=last";
  var CACHE_KEY = "contrib-cache-" + USERNAME;
  var WEEKS = 24;
  var DAYS = 7;
  var CELL = 10;
  var GAP = 2;
  var PITCH = CELL + GAP;
  var LEFT_GUTTER = 22;
  var TOP_GUTTER = 14;
  var MAX_GENERATIONS = 36;
  var STEP_MS = 160;
  var RESET_DELAY_MS = 1500;
  var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var IDLE_LABEL = "GitHub contributions. Activate to bring them to life.";
  var PLAYING_LABEL = "Contributions playing Game of Life. Activate to restore.";

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function dateKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ date: todayKey(), data: data }));
    } catch (e) {
      // Storage is optional (private browsing, quota, etc.) - safe to skip.
    }
  }

  function loadContributions() {
    var cached = readCache();
    if (cached && cached.date === todayKey() && cached.data) {
      return Promise.resolve(cached.data);
    }

    var controller = new AbortController();
    var timeoutId = setTimeout(function () {
      controller.abort();
    }, 8000);

    return fetch(API_URL, { signal: controller.signal })
      .then(function (res) {
        if (!res.ok) throw new Error("bad status");
        return res.json();
      })
      .then(function (json) {
        var data = (json && json.contributions) || [];
        writeCache(data);
        return data;
      })
      .catch(function () {
        return (cached && cached.data) || null;
      })
      .finally(function () {
        clearTimeout(timeoutId);
      });
  }

  // Standard Conway's Game of Life step on a finite (dead-edge) board.
  function nextGeneration(cells, width, height) {
    return cells.map(function (alive, index) {
      var x = index % width;
      var y = Math.floor(index / width);
      var neighbors = 0;
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          var nx = x + dx;
          var ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (cells[ny * width + nx]) neighbors++;
        }
      }
      return neighbors === 3 || Boolean(alive && neighbors === 2);
    });
  }

  function buildGrid(contributions) {
    var byDate = {};
    contributions.forEach(function (entry) {
      byDate[entry.date] = entry;
    });

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    var gridStart = new Date(weekStart);
    gridStart.setDate(gridStart.getDate() - (WEEKS - 1) * 7);

    var days = [];
    for (var c = 0; c < WEEKS; c++) {
      for (var r = 0; r < DAYS; r++) {
        var d = new Date(gridStart);
        d.setDate(d.getDate() + c * 7 + r);
        var key = dateKey(d);
        var entry = byDate[key];
        days.push({
          col: c,
          row: r,
          date: d,
          level: entry ? entry.level : 0,
        });
      }
    }
    return days;
  }

  function renderGraph(svg, days) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var width = LEFT_GUTTER + WEEKS * PITCH;
    var height = TOP_GUTTER + DAYS * PITCH;
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);

    var svgNS = svg.namespaceURI;
    var rects = [];
    var seed = [];
    var lastMonth = null;

    days.forEach(function (day) {
      if (day.row === 0) {
        var month = day.date.getMonth();
        if (month !== lastMonth) {
          lastMonth = month;
          var label = document.createElementNS(svgNS, "text");
          label.textContent = MONTH_NAMES[month];
          label.setAttribute("x", LEFT_GUTTER + day.col * PITCH);
          label.setAttribute("y", TOP_GUTTER - 4);
          svg.appendChild(label);
        }
      }

      var rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", LEFT_GUTTER + day.col * PITCH);
      rect.setAttribute("y", TOP_GUTTER + day.row * PITCH);
      rect.setAttribute("width", CELL);
      rect.setAttribute("height", CELL);
      rect.setAttribute("rx", 2);
      rect.setAttribute("data-level", day.level);
      rect.setAttribute("data-date", dateKey(day.date));
      svg.appendChild(rect);
      rects.push(rect);
      seed.push(day.level > 0);
    });

    ["Mon", "Wed", "Fri"].forEach(function (name, i) {
      var row = i * 2 + 1;
      var label = document.createElementNS(svgNS, "text");
      label.textContent = name;
      label.setAttribute("x", 0);
      label.setAttribute("y", TOP_GUTTER + row * PITCH + CELL * 0.8);
      svg.appendChild(label);
    });

    return { rects: rects, seed: seed };
  }

  function setupGameOfLife(wrap, svg, board) {
    var generation = 0;
    var cells = null;
    var previousCells = null;
    var timer = null;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function reset() {
      clearTimeout(timer);
      generation = 0;
      svg.classList.remove("is-living");
      wrap.setAttribute("aria-label", IDLE_LABEL);
      wrap.setAttribute("aria-pressed", "false");
    }

    function cellsEqual(a, b) {
      for (var i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    }

    function step() {
      previousCells = cells;
      cells = nextGeneration(cells, WEEKS, DAYS);
      generation++;
      svg.classList.add("is-living");
      board.rects.forEach(function (rect, i) {
        rect.classList.toggle("is-alive", cells[i]);
      });
      wrap.setAttribute("aria-label", PLAYING_LABEL);
      wrap.setAttribute("aria-pressed", "true");

      // Stop early once the board dies out or locks into a static shape,
      // rather than silently waiting out the rest of the 36-generation
      // budget on a board that's no longer visibly changing.
      var settled = cellsEqual(cells, previousCells);
      var done = generation >= MAX_GENERATIONS || settled || reduceMotion.matches;
      timer = setTimeout(done ? reset : step, done ? RESET_DELAY_MS : STEP_MS);
    }

    function activate() {
      if (generation) {
        reset();
        return;
      }
      // A real contribution history is often too sparse on its own for
      // Game of Life to do anything interesting - isolated single cells
      // just die of underpopulation in one step. Real active days are
      // always included; a light random scatter on top gives the board
      // enough density to actually ripple for a few seconds before it
      // settles, while still growing out of your real graph each time.
      cells = board.seed.map(function (alive) {
        return alive || Math.random() < 0.13;
      });
      step();
    }

    wrap.addEventListener("click", activate);
    wrap.addEventListener("pointerenter", function (event) {
      // Only auto-play on a real mouse hover (touch/pen "enter" fires on
      // tap, which would double up with the click handler above).
      if (event.pointerType === "mouse" && !generation) activate();
    });
    wrap.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      } else if (event.key === "Escape") {
        reset();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var wrap = document.getElementById("contrib-wrap");
    var svg = document.getElementById("contrib-graph");
    if (!wrap || !svg) return;

    loadContributions().then(function (contributions) {
      if (!contributions) return;

      var days = buildGrid(contributions);
      var board = renderGraph(svg, days);
      setupGameOfLife(wrap, svg, board);

      wrap.hidden = false;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          wrap.classList.add("is-ready");
        });
      });
    });
  });
})();
