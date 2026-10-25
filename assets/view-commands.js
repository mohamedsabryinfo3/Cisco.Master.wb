/* ==========================================================================
   view-commands.js — the command reference page
   ========================================================================== */
(function () {
  "use strict";
  const A = window.APP;
  const { State, $, $$, esc } = A;

  const GROUPS = [
    ["all", "كل المجموعات"],
    ["basics", "الأساسيات"],
    ["switching", "التحويل"],
    ["routing", "التوجيه"],
    ["services", "الخدمات"],
    ["modern", "IPv6 والأتمتة"]
  ];

  let shown = 0;
  let filtered = [];
  let compact = false;

  function matches(c) {
    if (State.csec !== "all" && c.sec !== State.csec) return false;
    if (State.cgrp !== "all" && c.grp !== State.cgrp) return false;
    if (State.cfav && !State.favs[c.i]) return false;
    const q = State.cq.trim().toLowerCase();
    if (!q) return true;
    const hay = (c.synPlain + " " + c.ar + " " + c.en + " " + c.mode + " " + c.neg + " " + c.secAr).toLowerCase();
    return q.split(/\s+/).every(w => hay.indexOf(w) > -1);
  }

  /* ----------------------------- card ----------------------------- */
  // Lab cards carry a lab category in their "mode" slot, not a CLI mode.
  const LAB_CAT = /^(Basic|Switching|Routing|Security|Services)$/;
  function modePill(c) {
    if (LAB_CAT.test(c.mode)) return '<span class="chip v">معمل تطبيقي</span>';
    return '<span class="mode ' + A.modeClass(c.mode) + '">' + esc(c.mode) + '</span>';
  }

  function card(c) {
    const fav = !!State.favs[c.i];
    const isConcept = c.kind === "concept";
    return '' +
      '<article class="cmd" data-i="' + c.i + '">' +
        '<div class="cmd-top">' +
          '<div class="cmd-syn">' + c.syn + '</div>' +
          '<div class="cmd-tools">' +
            modePill(c) +
            (isConcept ? '' : '<button class="copy-btn" data-copy="' + c.i + '" type="button" title="نسخ الأمر">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>نسخ</button>') +
            '<button class="copy-btn" data-open="' + c.i + '" type="button" title="تفاصيل كاملة">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M10 14 21 3M21 14v7H3V3h7"/></svg></button>' +
            '<button class="copy-btn' + (fav ? " done" : "") + '" data-fav="' + c.i + '" type="button" title="إضافة للمفضلة">' +
              '<svg viewBox="0 0 24 24" fill="' + (fav ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2"><path d="m12 3 2.7 5.9 6.3.7-4.7 4.3 1.3 6.1L12 17l-5.6 3 1.3-6.1L3 9.6l6.3-.7Z"/></svg></button>' +
          '</div>' +
        '</div>' +
        '<div class="cmd-body' + (compact ? " hidden" : "") + '">' +
          '<p class="cmd-ar">' + c.ar + '</p>' +
          '<div class="cmd-en"><span class="en-lbl">English</span>' + esc(c.en) + '</div>' +
          (c.ex ? '<div class="cmd-ex"><pre>' + c.ex + '</pre></div>' : '') +
          (c.neg ? '<div class="cmd-neg"><span class="lbl">للإلغاء</span><code>' + esc(c.neg) + '</code></div>' : '') +
          '<div class="cmd-meta"><span class="cmd-sec">' + c.no + ' · ' + esc(c.secEn) + '</span></div>' +
        '</div>' +
      '</article>';
  }

  function paintList(root, reset) {
    const list = $("#cmdList", root);
    if (!list) return;
    filtered = window.COMMANDS.filter(matches);
    shown = reset ? 0 : shown;
    const take = Math.min(filtered.length, shown + 30);
    const slice = filtered.slice(shown, take);
    if (reset) list.innerHTML = slice.map(card).join("");
    else list.insertAdjacentHTML("beforeend", slice.map(card).join(""));
    shown = take;

    const more = $("#cmdMore", root);
    if (more) {
      more.classList.toggle("hidden", shown >= filtered.length);
      more.textContent = "عرض المزيد (" + (filtered.length - shown) + " متبقٍ)";
    }
    const cnt = $("#cmdCount", root);
    if (cnt) cnt.textContent = filtered.length + " أمر";
    const none = $("#cmdEmpty", root);
    if (none) none.classList.toggle("hidden", filtered.length > 0);
  }

  /* ----------------------------- drawer ----------------------------- */
  function openDrawer(i) {
    const c = window.COMMANDS.find(x => x.i === +i);
    if (!c) return;
    const d = $("#drawer");
    $("#drawerTitle").innerHTML = c.syn;
    const related = window.QBANK.questions.filter(q =>
      q.topic === c.sec || (c.sec === "ospf" && q.topic === "ospf")
    ).slice(0, 3);

    $("#drawerBody").innerHTML = '' +
      '<div class="cmd-meta" style="margin-bottom:14px">' +
        modePill(c) +
        '<span class="cmd-sec">' + c.no + ' · ' + esc(c.secAr) + '</span>' +
        (c.kind === "concept" && !LAB_CAT.test(c.mode) ? '<span class="chip v">مفهوم</span>' : '') +
      '</div>' +
      '<p class="cmd-ar">' + c.ar + '</p>' +
      '<div class="cmd-en"><span class="en-lbl">English explanation</span>' + esc(c.en) + '</div>' +
      (c.ex ? '<h4 class="sec-title" style="margin:18px 0 8px;font-size:13px">المثال التطبيقي</h4>' +
        '<div class="cmd-ex"><pre>' + c.ex + '</pre></div>' : '') +
      (c.neg ? '<div class="cmd-neg"><span class="lbl">للإلغاء</span><code>' + esc(c.neg) + '</code></div>' : '') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">' +
        (c.kind === "concept" ? '' : '<button class="btn btn-primary btn-sm" data-dcopy="syn">نسخ الأمر</button>') +
        (c.exPlain ? '<button class="btn btn-sm" data-dcopy="ex">نسخ المثال</button>' : '') +
        '<button class="btn btn-sm" data-dcopy="all">نسخ الكل</button>' +
        '<button class="btn btn-sm" data-share="' + c.i + '">نسخ رابط الأمر</button>' +
      '</div>' +
      (related.length ? '<h4 class="sec-title" style="margin:22px 0 8px;font-size:13px">أسئلة مرتبطة</h4>' +
        '<div style="display:flex;flex-direction:column;gap:7px">' +
          related.map(q => '<button class="btn btn-sm" style="justify-content:flex-start;text-align:start;white-space:normal" data-qgo="' + q.id + '">' + esc(A.stripHtml(q.q)).slice(0, 90) + '…</button>').join("") +
        '</div>' : '');

    d.dataset.cur = c.i;
    d.classList.add("open");
    d.setAttribute("aria-hidden", "false");
  }
  function closeDrawer() {
    const d = $("#drawer");
    d.classList.remove("open");
    d.setAttribute("aria-hidden", "true");
  }

  /* ----------------------------- render ----------------------------- */
  A.RENDER.commands = function (root, opts) {
    const secs = window.SECTIONS.filter(s => s.count > 0);
    root.innerHTML = '' +
      '<div class="toolbar">' +
        '<div class="grow">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
          '<input id="cq" class="field" type="search" placeholder="ابحث عن أمر أو شرح… (مثال: trunk، OSPF، نسخ)" value="' + esc(State.cq) + '" autocomplete="off">' +
        '</div>' +
        '<select id="csec" class="field">' +
          '<option value="all">كل الأقسام</option>' +
          secs.map(s => '<option value="' + s.id + '"' + (State.csec === s.id ? " selected" : "") + '>' + s.no + ' · ' + esc(s.ar) + ' (' + s.count + ')</option>').join("") +
        '</select>' +
        '<select id="cgrp" class="field">' +
          GROUPS.map(g => '<option value="' + g[0] + '"' + (State.cgrp === g[0] ? " selected" : "") + '>' + g[1] + '</option>').join("") +
        '</select>' +
        '<button class="btn btn-sm' + (State.cfav ? " is-on" : "") + '" id="cfav" type="button">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3 2.7 5.9 6.3.7-4.7 4.3 1.3 6.1L12 17l-5.6 3 1.3-6.1L3 9.6l6.3-.7Z"/></svg>المفضلة</button>' +
        '<button class="btn btn-sm" id="ccompact" type="button">' + (compact ? "عرض كامل" : "عرض مضغوط") + '</button>' +
      '</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 2px 10px">' +
        '<span id="cmdCount" class="chip plain">0 أمر</span>' +
        '<span class="chip plain" style="border:none;background:transparent">اضغط <kbd style="font-size:10px;border:1px solid var(--border);padding:1px 5px;border-radius:4px">/</kbd> للبحث السريع</span>' +
      '</div>' +
      '<div id="cmdList" class="cmd-list"></div>' +
      '<div class="empty hidden" id="cmdEmpty"><b>لا نتائج</b><span>جرّب كلمة أقصر أو بالإنجليزية</span></div>' +
      '<div style="text-align:center;margin-top:16px"><button class="btn hidden" id="cmdMore" type="button">عرض المزيد</button></div>';

    paintList(root, true);

    // events
    const q = $("#cq", root);
    q.addEventListener("input", A.debounce(function () { State.cq = q.value; paintList(root, true); }, 140));
    $("#csec", root).addEventListener("change", function () { State.csec = this.value; paintList(root, true); });
    $("#cgrp", root).addEventListener("change", function () { State.cgrp = this.value; paintList(root, true); });
    $("#cfav", root).addEventListener("click", function () {
      State.cfav = !State.cfav;
      this.classList.toggle("is-on", State.cfav);
      paintList(root, true);
    });
    $("#ccompact", root).addEventListener("click", function () {
      compact = !compact;
      this.textContent = compact ? "عرض كامل" : "عرض مضغوط";
      $$(".cmd-body", root).forEach(b => b.classList.toggle("hidden", compact));
    });
    $("#cmdMore", root).addEventListener("click", function () { paintList(root, false); });

    $("#cmdList", root).addEventListener("click", function (e) {
      const copyBtn = e.target.closest("[data-copy]");
      if (copyBtn) {
        const c = window.COMMANDS.find(x => x.i === +copyBtn.dataset.copy);
        A.copy(c.synPlain, "تم نسخ الأمر");
        copyBtn.classList.add("done");
        setTimeout(() => copyBtn.classList.remove("done"), 1200);
        return;
      }
      const favBtn = e.target.closest("[data-fav]");
      if (favBtn) {
        const on = A.toggleFav(favBtn.dataset.fav);
        favBtn.classList.toggle("done", on);
        const svg = favBtn.querySelector("svg");
        if (svg) svg.setAttribute("fill", on ? "currentColor" : "none");
        A.toast(on ? "أُضيف للمفضلة" : "أُزيل من المفضلة");
        if (State.cfav) paintList(root, true);
        return;
      }
      const openBtn = e.target.closest("[data-open]");
      if (openBtn) { openDrawer(openBtn.dataset.open); return; }
    });

    // deep link: #commands/c123 opens that command straight away
    if (opts && opts.deep) {
      const m = /^c(\d+)$/.exec(opts.deep);
      if (m) openDrawer(+m[1]);
    }
  };

  /* drawer global wiring (once) */
  document.addEventListener("DOMContentLoaded", function () {
    const d = $("#drawer");
    d.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) return closeDrawer();
      const b = e.target.closest("[data-dcopy]");
      if (b) {
        const c = window.COMMANDS.find(x => x.i === +d.dataset.cur);
        if (!c) return;
        const k = b.dataset.dcopy;
        if (k === "syn") A.copy(c.synPlain, "تم نسخ الأمر");
        if (k === "ex") A.copy(c.exPlain, "تم نسخ المثال");
        if (k === "all") A.copy(c.synPlain + "\n\n" + A.stripHtml(c.ar) + "\n" + c.en + (c.exPlain ? "\n\n" + c.exPlain : ""), "تم نسخ كل شيء");
        return;
      }
      const sh = e.target.closest("[data-share]");
      if (sh) {
        const url = location.origin + location.pathname + "#commands/c" + sh.dataset.share;
        A.copy(url, "تم نسخ رابط الأمر");
        return;
      }
      const qg = e.target.closest("[data-qgo]");
      if (qg) {
        const id = qg.dataset.qgo;
        const target = window.QBANK.questions.find(x => x.id === id);
        closeDrawer();
        State.qq = "";
        State.qstatus = "all";
        State.qtrack = "all";
        if (target) State.qtopic = target.topic;
        A.go("questions");
        setTimeout(() => A.focusQuestion(id), 140);
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrawer();
    });
  });

  window.openCommandDrawer = openDrawer;
  window.closeCommandDrawer = closeDrawer;
})();
