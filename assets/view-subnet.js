/* ==========================================================================
   view-subnet.js — IOS Master "Subnetting Pro" module.
   Six tabs: محلل الشبكة · مقسّم FLSM · VLSM · أدوات · مرجع دراسي · IPv6.
   All math comes from window.SUBNETCORE (assets/subnet-core.js). Layout/copy
   follow the reference site, extended with Cisco-specific notes.
   ========================================================================== */
(function () {
  "use strict";
  const A = window.APP;
  const C = window.SUBNETCORE;
  const { State, $, $$, esc, debounce, toast, copy } = A;

  /* ------------------------------ state ------------------------------ */
  if (!State.subnetTab) State.subnetTab = "analyzer";
  if (!State.sn) State.sn = "192.168.1.10/24";
  if (!State.sfBase) State.sfBase = "192.168.1.0/24";
  if (!State.sfMode) State.sfMode = "hosts";
  if (!State.sfCount) State.sfCount = "50";
  if (!State.svBase) State.svBase = "192.168.1.0/24";
  if (!State.vRows) State.vRows = [
    { name: "LAN-A", hosts: "60" }, { name: "LAN-B", hosts: "25" },
    { name: "LAN-C", hosts: "10" }, { name: "WAN-1", hosts: "2" }
  ];
  if (!State.ip6) State.ip6 = "2001:db8:1:2::/64";

  const TABS = [
    ["analyzer", "محلل الشبكة", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'],
    ["fldiv", "مقسّم FLSM", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="6" rx="1"/><rect x="3" y="11" width="8" height="6" rx="1"/><rect x="13" y="11" width="8" height="6" rx="1"/></svg>'],
    ["vlsm", "VLSM", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h12M3 18h6"/><circle cx="18" cy="12" r="2"/><circle cx="21" cy="18" r="2"/></svg>'],
    ["tools", "أدوات", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a4 4 0 0 0 5 5L21 21H3l7.3-7.3a4 4 0 0 0 4.4-7.4Z"/></svg>'],
    ["ref", "مرجع دراسي", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2Z"/><path d="M8 7h7M8 11h7"/></svg>'],
    ["ipv6", "IPv6", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>']
  ];

  /* ------------------------------ shared bits ------------------------------ */
  function stat(lbl, val, hi) {
    return '<div class="stat"><span class="lbl">' + esc(lbl) + '</span>' +
      '<span class="val' + (hi ? " g" : "") + '">' + esc(val) + '</span></div>';
  }
  function fmtN(n) {
    if (typeof n === "bigint") return n.toLocaleString("en-US");
    return Number(n).toLocaleString("en-US");
  }
  function svg(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + p + '</svg>'; }

  /* ============================ ANALYZER ============================ */
  function bitGrid(c) {
    const b = C.bin32(c.ip), cf = c.classful || 0, bor = c.borrowed || 0;
    let out = '<div class="bit-grid">';
    for (let i = 0; i < 32; i++) {
      if (i > 0 && i % 8 === 0) out += '<span class="bit-sep"></span>';
      let cls = "b-h";
      if (i < cf) cls = "b-n";
      else if (i < cf + bor) cls = "b-b";
      out += '<span class="bit ' + cls + '">' + b[i] + '</span>';
    }
    out += '</div>';
    const legend = cf
      ? '<span><i class="b-n"></i>Network (' + cf + ' bit)</span>' +
        (bor ? '<span><i class="b-b"></i>مستعارة (' + bor + ' bit)</span>' : '') +
        '<span><i class="b-h"></i>Host (' + (32 - c.prefix) + ' bit)</span>'
      : '<span><i class="b-n"></i>Network (' + c.prefix + ' bit)</span>' +
        '<span><i class="b-h"></i>Host (' + (32 - c.prefix) + ' bit)</span>';
    return out + '<div class="legend">' + legend + '</div>';
  }

  function analyzerView() {
    const p = C.parseInput(State.sn);
    const inv = !p || !p.ok;
    let a = null;
    if (!inv) a = C.analyze(p.ip, p.prefix);

    const headerChips = [
      ["CIDR", "analyzer"], ["Wildcard", "tools"], ["VLSM", "vlsm"], ["FLSM", "fldiv"],
      ["IPv4 Classes", "ref"], ["RFC 1918", "ref"], ["RFC 3021", "ref"]
    ].map(function (c) {
      return '<button class="copy-btn" data-jump="' + c[1] + '" type="button">' + c[0] + '</button>';
    }).join("");

    const ex = ["192.168.1.10/24", "10.0.0.5/8", "172.16.5.3/22", "192.168.10.130/26", "10.10.10.0/30", "203.0.113.7/29"];
    const exBtns = ex.map(function (x) {
      return '<button class="copy-btn" data-ex="' + x + '" type="button" style="font-family:var(--mono)">' + x + '</button>';
    }).join("");

    return '' +
      '<div class="card subnet-hero">' +
        '<div class="subnet-hero-in">' +
          '<b>وحدة Subnetting الاحترافية</b>' +
          '<span>حلّل أي عنوان IP، قسّم الشبكات، نفّذ VLSM — كله بالعربية، محلياً في متصفحك.</span>' +
        '</div>' +
        '<div class="subnet-chips">' + headerChips + '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-h"><div class="card-ico">' + svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>') + '</div>' +
          '<div><b>محلل الشبكة</b><span>صيغ مدعومة: 192.168.1.0/24 — 10.0.0.5 255.0.0.0 — 172.16.5.3/22</span></div></div>' +
        '<div class="card-b">' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<input id="snIn" class="field mono" style="flex:1;min-width:240px" value="' + esc(State.sn) + '" placeholder="192.168.1.10/24 أو 10.0.0.5 255.0.0.0" spellcheck="false">' +
            '<button class="btn btn-primary" id="snCopy" type="button">نسخ الكل</button>' +
          '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px">' + exBtns + '</div>' +
          (inv ? '<div class="note d" style="margin-top:12px"><b>إدخال غير صالح</b>' + (p && p.error ? esc(p.error) : "تأكد من الصيغة.") + '</div>' : '') +
        '</div>' +
      '</div>' +

      (inv ? "" : analyzerResults(a, p));
  }

  function analyzerResults(a, p) {
    const scopeCls = "chip " + (a.scope.cls || "g");
    const scopeTxt = a.scope.label;
    const klassLine = '<span class="chip">Class ' + a.klass + '</span>' +
      '<span class="chip">/' + a.prefix + ' CIDR</span>' +
      (a.priv ? '<span class="chip t">خاص RFC 1918</span>' : '<span class="chip a">عنوان عام</span>') +
      (p.mode === "wildcard" ? '<span class="chip v">قرئ كـ Wildcard</span>' : '') +
      (p.mode === "classful" ? '<span class="chip v">صنفي افتراضي</span>' : '') +
      (a.prefix === 31 ? '<span class="chip v">point-to-point /31</span>' : '') +
      (a.prefix === 32 ? '<span class="chip v">host route /32</span>' : '');

    const step = '<div class="step"><b>1.</b> عنوان IP بالثنائي:<br><code class="mono">' + C.dottedBin(a.ip) + '</code></div>' +
      '<div class="step"><b>2.</b> القناع بالثنائي:<br><code class="mono">' + C.dottedBin(a.mask) + '</code></div>' +
      '<div class="step"><b>3.</b> IP <b>AND</b> Mask = عنوان الشبكة:<br><code class="mono">' + C.dottedBin(a.net) + '</code></div>' +
      '<div class="step"><b>4.</b> عكس القناع = Wildcard (للـ ACL و OSPF):<br><code class="mono">' + C.dottedBin(a.wildcard) + '</code></div>' +
      '<div class="step"><b>5.</b> الشبكة <b>OR</b> Wildcard = عنوان البث:<br><code class="mono">' + C.dottedBin(a.bcast) + '</code></div>' +
      '<div class="step"><b>6.</b> أول مضيف = شبكة +1 ، آخر مضيف = بث −1 (عدا /31 و/32).</div>' +
      '<div class="step"><b>7.</b> عدد المضيفين الصالحين = 2<sup>' + a.hostBits + '</sup> − 2 = <b>' + fmtN(a.usable) + '</b>.</div>';

    return '' +
      '<div class="grid g4" style="margin-top:12px">' +
        stat("عنوان الشبكة", a.netIp, true) +
        stat("القناع", a.maskIp) +
        stat("Wildcard (Cisco)", a.wildcardIp) +
        stat("عنوان البث", a.bcastIp) +
        stat("أول IP مضيف", a.firstIp) +
        stat("آخر IP مضيف", a.lastIp) +
        stat("عدد المضيفين", fmtN(a.usable)) +
        stat("إجمالي العناوين", fmtN(a.total)) +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0">' + scopeCls + ' ' + scopeTxt + '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0">' + klassLine + '</div>' +

      '<div class="card" style="margin-top:4px">' +
        '<div class="card-h"><div class="card-ico">' + svg('<path d="M4 7h16M4 12h16M4 17h16"/>') + '</div>' +
          '<div><b>التمثيل البصري للبتات (32-bit)</b><span>أزرق = الشبكة · كهرماني = البتات المستعارة · رمادي = المضيف</span></div></div>' +
        '<div class="card-b">' + bitGrid(a) +
          '<div style="margin-top:14px"><table class="bin-table">' +
            '<tr><td>IP</td><td>' + C.dottedBin(a.ip) + '</td></tr>' +
            '<tr><td>Mask</td><td>' + C.dottedBin(a.mask) + '</td></tr>' +
            '<tr><td>Network</td><td class="net">' + C.dottedBin(a.net) + '</td></tr>' +
            '<tr><td>Broadcast</td><td class="host">' + C.dottedBin(a.bcast) + '</td></tr>' +
          '</table></div>' +
          '<div class="note i" style="margin-bottom:0"><b>عنوان لكل شبكة فرعية (Block Size)</b>يساوي 2<sup>' + a.hostBits + '</sup> = ' + fmtN(a.blockSize) +
            '. يُستخدم لتحديد حجم كل شريحة عند التقسيم. بالصنف C: /26 → 64، فتتكرر الشبكات 0، 64، 128، 192.</div>' +
        '</div>' +
      '</div>' +

      '<div class="card" style="margin-top:12px">' +
        '<div class="card-h"><div class="card-ico">' + svg('<path d="M3 12h18"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="12" r="2"/>') + '</div>' +
          '<div><b>تصوّر نطاق العناوين</b><span>من الشبكة إلى البث</span></div></div>' +
        '<div class="card-b"><div class="rng-bar">' +
          '<div class="rng-net"><div class="rng-l">Network</div><div class="mono">' + a.netIp + '</div></div>' +
          '<div class="rng-use"><div class="rng-l">Usable Range</div><div class="mono">' + a.firstIp + ' — ' + a.lastIp + '</div><div class="rng-s">' + fmtN(a.usable) + ' عنوان</div></div>' +
          '<div class="rng-bc"><div class="rng-l">Broadcast</div><div class="mono">' + a.bcastIp + '</div></div>' +
        '</div></div>' +
      '</div>' +

      '<div class="card" style="margin-top:12px">' +
        '<details class="acc">' +
          '<summary>الحل خطوة بخطوة</summary>' +
          '<div class="acc-b">' + step + '</div>' +
        '</details>' +
      '</div>';
  }

  /* ============================ FLSM DIVIDER ============================ */
  function fldivView() {
    const p = C.parseInput(State.sfBase);
    const inv = !p || !p.ok;
    let info = null, rows = [], err = "";
    if (!inv) {
      const base = C.analyze(p.ip, p.prefix);
      if (State.sfMode === "hosts") {
        const r = C.splitByHosts(p.ip, p.prefix, parseInt(State.sfCount, 10) || 1);
        if (!r.ok) err = r.error; else { info = r; rows = C.rowsFor(base.net, r.prefix, r.count); }
      } else {
        const r = C.splitByNetworks(p.ip, p.prefix, parseInt(State.sfCount, 10) || 1);
        if (!r.ok) err = r.error; else { info = r; rows = C.rowsFor(base.net, r.prefix, r.count); }
      }
    }

    const seg = '<div class="seg seg-in" style="grid-template-columns:1fr 1fr">' +
      '<button class="seg-btn' + (State.sfMode === "hosts" ? " is-on" : "") + '" data-sfm="hosts" type="button"><span>حسب الأجهزة</span></button>' +
      '<button class="seg-btn' + (State.sfMode === "networks" ? " is-on" : "") + '" data-sfm="networks" type="button"><span>حسب الشبكات</span></button>' +
      '</div>';

    const body = inv ? '<div class="note d"><b>إدخال غير صالح</b>' + (p && p.error ? esc(p.error) : "") + '</div>' :
      (err ? '<div class="note d"><b>تعذّر التقسيم</b>' + esc(err) + '</div>' :
      (function () {
        const csv = "#,Network,CIDR,First Host,Last Host,Broadcast,Mask,Hosts\n" + rows.map(function (r) {
          return [r.idx, r.netIp, "/" + r.prefix, r.firstIp, r.lastIp, r.bcastIp, r.maskIp, fmtN(r.usable)].join(",");
        }).join("\n");
        return '' +
          '<div class="mini-stats">' +
            stat("Base", info.base.netIp) +
            stat("البريفيكس لكل شبكة", "/" + info.prefix, true) +
            stat("عدد الشبكات", fmtN(info.count)) +
            stat("مضيف صالح/شبكة", fmtN(info.usable)) +
            (info.wasted ? stat("عناوين مهدورة", fmtN(info.wasted)) : '') +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px">' +
            '<button class="btn btn-primary btn-sm" data-copy="' + esc(csv) + '" type="button">نسخ الكل</button>' +
            '<button class="btn btn-sm" data-csv="' + esc(csv) + '" type="button">CSV</button>' +
          '</div>' +
          '<div class="table-wrap"><table class="vtable"><thead><tr>' +
            '<th>#</th><th>Network</th><th>CIDR</th><th>First Host</th><th>Last Host</th><th>Broadcast</th><th>Mask</th><th>Hosts</th>' +
            '</tr></thead><tbody>' +
            rows.map(function (r) {
              return '<tr><td>' + r.idx + '</td><td class="mono">' + r.netIp + '</td><td class="mono g">' + "/" + r.prefix +
                '</td><td class="mono">' + r.firstIp + '</td><td class="mono">' + r.lastIp + '</td><td class="mono">' + r.bcastIp +
                '</td><td class="mono">' + r.maskIp + '</td><td class="mono">' + fmtN(r.usable) + '</td></tr>';
            }).join("") +
            '</tbody></table></div>' +
          '<div class="note i" style="margin-bottom:0"><b>FLSM</b> كل الشبكات الفرعية بنفس الحجم. إذا احتجت أحجاماً مختلفة استخدم تبويب <b>VLSM</b> لتقليل الهدر.</div>';
      })());

    return '' +
      '<div class="card">' +
        '<div class="card-h"><div class="card-ico">' + svg('<rect x="3" y="3" width="18" height="6" rx="1"/><rect x="3" y="11" width="8" height="6" rx="1"/><rect x="13" y="11" width="8" height="6" rx="1"/>') + '</div>' +
          '<div><b>مقسّم الشبكات (FLSM)</b><span>أدخل الشبكة الأساسية واختر طريقة التقسيم — كل شبكة بنفس الحجم.</span></div></div>' +
        '<div class="card-b">' +
          '<label style="font-size:12px;color:var(--muted);font-weight:700">الشبكة الأساسية (Base Network)</label>' +
          '<input id="sfBase" class="field mono" style="margin:7px 0 12px" value="' + esc(State.sfBase) + '" placeholder="192.168.1.0/24" spellcheck="false">' +
          seg +
          '<div style="margin-top:12px">' +
            (State.sfMode === "hosts"
              ? '<label style="font-size:12px;color:var(--muted);font-weight:700">عدد الأجهزة في كل شبكة</label><input id="sfCount" class="field mono" style="margin-top:7px" value="' + esc(State.sfCount) + '" placeholder="50">'
              : '<label style="font-size:12px;color:var(--muted);font-weight:700">عدد الشبكات الفرعية المطلوبة</label><input id="sfCount" class="field mono" style="margin-top:7px" value="' + esc(State.sfCount) + '" placeholder="4">') +
          '</div>' +
        '</div>' +
      '</div>' +
      (body ? '<div style="margin-top:14px">' + body + '</div>' : '');
  }

  /* ============================ VLSM ============================ */
  function vlsmView() {
    const p = C.parseInput(State.svBase);
    const inv = !p || !p.ok;
    const rowsHtml = State.vRows.map(function (r, i) {
      return '<tr data-vi="' + i + '">' +
        '<td class="mono g">' + (i + 1) + '</td>' +
        '<td><input class="field mono sm" data-vn="' + i + '" value="' + esc(r.name) + '" placeholder="LAN-A"></td>' +
        '<td><input class="field mono sm" data-vh="' + i + '" value="' + esc(r.hosts) + '" placeholder="60"></td>' +
        '<td style="text-align:center"><button class="icon-btn-x" data-vdel="' + i + '" type="button" title="حذف">✕</button></td>' +
        '</tr>';
    }).join("");

    let body = "";
    if (inv) body = '<div class="note d"><b>إدخال غير صالح</b>' + (p && p.error ? esc(p.error) : "") + '</div>';
    else {
      const reqs = State.vRows.map(function (r) { return { name: r.name, hosts: r.hosts }; });
      const r = C.vlsm(p.ip, p.prefix, reqs);
      if (!r.ok) body = '<div class="note d"><b>تعذّر التخصيص</b>' + esc(r.error) + '</div>';
      else {
        const csv = "#,Name,Requested,Assigned,Network,CIDR,First Host,Last Host,Broadcast,Mask\n" + r.rows.map(function (x) {
          return [x.idx, x.name, x.asked, fmtN(x.usable), x.netIp, "/" + x.prefix, x.firstIp, x.lastIp, x.bcastIp, x.maskIp].join(",");
        }).join("\n");
        body = '' +
          '<div class="mini-stats">' +
            stat("الشبكة الأساسية", r.base.netIp) +
            stat("إجمالي المطلوب", fmtN(r.reqTotal)) +
            stat("إجمالي المُخصّص", fmtN(r.allocTotal)) +
            stat("الكفاءة", r.efficiency + "%", true) +
            stat("المتبقي", fmtN(r.remaining)) +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px">' +
            '<button class="btn btn-primary btn-sm" data-copy="' + esc(csv) + '" type="button">نسخ الكل</button>' +
            '<button class="btn btn-sm" data-csv="' + esc(csv) + '" type="button">CSV</button>' +
          '</div>' +
          '<div class="table-wrap"><table class="vtable"><thead><tr>' +
            '<th>#</th><th>الاسم</th><th>طلب</th><th>حصل</th><th>Network</th><th>CIDR</th><th>First</th><th>Last</th><th>Broadcast</th><th>Mask</th>' +
            '</tr></thead><tbody>' +
            r.rows.map(function (x) {
              return '<tr><td>' + x.idx + '</td><td class="mono">' + esc(x.name) + '</td><td class="mono">' + x.asked +
                '</td><td class="mono g">' + fmtN(x.usable) + '</td><td class="mono">' + x.netIp + '</td><td class="mono g">/' + x.prefix +
                '</td><td class="mono">' + x.firstIp + '</td><td class="mono">' + x.lastIp + '</td><td class="mono">' + x.bcastIp +
                '</td><td class="mono">' + x.maskIp + '</td></tr>';
            }).join("") +
            '</tbody></table></div>' +
          '<div class="note i" style="margin-bottom:0"><b>VLSM</b> رتّب المتطلبات تنازلياً (يحدث تلقائياً) وابدأ من أكبر شبكة لمنع التداخل والثقوب. الكفاءة = المطلوب ÷ المُخصّص.</div>';
      }
    }

    return '' +
      '<div class="card">' +
        '<div class="card-h"><div class="card-ico">' + svg('<path d="M3 6h18M3 12h12M3 18h6"/><circle cx="18" cy="12" r="2"/><circle cx="21" cy="18" r="2"/>') + '</div>' +
          '<div><b>تقسيم VLSM (أطوال متغيرة)</b><span>شبكات بأحجام مختلفة — يُرتَّب التنازلي تلقائياً ترشيداً للعناوين.</span></div></div>' +
        '<div class="card-b">' +
          '<label style="font-size:12px;color:var(--muted);font-weight:700">الشبكة الأساسية</label>' +
          '<input id="svBase" class="field mono" style="margin:7px 0 12px" value="' + esc(State.svBase) + '" placeholder="192.168.1.0/24" spellcheck="false">' +
          '<div class="table-wrap"><table class="vtable"><thead><tr><th>#</th><th>الاسم</th><th>عدد الأجهزة</th><th></th></tr></thead><tbody id="vRows">' + rowsHtml + '</tbody></table></div>' +
          '<button class="btn btn-sm" id="vAdd" type="button" style="margin-top:8px">+ إضافة شبكة</button>' +
        '</div>' +
      '</div>' +
      (body ? '<div style="margin-top:14px">' + body + '</div>' : '');
  }

  /* ============================ TOOLS ============================ */
  function toolsView() {
    const fmts = C.formats(C.ipToInt("192.168.1.10"));
    const convBox = '<div class="conv">' +
      '<input id="convIn" class="field mono" value="192.168.1.10" spellcheck="false">' +
      '<div class="conv-grid">' +
        convRow("Decimal", fmts.dotted) +
        convRow("Binary", fmts.binary) +
        convRow("Hex", fmts.hex) +
        convRow("Long", String(fmts.decimal)) +
      '</div></div>';

    const binConv = '<div class="conv2">' +
      '<div><label>Binary → IP</label><input id="b2i" class="field mono" placeholder="11000000.10101000.00000001.00001010"><div class="mono out" id="b2iOut">—</div></div>' +
      '<div><label>IP → Binary</label><input id="i2b" class="field mono" value="192.168.1.10"><div class="mono out" id="i2bOut">—</div></div>' +
      '</div>';

    const quick = '<div class="conv2">' +
      '<div><label>كم جهاز تحتاج في الشبكة؟</label><input id="qHosts" class="field mono" value="50"><div class="mono out" id="qHostsOut">—</div></div>' +
      '<div><label>كم شبكة فرعية تريد؟</label><input id="qNets" class="field mono" value="8"><div class="mono out" id="qNetsOut">—</div></div>' +
      '</div>';

    const maskRows = [];
    for (let i = 0; i <= 32; i++) {
      const m = C.prefixToMask(i);
      const hosts = i >= 31 ? (i === 32 ? 1 : 2) : Math.pow(2, 32 - i) - 2;
      maskRows.push('<tr><td class="mono g">/' + i + '</td><td class="mono">' + C.intToIp(m) + '</td><td class="mono">' + C.dottedBin(m) + '</td><td class="mono">' + fmtN(hosts) + '</td></tr>');
    }
    const maskTable = '<div class="table-wrap" style="max-height:360px;overflow:auto"><table class="vtable"><thead><tr><th>Prefix</th><th>Subnet Mask</th><th>Binary</th><th>Hosts</th></tr></thead><tbody>' + maskRows.join("") + '</tbody></table></div>';

    return '' +
      '<div class="card">' +
        '<div class="card-h"><div class="card-ico">' + svg('<path d="M4 6h16M4 12h10M4 18h6"/>') + '</div>' +
          '<div><b>محوّل صيغ الـ IP</b><span>حوّل أي عنوان بين Decimal · Binary · Hex · Long.</span></div></div>' +
        '<div class="card-b">' + convBox + '</div>' +
      '</div>' +

      '<div class="card" style="margin-top:14px">' +
        '<div class="card-h"><div class="card-ico">' + svg('<path d="M4 4h16v16H4z"/><path d="M9 9h6v6H9z"/>') + '</div>' +
          '<div><b>Binary ↔ IP</b><span>تحويل مباشر في الاتجاهين.</span></div></div>' +
        '<div class="card-b">' + binConv + '</div>' +
      '</div>' +

      '<div class="card" style="margin-top:14px">' +
        '<div class="card-h"><div class="card-ico">' + svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6"/>') + '</div>' +
          '<div><b>حاسبة البريفيكس السريعة</b><span>أجهزة أو شبكات → البريفيكس والبتات اللازمة.</span></div></div>' +
        '<div class="card-b">' + quick + '</div>' +
      '</div>' +

      '<div class="card" style="margin-top:14px">' +
        '<div class="card-h"><div class="card-ico">' + svg('<path d="M3 5h18M3 10h18M3 15h18M3 20h18"/>') + '</div>' +
          '<div><b>جدول كل الأقنعة (0 — 32)</b><span>مرجع كامل مع التمثيل الثنائي.</span></div></div>' +
        '<div class="card-b">' + maskTable + '</div>' +
      '</div>';
  }
  function convRow(l, v) {
    return '<div class="conv-row"><span class="conv-l">' + l + '</span><span class="mono conv-v" data-conv="' + esc(v) + '">' + esc(v) + '</span>' +
      '<button class="copy-btn sm" data-ccopy="' + esc(v) + '" type="button">نسخ</button></div>';
  }

  /* ============================ STUDY REFERENCE ============================ */
  function refView() {
    const formulas = [
      ["عدد المضيفين الصالحين لكل شبكة", "2<sup>host bits</sup> − 2", "نطرح 2 لعنوان الشبكة والبث. لـ /31 (PtP) يبقى 2 وفق RFC 3021."],
      ["عدد الشبكات الفرعية الممكنة", "2<sup>borrowed bits</sup>", "البتات المستعارة = البريفيكس الجديد − الأصلي."],
      ["حجم الـ Block", "2<sup>(32 − prefix)</sup>", "عدد العناوين الكلي في كل شبكة فرعية شامل الشبكة والبث."],
      ["Wildcard Mask (Cisco)", "255.255.255.255 − mask", "عكس القناع، يُستخدم في ACLs و OSPF."],
      ["عند طلب N جهازاً", "host bits = ⌈log₂(N+2)⌉", "والبريفيكس = 32 − host bits."],
      ["عند طلب M شبكة", "borrow = ⌈log₂(M)⌉", "والبريفيكس = الأصلي + borrow."]
    ].map(function (f) {
      return '<div class="formula"><div class="f-eq"><b>' + f[0] + '</b><code class="mono">' + f[1] + '</code></div><div class="f-note">' + f[2] + '</div></div>';
    }).join("");

    const classes = [
      ["Class A", "0.0.0.0 — 127.255.255.255", "/8", "255.0.0.0", "128", "16,777,214"],
      ["Class B", "128.0.0.0 — 191.255.255.255", "/16", "255.255.0.0", "16,384", "65,534"],
      ["Class C", "192.0.0.0 — 223.255.255.255", "/24", "255.255.255.0", "2,097,152", "254"],
      ["Class D", "224.0.0.0 — 239.255.255.255", "—", "Multicast", "—", "—"],
      ["Class E", "240.0.0.0 — 255.255.255.255", "—", "Reserved", "—", "—"]
    ];
    const rfc = [
      ["10.0.0.0/8", "255.0.0.0", "16,777,216"],
      ["172.16.0.0/12", "255.240.0.0", "1,048,576"],
      ["192.168.0.0/16", "255.255.0.0", "65,536"]
    ];
    const common = [
      ["/8", "255.0.0.0", "16,777,214"], ["/12", "255.240.0.0", "1,048,574"],
      ["/16", "255.255.0.0", "65,534"], ["/20", "255.255.240.0", "4,094"],
      ["/22", "255.255.252.0", "1,022"], ["/24", "255.255.255.0", "254"],
      ["/25", "255.255.255.128", "126"], ["/26", "255.255.255.192", "62"],
      ["/27", "255.255.255.224", "30"], ["/28", "255.255.255.240", "14"],
      ["/29", "255.255.255.248", "6"], ["/30", "255.255.255.252", "2"],
      ["/31", "255.255.255.254", "2 (PtP)"], ["/32", "255.255.255.255", "1"]
    ];
    const tips = [
      "تذكّر سلسلة الـ 2: 128·64·32·16·8·4·2·1 — منها تُشتق كل أقنعة الصنف C من /25 إلى /30.",
      "البتات تُستعار من جهة المضيف، فالبريفيكس يزيد دائماً: شبكتان → 1 بت، 4 → 2، 8 → 3…",
      "في VLSM رتّب تنازلياً وابدأ من أكبر شبكة لتجنّب التداخل والثقوب.",
      "الـ Wildcard = 255.255.255.255 − القناع، أو ببساطة اعكس كل بت.",
      "للتأكد من انتماء IP لشبكة: IP AND Mask = Network."
    ];

    const tbl = function (head, rows, cell) {
      return '<div class="table-wrap"><table class="vtable"><thead><tr>' + head.map(function (h) { return "<th>" + h + "</th>"; }).join("") + '</tr></thead><tbody>' +
        rows.map(function (r) { return "<tr>" + r.map(function (c, i) { return "<td class='" + (cell && cell[i] ? "mono" : "") + (cell && cell[i] === "g" ? " g" : "") + "'>" + c + "</td>"; }).join("") + "</tr>"; }).join("") +
        '</tbody></table></div>';
    };

    return '' +
      '<div class="card"><div class="card-h"><div class="card-ico">' + svg('<path d="M4 4h16v16H4z"/><path d="M8 8h8v8H8z"/>') + '</div><div><b>المعادلات الأساسية</b><span>احفظها للامتحان.</span></div></div>' +
        '<div class="card-b">' + formulas + '</div></div>' +

      '<div class="card" style="margin-top:14px"><div class="card-h"><div class="card-ico">' + svg('<rect x="3" y="3" width="18" height="6"/><rect x="3" y="11" width="18" height="6"/>') + '</div><div><b>أصناف عناوين IP</b></div></div>' +
        '<div class="card-b">' + tbl(["الصنف", "النطاق", "البريفيكس", "القناع", "الشبكات", "المضيفين"], classes, [0, 0, "g", "g", 0, 0]) + '</div></div>' +

      '<div class="card" style="margin-top:14px"><div class="card-h"><div class="card-ico">' + svg('<rect x="3" y="11" width="18" height="6" rx="1"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>') + '</div><div><b>نطاقات الشبكات الخاصة (RFC 1918)</b></div></div>' +
        '<div class="card-b">' + tbl(["النطاق", "القناع", "عدد العناوين"], rfc, ["g", "g", 0]) +
        '<div class="note i" style="margin-bottom:0">لا تُوجَّه على الإنترنت العام — تُترجَم عبر NAT.</div></div></div>' +

      '<div class="card" style="margin-top:14px"><div class="card-h"><div class="card-ico">' + svg('<path d="M3 5h18M3 10h18M3 15h18M3 20h18"/>') + '</div><div><b>جدول البريفيكسات الشائعة</b></div></div>' +
        '<div class="card-b">' + tbl(["Prefix", "Mask", "Hosts/Subnet"], common, ["g", "g", 0]) + '</div></div>' +

      '<div class="card" style="margin-top:14px"><div class="card-h"><div class="card-ico">' + svg('<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z"/>') + '</div><div><b>نصائح للمذاكرة</b></div></div>' +
        '<div class="card-b">' + tips.map(function (t, i) { return '<div class="tip"><b>' + (i + 1) + '.</b> ' + t + '</div>'; }).join("") + '</div></div>' +

      '<div class="card" style="margin-top:14px"><div class="card-h"><div class="card-ico">' + svg('<path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6Z"/>') + '</div><div><b>ملاحظات سيسكو الاحترافية</b><span>ما يطلبه الامتحان والعمل فعلياً</span></div></div>' +
        '<div class="card-b">' +
          '<div class="tip"><b>/31</b> لروابط Point-to-Point فقط (RFC 3021) — يعطي عنوانين ويُستخدم على وصلات WAN بين موجّهين.</div>' +
          '<div class="tip"><b>Wildcard</b> في OSPF: <code class="mono">network 10.0.0.0 0.0.0.255 area 0</code> — والقناع العكسي في <code class="mono">ip ospf network</code> مختلف.</div>' +
          '<div class="tip"><b>الـ Summarization</b>: اجمع شبكات متجاورة على حد بت مشترك. الأمر: <code class="mono">ip summary-address eigrp 1 10.0.0.0 255.0.0.0</code>.</div>' +
          '<div class="tip"><b>تجميع BGP</b>: <code class="mono">aggregate-address 172.16.0.0 255.255.0.0 summary-only</code> لمنع تسرّب المسارات التفصيلية.</div>' +
          '<div class="tip" style="margin-bottom:0"><b>التحقق</b>: <code class="mono">show ip route</code> · <code class="mono">show ip interface brief</code> · <code class="mono">show ip ospf interface</code>.</div>' +
        '</div></div>';
  }

  /* ============================ IPv6 ============================ */
  function ipv6View() {
    const p = C.ipv6Parse(State.ip6);
    const inv = !p || !p.ok;
    let body = "";
    if (inv) body = '<div class="note d"><b>إدخال غير صالح</b>' + (p && p.error ? esc(p.error) : "") + '</div>';
    else {
      const a = C.ipv6Analyze(p.ip, p.prefix);
      body = '' +
        '<div class="grid g3" style="margin-top:12px">' +
          stat("عنوان الشبكة", a.netStr, true) +
          stat("البريفيكس", "/" + a.prefix) +
          stat("عدد عناوين /64", a.num64 === 0n ? "—" : fmtN(a.num64)) +
        '</div>' +
        '<div class="grid g2" style="margin-top:10px">' +
          stat("أول عنوان", a.firstStr) +
          stat("آخر عنوان", a.lastStr) +
        '</div>' +
        '<div class="note i" style="margin-bottom:0"><b>إجمالي العناوين</b> 2<sup>' + a.hostBits + '</sup> = ' + fmtN(a.total) +
          '. في التصميم العام (2000::/3): 3 بت registry · 13 provider · 32 subscriber · 16 subnet · 64 interface ID.</div>';

      // splitter
      const r = C.ipv6Split(p.ip, p.prefix, Math.min(128, p.prefix + 4), 64);
      if (r.ok) {
        const csv = "#,Network\n" + r.out.map(function (x) { return [x.idx, x.cidr].join(","); }).join("\n");
        body += '<div class="card" style="margin-top:14px"><div class="card-h"><div class="card-ico">' + svg('<rect x="3" y="3" width="18" height="6" rx="1"/><rect x="3" y="11" width="8" height="6" rx="1"/><rect x="13" y="11" width="8" height="6" rx="1"/>') + '</div><div><b>تقسيم العرض التجريبي (/+' + (r.prefix - p.prefix) + ')</b><span>مثال: تقسيم "/' + p.prefix + '" إلى "/' + r.prefix + '" — ' + fmtN(r.count) + ' شبكة (أول 64 معروضة).</span></div></div>' +
          '<div class="card-b"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><button class="btn btn-primary btn-sm" data-copy="' + esc(csv) + '" type="button">نسخ الكل</button><button class="btn btn-sm" data-csv="' + esc(csv) + '" type="button">CSV</button></div>' +
          '<div class="table-wrap" style="max-height:300px;overflow:auto"><table class="vtable"><thead><tr><th>#</th><th>Network</th></tr></thead><tbody>' +
          r.out.map(function (x) { return '<tr><td>' + x.idx + '</td><td class="mono">' + x.cidr + '</td></tr>'; }).join("") +
          '</tbody></table></div></div>';
      }
    }

    return '' +
      '<div class="card">' +
        '<div class="card-h"><div class="card-ico">' + svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>') + '</div>' +
          '<div><b>محلل IPv6</b><span>إضافة احترافية — العناوين هائلة فلا تُقسَّم مثل IPv4.</span></div></div>' +
        '<div class="card-b">' +
          '<input id="ip6In" class="field mono" style="margin-bottom:10px" value="' + esc(State.ip6) + '" placeholder="2001:db8:1:2::/64" spellcheck="false">' +
          (inv ? "" : body) +
        '</div>' +
      '</div>' +
      (inv ? "" : "");
  }

  /* ============================ ROUTER ============================ */
  function renderTab() {
    const v = $("#subTab");
    if (!v) return;
    const t = State.subnetTab;
    let html = "";
    if (t === "analyzer") html = analyzerView();
    else if (t === "fldiv") html = fldivView();
    else if (t === "vlsm") html = vlsmView();
    else if (t === "tools") html = toolsView();
    else if (t === "ref") html = refView();
    else html = ipv6View();
    v.innerHTML = html;
    wireTab();
  }

  A.RENDER.subnet = function (root, opts) {
    if (opts && opts.deep) {
      const m = /^(analyzer|fldiv|vlsm|tools|ref|ipv6)$/.exec(opts.deep);
      if (m) State.subnetTab = m[1];
    }
    root.innerHTML = '' +
      '<div class="tabs" id="subTabs">' +
        TABS.map(function (t) {
          return '<button class="tab' + (State.subnetTab === t[0] ? " is-on" : "") + '" data-stab="' + t[0] + '" type="button">' + t[1] + '</button>';
        }).join("") +
      '</div>' +
      '<div id="subTab"></div>';
    $$("#subTabs .tab", root).forEach(function (b) {
      b.addEventListener("click", function () {
        State.subnetTab = b.dataset.stab;
        $$("#subTabs .tab", root).forEach(function (x) { x.classList.toggle("is-on", x === b); });
        renderTab();
      });
    });
    renderTab();
  };

  /* ============================ WIRING ============================ */
  function wireTab() {
    const t = State.subnetTab;
    if (t === "analyzer") return wireAnalyzer();
    if (t === "fldiv") return wireFldiv();
    if (t === "vlsm") return wireVlsm();
    if (t === "tools") return wireTools();
    if (t === "ipv6") return wireIp6();
  }

  function wireAnalyzer() {
    const v = $("#subTab");
    const inp = $("#snIn", v);
    if (inp) inp.addEventListener("input", debounce(function () {
      State.sn = inp.value;
      renderTab();
    }, 360));
    $$("[data-ex]", v).forEach(function (b) { b.addEventListener("click", function () { State.sn = b.dataset.ex; renderTab(); }); });
    $$("[data-jump]", v).forEach(function (b) { b.addEventListener("click", function () {
      State.subnetTab = b.dataset.jump;
      const tb = $("#subTabs .tab[data-stab='" + b.dataset.jump + "']");
      if (tb) tb.click(); else renderTab();
    }); });
    const cp = $("#snCopy", v);
    if (cp) cp.addEventListener("click", function () {
      const p = C.parseInput(State.sn);
      if (!p || !p.ok) return;
      const a = C.analyze(p.ip, p.prefix);
      copy("Network: " + a.netIp + "\nMask: " + a.maskIp + "\nWildcard: " + a.wildcardIp +
        "\nBroadcast: " + a.bcastIp + "\nRange: " + a.firstIp + " - " + a.lastIp +
        "\nUsable hosts: " + fmtN(a.usable) + "\nTotal: " + fmtN(a.total), "تم نسخ النتيجة");
    });
  }

  function wireFldiv() {
    const v = $("#subTab");
    const base = $("#sfBase", v);
    if (base) base.addEventListener("input", debounce(function () { State.sfBase = base.value; renderTab(); }, 360));
    const cnt = $("#sfCount", v);
    if (cnt) cnt.addEventListener("input", debounce(function () { State.sfCount = cnt.value; renderTab(); }, 360));
    $$("[data-sfm]", v).forEach(function (b) { b.addEventListener("click", function () {
      State.sfMode = b.dataset.sfm; renderTab();
    }); });
    $$("[data-copy]", v).forEach(function (b) { b.addEventListener("click", function () { copy(b.dataset.copy, "تم النسخ"); }); });
    $$("[data-csv]", v).forEach(function (b) { b.addEventListener("click", function () { downloadCsv(b.dataset.csv, "flsm.csv"); }); });
  }

  function wireVlsm() {
    const v = $("#subTab");
    const base = $("#svBase", v);
    if (base) base.addEventListener("input", debounce(function () { State.svBase = base.value; renderTab(); }, 360));
    $$("[data-vn]", v).forEach(function (b) { b.addEventListener("input", function () { State.vRows[+b.dataset.vn].name = b.value; renderTab(); }); });
    $$("[data-vh]", v).forEach(function (b) { b.addEventListener("input", function () { State.vRows[+b.dataset.vh].hosts = b.value; renderTab(); }); });
    $$("[data-vdel]", v).forEach(function (b) { b.addEventListener("click", function () {
      State.vRows.splice(+b.dataset.vdel, 1); renderTab();
    }); });
    const add = $("#vAdd", v);
    if (add) add.addEventListener("click", function () { State.vRows.push({ name: "", hosts: "10" }); renderTab(); });
    $$("[data-copy]", v).forEach(function (b) { b.addEventListener("click", function () { copy(b.dataset.copy, "تم النسخ"); }); });
    $$("[data-csv]", v).forEach(function (b) { b.addEventListener("click", function () { downloadCsv(b.dataset.csv, "vlsm.csv"); }); });
  }

  function wireTools() {
    const v = $("#subTab");
    const ci = $("#convIn", v);
    if (ci) ci.addEventListener("input", debounce(function () {
      const ip = C.ipToInt(ci.value.trim());
      const f = ip !== null ? C.formats(ip) : null;
      const set = function (lbl, val) {
        $$(".conv-row", v).forEach(function (row) {
          if (row.querySelector(".conv-l") && row.querySelector(".conv-l").textContent.trim() === lbl) {
            const el = row.querySelector(".conv-v");
            if (el) { el.textContent = val; el.dataset.conv = val; }
          }
        });
      };
      set("Decimal", f ? f.dotted : "—");
      set("Binary", f ? f.binary : "—");
      set("Hex", f ? f.hex : "—");
      set("Long", f ? String(f.decimal) : "—");
    }, 200));
    $$("[data-ccopy]", v).forEach(function (b) { b.addEventListener("click", function () { copy(b.dataset.ccopy, "تم النسخ"); }); });

    const b2i = $("#b2i", v), i2b = $("#i2b", v);
    if (b2i) b2i.addEventListener("input", function () {
      const r = C.binaryToIp(b2i.value);
      $("#b2iOut", v).textContent = r.ok ? r.text : "غير صالح";
    });
    if (i2b) i2b.addEventListener("input", function () {
      const ip = C.ipToInt(i2b.value.trim());
      $("#i2bOut", v).textContent = ip !== null ? C.dottedBin(ip) : "غير صالح";
    });

    const qh = $("#qHosts", v), qn = $("#qNets", v);
    if (qh) qh.addEventListener("input", function () {
      const n = parseInt(qh.value, 10); const f = C.prefixForHosts(isFinite(n) ? n : 1, true);
      $("#qHostsOut", v).textContent = f ? ("prefix /" + f.prefix + " · host bits " + f.hostBits + " · usable " + fmtN(f.usable)) : "—";
    });
    if (qn) qn.addEventListener("input", function () {
      const m = parseInt(qn.value, 10); const b = m > 0 ? C.log2ceil(m) : 0;
      $("#qNetsOut", v).textContent = ("borrowed " + b + " bit · networks " + fmtN(Math.pow(2, b)));
    });
    // prime the quick calc defaults
    if (qh) qh.dispatchEvent(new Event("input"));
    if (qn) qn.dispatchEvent(new Event("input"));
  }

  function wireIp6() {
    const v = $("#subTab");
    const inp = $("#ip6In", v);
    if (inp) inp.addEventListener("input", debounce(function () { State.ip6 = inp.value; renderTab(); }, 360));
    $$("[data-copy]", v).forEach(function (b) { b.addEventListener("click", function () { copy(b.dataset.copy, "تم النسخ"); }); });
    $$("[data-csv]", v).forEach(function (b) { b.addEventListener("click", function () { downloadCsv(b.dataset.csv, "ipv6.csv"); }); });
  }

  function downloadCsv(text, name) {
    try {
      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
      toast("تم تنزيل " + name);
    } catch (e) { copy(text, "تم نسخ CSV"); }
  }
})();
