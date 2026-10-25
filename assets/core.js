/* ==========================================================================
   core.js — state, storage, routing, theme, clipboard, helpers
   ========================================================================== */
(function () {
  "use strict";

  const NS = "iosmaster.v2.";
  const Store = {
    get(k, d) {
      try { const v = localStorage.getItem(NS + k); return v === null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) {}
    },
    del(k) { try { localStorage.removeItem(NS + k); } catch (e) {} }
  };

  const State = {
    page: "home",
    // commands
    cq: "",
    csec: "all",
    cgrp: "all",
    cfav: false,
    // questions
    qtrack: "all",
    qtopic: "all",
    qdiff: "all",
    qtype: "all",
    qstatus: "all",
    qq: "",
    // quiz
    quiz: null,
    // plan
    plan: Store.get("plan", {}),
    // progress
    seen: Store.get("seen", {}),
    stats: Store.get("stats", {}),
    favs: Store.get("favs", {}),
    qfavs: Store.get("qfavs", {}),
    // tools
    tool: "mask",
    subnet: "192.168.1.10/24"
  };

  /* ------------------------------ utils ------------------------------ */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      const a = arguments, c = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(c, a), ms);
    };
  }

  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>' + esc(msg);
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 1800);
  }

  async function copy(text, label) {
    if (!text) return false;
    let ok = false;

    // Preferred path: async Clipboard API (needs a secure context + permission).
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { ok = false; }
    }

    // Fallback: hidden textarea + execCommand — works on file:// and when the
    // clipboard permission is denied, as long as we are inside a user gesture.
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        ok = document.execCommand("copy");
        ta.remove();
      } catch (e) { ok = false; }
    }

    toast(ok ? (label || "تم النسخ") : "تعذّر النسخ — انسخ يدوياً");
    return ok;
  }

  /* ------------------------------ theme ------------------------------ */
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    Store.set("theme", t);
  }
  function initTheme() {
    const saved = Store.get("theme", null);
    if (saved) applyTheme(saved);
    else applyTheme(window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme");
    applyTheme(cur === "dark" ? "light" : "dark");
  }

  /* ------------------------------ routing ------------------------------ */
  const PAGES = ["home", "commands", "questions", "subnet", "tools", "reference", "plan"];
  const RENDER = {};

  function go(page, opts) {
    if (PAGES.indexOf(page) < 0) page = "home";
    if (State.page === "questions" && page !== "questions" && State.quiz && !State.quiz.done) {
      // leaving an unfinished quiz: keep it, just warn silently
    }
    // leaving the command page must not leave its drawer floating over the next one
    if (page !== "commands" && typeof window.closeCommandDrawer === "function") {
      window.closeCommandDrawer();
    }
    State.page = page;
    $$(".seg-btn").forEach(b => b.classList.toggle("is-on", b.dataset.page === page));
    const hero = $("#hero");
    if (hero) hero.classList.toggle("hidden", page !== "home");
    const view = $("#view");
    view.innerHTML = "";
    if (RENDER[page]) RENDER[page](view, opts || {});
    window.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
    // keep a deep-link suffix (#commands/c123) when the caller asked for one
    const want = "#" + page + (opts && opts.deep ? "/" + opts.deep : "");
    if (location.hash !== want) history.replaceState(null, "", want);
  }

  function routeFromHash() {
    const raw = location.hash.replace(/^#/, "");
    const cut = raw.indexOf("/");
    const page = (cut > -1 ? raw.slice(0, cut) : raw).split("?")[0];
    const deep = cut > -1 ? raw.slice(cut + 1) : null;
    go(PAGES.indexOf(page) >= 0 ? page : "home", { deep: deep || null, fromHash: true });
  }

  /* ------------------------------ storage helpers ------------------------------ */
  function markSeen(id) {
    if (!State.seen[id]) { State.seen[id] = 1; Store.set("seen", State.seen); }
  }
  function toggleFav(id) {
    if (State.favs[id]) delete State.favs[id]; else State.favs[id] = 1;
    Store.set("favs", State.favs);
    return !!State.favs[id];
  }
  function toggleQFav(id) {
    if (State.qfavs[id]) delete State.qfavs[id]; else State.qfavs[id] = 1;
    Store.set("qfavs", State.qfavs);
    return !!State.qfavs[id];
  }
  function qStat(id) {
    return State.stats[id] || { ok: 0, bad: 0, last: 0 };
  }
  function recordAnswer(id, ok) {
    const s = qStat(id);
    if (ok) s.ok++; else s.bad++;
    s.last = Date.now();
    State.stats[id] = s;
    Store.set("stats", State.stats);
  }

  /* ------------------------------ misc ------------------------------ */
  function modeClass(m) {
    const t = (m || "").toLowerCase();
    if (t.indexOf("privileged") > -1) return "mode-pexec";
    if (t.indexOf("interface") > -1 || t.indexOf("sub-interface") > -1 || t.indexOf("tunnel") > -1) return "mode-iconf";
    if (t.indexOf("router") > -1 || t.indexOf("address-family") > -1 || t.indexOf("route-map") > -1) return "mode-rconf";
    if (t.indexOf("line") > -1) return "mode-lconf";
    if (t.indexOf("vlan") > -1) return "mode-vlan";
    if (t.indexOf("global") > -1) return "mode-gconf";
    if (t.indexOf("exec") > -1) return "mode-pexec";
    if (t.indexOf("أي") > -1 || t.indexOf("any") > -1) return "mode-any";
    return "mode-gconf";
  }

  function stripHtml(s) {
    const d = document.createElement("div");
    d.innerHTML = s || "";
    return (d.textContent || "").replace(/\u00a0/g, " ").trim();
  }

  function plural(n, one, two, many) {
    if (n === 1) return one;
    if (n === 2) return two;
    return many;
  }

  /* ------------------------------ export ------------------------------ */
  window.APP = {
    NS, Store, State, $, $$, esc, debounce, toast, copy,
    applyTheme, initTheme, toggleTheme,
    go, routeFromHash, PAGES, RENDER,
    markSeen, toggleFav, toggleQFav, qStat, recordAnswer,
    modeClass, stripHtml, plural
  };
})();
