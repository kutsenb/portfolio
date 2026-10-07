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
// Language switch (English / Russian)
// English is the page's own markup, so the site reads normally without
// JavaScript. Elements opted in for translation carry one of:
//   data-i18n="key"            replace the element's text
//   data-i18n-html="key"       replace its inner HTML (text with links)
//   data-i18n-attr="a:key;..." replace the named attributes
// The Russian text for each key lives in RU below; the original English is
// remembered per element the first time it is touched, so switching back
// restores it exactly. The choice is saved in localStorage and announced to
// the other modules via a "sitelanguagechange" event; script-generated text
// (graph labels, photo captions) reads from UI instead.
// =========================================================================

(function () {
  var STORAGE_KEY = "lang";
  var root = document.documentElement;
  var originals = new WeakMap();
  var current = "en";

  var RU = {
    "meta.title.home": "Богдан Куценко",
    "meta.desc.home": "Богдан Куценко — студент-механик, интересующийся ИИ и машинным обучением.",
    "meta.title.projects": "Проекты — Богдан Куценко",
    "meta.desc.projects": "Инженерные и программные проекты Богдана Куценко.",
    "meta.title.posts": "Заметки — Богдан Куценко",
    "meta.desc.posts": "Заметки и конспекты прочитанного Богдана Куценко.",
    "meta.title.hobbies": "Хобби — Богдан Куценко",
    "meta.desc.hobbies": "Хобби и увлечения Богдана Куценко.",
    "meta.title.certificates": "Сертификаты — Богдан Куценко",
    "meta.desc.certificates": "Сертификаты, полученные Богданом Куценко.",

    "profile.avatarAlt": "Богдан Куценко",
    "profile.name": "Куценко Богдан",
    "profile.tagline": "Студент-механик с растущим интересом к ИИ и робототехнике.",
    "nav.home": "главная",
    "nav.projects": "проекты",
    "nav.cv": "резюме",
    "nav.posts": "заметки",
    "nav.hobbies": "хобби",
    "aria.email": "Электронная почта",
    "aria.theme": "Переключить светлую и тёмную тему",
    "footer.copy": "© 2026 Куценко Богдан",

    "date.fall2026": "Осень 2026",
    "date.winter2026": "Зима 2026",
    "date.winter2025": "Зима 2025",
    "date.winter2024": "Зима 2024",
    "date.aug2026": "Авг. 2026",
    "date.jan2026": "Янв. 2026",

    "home.hi": "Привет!",
    "home.intro": "Я студент четвёртого курса по специальности «Машиностроение» в Lassonde (Йоркский университет), живу в Торонто. Мне нравится сочетать CAD-проектирование, встраиваемые системы и программирование, чтобы создавать устройства, которые двигаются.",
    "home.learning": "Сейчас изучаю разработку программного обеспечения и машинное обучение, чтобы дополнить ими механическую подготовку.",
    "home.latest": "Последнее:",
    "home.more": "Загляните в мои <a href=\"hobbies.html\">хобби</a>, свежие <a href=\"posts.html\">заметки</a> или <a href=\"certificates.html\">сертификаты</a>.",

    "projects.heading": "Проекты",
    "projects.intro": "Учебные и личные инженерные проекты",
    "proj.portfolio.title": "Персональный сайт-портфолио",
    "proj.portfolio.desc": "Разработал и запустил адаптивный персональный сайт на собственном домене.",
    "proj.solar.title": "Плавучий монитор качества воды на солнечной энергии",
    "proj.solar.desc": "Плавучая платформа с двухосевым слежением за солнцем, которая измеряет pH и температуру воды и передаёт показания на панель мониторинга в реальном времени. Конструкция построена на трёх буях, напечатанных на 3D-принтере. Опыт показал: размещение тяжёлых деталей низко и ближе к ватерлинии важнее, чем подсказывают расчёты.",
    "proj.solar.meta": "SolidWorks · Arduino MKR 1010 · 3D-печать · IoT",
    "proj.security.title": "Автоматизированная система охраны и отслеживания объектов",
    "proj.security.desc": "Система управления на LabVIEW, объединяющая ультразвуковые датчики и оборудование DAQ для двухосевого отслеживания объектов, с задокументированными результатами калибровки и испытаний.",
    "proj.security.meta": "LabVIEW · DAQ · Датчики",
    "proj.rover.title": "Дистанционно управляемый ровер",
    "proj.rover.homeTitle": "Дистанционно управляемый медицинский ровер",
    "proj.rover.desc": "Дистанционно управляемый ровер с рулевым управлением по схеме Аккермана и редуктором собственной конструкции из PLA, который перевозит медицинские материалы по больницам и снижает контакт персонала с зонами повышенного риска. Выяснилось, что крепления рулевого механизма необходимо усилить для работы при полной нагрузке.",
    "proj.rover.meta": "SolidWorks · Arduino · МКЭ-анализ · 3D-печать",
    "proj.plant.title": "Автоматизированная система полива растений",
    "proj.plant.desc": "Программа на Java, которая считывает показания датчика влажности почвы и включает и выключает насос на 12 В, поддерживая влажность почвы в заданном диапазоне; текущие показания выводятся на OLED-дисплей.",

    "posts.heading": "Заметки",
    "posts.intro": "Время от времени пишу о том, что изучаю.",

    "hobbies.heading": "Хобби",
    "hobbies.intro": "В основном поездки, а также другие увлечения.",
    "hobbies.mw.title": "Гора Вашингтон",
    "hobbies.mw.alt1": "Туристы поднимаются по каменной осыпи недалеко от вершины горы Вашингтон; позади долину заполняют облака",
    "hobbies.mw.alt2": "Памятная табличка на вершине горы Вашингтон о рекордной скорости ветра — 231 миля в час (около 372 км/ч)",
    "hobbies.mw.alt3": "Вид на гору Вашингтон с полосой облаков на вершине, с парковки у её подножия",
    "hobbies.mw.alt4": "Скалистый, поросший деревьями хребет горы Вашингтон под пасмурным небом",
    "hobbies.mw.alt5": "Зубчатый скалистый хребет горы Вашингтон за хвойными деревьями",
    "hobbies.mw.alt6": "Водопад, стекающий по крутому скалистому склону горы Вашингтон, частично скрытый туманом",
    "hobbies.mw.alt7": "Домик метеостанции с радиомачтой на тропе к вершине горы Вашингтон среди деревьев",
    "hobbies.mw.alt8": "Скалистый альпийский хребет у вершины горы Вашингтон, частично окутанный низкими облаками",

    "certs.heading": "Сертификаты",
    "certs.whmis.desc": "Сертификат по основам безопасности и работе с опасными материалами.",
    "certs.whmis.meta": "Йоркский университет &middot; ID сертификата 8522131065BK &middot; <a href=\"whmis-2-certificate.pdf\" target=\"_blank\" rel=\"noopener\">Посмотреть сертификат</a>"
  };

  // Text that script.js itself puts on the page, in both languages.
  var UI = {
    en: {
      "lang.code": "RU",
      "lang.label": "Switch language to Russian",
      "photo.word": "photo",
      "graph.months": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      "graph.weekdays": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      "graph.idle": "GitHub contributions. Activate to bring them to life.",
      "graph.playing": "Contributions playing Game of Life. Activate to restore."
    },
    ru: {
      "lang.code": "EN",
      "lang.label": "Переключить на английский язык",
      "photo.word": "фото",
      "graph.months": ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
      "graph.weekdays": ["вс", "пн", "вт", "ср", "чт", "пт", "сб"],
      "graph.idle": "Активность на GitHub. Нажмите, чтобы оживить её.",
      "graph.playing": "Активность на GitHub воспроизводит игру «Жизнь». Нажмите, чтобы вернуть обычный вид."
    }
  };

  function readStored() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      return stored === "ru" || stored === "en" ? stored : "en";
    } catch (e) {
      return "en";
    }
  }

  function writeStored(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      // Storage is optional (private browsing, quota, etc.) - safe to skip.
    }
  }

  function record(el) {
    var rec = originals.get(el);
    if (!rec) {
      rec = { text: el.textContent, html: el.innerHTML, attrs: {} };
      originals.set(el, rec);
    }
    return rec;
  }

  function translate(lang) {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var rec = record(el);
      var ru = RU[el.getAttribute("data-i18n")];
      el.textContent = lang === "ru" && ru != null ? ru : rec.text;
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var rec = record(el);
      var ru = RU[el.getAttribute("data-i18n-html")];
      el.innerHTML = lang === "ru" && ru != null ? ru : rec.html;
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      var rec = record(el);
      el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var colon = pair.indexOf(":");
        var name = pair.slice(0, colon).trim();
        var ru = RU[pair.slice(colon + 1).trim()];
        if (!(name in rec.attrs)) rec.attrs[name] = el.getAttribute(name);
        el.setAttribute(name, lang === "ru" && ru != null ? ru : rec.attrs[name]);
      });
    });
  }

  function setLanguage(lang, persist) {
    current = lang;
    root.setAttribute("lang", lang);
    translate(lang);

    var button = document.getElementById("lang-toggle");
    if (button) {
      button.querySelector(".lang-code").textContent = UI[lang]["lang.code"];
      button.setAttribute("aria-label", UI[lang]["lang.label"]);
      button.setAttribute("title", UI[lang]["lang.label"]);
    }

    if (persist) writeStored(lang);
    document.dispatchEvent(new CustomEvent("sitelanguagechange", { detail: { lang: lang } }));
  }

  window.siteI18n = {
    lang: function () {
      return current;
    },
    ui: function (key) {
      return UI[current][key];
    }
  };

  // This script sits at the end of <body>, so every element it needs
  // already exists and the page can be translated before first paint.
  setLanguage(readStored(), false);

  var toggle = document.getElementById("lang-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      setLanguage(current === "en" ? "ru" : "en", true);
    });
  }
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

  // Caption for a project photo. In Russian the project's (translated)
  // heading is used instead of the English data-title.
  function photoAlt(row, index) {
    var title = row.getAttribute("data-title") || "";
    if (window.siteI18n.lang() !== "en") {
      var heading = row.parentElement && row.parentElement.querySelector("h2");
      if (heading) title = heading.textContent.trim();
    }
    return title + " — " + window.siteI18n.ui("photo.word") + " " + index;
  }

  document.addEventListener("sitelanguagechange", function () {
    document.querySelectorAll(".photo-row img").forEach(function (img) {
      img.alt = photoAlt(img.parentElement, img.getAttribute("data-photo-index"));
    });
  });

  function tryLoadPhoto(row, prefix, index) {
    return new Promise(function (resolve) {
      var src = "images/" + prefix + "-" + index + ".jpg";
      var probe = new Image();
      probe.onload = function () {
        var thumb = document.createElement("img");
        thumb.src = src;
        thumb.setAttribute("data-photo-index", index);
        thumb.alt = photoAlt(row, index);
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
    if (!prefix) return;

    var attempts = [];
    for (var i = 1; i <= MAX_PHOTOS_PER_PROJECT; i++) {
      attempts.push(tryLoadPhoto(row, prefix, i));
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
  var i18n = window.siteI18n;

  function idleLabel() {
    return i18n.ui("graph.idle");
  }

  function playingLabel() {
    return i18n.ui("graph.playing");
  }

  // Month and weekday labels are SVG text; refreshed when the language flips.
  function refreshGraphLabels(svg) {
    var months = i18n.ui("graph.months");
    var weekdays = i18n.ui("graph.weekdays");
    svg.querySelectorAll("text[data-month]").forEach(function (label) {
      label.textContent = months[label.getAttribute("data-month")];
    });
    svg.querySelectorAll("text[data-weekday]").forEach(function (label) {
      label.textContent = weekdays[label.getAttribute("data-weekday")];
    });
  }

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
          label.setAttribute("data-month", month);
          label.textContent = i18n.ui("graph.months")[month];
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

    [1, 3, 5].forEach(function (row) {
      var label = document.createElementNS(svgNS, "text");
      label.setAttribute("data-weekday", row);
      label.textContent = i18n.ui("graph.weekdays")[row];
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
      wrap.setAttribute("aria-label", idleLabel());
      wrap.setAttribute("aria-pressed", "false");
    }

    wrap.setAttribute("aria-label", idleLabel());
    document.addEventListener("sitelanguagechange", function () {
      refreshGraphLabels(svg);
      wrap.setAttribute("aria-label", generation ? playingLabel() : idleLabel());
    });

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
      wrap.setAttribute("aria-label", playingLabel());
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
