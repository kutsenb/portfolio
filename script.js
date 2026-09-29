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
// GitHub contributions graph, with a little easter egg
// This is a static site with no backend, so real contribution data is
// fetched client-side from a well-known CORS-enabled community mirror
// (github-contributions-api.jogruber.de, the same source used by several
// open-source "GitHub calendar" widgets) instead of GitHub's own graph
// endpoint, which blocks cross-origin requests. Results are cached in
// localStorage for the day so navigating between pages doesn't refetch.
//
// Clicking (or hovering, or pressing Enter/Space on) the graph plays a
// falling-rain animation across the cells, then scrolls a pixel-font
// message through the same grid for an equal stretch of time, then
// fades back to the real graph. Clicking again mid-run resets it
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
  var RAIN_STEP_MS = 90;
  var RAIN_DURATION_MS = 2300;
  var MESSAGE_STEP_MS = 90;
  var MESSAGE_DURATION_MS = 2300;
  var RESET_DELAY_MS = 700;
  var DROP_SPAWN_CHANCE = 0.16;
  var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var IDLE_LABEL = "GitHub contributions. Activate for a surprise.";
  var PLAYING_LABEL = "Contributions playing an animation. Activate to restore.";

  // ---- Tiny 5x7 pixel font, just enough of it for "I <3 LINDA W" ----
  var FONT_ROWS = {
    "I": ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "N": ["10001", "11001", "10101", "10101", "10011", "10001", "10001"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "heart": ["01010", "11111", "11111", "11111", "01110", "00100", "00000"],
  };
  var GLYPH_GAP = 1;
  var WORD_GAP = 2;
  // Spells "I ♥ LINDA W", one glyph per entry, with the column gap
  // that follows it (a wider gap between words than between letters).
  var MESSAGE_GLYPHS = [
    { glyph: "I", gap: WORD_GAP },
    { glyph: "heart", gap: WORD_GAP },
    { glyph: "L", gap: GLYPH_GAP },
    { glyph: "I", gap: GLYPH_GAP },
    { glyph: "N", gap: GLYPH_GAP },
    { glyph: "D", gap: GLYPH_GAP },
    { glyph: "A", gap: WORD_GAP },
    { glyph: "W", gap: 0 },
  ];

  function buildMessageBitmap() {
    var columns = [];
    MESSAGE_GLYPHS.forEach(function (entry) {
      var rows = FONT_ROWS[entry.glyph];
      var width = rows[0].length;
      for (var col = 0; col < width; col++) {
        var bits = [];
        for (var row = 0; row < DAYS; row++) {
          bits.push(rows[row][col] === "1");
        }
        columns.push(bits);
      }
      for (var g = 0; g < entry.gap; g++) {
        columns.push(new Array(DAYS).fill(false));
      }
    });
    return columns;
  }

  var MESSAGE_BITMAP = buildMessageBitmap();
  var MESSAGE_WIDTH = MESSAGE_BITMAP.length;

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
    var levels = [];
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
      levels.push(day.level);
    });

    ["Mon", "Wed", "Fri"].forEach(function (name, i) {
      var row = i * 2 + 1;
      var label = document.createElementNS(svgNS, "text");
      label.textContent = name;
      label.setAttribute("x", 0);
      label.setAttribute("y", TOP_GUTTER + row * PITCH + CELL * 0.8);
      svg.appendChild(label);
    });

    return { rects: rects, levels: levels };
  }

  function setupEasterEgg(wrap, board) {
    var phase = "idle"; // "idle" | "rain" | "message"
    var timer = null;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function applyLevels(levels) {
      board.rects.forEach(function (rect, i) {
        rect.setAttribute("data-level", levels[i]);
      });
    }

    function reset() {
      clearTimeout(timer);
      phase = "idle";
      applyLevels(board.levels);
      wrap.setAttribute("aria-label", IDLE_LABEL);
      wrap.setAttribute("aria-pressed", "false");
    }

    // One column of rain per tick: each column either has an active drop
    // (a row index that increments every tick) or doesn't; a short fading
    // tail trails two rows behind the bright drop head.
    var dropRows = null;

    function tickRain() {
      var levels = new Array(WEEKS * DAYS).fill(0);
      for (var c = 0; c < WEEKS; c++) {
        if (dropRows[c] == null) {
          if (Math.random() < DROP_SPAWN_CHANCE) dropRows[c] = 0;
        } else {
          dropRows[c] += 1;
          if (dropRows[c] - 2 >= DAYS) dropRows[c] = null;
        }
        var head = dropRows[c];
        if (head == null) continue;
        [
          [head, 4],
          [head - 1, 2],
          [head - 2, 1],
        ].forEach(function (pair) {
          var row = pair[0];
          var level = pair[1];
          if (row >= 0 && row < DAYS) levels[c * DAYS + row] = level;
        });
      }
      applyLevels(levels);
    }

    function runRain(startedAt) {
      tickRain();
      if (Date.now() - startedAt >= RAIN_DURATION_MS) {
        runMessage(Date.now());
      } else {
        timer = setTimeout(function () {
          runRain(startedAt);
        }, RAIN_STEP_MS);
      }
    }

    // Scrolls the pixel-font message leftward through the grid: at t=0
    // its first column sits just off the right edge, and by t=duration
    // its last column has scrolled fully past the left edge.
    function tickMessage(t) {
      var leftEdge = WEEKS - t * (WEEKS + MESSAGE_WIDTH);
      var levels = new Array(WEEKS * DAYS).fill(0);
      for (var c = 0; c < WEEKS; c++) {
        var textCol = Math.round(c - leftEdge);
        if (textCol < 0 || textCol >= MESSAGE_WIDTH) continue;
        var bits = MESSAGE_BITMAP[textCol];
        for (var row = 0; row < DAYS; row++) {
          if (bits[row]) levels[c * DAYS + row] = 4;
        }
      }
      applyLevels(levels);
    }

    function runMessage(startedAt) {
      phase = "message";
      var elapsed = Date.now() - startedAt;
      tickMessage(Math.min(elapsed / MESSAGE_DURATION_MS, 1));
      if (elapsed >= MESSAGE_DURATION_MS) {
        timer = setTimeout(reset, RESET_DELAY_MS);
      } else {
        timer = setTimeout(function () {
          runMessage(startedAt);
        }, MESSAGE_STEP_MS);
      }
    }

    function activate() {
      if (phase !== "idle") {
        reset();
        return;
      }
      wrap.setAttribute("aria-label", PLAYING_LABEL);
      wrap.setAttribute("aria-pressed", "true");
      if (reduceMotion.matches) {
        // Skip the animated build-up; just hold the message briefly.
        phase = "message";
        tickMessage(0.5);
        timer = setTimeout(reset, RAIN_DURATION_MS + MESSAGE_DURATION_MS);
        return;
      }
      phase = "rain";
      dropRows = new Array(WEEKS).fill(null);
      runRain(Date.now());
    }

    wrap.addEventListener("click", activate);
    wrap.addEventListener("pointerenter", function (event) {
      // Only auto-play on a real mouse hover (touch/pen "enter" fires on
      // tap, which would double up with the click handler above).
      if (event.pointerType === "mouse" && phase === "idle") activate();
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
      setupEasterEgg(wrap, board);

      wrap.hidden = false;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          wrap.classList.add("is-ready");
        });
      });
    });
  });
})();
