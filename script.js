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
    if (rows.length === 0) return;

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
  });
})();
