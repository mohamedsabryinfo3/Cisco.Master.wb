/* ==========================================================================
   view-tools.js — subnet calculator, converters, generators
   ========================================================================== */
(function () {
  "use strict";
  const A = window.APP;
  const { State, $, $$, esc } = A;

  /* ------------------------------ helpers ------------------------------ */
  function ipToInt(ip) {
    const p = ip.split(".");
    if (p.length !== 4) return null;
    let n = 0;
    for (let i = 0; i < 4; i++) {
      const v = parseInt(p[i], 10);
      if (isNaN(v) || v < 0 || v > 255 || String(v) !== p[i].trim()) return null;
      n = n * 256 + v;
    }
    return n;
  }
  function intToIp(n) {
    n = n >>> 0;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
  }
  function maskFromPrefix(p) { return p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0; }
  function prefixFromMask(m) {
    let p = 0, n = m >>> 0;
    while (n & 0x80000000) { p++; n = (n << 1) >>> 0; }
    return p;
  }
  function bin32(n) {
    n = n >>> 0;
    let s = "";
    for (let i = 31; i >= 0; i--) s += ((n >>> i) & 1);
    return s;
  }
  function dottedBin(n) {
    const b = bin32(n);
    return [b.slice(0, 8), b.slice(8, 16), b.slice(16, 24), b.slice(24, 32)].join(".");
  }
  function parseInput(str) {
    str = (str || "").trim().replace(/\s+/g, " ");
    let ip = null, prefix = null;
    if (str.indexOf("/") > -1) {
      const [a, b] = str.split("/");
      ip = ipToInt(a.trim());
      prefix = parseInt(b, 10);
    } else {
      const parts = str.split(" ");
      if (parts.length === 2) {
        ip = ipToInt(parts[0]);
        const m = ipToInt(parts[1]);
        if (m !== null) prefix = prefixFromMask(m);
      } else if (parts.length === 1) {
        ip = ipToInt(parts[0]);
        prefix = 24;
      }
    }
    if (ip === null || prefix === null || isNaN(prefix) || prefix < 0 || prefix > 32) return null;
    return { ip: ip, prefix: prefix };
  }

  /* ------------------------------ shared ------------------------------ */
  function stat(lbl, val, hi) {
    return '<div class="stat"><span class="lbl">' + esc(lbl) + '</span>' +
      '<span class="val' + (hi ? " g" : "") + '" style="font-size:15px">' + esc(val) + '</span></div>';
  }

  /* ------------------------------ mask converter ------------------------------ */
  // Accepts "/26", "26", "255.255.255.192" (mask) or "0.0.0.63" (wildcard).
  function parseMaskInput(raw) {
    const s = String(raw == null ? "" : raw).trim().replace(/\s+/g, " ");
    if (!s) return null;
    if (/^\/?\d{1,2}$/.test(s)) {
      const p = parseInt(s.replace("/", ""), 10);
      return p >= 0 && p <= 32 ? { prefix: p, form: "prefix" } : null;
    }
    const m = ipToInt(s);
    if (m === null) return null;
    const p1 = prefixFromMask(m);
    if (maskFromPrefix(p1) === m) return { prefix: p1, form: "mask" };
    const inv = (~m) >>> 0;
    const p2 = prefixFromMask(inv);
    if (maskFromPrefix(p2) === inv) return { prefix: p2, form: "wildcard" };
    return null;
  }

  const MASK_EX = ["/24", "255.255.255.192", "0.0.0.63", "/30", "255.255.255.252", "0.0.0.3"];
  const MASK_FORM = { prefix: "بادئة CIDR", mask: "قناع شبكة", wildcard: "Wildcard" };

  function toolMask() {
    const v = State.maskIn || "255.255.255.192";
    const r = parseMaskInput(v);
    const pref = r ? r.prefix : null;
    return '' +
      '<div class="card">' +
        '<div class="card-h"><div class="card-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h10M4 18h6"/></svg></div>' +
          '<div><b>محوّل القناع / Wildcard / CIDR</b><span>اكتب أي صيغة ويُحوَّل الباقي</span></div></div>' +
        '<div class="card-b">' +
          '<input id="maskIn" class="field mono" value="' + esc(v) + '" placeholder="255.255.255.192 أو /26 أو 0.0.0.63" spellcheck="false">' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px">' +
            MASK_EX.map(x => '<button class="copy-btn" data-mex="' + x + '" type="button" style="font-family:var(--mono)">' + x + '</button>').join("") +
          '</div>' +
          (pref === null
            ? '<div class="note d"><b>صيغة غير مفهومة</b>جرّب قناعاً مثل 255.255.255.0، أو بادئة مثل /24، أو Wildcard مثل 0.0.0.255.</div>'
            : '<div style="margin-top:10px"><span class="chip v">تم التعرف عليه: ' + MASK_FORM[r.form] + '</span></div>' +
              '<div class="grid g3" style="margin-top:10px">' +
                stat("CIDR", "/" + pref, true) +
                stat("Subnet Mask", intToIp(maskFromPrefix(pref))) +
                stat("Wildcard", intToIp((~maskFromPrefix(pref)) >>> 0)) +
              '</div>' +
              '<div class="grid g3" style="margin-top:10px">' +
                stat("العناوين", Math.pow(2, 32 - pref).toLocaleString("en-US")) +
                stat("مضيفون صالحون", (pref >= 31 ? (pref === 32 ? 0 : 2) : Math.pow(2, 32 - pref) - 2).toLocaleString("en-US")) +
                stat("Block Size", Math.pow(2, Math.min(8, 32 - pref)).toLocaleString("en-US")) +
              '</div>' +
              '<div class="note i" style="margin-bottom:0"><b>قاعدة التحويل</b>Wildcard = 255 − كل أوكتيت من القناع. مثال: 255.255.255.192 ← 0.0.0.63. وتذكّر أن <code>0.0.0.0</code> wildcard يعني «أي عنوان» و<code>255.255.255.255</code> قناعاً يعني عنواناً واحداً.</div>') +
        '</div>' +
      '</div>';
  }

  /* ------------------------------ password gen ------------------------------ */
  function genPass(len, upper, lower, digits, symbols) {
    // One character per selected class is guaranteed, otherwise a uniform draw from the
    // merged pool silently skips a class ~10% of the time and Cisco complexity rejects it.
    const sets = [];
    if (upper) sets.push("ABCDEFGHJKLMNPQRSTUVWXYZ");
    if (lower) sets.push("abcdefghijkmnopqrstuvwxyz");
    if (digits) sets.push("23456789");
    if (symbols) sets.push("!@#$%^&*-_=+");
    if (!sets.length) sets.push("abcdefghijkmnopqrstuvwxyz23456789");
    const pool = sets.join("");
    const rnd = function (n) {
      const a = new Uint32Array(1);
      (window.crypto || window.msCrypto).getRandomValues(a);
      return a[0] % n;
    };
    const chars = [];
    for (let i = 0; i < sets.length && chars.length < len; i++) chars.push(sets[i][rnd(sets[i].length)]);
    while (chars.length < len) chars.push(pool[rnd(pool.length)]);
    // shuffle so the guaranteed characters are not parked at the front
    for (let i = chars.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      const t = chars[i]; chars[i] = chars[j]; chars[j] = t;
    }
    return chars.join("");
  }

  function toolPass() {
    const len = State.passLen || 16;
    const p = State.pass || genPass(len, true, true, true, true);
    const opts = State.passOpts || { u: true, l: true, d: true, s: true };
    const strength = Math.min(4, Math.floor(len / 5));
    const bars = ["ضعيف", "متوسط", "جيد", "قوي", "قوي جداً"];
    return '' +
      '<div class="card">' +
        '<div class="card-h"><div class="card-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div>' +
          '<div><b>مولّد كلمات السر</b><span>توليد محلي عبر crypto — لا يُرسل شيء لأي مكان</span></div></div>' +
        '<div class="card-b">' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<input id="passOut" class="field mono" style="flex:1;min-width:200px;font-size:15px;letter-spacing:.5px" value="' + esc(p) + '" readonly>' +
            '<button class="btn btn-primary" id="passCopy" type="button">نسخ</button>' +
            '<button class="btn" id="passNew" type="button">توليد جديد</button>' +
          '</div>' +
          '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:12px">' +
            '<label style="display:flex;align-items:center;gap:7px;font-size:12.5px">الطول <input id="passLen" type="range" min="8" max="40" value="' + len + '" style="accent-color:var(--primary)"><b class="mono" id="passLenV">' + len + '</b></label>' +
            [["u", "ABC"], ["l", "abc"], ["d", "123"], ["s", "!@#"]].map(([k, l]) =>
              '<label style="display:flex;align-items:center;gap:5px;font-size:12px;font-family:var(--mono);cursor:pointer">' +
              '<input type="checkbox" data-popt="' + k + '"' + (opts[k] ? " checked" : "") + ' style="accent-color:var(--primary)">' + l + '</label>').join("") +
          '</div>' +
          '<div class="bar" style="margin-top:14px"><i style="width:' + (strength * 25) + '%;background:' + (strength < 2 ? "var(--rose)" : strength < 3 ? "var(--amber)" : "var(--primary)") + '"></i></div>' +
          '<div style="font-size:11.5px;color:var(--muted);margin-top:4px">القوة: ' + bars[strength] + ' · ' + len + ' حرفاً</div>' +
          '<div class="note w" style="margin-bottom:0"><b>لسيسكو تحديداً</b>تجنّب الأحرف المتشابهة (O/0، l/1، I) لتقليل أخطاء الكتابة في الـ console. وفعّل <code>security passwords min-length 8</code> مع <code>enable algorithm-type scrypt secret</code>.</div>' +
        '</div>' +
      '</div>';
  }

  /* ------------------------------ config builder ------------------------------ */
  const HARDEN = [
    ["hostname", "تسمية الجهاز", "SW-CORE-01"],
    ["domain", "اسم النطاق (لازم لـ SSH)", "corp.local"],
    ["secret", "كلمة سر enable", ""],
    ["ssh", "تفعيل SSHv2 + مستخدم محلي", ""],
    ["banner", "بانر تحذيري", "Authorized access only"],
    ["timeout", "exec-timeout على كل الخطوط", ""],
    ["sync", "logging synchronous", ""],
    ["https", "تعطيل HTTP/HTTPS", ""],
    ["cdp", "تعطيل CDP على الأطراف", ""]
  ];

  function toolConfig() {
    const sel = State.cfgSel || { hostname: true, domain: true, secret: true, ssh: true, banner: true, timeout: true, sync: true, https: true, cdp: false };
    const hn = State.cfgHost || "R1-CORE";
    const dom = State.cfgDom || "corp.local";
    const sec = State.cfgSec || "Str0ng#Pass";
    const lines = [];
    if (sel.hostname) lines.push("hostname " + hn);
    if (sel.domain) lines.push("ip domain-name " + dom);
    if (sel.https) lines.push("no ip http server", "no ip http secure-server");
    if (sel.secret) lines.push("enable algorithm-type scrypt secret " + sec, "service password-encryption", "security passwords min-length 10");
    if (sel.ssh) lines.push(
      "crypto key generate rsa modulus 2048",
      "ip ssh version 2",
      "username admin privilege 15 secret " + sec,
      "line vty 0 4",
      " login local",
      " transport input ssh",
      " exit"
    );
    if (sel.timeout) lines.push("line con 0", " exec-timeout 10 0", " exit", "line vty 0 4", " exec-timeout 10 0", " exit");
    if (sel.sync) lines.push("line con 0", " logging synchronous", " exit");
    if (sel.banner) lines.push("banner motd #" + (State.cfgBan || "Authorized access only. All activity is logged.") + "#");
    if (sel.cdp) lines.push("no cdp run");
    const code = lines.join("\n");

    return '' +
      '<div class="card">' +
        '<div class="card-h"><div class="card-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m4 17 6-6-6-6"/><path d="M12 19h8"/></svg></div>' +
          '<div><b>مولّد إعداد التصليب</b><span>اختر ما تريد ثم انسخ الإعداد جاهزاً</span></div></div>' +
        '<div class="card-b">' +
          '<div class="grid g3" style="margin-bottom:12px">' +
            '<input id="cfgHost" class="field mono" value="' + esc(hn) + '" placeholder="hostname">' +
            '<input id="cfgDom" class="field mono" value="' + esc(dom) + '" placeholder="domain">' +
            '<input id="cfgSec" class="field mono" value="' + esc(sec) + '" placeholder="secret">' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:10px 16px;margin-bottom:14px">' +
            HARDEN.map(([k, l]) =>
              '<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;cursor:pointer">' +
              '<input type="checkbox" data-cfg="' + k + '"' + (sel[k] ? " checked" : "") + ' style="accent-color:var(--primary)">' + esc(l) + '</label>').join("") +
          '</div>' +
          '<div class="cmd-ex"><pre>' + esc(code) + '</pre></div>' +
          '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
            '<button class="btn btn-primary btn-sm" id="cfgCopy" type="button">نسخ الإعداد</button>' +
            '<button class="btn btn-sm" id="cfgAll" type="button">تحديد الكل</button>' +
          '</div>' +
          '<div class="note i" style="margin-bottom:0"><b>تنبيه</b>الأمر <code>crypto key generate rsa</code> يتطلب hostname غير افتراضي وdomain-name. إذا نُفِّذ قبلها سيرفض الجهاز بخطأ.</div>' +
        '</div>' +
      '</div>';
  }

  /* ------------------------------ page ------------------------------ */
  const TOOLS = [
    ["mask", "محوّل القناع", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h10M4 18h6"/></svg>'],
    ["pass", "مولّد كلمات السر", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'],
    ["config", "مولّد الإعداد", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m4 17 6-6-6-6"/><path d="M12 19h8"/></svg>']
  ];

  A.RENDER.tools = function (root) {
    root.innerHTML = '' +
      '<div class="seg" style="position:static;grid-template-columns:repeat(3,1fr);margin-bottom:14px">' +
        TOOLS.map(([id, l, ic]) =>
          '<button class="seg-btn' + (State.tool === id ? " is-on" : "") + '" data-tool="' + id + '" type="button">' + ic + '<span>' + l + '</span></button>').join("") +
      '</div>' +
      '<div id="toolBody"></div>';

    function paint() {
      const body = $("#toolBody");
      if (State.tool === "mask") body.innerHTML = toolMask();
      else if (State.tool === "pass") body.innerHTML = toolPass();
      else body.innerHTML = toolConfig();
      wire();
    }

    function wire() {
      const body = $("#toolBody");

      // mask
      const mi = $("#maskIn", body);
      if (mi) mi.addEventListener("input", A.debounce(function () {
        State.maskIn = mi.value;
        const b2 = $("#toolBody");
        b2.innerHTML = toolMask(); wire();
        const ag = $("#maskIn");
        if (ag) { ag.focus(); ag.setSelectionRange(ag.value.length, ag.value.length); }
      }, 320));
      $$("[data-mex]", body).forEach(b => b.addEventListener("click", function () {
        State.maskIn = b.dataset.mex; paint();
      }));

      // pass
      const pn = $("#passNew", body);
      if (pn) pn.addEventListener("click", function () {
        const o = State.passOpts || { u: true, l: true, d: true, s: true };
        State.pass = genPass(State.passLen || 16, o.u, o.l, o.d, o.s);
        paint();
      });
      const pc = $("#passCopy", body);
      if (pc) pc.addEventListener("click", function () { A.copy($("#passOut").value, "تم نسخ كلمة السر"); });
      const pl = $("#passLen", body);
      if (pl) pl.addEventListener("input", function () {
        State.passLen = +pl.value;
        $("#passLenV").textContent = pl.value;
        const o = State.passOpts || { u: true, l: true, d: true, s: true };
        State.pass = genPass(State.passLen, o.u, o.l, o.d, o.s);
        $("#passOut").value = State.pass;
      });
      $$("[data-popt]", body).forEach(cb => cb.addEventListener("change", function () {
        State.passOpts = State.passOpts || { u: true, l: true, d: true, s: true };
        State.passOpts[cb.dataset.popt] = cb.checked;
        const o = State.passOpts;
        State.pass = genPass(State.passLen || 16, o.u, o.l, o.d, o.s);
        $("#passOut").value = State.pass;
      }));

      // config
      $$("[data-cfg]", body).forEach(cb => cb.addEventListener("change", function () {
        State.cfgSel = State.cfgSel || {};
        State.cfgSel[cb.dataset.cfg] = cb.checked;
        paint();
      }));
      ["cfgHost", "cfgDom", "cfgSec"].forEach(id => {
        const el = $("#" + id, body);
        if (el) el.addEventListener("input", A.debounce(function () {
          if (id === "cfgHost") State.cfgHost = el.value;
          if (id === "cfgDom") State.cfgDom = el.value;
          if (id === "cfgSec") State.cfgSec = el.value;
          paint();
        }, 500));
      });
      const cc = $("#cfgCopy", body);
      if (cc) cc.addEventListener("click", function () {
        const pre = $("#toolBody .cmd-ex pre");
        A.copy(pre.textContent, "تم نسخ الإعداد");
      });
      const ca = $("#cfgAll", body);
      if (ca) ca.addEventListener("click", function () {
        State.cfgSel = {}; HARDEN.forEach(h => State.cfgSel[h[0]] = true); paint();
      });
    }

    $$("[data-tool]", root).forEach(b => b.addEventListener("click", function () {
      State.tool = b.dataset.tool;
      $$("[data-tool]", root).forEach(x => x.classList.toggle("is-on", x === b));
      paint();
    }));

    paint();
  };
})();
