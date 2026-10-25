/* ==========================================================================
   view-misc.js — home, reference tables, study plan
   ========================================================================== */
(function () {
  "use strict";
  const A = window.APP;
  const { State, $, $$, esc } = A;

  /* ============================== HOME ============================== */
  A.RENDER.home = function (root) {
    const cmds = window.COMMANDS.length;
    const secs = window.SECTIONS.filter(s => s.count > 0).length;
    const qs = window.QBANK.questions.length;
    const answered = window.QBANK.questions.filter(q => (A.qStat(q.id).ok + A.qStat(q.id).bad) > 0).length;
    const wrong = window.QBANK.questions.filter(q => A.qStat(q.id).bad > 0).length;
    const favs = Object.keys(State.favs).length;
    const planDone = Object.values(State.plan).filter(Boolean).length;
    const planTotal = PLAN.length;

    // weakest topics
    const byTopic = {};
    window.QBANK.questions.forEach(q => {
      const s = A.qStat(q.id);
      if (s.ok + s.bad === 0) return;
      byTopic[q.topic] = byTopic[q.topic] || { ok: 0, bad: 0, n: 0 };
      byTopic[q.topic].ok += s.ok;
      byTopic[q.topic].bad += s.bad;
      byTopic[q.topic].n++;
    });
    const weak = Object.keys(byTopic)
      .map(k => ({ id: k, ...byTopic[k], rate: byTopic[k].ok / (byTopic[k].ok + byTopic[k].bad) }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 4);

    const top = window.COMMANDS.filter(c => ["show ip interface brief", "show running-config", "switchport mode trunk", "ip route", "router ospf process-id"].some(s => c.synPlain.indexOf(s) === 0)).slice(0, 5);

    root.innerHTML = '' +
      '<div class="grid g4" style="margin-bottom:16px">' +
        '<div class="stat"><span class="lbl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m4 17 6-6-6-6"/><path d="M12 19h8"/></svg>أوامر موثّقة</span><span class="val">' + cmds + '</span><span class="sub">في ' + secs + ' قسماً</span></div>' +
        '<div class="stat"><span class="lbl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 1 1 4.2 2.8c-.8.4-1.3 1.2-1.3 2.2"/></svg>أسئلة البنك</span><span class="val">' + qs + '</span><span class="sub">CCNA · CCNP · Interview</span></div>' +
        '<div class="stat"><span class="lbl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 5 5L20 7"/></svg>أُجيب عنها</span><span class="val g">' + answered + '</span><span class="sub">' + (qs ? Math.round(answered / qs * 100) : 0) + '% من البنك</span></div>' +
        '<div class="stat"><span class="lbl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>تحتاج مراجعة</span><span class="val" style="color:var(--rose)">' + wrong + '</span><span class="sub">' + favs + ' أمر في المفضلة</span></div>' +
      '</div>' +

      '<div class="grid g3" style="margin-bottom:8px">' +
        quickCard("commands", "مرجع الأوامر", "ابحث في " + cmds + " أمراً بشرح عربي وإنجليزي وأزرار نسخ فورية.",
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m4 17 6-6-6-6"/><path d="M12 19h8"/></svg>') +
        quickCard("questions", "بنك الأسئلة", "اختبر نفسك بجلسة مُوقَّتة أو راجع الأسئلة التي أخطأت فيها.",
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 1 1 4.2 2.8c-.8.4-1.3 1.2-1.3 2.2"/><path d="M12 17h.01"/></svg>') +
        quickCard("tools", "الأدوات", "حاسبة Subneting بتمثيل بتّي، ومحوّل Wildcard، ومولّد إعدادات.",
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a4 4 0 0 0 5 5L21 21H3l7.3-7.3a4 4 0 0 0 4.4-7.4Z"/></svg>') +
      '</div>' +

      '<div class="two-col" style="margin-top:16px">' +
        '<div class="card">' +
          '<div class="card-h"><div class="card-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/></svg></div>' +
            '<div><b>تقدمك حسب الموضوع</b><span>نسبة الإجابات الصحيحة في المواضيع التي جرّبتها</span></div></div>' +
          '<div class="card-b">' +
            (weak.length ? weak.map(w => {
              const t = window.QBANK.topics.find(x => x.id === w.id);
              const pct = Math.round(w.rate * 100);
              return '<div style="margin-bottom:11px">' +
                '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">' +
                  '<span style="font-weight:700">' + esc(t ? t.ar : w.id) + '</span>' +
                  '<span class="mono" style="color:var(--muted);font-size:11.5px">' + pct + '% · ' + w.n + ' سؤال</span>' +
                '</div>' +
                '<div class="bar"><i style="width:' + pct + '%;background:' + (pct >= 80 ? "var(--primary)" : pct >= 50 ? "var(--amber)" : "var(--rose)") + '"></i></div>' +
              '</div>';
            }).join("") : '<div class="empty" style="padding:28px"><b>لم تجرّب أي سؤال بعد</b><span>ابدأ بجلسة اختبار قصيرة لتظهر إحصاءاتك هنا</span></div>') +
          '</div>' +
        '</div>' +

        '<div class="card">' +
          '<div class="card-h"><div class="card-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M3 12h18"/></svg></div>' +
            '<div><b>خطة المراجعة</b><span>' + planDone + ' من ' + planTotal + ' مهمة مكتملة</span></div></div>' +
          '<div class="card-b">' +
            '<div class="bar" style="margin-bottom:12px"><i style="width:' + Math.round(planDone / planTotal * 100) + '%"></i></div>' +
            '<div style="display:flex;flex-direction:column;gap:7px">' +
              PLAN.slice(0, 4).map((p, i) => {
                const on = !!State.plan[i];
                return '<div class="plan-item' + (on ? " done" : "") + '" style="padding:9px 11px">' +
                  '<button class="chk' + (on ? " on" : "") + '" data-plan="' + i + '" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 5 5L20 7"/></svg></button>' +
                  '<div><div class="plan-t" style="font-size:12.8px">' + esc(p.t) + '</div></div></div>';
              }).join("") +
            '</div>' +
            '<button class="btn btn-sm" style="width:100%;margin-top:12px" data-goto="plan" type="button">عرض الخطة كاملة</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="sec-title">أوامر يبدأ بها كل مهندس <span class="cnt">5</span></div>' +
      '<div class="cmd-list">' + top.map(c => miniCmd(c)).join("") + '</div>' +

      '<div class="note i" style="margin-top:20px">' +
        '<b>نصيحة استخدام</b>' +
        'اضغط <kbd style="font-family:var(--mono);font-size:11px;border:1px solid var(--border);padding:1px 5px;border-radius:4px">/</kbd> في أي وقت لفتح البحث السريع، و' +
        '<kbd style="font-family:var(--mono);font-size:11px;border:1px solid var(--border);padding:1px 5px;border-radius:4px">Esc</kbd> لإغلاقه. كل تقدمك يُحفظ محلياً في هذا المتصفح ولا يحتاج إنترنت.' +
      '</div>';

    $$("[data-goto]", root).forEach(b => b.addEventListener("click", () => A.go(b.dataset.goto)));
    $$("[data-plan]", root).forEach(b => b.addEventListener("click", function () {
      const i = +b.dataset.plan;
      State.plan[i] = !State.plan[i];
      A.Store.set("plan", State.plan);
      A.go("home");
    }));
    $$("[data-mini]", root).forEach(b => b.addEventListener("click", () => window.openCommandDrawer(b.dataset.mini)));
  };

  function quickCard(page, title, desc, icon) {
    return '<button class="card" data-goto="' + page + '" type="button" style="text-align:start;cursor:pointer;padding:0;transition:.18s">' +
      '<div class="card-h" style="padding:15px 16px 0">' +
        '<div class="card-ico">' + icon + '</div>' +
        '<div><b>' + title + '</b><span>' + desc + '</span></div>' +
      '</div>' +
      '<div style="padding:12px 16px 15px;display:flex;align-items:center;gap:6px;color:var(--primary);font-size:12.5px;font-weight:700">' +
        'افتح' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="m15 18-6-6 6-6"/></svg>' +
      '</div></button>';
  }

  function miniCmd(c) {
    return '<article class="cmd"><div class="cmd-top" style="padding:9px 12px">' +
      '<div class="cmd-syn" style="font-size:12.4px">' + c.syn + '</div>' +
      '<div class="cmd-tools">' +
        '<span class="mode ' + A.modeClass(c.mode) + '">' + esc(c.mode) + '</span>' +
        '<button class="copy-btn" data-mini="' + c.i + '" type="button">تفاصيل</button>' +
      '</div></div></article>';
  }

  /* ============================== REFERENCE ============================== */
  const REF = [
    {
      id: "ports", title: "أرقام المنافذ الشائعة", en: "Well-known ports",
      head: ["المنفذ", "البروتوكول", "النقل", "ملاحظة"],
      rows: [
        ["20 / 21", "FTP Data / Control", "TCP", "21 للتحكم و20 للبيانات"],
        ["22", "SSH", "TCP", "البديل المشفّر لـ Telnet"],
        ["23", "Telnet", "TCP", "غير مشفّر — يُعطَّل في الإنتاج"],
        ["25", "SMTP", "TCP", "إرسال البريد"],
        ["53", "DNS", "UDP/TCP", "UDP للاستعلامات وTCP للنقل الكبير"],
        ["67 / 68", "DHCP Server / Client", "UDP", "67 للخادم و68 للعميل"],
        ["69", "TFTP", "UDP", "نسخ صور IOS"],
        ["80 / 443", "HTTP / HTTPS", "TCP", "واجهة إدارة الويب"],
        ["123", "NTP", "UDP", "مزامنة الوقت"],
        ["161 / 162", "SNMP / Traps", "UDP", "162 للـ Traps"],
        ["389 / 636", "LDAP / LDAPS", "TCP", "خدمات الدليل"],
        ["514", "Syslog", "UDP", "إرسال السجلات"],
        ["830", "NETCONF", "SSH", "إدارة نموذجية"],
        ["1812 / 1813", "RADIUS Auth / Acct", "UDP", "802.1X وVPN"],
        ["49", "TACACS+", "TCP", "إدارة الأجهزة"],
        ["2055", "NetFlow", "UDP", "تصدير التدفقات"],
        ["4789", "VXLAN", "UDP", "تغليف Layer 2 عبر Layer 3"],
        ["5246 / 5247", "CAPWAP Control / Data", "UDP", "بين AP وWLC"]
      ]
    },
    {
      id: "ad", title: "المسافة الإدارية AD", en: "Administrative distance",
      head: ["المصدر", "AD", "ملاحظة"],
      rows: [
        ["Connected", "0", "الأولوية المطلقة"],
        ["Static route", "1", "يدوي"],
        ["eBGP", "20", "بين الأنظمة المستقلة"],
        ["EIGRP internal", "90", "داخل نفس AS"],
        ["IGRP", "100", "قديم"],
        ["OSPF", "110", "معياري مفتوح"],
        ["IS-IS", "115", "معياري مفتوح"],
        ["RIP", "120", "حد 15 hop"],
        ["EIGRP external", "170", "مُعاد توزيعه"],
        ["iBGP", "200", "داخل نفس AS"],
        ["Unknown / Unreachable", "255", "لا يُثبَّت"]
      ]
    },
    {
      id: "cidr", title: "جدول CIDR وعدد المضيفين", en: "CIDR cheat sheet",
      head: ["البادئة", "القناع", "Wildcard", "العناوين", "مضيفون صالحون"],
      rows: [
        ["/24", "255.255.255.0", "0.0.0.255", "256", "254"],
        ["/25", "255.255.255.128", "0.0.0.127", "128", "126"],
        ["/26", "255.255.255.192", "0.0.0.63", "64", "62"],
        ["/27", "255.255.255.224", "0.0.0.31", "32", "30"],
        ["/28", "255.255.255.240", "0.0.0.15", "16", "14"],
        ["/29", "255.255.255.248", "0.0.0.7", "8", "6"],
        ["/30", "255.255.255.252", "0.0.0.3", "4", "2"],
        ["/31", "255.255.255.254", "0.0.0.1", "2", "2 (RFC 3021)"],
        ["/32", "255.255.255.255", "0.0.0.0", "1", "0 (host route)"],
        ["/23", "255.255.254.0", "0.0.1.255", "512", "510"],
        ["/22", "255.255.252.0", "0.0.3.255", "1024", "1022"],
        ["/21", "255.255.248.0", "0.0.7.255", "2048", "2046"],
        ["/20", "255.255.240.0", "0.0.15.255", "4096", "4094"],
        ["/16", "255.255.0.0", "0.0.255.255", "65536", "65534"],
        ["/12", "255.240.0.0", "0.15.255.255", "1,048,576", "1,048,574"],
        ["/8", "255.0.0.0", "0.255.255.255", "16,777,216", "16,777,214"]
      ]
    },
    {
      id: "lsa", title: "أنواع LSA في OSPF", en: "OSPF LSA types",
      head: ["النوع", "الاسم", "يُنشئه", "المحتوى"],
      rows: [
        ["1", "Router LSA", "كل راوتر", "روابط الراوتر داخل المنطقة"],
        ["2", "Network LSA", "DR", "الشبكات متعددة الوصول والجيران"],
        ["3", "Summary LSA", "ABR", "شبكات المناطق الأخرى"],
        ["4", "ASBR Summary", "ABR", "موقع الـ ASBR"],
        ["5", "External LSA", "ASBR", "مسارات خارجية"],
        ["6", "Group Membership", "—", "MOSPF (مهجور)"],
        ["7", "NSSA External", "ASBR داخل NSSA", "خارجي داخل NSSA"],
        ["9/10/11", "Opaque", "حسب التطبيق", "Traffic Engineering وGraceful Restart"]
      ]
    },
    {
      id: "bgp", title: "حالات BGP", en: "BGP neighbour states",
      head: ["الحالة", "المعنى"],
      rows: [
        ["Idle", "لا محاولة اتصال — ينتظر بدء المؤقت"],
        ["Connect", "جارٍ إنشاء جلسة TCP"],
        ["Active", "فشل TCP ويحاول مجدداً"],
        ["OpenSent", "أُرسل OPEN وينتظر OPEN من الجار"],
        ["OpenConfirm", "وصل OPEN ويُنتظر KEEPALIVE"],
        ["Established", "الجيرة تعمل ويُتبادل التحديث"]
      ]
    },
    {
      id: "syslog", title: "مستويات Syslog", en: "Syslog severity",
      head: ["الرقم", "المستوى", "المعنى"],
      rows: [
        ["0", "emergencies", "النظام غير قابل للاستخدام"],
        ["1", "alerts", "تدخّل فوري مطلوب"],
        ["2", "critical", "حالة حرجة"],
        ["3", "errors", "أخطاء"],
        ["4", "warnings", "تحذيرات"],
        ["5", "notifications", "أحداث عادية مهمة"],
        ["6", "informational", "معلومات"],
        ["7", "debugging", "رسائل تصحيح"]
      ]
    },
    {
      id: "stp", title: "مؤقتات وحالات STP", en: "STP timers & states",
      head: ["العنصر", "القيمة الافتراضية"],
      rows: [
        ["Hello time", "2 ثانية"],
        ["Max Age", "20 ثانية"],
        ["Forward Delay", "15 ثانية"],
        ["أسوأ زمن تحوّل (802.1D)", "50 ثانية (20+15+15)"],
        ["حالات المنفذ", "Blocking → Listening → Learning → Forwarding"],
        ["حالات RSTP", "Discarding → Learning → Forwarding"],
        ["Bridge Priority الافتراضي", "32768 (بخطوات 4096)"],
        ["Path Cost (1G)", "4 بـ short / 20000 بـ long"]
      ]
    },
    {
      id: "dscp", title: "قيم DSCP للـ QoS", en: "DSCP values",
      head: ["القيمة", "الاسم", "الاستخدام"],
      rows: [
        ["46", "EF", "الصوت — أولوية صارمة"],
        ["24", "CS3", "تحكم الصوت (Signaling)"],
        ["34", "AF41", "الفيديو التفاعلي"],
        ["26", "AF31", "بث الفيديو"],
        ["0", "Default / BE", "ترافيك عادي"],
        ["48", "CS6", "بروتوكولات التحكم بالشبكة"],
        ["56", "CS7", "أعلى أولوية تحكم"]
      ]
    },
    {
      id: "routing", title: "مقارنة بروتوكولات التوجيه", en: "Routing protocol comparison",
      head: ["البروتوكول", "النوع", "المترية", "المدى", "النطاق", "ملاحظة"],
      rows: [
        ["OSPF", "Link-state", "Cost = 10⁸ ÷ Bandwidth", "بلا حد", "Area / AS", "معياري مفتوح · RFC 2328"],
        ["EIGRP", "Advanced distance-vector", "Composite (BW + Delay)", "255 hop", "AS", "سريع التقارب · DUAL"],
        ["BGP", "Path-vector", "Attributes", "بلا حد (AS-Path)", "AS", "بين الأنظمة المستقلة"],
        ["RIP", "Distance-vector", "Hop count", "15 hop", "—", "الأبسط والأقدم"],
        ["IS-IS", "Link-state", "Metric", "بلا حد", "Area / Domain", "شائع عند مزوّدي الخدمة"],
        ["Static", "—", "AD = 1", "—", "—", "تحكّم يدوي كامل"]
      ]
    },
    {
      id: "cable", title: "معايير الكابلات والإيثرنت", en: "Cabling & Ethernet standards",
      head: ["المعيار", "السرعة", "المسافة", "الكابل"],
      rows: [
        ["1000BASE-T", "1 Gbps", "100 m", "Cat5e / Cat6 UTP"],
        ["1000BASE-SX", "1 Gbps", "550 m", "Multimode fibre"],
        ["1000BASE-LX", "1 Gbps", "5 km", "Single-mode fibre"],
        ["10GBASE-T", "10 Gbps", "100 m", "Cat6a / Cat7"],
        ["10GBASE-SR", "10 Gbps", "400 m", "Multimode fibre"],
        ["40GBASE-SR4", "40 Gbps", "150 m", "MMF MTP/MPO"],
        ["100GBASE-LR4", "100 Gbps", "10 km", "Single-mode fibre"]
      ]
    },
    {
      id: "ipv6types", title: "أنواع عناوين IPv6 وبادئاتها", en: "IPv6 address types",
      head: ["النوع", "البادئة", "ملاحظة"],
      rows: [
        ["Global Unicast", "2000::/3", "العنوان العام القابل للتوجيه — يبدأ عادة بـ 2 أو 3"],
        ["Link-Local", "FE80::/10", "تلقائي على كل واجهة، لا يُوجَّه، أساس جيران ND"],
        ["Unique Local (ULA)", "FC00::/7", "خاص مثل RFC1918 — يُستخدم FD00::/8 عملياً"],
        ["Multicast", "FF00::/8", "البتات الثمانية الأولى كلها 1؛ لا يوجد Broadcast في IPv6"],
        ["Solicited-Node", "FF02::1:FF00:0/104", "آخر 24 بت من العنوان الأحادي — هدف NS/NA"],
        ["All-Nodes", "FF02::1", "مكافئ البث للجميع داخل النطاق"],
        ["All-Routers", "FF02::2", "كل الراوترات على الرابط"],
        ["Loopback", "::1/128", "مكافئ 127.0.0.1"],
        ["Unspecified", "::/128", "يُستخدم في DAD قبل تثبيت العنوان"],
        ["6to4", "2002::/16", "تغليف تلقائي يحمل IPv4 في وسط العنوان"],
        ["Teredo", "2001::/32", "نفق عبر NAT44"],
        ["NAT64 / WKP", "64:ff9b::/96", "ترجمة IPv6 إلى IPv4"]
      ]
    },
    {
      id: "etherchannel", title: "أوضاع EtherChannel وLACP", en: "EtherChannel & LACP modes",
      head: ["البروتوكول", "الوضع", "يعمل مع", "ملاحظة"],
      rows: [
        ["LACP (802.3ad)", "active", "active / passive", "يبدأ الإرسال بنفسه — الأفضل"],
        ["LACP (802.3ad)", "passive", "active فقط", "يستجيب ولا يبدأ"],
        ["PAgP (Cisco)", "desirable", "desirable / auto", "خاص بسيسكو"],
        ["PAgP (Cisco)", "auto", "desirable فقط", "يستجيب ولا يبدأ"],
        ["بلا بروتوكول", "on", "on فقط", "يجبر التجميع بلا تفاوض — لا يعمل مع الأوضاع الأخرى"],
        ["—", "off", "—", "لا تجميع"]
      ]
    },
    {
      id: "echannel-req", title: "شروط تكوين EtherChannel", en: "EtherChannel requirements",
      head: ["الشرط", "التفصيل"],
      rows: [
        ["السرعة والدوبلكس", "متطابقة على كل الأعضاء"],
        ["نوع المنفذ", "كلها access أو كلها trunk — لا خلط"],
        ["VLAN المسموحة", "نفس قائمة allowed VLAN وnative VLAN على الطرفين"],
        ["STP", "نفس تكلفة المسار وتكوين MST إن استُخدم"],
        ["الواجهة المنطقية", "تُضبط الأوامر على Port-channel لا على الأعضاء"],
        ["ممنوع", "منفذ وجهة SPAN أو منفذ محمي لا يدخل التجميع"]
      ]
    }
  ];

  A.RENDER.reference = function (root) {
    root.innerHTML = '' +
      '<div class="toolbar">' +
        '<div class="grow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
        '<input id="refQ" class="field" type="search" placeholder="ابحث في الجداول المرجعية…" autocomplete="off"></div>' +
        '<span class="chip plain">' + REF.length + ' جدولاً</span>' +
      '</div>' +
      REF.map(t => '' +
        '<div class="sec-title">' + esc(t.title) + ' <span class="cnt">' + esc(t.en) + '</span></div>' +
        '<div class="table-wrap" data-ref="' + t.id + '"><table class="table"><thead><tr>' +
          t.head.map(h => '<th>' + esc(h) + '</th>').join("") +
        '</tr></thead><tbody>' +
          t.rows.map(r => '<tr>' + r.map((c, i) => '<td' + (i === 0 ? ' class="mono"' : '') + '>' + esc(c) + '</td>').join("") + '</tr>').join("") +
        '</tbody></table></div>').join("");

    const q = $("#refQ", root);
    q.addEventListener("input", A.debounce(function () {
      const t = q.value.trim().toLowerCase();
      $$("[data-ref]", root).forEach(w => {
        const title = w.previousElementSibling;
        const isTitle = title && title.classList.contains("sec-title");
        // if the section title itself matches, keep every row of that table
        const titleHit = !t || (isTitle && title.textContent.toLowerCase().indexOf(t) > -1);
        let any = false;
        $$("tbody tr", w).forEach(tr => {
          const hit = titleHit || tr.textContent.toLowerCase().indexOf(t) > -1;
          tr.classList.toggle("hidden", !hit);
          if (hit) any = true;
        });
        w.classList.toggle("hidden", !any);
        if (isTitle) title.classList.toggle("hidden", !any);
      });
    }, 140));
  };

  /* ============================== PLAN ============================== */
  const PLAN = [
    { t: "اليوم 1 — أساسيات IOS والتنقل", d: "أوضاع الـ CLI، الاختصارات، show version / show ip interface brief، حفظ الإعداد." },
    { t: "اليوم 2 — الإعداد الأساسي والأمان", d: "hostname، كلمات السر، SSH كاملاً، banner، exec-timeout، AAA الأساسي." },
    { t: "اليوم 3 — الواجهات والعنونة", d: "IPv4/IPv6، speed/duplex، loopback، SVI، ip routing، أخطاء up/down." },
    { t: "اليوم 4 — التقسيم Subnetting", d: "Block Size، VLSM، Wildcard. حلّ 30 مسألة يدوياً بلا حاسبة." },
    { t: "اليوم 5 — VLANs وTrunking", d: "Access/Trunk، Native VLAN، DTP، VTP، Router-on-a-Stick." },
    { t: "اليوم 6 — STP وEtherChannel", d: "انتخاب الجذر، الحالات، PortFast/BPDU Guard، LACP/PAgP." },
    { t: "اليوم 7 — أمان L2", d: "Port Security، DHCP Snooping، DAI، IP Source Guard، storm-control." },
    { t: "اليوم 8 — التوجيه الساكن", d: "Static، Default، Floating، AD، Longest Match، Null0." },
    { t: "اليوم 9 — OSPF", d: "الجيرة، DR/BDR، Cost، المناطق، Stub/NSSA، التلخيص." },
    { t: "اليوم 10 — EIGRP وRIP", d: "المترية، Feasible Successor، variance، إعادة التوزيع." },
    { t: "اليوم 11 — ACLs", d: "Standard/Extended/Named، الترتيب، الاتجاه، time-range." },
    { t: "اليوم 12 — NAT وDHCP", d: "Static/Dynamic/PAT، Port Forwarding، DORA، Helper، Options." },
    { t: "اليوم 13 — خدمات وأدوات", d: "NTP، Syslog، SNMP، CDP/LLDP، QoS الأساسي، NetFlow." },
    { t: "اليوم 14 — مراجعة واختبار شامل", d: "جلسة 50 سؤالاً بوقت محدد + مراجعة كل الأخطاء + معمل تطبيقي." }
  ];

  const LABS = [
    ["Lab 01", "تهيئة راوتر من الصفر", "hostname، كلمات سر، SSH، واجهات، حفظ، اختبار الاتصال."],
    ["Lab 02", "VLANs وTrunking", "3 VLANs، trunk بين سويتشين، native VLAN، التحقق."],
    ["Lab 03", "Router-on-a-Stick", "sub-interfaces، encapsulation dot1Q، التوجيه بين VLANs."],
    ["Lab 04", "STP وPortFast", "فرض الجذر، تعديل الأولوية، BPDU Guard، اختبار الحلقة."],
    ["Lab 05", "EtherChannel LACP", "تجميع رابطين، active/active، التحقق من الـ bundle."],
    ["Lab 06", "Port Security وDHCP Snooping", "maximum/sticky/violation، trust، DAI."],
    ["Lab 07", "OSPF Multi-Area", "Area 0 و1، ABR، passive-interface، التلخيص."],
    ["Lab 08", "EIGRP مع Variance", "unequal load balancing، Feasible Successor."],
    ["Lab 09", "ACLs متعددة", "Standard/Extended، الترتيب، اختبار العدّادات."],
    ["Lab 10", "NAT + DHCP كامل", "Pool، excluded-address، PAT، Port Forwarding، التحقق."]
  ];

  A.RENDER.plan = function (root) {
    const done = Object.values(State.plan).filter(Boolean).length;
    root.innerHTML = '' +
      '<div class="card" style="margin-bottom:16px"><div class="card-b" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:200px">' +
          '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">' +
            '<b>تقدم الخطة</b><span class="mono" style="color:var(--muted)">' + done + ' / ' + PLAN.length + '</span></div>' +
          '<div class="bar"><i style="width:' + Math.round(done / PLAN.length * 100) + '%"></i></div>' +
        '</div>' +
        '<button class="btn btn-sm" id="planReset" type="button">تصفير</button>' +
      '</div></div>' +

      '<div class="sec-title">خطة 14 يوماً <span class="cnt">' + PLAN.length + ' يوماً</span></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
        PLAN.map((p, i) => {
          const on = !!State.plan[i];
          return '<div class="plan-item' + (on ? " done" : "") + '">' +
            '<button class="chk' + (on ? " on" : "") + '" data-plan="' + i + '" type="button" aria-label="إكمال"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 5 5L20 7"/></svg></button>' +
            '<div><div class="plan-t">' + esc(p.t) + '</div><div class="plan-d">' + esc(p.d) + '</div></div></div>';
        }).join("") +
      '</div>' +

      '<div class="sec-title">التمارين المعملية <span class="cnt">10 معامل</span></div>' +
      '<div class="grid g2">' +
        LABS.map(l => '<div class="card"><div class="card-b" style="padding:13px 15px">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
            '<span class="chip g">' + esc(l[0]) + '</span>' +
            '<b style="font-size:13.5px">' + esc(l[1]) + '</b></div>' +
          '<p style="margin:0;font-size:12.5px;color:var(--muted);line-height:1.75">' + esc(l[2]) + '</p>' +
        '</div></div>').join("") +
      '</div>' +

      '<div class="note w" style="margin-top:18px"><b>قاعدة المعمل الذهبية</b>لا تنتقل إلى المعمل التالي قبل أن تُثبت النتيجة بأمر <code>show</code> مناسب. «يبدو أنه يعمل» ليست نتيجة — العدّادات وجداول الجيران هي النتيجة.</div>';

    $$("[data-plan]", root).forEach(b => b.addEventListener("click", function () {
      const i = +b.dataset.plan;
      State.plan[i] = !State.plan[i];
      A.Store.set("plan", State.plan);
      A.go("plan");
    }));
    const rs = $("#planReset", root);
    if (rs) rs.addEventListener("click", function () {
      State.plan = {}; A.Store.set("plan", {}); A.go("plan");
    });
  };

  window.PLAN_DATA = PLAN;
  // expose PLAN for home (defined below in file order, hoisted by const? no)
  window.__PLAN = PLAN;
})();
