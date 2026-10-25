/* ==========================================================================
   boot.js — wiring, quick search palette, keyboard, start
   ========================================================================== */
(function () {
  "use strict";
  const A = window.APP;
  const { State, $, $$, esc } = A;

  A.initTheme();

  /* hero counters always mirror the real dataset */
  (function heroCounts() {
    const cmds = window.COMMANDS.length;
    const qs = window.QBANK.questions.length;
    const secs = window.SECTIONS.filter(s => s.count > 0).length;
    const chips = $$(".hero-chips span");
    if (chips.length) {
      if (chips[0]) chips[0].textContent = cmds + " Command";
      if (chips[1]) chips[1].textContent = qs + " Question";
      if (chips[2]) chips[2].textContent = secs + " Section";
    }
    const ar = n => (n.toLocaleString("ar-EG") || n);
    $$("[data-hn]").forEach(el => {
      el.textContent = ar(el.dataset.hn === "cmd" ? cmds : qs);
    });
  })();

  /* ------------------------------ nav ------------------------------ */
  $$(".seg-btn[data-page]").forEach(b => {
    b.addEventListener("click", () => A.go(b.dataset.page));
  });
  $("#btnTheme").addEventListener("click", A.toggleTheme);
  $("#btnSearch").addEventListener("click", () => openPalette());

  /* ------------------------------ palette ------------------------------ */
  let pIdx = 0, pItems = [];

  function openPalette() {
    const p = $("#palette");
    p.classList.add("open");
    p.setAttribute("aria-hidden", "false");
    const inp = $("#paletteQ");
    inp.value = "";
    renderPalette("");
    setTimeout(() => inp.focus(), 40);
  }
  function closePalette() {
    const p = $("#palette");
    p.classList.remove("open");
    p.setAttribute("aria-hidden", "true");
  }

  function renderPalette(term) {
    const t = term.trim().toLowerCase();
    const box = $("#paletteResults");
    pItems = [];
    pIdx = 0;

    if (!t) {
      // suggestions: popular commands
      const pop = window.COMMANDS.filter(c =>
        ["show ip interface brief", "show running-config", "show version", "switchport mode trunk",
          "ip route", "router ospf process-id", "access-list 1-99", "standby group ip virtual-ip"].some(s => c.synPlain.indexOf(s) === 0)
      ).slice(0, 6);
      pItems = pop.map(c => ({ type: "cmd", c: c }));
      box.innerHTML =
        '<div style="padding:8px 10px 4px;font-size:10.5px;font-weight:800;letter-spacing:.06em;color:var(--muted);text-transform:uppercase">أوامر شائعة</div>' +
        pItems.map((it, i) => prRow(it, i)).join("");
      return;
    }

    const cmds = window.COMMANDS.filter(c =>
      (c.synPlain + " " + c.ar + " " + c.en + " " + c.mode).toLowerCase().indexOf(t) > -1
    ).slice(0, 7).map(c => ({ type: "cmd", c: c }));

    const qs = window.QBANK.questions.filter(q =>
      (A.stripHtml(q.q) + " " + (q.qEn || "") + " " + A.stripHtml(q.ans)).toLowerCase().indexOf(t) > -1
    ).slice(0, 5).map(q => ({ type: "q", q: q }));

    pItems = cmds.concat(qs);
    if (!pItems.length) {
      box.innerHTML = '<div class="palette-empty">لا نتائج لـ «' + esc(term) + '»<br><span style="font-size:11.5px">جرّب كلمة إنجليزية مثل ospf أو trunk</span></div>';
      return;
    }

    let html = "";
    if (cmds.length) {
      html += '<div style="padding:8px 10px 4px;font-size:10.5px;font-weight:800;letter-spacing:.06em;color:var(--muted);text-transform:uppercase">الأوامر</div>';
      html += cmds.map((it, i) => prRow(it, i)).join("");
    }
    if (qs.length) {
      html += '<div style="padding:10px 10px 4px;font-size:10.5px;font-weight:800;letter-spacing:.06em;color:var(--muted);text-transform:uppercase">الأسئلة</div>';
      html += qs.map((it, i) => prRow(it, cmds.length + i)).join("");
    }
    box.innerHTML = html;
    highlight();
  }

  function prRow(it, i) {
    if (it.type === "cmd") {
      const c = it.c;
      return '<div class="pr" data-pi="' + i + '">' +
        '<div class="pr-ico">' + c.no + '</div>' +
        '<div class="pr-txt"><b>' + c.synPlain + '</b><span>' + esc(A.stripHtml(c.ar)).slice(0, 74) + '</span></div>' +
        '<span class="pr-type">أمر</span></div>';
    }
    const q = it.q;
    return '<div class="pr" data-pi="' + i + '">' +
      '<div class="pr-ico" style="color:var(--primary);border-color:var(--primary-line);background:var(--primary-soft)">؟</div>' +
      '<div class="pr-txt"><b style="font-family:var(--font);direction:rtl;text-align:right">' + esc(A.stripHtml(q.q)).slice(0, 70) + '</b>' +
      '<span>' + esc(q.track.toUpperCase()) + ' · ' + esc(q.topic) + '</span></div>' +
      '<span class="pr-type">سؤال</span></div>';
  }

  function highlight() {
    $$(".pr").forEach((el, i) => el.classList.toggle("sel", i === pIdx));
    const sel = $(".pr.sel");
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }

  function activate(i) {
    const it = pItems[i];
    if (!it) return;
    closePalette();
    if (it.type === "cmd") {
      A.go("commands");
      setTimeout(() => window.openCommandDrawer(it.c.i), 160);
    } else {
      State.qq = "";
      State.qstatus = "all";
      State.qtrack = "all";
      State.qtopic = it.q.topic;
      A.go("questions");
      setTimeout(() => A.focusQuestion(it.q.id), 140);
    }
  }

  const pInp = $("#paletteQ");
  pInp.addEventListener("input", A.debounce(function () { renderPalette(pInp.value); }, 90));
  $("#paletteResults").addEventListener("click", function (e) {
    const row = e.target.closest("[data-pi]");
    if (row) activate(+row.dataset.pi);
  });
  $("#palette").addEventListener("click", function (e) {
    if (e.target.closest("[data-pclose]")) closePalette();
  });

  document.addEventListener("keydown", function (e) {
    const pOpen = $("#palette").classList.contains("open");

    if (e.key === "/" && !pOpen) {
      const tag = (document.activeElement.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      e.preventDefault();
      openPalette();
      return;
    }
    if (!pOpen) {
      if (e.key === "Escape") {
        const d = $("#drawer");
        if (d.classList.contains("open")) d.classList.remove("open");
      }
      return;
    }
    if (e.key === "Escape") { closePalette(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); pIdx = Math.min(pItems.length - 1, pIdx + 1); highlight(); }
    if (e.key === "ArrowUp") { e.preventDefault(); pIdx = Math.max(0, pIdx - 1); highlight(); }
    if (e.key === "Enter") { e.preventDefault(); activate(pIdx); }
  });

  /* ------------------------------ start ------------------------------ */
  window.addEventListener("hashchange", A.routeFromHash);
  A.routeFromHash();

  // show a hint once
  if (!A.Store.get("hinted", false)) {
    A.Store.set("hinted", true);
    setTimeout(() => A.toast("اضغط / للبحث السريع في كل شيء"), 900);
  }

  /* ------------------------------ offline (PWA) ------------------------------ */
  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
