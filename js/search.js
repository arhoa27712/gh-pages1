/* Autumn Ridge HOA — expanding header search
   Icon click -> input expands -> live dropdown of matching tags + site content. */
(function () {
  "use strict";

  var wrap = document.getElementById("site-search");
  var toggle = document.getElementById("search-toggle");
  var input = document.getElementById("search-input");
  var box = document.getElementById("search-results");
  if (!wrap || !toggle || !input || !box) return;

  var MAX_CONTENT = 8, MAX_TAGS = 4, active = -1, timer = null;

  /* ---------- Data ---------- */
  var index = null, fields = {};
  function loadIndex() {
    if (index || !window.elasticlunr || !window.searchIndex) return;
    try {
      index = elasticlunr.Index.load(window.searchIndex);
      var boost = { title: 3, description: 2, body: 1 };
      index.getFields().forEach(function (f) { fields[f] = { boost: boost[f] || 1 }; });
    } catch (e) { index = null; }
  }

  var tags = Array.prototype.map.call(
    document.querySelectorAll("#search-tag-data a"),
    function (a) {
      return { name: a.textContent.trim(), url: a.getAttribute("href"),
               count: parseInt(a.getAttribute("data-count"), 10) || 0 };
    });

  /* ---------- Helpers ---------- */
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function terms(q) { return q.toLowerCase().split(/\s+/).filter(Boolean); }
  function mark(text, ts) {
    var out = esc(text);
    ts.forEach(function (t) {
      out = out.replace(new RegExp("(" + esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "<mark>$1</mark>");
    });
    return out;
  }
  function excerpt(body, ts) {
    body = String(body || "").replace(/\s+/g, " ").trim();
    if (!body) return "";
    var low = body.toLowerCase(), pos = -1;
    for (var i = 0; i < ts.length && pos < 0; i++) pos = low.indexOf(ts[i]);
    var start = Math.max(0, pos - 40);
    return (start ? "… " : "") + body.substr(start, 140) + (start + 140 < body.length ? " …" : "");
  }
  function kind(url) {
    var p = url.replace(/^https?:\/\/[^/]+/, "");
    if (p.indexOf("/news/") === 0) return "News";
    if (p.indexOf("/events/") === 0) return "Event";
    if (p.indexOf("/documents") === 0) return "Docs";
    return "Page";
  }

  /* ---------- Search ---------- */
  function findTags(q) {
    var n = q.toLowerCase().replace(/[\s#_-]+/g, "");
    if (!n) return [];
    return tags.filter(function (t) {
      return t.name.toLowerCase().replace(/[\s_-]+/g, "").indexOf(n) !== -1;
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, MAX_TAGS);
  }

  function findContent(q) {
    loadIndex();
    if (!index) return [];
    var opts = { bool: "AND", expand: true, fields: fields };
    var r = index.search(q, opts);
    if (!r.length) { opts.bool = "OR"; r = index.search(q, opts); }
    return r.slice(0, MAX_CONTENT).map(function (x) {
      var d = x.doc || {};
      return { url: x.ref, title: d.title || x.ref, text: d.description || d.body || "", type: kind(x.ref) };
    });
  }

  function render(q) {
    var ts = terms(q), html = "";
    var t = findTags(q), c = findContent(q);

    if (t.length) {
      html += '<div class="search-group">Tags</div>';
      t.forEach(function (x) {
        html += '<a class="search-item is-tag" role="option" href="' + esc(x.url) + '">' +
                  '<span class="search-badge">#</span>' +
                  '<span class="search-body"><span class="search-title">' + mark(x.name, ts) + '</span>' +
                  '<span class="search-text">' + x.count + ' item' + (x.count === 1 ? '' : 's') + '</span></span></a>';
      });
    }
    if (c.length) {
      html += '<div class="search-group">Pages</div>';
      c.forEach(function (x) {
        html += '<a class="search-item" role="option" href="' + esc(x.url) + '">' +
                  '<span class="search-badge">' + x.type + '</span>' +
                  '<span class="search-body"><span class="search-title">' + mark(x.title, ts) + '</span>' +
                  '<span class="search-text">' + mark(excerpt(x.text, ts), ts) + '</span></span></a>';
      });
    }
    if (!html) html = '<div class="search-empty">No results for “' + esc(q) + '”</div>';

    box.innerHTML = html;
    active = -1;
    showResults(true);
  }

  /* ---------- Open / close ---------- */
  function showResults(on) {
    box.hidden = !on;
    input.setAttribute("aria-expanded", on ? "true" : "false");
  }
  function openSearch() {
    wrap.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close search");
    loadIndex();
    setTimeout(function () { input.focus(); }, 50);
  }
  function closeSearch() {
    wrap.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open search");
    input.value = "";
    box.innerHTML = "";
    showResults(false);
  }

  toggle.addEventListener("click", function () {
    wrap.classList.contains("is-open") ? closeSearch() : openSearch();
  });

  /* ---------- Typing / keyboard ---------- */
  input.addEventListener("input", function () {
    clearTimeout(timer);
    var q = input.value.trim();
    if (q.length < 2) { box.innerHTML = ""; showResults(false); return; }
    timer = setTimeout(function () { render(q); }, 100);
  });

  function items() { return box.querySelectorAll(".search-item"); }
  function setActive(i) {
    var list = items(); if (!list.length) return;
    active = (i + list.length) % list.length;
    list.forEach(function (el, n) { el.classList.toggle("is-active", n === active); });
    list[active].scrollIntoView({ block: "nearest" });
  }

  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter") {
      var list = items();
      if (list.length) { e.preventDefault(); location.href = list[active < 0 ? 0 : active].getAttribute("href"); }
    }
    else if (e.key === "Escape") { closeSearch(); toggle.focus(); }
  });

  // Click outside closes; "/" opens from anywhere.
  document.addEventListener("click", function (e) {
    if (wrap.classList.contains("is-open") && !wrap.contains(e.target)) closeSearch();
  });
  document.addEventListener("keydown", function (e) {
    var tag = (document.activeElement || {}).tagName;
    if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
      e.preventDefault(); openSearch();
    }
  });
})();
