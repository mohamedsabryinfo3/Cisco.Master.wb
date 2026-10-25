/* ==========================================================================
   subnet-core.js — pure IPv4 math for the subnetting suite.
   No DOM here: every function is testable in isolation (build/qa_subnet.py
   compares it against Python's ipaddress module).
   ========================================================================== */
(function (root) {
  "use strict";

  const U = 0xFFFFFFFF;

  /* ------------------------------ primitives ------------------------------ */
  function ipToInt(s) {
    if (typeof s !== "string") return null;
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s.trim());
    if (!m) return null;
    const p = [+m[1], +m[2], +m[3], +m[4]];
    for (let i = 0; i < 4; i++) if (p[i] < 0 || p[i] > 255) return null;
    return (((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]) >>> 0;
  }

  function intToIp(n) {
    n = n >>> 0;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
  }

  function prefixToMask(p) {
    if (p <= 0) return 0;
    if (p >= 32) return U;
    return (U << (32 - p)) >>> 0;
  }

  function maskToPrefix(mask) {
    // returns -1 when the mask is not contiguous (255.255.255.1 is not a mask)
    let p = 0, zeroSeen = false;
    for (let i = 31; i >= 0; i--) {
      const bit = (mask >>> i) & 1;
      if (bit) {
        if (zeroSeen) return -1;
        p++;
      } else zeroSeen = true;
    }
    return p;
  }

  function bin32(n) {
    n = n >>> 0;
    let s = "";
    for (let i = 31; i >= 0; i--) s += (n >>> i) & 1;
    return s;
  }

  function dottedBin(n) {
    const b = bin32(n);
    return b.slice(0, 8) + "." + b.slice(8, 16) + "." + b.slice(16, 24) + "." + b.slice(24);
  }

  function log2ceil(x) {
    if (x <= 1) return 0;
    return Math.ceil(Math.log(x) / Math.LN2 - 1e-12);
  }

  /* ------------------------------ parsing ------------------------------ */
  /* Accepts:  10.0.0.5/22 | 10.0.0.5 255.255.252.0 | 10.0.0.5 0.0.3.255
               10.0.0.5            (classful)                                       */
  function parseInput(raw) {
    if (typeof raw !== "string" || !raw.trim()) {
      return { ok: false, error: "أدخل عنواناً أولاً." };
    }
    let s = raw.trim().replace(/\s+/g, " ");

    // CIDR form
    let m = /^([0-9.]+)\s*\/\s*(\d{1,2})$/.exec(s);
    if (m) {
      const ip = ipToInt(m[1]);
      const p = +m[2];
      if (ip === null) return { ok: false, error: "العنوان غير صالح — كل أوكتيت بين 0 و255." };
      if (p < 0 || p > 32) return { ok: false, error: "البادئة يجب أن تكون بين 0 و32." };
      return { ok: true, ip: ip, prefix: p, mode: "cidr", raw: raw.trim() };
    }

    // IP + second token (mask or wildcard)
    const parts = s.split(" ");
    if (parts.length === 2) {
      const ip = ipToInt(parts[0]);
      const second = ipToInt(parts[1]);
      if (ip === null) return { ok: false, error: "العنوان غير صالح — كل أوكتيت بين 0 و255." };
      if (second === null) {
        if (/^\/?\d{1,2}$/.test(parts[1])) {
          const p = +parts[1].replace("/", "");
          if (p >= 0 && p <= 32) return { ok: true, ip: ip, prefix: p, mode: "cidr", raw: raw.trim() };
        }
        return { ok: false, error: "القناع غير صالح — استخدم 255.255.255.0 أو 24 أو /24." };
      }
      let p = maskToPrefix(second);
      if (p >= 0) return { ok: true, ip: ip, prefix: p, mode: "mask", raw: raw.trim() };
      p = maskToPrefix((~second) >>> 0);
      if (p >= 0) {
        return { ok: true, ip: ip, prefix: p, mode: "wildcard", raw: raw.trim(),
                 note: "قُرئت القيمة الثانية كـ Wildcard لأنها ليست قناعاً متصلاً." };
      }
      return { ok: false, error: "القناع غير متصل — لا يمكن أن يكون 255.255.255.1 قناعاً." };
    }

    // bare address → classful
    const ip = ipToInt(s);
    if (ip !== null) {
      const p = classfulPrefix(ip);
      if (p) return { ok: true, ip: ip, prefix: p, mode: "classful", raw: raw.trim(),
                      note: "لا بادئة مُدخلة — استُخدمت البادئة الافتراضية للصنف (/" + p + ")." };
      return { ok: false, error: "هذا النطاق (Class D/E) لا يُقسَّم — لا بادئة افتراضية له." };
    }
    return { ok: false, error: "صيغة غير مفهومة. أمثلة: 192.168.1.10/24 · 10.0.0.5 255.0.0.0" };
  }

  function classOf(ip) {
    const o = (ip >>> 24) & 255;
    if (o < 128) return "A";
    if (o < 192) return "B";
    if (o < 224) return "C";
    if (o < 240) return "D";
    return "E";
  }

  function classfulPrefix(ip) {
    const c = classOf(ip);
    return c === "A" ? 8 : c === "B" ? 16 : c === "C" ? 24 : 0;
  }

  /* ------------------------------ analysis ------------------------------ */
  const RANGES = [
    { net: "0.0.0.0", p: 8, label: "شبكة This-Network", cls: "r" },
    { net: "10.0.0.0", p: 8, label: "خاص RFC 1918", cls: "t" },
    { net: "100.64.0.0", p: 10, label: "CGNAT RFC 6598", cls: "a" },
    { net: "127.0.0.0", p: 8, label: "Loopback", cls: "v" },
    { net: "169.254.0.0", p: 16, label: "Link-Local (APIPA)", cls: "a" },
    { net: "172.16.0.0", p: 12, label: "خاص RFC 1918", cls: "t" },
    { net: "192.0.0.0", p: 24, label: "IETF Protocol Assignments", cls: "s" },
    { net: "192.0.2.0", p: 24, label: "توثيق TEST-NET-1", cls: "s" },
    { net: "192.88.99.0", p: 24, label: "6to4 Relay (مهجور)", cls: "s" },
    { net: "192.168.0.0", p: 16, label: "خاص RFC 1918", cls: "t" },
    { net: "198.18.0.0", p: 15, label: "Benchmark RFC 2544", cls: "s" },
    { net: "198.51.100.0", p: 24, label: "توثيق TEST-NET-2", cls: "s" },
    { net: "203.0.113.0", p: 24, label: "توثيق TEST-NET-3", cls: "s" },
    { net: "224.0.0.0", p: 4, label: "Multicast", cls: "a" },
    { net: "240.0.0.0", p: 4, label: "محجوز — Reserved", cls: "r" }
  ].map(function (r) {
    r.base = ipToInt(r.net);
    r.end = r.base + Math.pow(2, 32 - r.p) - 1;
    return r;
  });

  function scopeOf(ip) {
    if (ip === U) return { label: "بث محدود 255.255.255.255", cls: "r", priv: false };
    for (let i = 0; i < RANGES.length; i++) {
      const r = RANGES[i];
      if (ip >= r.base && ip <= r.end) {
        return { label: r.label, cls: r.cls, priv: r.label.indexOf("RFC 1918") > -1 };
      }
    }
    return { label: "عنوان عام قابل للتوجيه", cls: "g", priv: false };
  }

  function analyze(ip, prefix) {
    const mask = prefixToMask(prefix);
    const wildcard = (~mask) >>> 0;
    const net = (ip & mask) >>> 0;
    const bcast = (net | wildcard) >>> 0;
    const total = Math.pow(2, 32 - prefix);
    const usable = prefix === 32 ? 1 : prefix === 31 ? 2 : total - 2;
    const first = prefix >= 31 ? net : net + 1;
    const last = prefix >= 31 ? bcast : bcast - 1;
    const cls = classOf(ip);
    const classful = classfulPrefix(ip);
    const scope = scopeOf(ip);
    const borrowed = classful && prefix > classful ? prefix - classful : 0;
    return {
      ip: ip, prefix: prefix, mask: mask, wildcard: wildcard,
      net: net, bcast: bcast, total: total, usable: usable,
      first: first, last: last,
      // dotted forms: the UI prints these, the ints stay for arithmetic
      ipIp: intToIp(ip), netIp: intToIp(net), bcastIp: intToIp(bcast),
      maskIp: intToIp(mask), wildcardIp: intToIp(wildcard),
      firstIp: intToIp(first), lastIp: intToIp(last),
      klass: cls, classful: classful, borrowed: borrowed,
      hostBits: 32 - prefix, netBits: prefix,
      blockSize: total,
      isNetworkAddr: ip === net, isBroadcast: ip === bcast && prefix <= 30,
      scope: scope, priv: scope.priv,
      hostRange: total > 2
    };
  }

  /* ------------------------------ splitting ------------------------------ */
  function prefixForHosts(hosts, use31) {
    hosts = Math.max(1, Math.floor(hosts));
    if (hosts <= 2 && use31) return { prefix: 31, hostBits: 1, usable: 2 };
    const hostBits = log2ceil(hosts + 2);
    const prefix = 32 - hostBits;
    if (prefix < 0) return null;
    return { prefix: prefix, hostBits: hostBits, usable: Math.pow(2, hostBits) - 2 };
  }

  function rowsFor(net, prefix, count, limit) {
    const size = Math.pow(2, 32 - prefix);
    const out = [];
    const n = limit ? Math.min(count, limit) : count;
    for (let i = 0; i < n; i++) {
      const s = net + i * size;
      const f = prefix >= 31 ? s : s + 1;
      const l = prefix >= 31 ? s + size - 1 : s + size - 2;
      out.push({
        idx: i + 1, net: s, prefix: prefix, cidr: intToIp(s) + "/" + prefix,
        first: f, last: l,
        bcast: s + size - 1,
        netIp: intToIp(s), firstIp: intToIp(f), lastIp: intToIp(l),
        bcastIp: intToIp(s + size - 1), maskIp: intToIp(prefixToMask(prefix)),
        mask: prefixToMask(prefix),
        usable: prefix === 32 ? 1 : prefix === 31 ? 2 : size - 2,
        size: size
      });
    }
    return out;
  }

  function splitByHosts(base, basePrefix, hostsPerSubnet, opts) {
    const fit = prefixForHosts(hostsPerSubnet, opts && opts.use31);
    if (!fit) return { ok: false, error: "العدد المطلوب أكبر من مساحة IPv4." };
    if (fit.prefix < basePrefix) {
      return { ok: false, error: "كل شبكة فرعية تطلب " + hostsPerSubnet + " مضيفاً بحجم /" + fit.prefix +
        " وهو أكبر من الشبكة الأساسية /" + basePrefix + "." };
    }
    const a = analyze(base, basePrefix);
    const count = Math.pow(2, fit.prefix - basePrefix);
    return {
      ok: true, base: a, prefix: fit.prefix, count: count,
      hostBits: 32 - fit.prefix, borrowed: fit.prefix - basePrefix,
      usable: fit.usable, total: Math.pow(2, 32 - fit.prefix),
      wasted: a.total - count * Math.pow(2, 32 - fit.prefix)
    };
  }

  function splitByNetworks(base, basePrefix, wanted) {
    wanted = Math.max(1, Math.floor(wanted));
    const borrow = log2ceil(wanted);
    const prefix = basePrefix + borrow;
    if (prefix > 32) return { ok: false, error: "عدد الشبكات المطلوب أكبر من أن تستوعبه /" + basePrefix + "." };
    const a = analyze(base, basePrefix);
    const count = Math.pow(2, borrow);
    return {
      ok: true, base: a, prefix: prefix, count: count, borrowed: borrow,
      hostBits: 32 - prefix, usable: prefix === 32 ? 1 : prefix === 31 ? 2 : Math.pow(2, 32 - prefix) - 2,
      total: Math.pow(2, 32 - prefix), wasted: a.total - count * Math.pow(2, 32 - prefix)
    };
  }

  /* ------------------------------ VLSM ------------------------------ */
  function vlsm(base, basePrefix, reqs, opts) {
    if (!reqs.length) return { ok: false, error: "أضف متطلباً واحداً على الأقل." };
    for (let i = 0; i < reqs.length; i++) {
      if (!reqs[i].name || !String(reqs[i].name).trim()) {
        return { ok: false, error: "المتطلب رقم " + (i + 1) + " بلا اسم." };
      }
      const h = +reqs[i].hosts;
      if (!isFinite(h) || h < 1) return { ok: false, error: "عدد الأجهزة في «" + reqs[i].name + "» غير صالح." };
    }
    const a = analyze(base, basePrefix);
    const sorted = reqs.map(function (r, i) {
      return { name: String(r.name).trim(), hosts: Math.floor(+r.hosts), order: i };
    }).sort(function (x, y) { return y.hosts - x.hosts || x.order - y.order; });

    let cursor = a.net;
    const rows = [];
    let allocTotal = 0, reqTotal = 0;

    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      const fit = prefixForHosts(r.hosts, opts && opts.use31);
      if (!fit) return { ok: false, error: "«" + r.name + "» يطلب أكثر من مساحة IPv4." };
      if (fit.prefix < basePrefix) {
        return { ok: false, error: "«" + r.name + "» يطلب " + r.hosts + " جهازاً (/" + fit.prefix +
          ") وهو أكبر من الشبكة الأساسية /" + basePrefix + "." };
      }
      const size = Math.pow(2, 32 - fit.prefix);
      // align up to this block size, otherwise subnets overlap
      const aligned = Math.ceil(cursor / size) * size;
      if (aligned + size - 1 > a.bcast) {
        return { ok: false, error: "المساحة لا تكفي: «" + r.name + "» يحتاج /" + fit.prefix +
          " ولم يتبقَّ سوى " + (a.bcast - cursor + 1) + " عنواناً." };
      }
      const f = fit.prefix >= 31 ? aligned : aligned + 1;
      const l = fit.prefix >= 31 ? aligned + size - 1 : aligned + size - 2;
      rows.push({
        idx: rows.length + 1, name: r.name, asked: r.hosts, prefix: fit.prefix,
        cidr: intToIp(aligned) + "/" + fit.prefix, net: aligned,
        first: f, last: l,
        bcast: aligned + size - 1, mask: prefixToMask(fit.prefix),
        netIp: intToIp(aligned), firstIp: intToIp(f), lastIp: intToIp(l),
        bcastIp: intToIp(aligned + size - 1), maskIp: intToIp(prefixToMask(fit.prefix)),
        usable: fit.prefix === 32 ? 1 : fit.prefix === 31 ? 2 : size - 2,
        size: size
      });
      allocTotal += size;
      reqTotal += r.hosts;
      cursor = aligned + size;
    }

    return {
      ok: true, base: a, rows: rows,
      reqTotal: reqTotal, allocTotal: allocTotal,
      efficiency: allocTotal ? Math.round((reqTotal / allocTotal) * 1000) / 10 : 0,
      remaining: a.total - allocTotal,
      remainingPct: a.total ? Math.round((a.total - allocTotal) / a.total * 1000) / 10 : 0,
      freeBlocks: a.total - allocTotal > 0
    };
  }

  /* --------------------- route summarisation --------------------- */
  function summarize(cidrs) {
    const nets = [];
    for (let i = 0; i < cidrs.length; i++) {
      const p = parseInput(cidrs[i]);
      if (!p.ok) return { ok: false, error: "«" + cidrs[i] + "»: " + p.error };
      const a = analyze(p.ip, p.prefix);
      nets.push(a);
    }
    if (!nets.length) return { ok: false, error: "أدخل شبكة واحدة على الأقل." };
    let lo = nets[0].net, hi = nets[0].bcast;
    for (let i = 1; i < nets.length; i++) {
      if (nets[i].net < lo) lo = nets[i].net;
      if (nets[i].bcast > hi) hi = nets[i].bcast;
    }
    const diff = (lo ^ hi) >>> 0;
    const prefix = Math.clz32(diff); // leading equal bits = the summary prefix
    const mask = prefixToMask(prefix);
    const net = (lo & mask) >>> 0;
    const bcast = (net | ((~mask) >>> 0)) >>> 0;
    // did the summary swallow addresses outside the inputs?
    const covered = nets.reduce(function (s, n) { return s + n.total; }, 0);
    const waste = bcast - net + 1 - covered;
    return {
      ok: true, prefix: prefix, mask: mask, net: net, bcast: bcast,
      cidr: intToIp(net) + "/" + prefix, wildcard: (~mask) >>> 0,
      netIp: intToIp(net), bcastIp: intToIp(bcast), maskIp: intToIp(mask),
      wildcardIp: intToIp((~mask) >>> 0),
      covered: covered, size: bcast - net + 1, waste: waste,
      fits: waste === 0,
      ios: "ip route " + intToIp(net) + " " + intToIp(mask) + " <next-hop|interface>",
      ospf: "area 0 range " + intToIp(net) + " " + intToIp(mask)
    };
  }

  /* --------------------- range → wildcard blocks --------------------- */
  function rangeToBlocks(fromStr, toStr) {
    const a = ipToInt(fromStr), b = ipToInt(toStr);
    if (a === null || b === null) return { ok: false, error: "أدخل بداية ونهاية صحيحتين." };
    if (a > b) return { ok: false, error: "بداية النطاق يجب أن تكون أصغر من نهايته." };
    const blocks = [];
    let cur = a;
    let guard = 0;
    while (cur <= b && guard++ < 4096) {
      let size = 1;
      while (size * 2 <= b - cur + 1 && cur % (size * 2) === 0) size *= 2;
      const prefix = 32 - Math.round(Math.log(size) / Math.LN2);
      blocks.push({
        net: cur, prefix: prefix, cidr: intToIp(cur) + "/" + prefix,
        wildcard: size - 1, size: size,
        acl: intToIp(cur) + " " + intToIp(size - 1)
      });
      cur += size;
    }
    return { ok: true, blocks: blocks, count: blocks.length, addresses: b - a + 1 };
  }

  /* --------------------- formatting helpers --------------------- */
  function formats(ip) {
    const n = ip >>> 0;
    return {
      dotted: intToIp(n),
      binary: dottedBin(n),
      hex: "0x" + ("00000000" + n.toString(16).toUpperCase()).slice(-8),
      hexDotted: [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
        .map(function (x) { return ("0" + x.toString(16).toUpperCase()).slice(-2); }).join("."),
      decimal: n,
      octal: "0" + n.toString(8)
    };
  }

  function binaryToIp(str) {
    const clean = String(str).replace(/[^01]/g, "");
    if (clean.length !== 32) return { ok: false, error: "يجب أن تكون 32 بت (أدخلت " + clean.length + ")." };
    let n = 0;
    for (let i = 0; i < 32; i++) n = ((n << 1) >>> 0) + (clean[i] === "1" ? 1 : 0);
    return { ok: true, ip: n, text: intToIp(n) };
  }

  /* ------------------------------ IPv6 (Cisco professional add-on) ------------------------------ */
  function ipv6ToBig(str) {
    if (typeof str !== "string") return null;
    str = str.trim().toLowerCase();
    const pct = str.indexOf("%"); if (pct >= 0) str = str.slice(0, pct);
    const dbl = str.indexOf("::");
    let h, t;
    if (dbl < 0) { h = str.split(":"); t = []; }
    else { h = str.slice(0, dbl).split(":").filter(function (s) { return s !== ""; });
           t = str.slice(dbl + 2).split(":").filter(function (s) { return s !== ""; }); }
    if (h.length + t.length > 8) return null;
    const g = new Array(8).fill(0);
    for (let i = 0; i < h.length; i++) g[i] = parseInt(h[i] || "0", 16);
    for (let i = 0; i < t.length; i++) g[8 - t.length + i] = parseInt(t[i] || "0", 16);
    let n = 0n;
    for (let i = 0; i < 8; i++) n = (n << 16n) | BigInt(g[i] & 0xffff);
    return n;
  }

  function bigToIpv6(n) {
    n = n & ((1n << 128n) - 1n);
    const g = [];
    let t = n;
    for (let i = 0; i < 8; i++) { g.unshift(Number(t & 0xffffn)); t >>= 16n; }
    let best = -1, bestLen = 0, rs = -1, rl = 0;
    for (let i = 0; i < 8; i++) {
      if (g[i] === 0) { if (rs < 0) rs = i; rl++; if (rl > bestLen) { bestLen = rl; best = rs; } }
      else { rs = -1; rl = 0; }
    }
    if (bestLen < 2) return g.map(function (x) { return x.toString(16); }).join(":");
    const left = g.slice(0, best).map(function (x) { return x.toString(16); });
    const right = g.slice(best + bestLen).map(function (x) { return x.toString(16); });
    let s = left.length ? left.join(":") : "";
    s += "::";
    if (right.length) s += right.join(":");
    return s;
  }

  function ipv6Parse(raw) {
    if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "أدخل عنوان IPv6." };
    const s = raw.trim();
    const slash = s.indexOf("/");
    let addr = s, prefix = 64;
    if (slash >= 0) {
      addr = s.slice(0, slash);
      const p = parseInt(s.slice(slash + 1), 10);
      if (isNaN(p) || p < 0 || p > 128) return { ok: false, error: "البادئة يجب أن تكون بين 0 و128." };
      prefix = p;
    }
    const ip = ipv6ToBig(addr);
    if (ip === null || isNaN(Number(ip))) return { ok: false, error: "عنوان IPv6 غير صالح." };
    return { ok: true, ip: ip, prefix: prefix, addr: addr };
  }

  const ALL6 = (1n << 128n) - 1n;
  function ipv6Analyze(ip, prefix) {
    const p = BigInt(prefix);
    const mask = p >= 128n ? ALL6 : (ALL6 ^ ((1n << (128n - p)) - 1n));
    const net = (ip & mask) & ALL6;
    const hostBits = 128 - prefix;
    const total = 1n << BigInt(hostBits);
    const lastRaw = (net | (~mask & ALL6)) & ALL6;
    const first = p >= 127n ? net : net + 1n;
    const last = p >= 127n ? lastRaw : lastRaw - 1n;
    const num64 = p <= 64n ? (1n << (64n - p)) : 0n;
    return {
      ip: ip, prefix: prefix, mask: mask, net: net, first: first, last: last,
      total: total, hostBits: hostBits, num64: num64,
      netStr: bigToIpv6(net), firstStr: bigToIpv6(first), lastStr: bigToIpv6(last)
    };
  }

  function ipv6Split(base, basePrefix, subPrefix, limit) {
    if (subPrefix <= basePrefix) return { ok: false, error: "البادئة الهدف يجب أن تكون أكبر من بادئة الأساس." };
    if (subPrefix > 128) return { ok: false, error: "البادئة القصوى هي /128." };
    const a = ipv6Analyze(base, basePrefix);
    const size = 1n << BigInt(128 - subPrefix);
    const count = 1n << BigInt(subPrefix - basePrefix);
    const lim = limit ? BigInt(Math.min(limit, Number(count))) : count;
    const out = [];
    for (let i = 0n; i < lim; i++) {
      const s = a.net + i * size;
      out.push({ idx: Number(i) + 1, net: s, cidr: bigToIpv6(s) + "/" + subPrefix });
    }
    return { ok: true, base: a, prefix: subPrefix, count: count, size: size, out: out };
  }

  root.SUBNETCORE = {
    U: U,
    ipToInt: ipToInt, intToIp: intToIp,
    prefixToMask: prefixToMask, maskToPrefix: maskToPrefix,
    bin32: bin32, dottedBin: dottedBin, log2ceil: log2ceil,
    parseInput: parseInput, classOf: classOf, classfulPrefix: classfulPrefix,
    scopeOf: scopeOf, analyze: analyze,
    prefixForHosts: prefixForHosts, rowsFor: rowsFor,
    splitByHosts: splitByHosts, splitByNetworks: splitByNetworks,
    vlsm: vlsm, summarize: summarize, rangeToBlocks: rangeToBlocks,
    formats: formats, binaryToIp: binaryToIp,
    ipv6ToBig: ipv6ToBig, bigToIpv6: bigToIpv6, ipv6Parse: ipv6Parse,
    ipv6Analyze: ipv6Analyze, ipv6Split: ipv6Split
  };
})(window);
