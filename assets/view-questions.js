/* ==========================================================================
   view-questions.js — question bank + quiz engine
   ========================================================================== */
(function () {
  "use strict";
  const A = window.APP;
  const { State, $, $$, esc } = A;

  let shown = 0, list = [], revealed = {};

  /* ------------------------------ filtering ------------------------------ */
  function passes(q) {
    if (State.qtrack !== "all" && q.track !== State.qtrack) return false;
    if (State.qtopic !== "all" && q.topic !== State.qtopic) return false;
    if (State.qdiff !== "all" && String(q.diff) !== State.qdiff) return false;
    if (State.qtype !== "all" && q.type !== State.qtype) return false;
    if (State.qstatus !== "all") {
      if (State.qstatus === "fav") {
        if (!State.qfavs[q.id]) return false;
      } else {
        const s = A.qStat(q.id);
        if (State.qstatus === "wrong" && s.bad === 0) return false;
        if (State.qstatus === "correct" && s.ok === 0) return false;
        if (State.qstatus === "unseen" && (s.ok + s.bad) > 0) return false;
      }
    }
    const t = State.qq.trim().toLowerCase();
    if (!t) return true;
    const hay = (A.stripHtml(q.q) + " " + (q.qEn || "") + " " + A.stripHtml(q.ans) + " " + (q.opts || []).join(" ")).toLowerCase();
    return t.split(/\s+/).every(w => hay.indexOf(w) > -1);
  }

  function filtered() { return window.QBANK.questions.filter(passes); }

  function topicName(id) {
    const t = window.QBANK.topics.find(x => x.id === id);
    return t ? t.ar : id;
  }
  function trackName(id) {
    const t = window.QBANK.tracks.find(x => x.id === id);
    return t ? t.ar : id;
  }
  function trackCls(id) {
    return id === "ccna" ? "g" : id === "ccnp" ? "v" : "a";
  }
  const DIFF = { 1: "أساسي", 2: "متوسط", 3: "متقدم" };

  /* ------------------------------ question card ------------------------------ */
  function qCard(q, idx) {
    const st = A.qStat(q.id);
    const isMcq = q.type === "mcq";
    const open = !!revealed[q.id];
    const saved = !!State.qfavs[q.id];
    const stChip = st.bad > 0 ? '<span class="chip r">أخطأت ' + st.bad + '</span>'
      : st.ok > 0 ? '<span class="chip g">صحيح ' + st.ok + '</span>' : "";

    let body = "";
    if (isMcq) {
      body = '<div class="opts" data-opts="' + q.id + '">' +
        q.opts.map((o, i) => '<button class="opt" type="button" data-opt="' + i + '" data-q="' + q.id + '">' +
          '<span class="k">' + "ABCD"[i] + '</span><span>' + o + '</span></button>').join("") +
        '</div>';
    } else {
      body = '<div class="q-actions"><button class="btn btn-sm" type="button" data-reveal="' + q.id + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>' +
        (open ? "إخفاء الإجابة" : "إظهار الإجابة") + '</button></div>' +
        '<div class="q-ans' + (open ? "" : " hidden") + '" data-ans="' + q.id + '"><b class="lbl">الإجابة النموذجية</b>' + q.ans + '</div>';
    }

    return '' +
      '<article class="q-card" data-qid="' + q.id + '" id="q-' + q.id + '">' +
        '<div class="q-head">' +
          '<span class="q-num">' + String(idx + 1).padStart(2, "0") + '</span>' +
          '<div class="q-main">' +
            '<p class="q-text">' + q.q + '</p>' +
            (q.qEn ? '<p class="q-en">' + esc(q.qEn) + '</p>' : '') +
            '<div class="q-tags">' +
              '<span class="chip ' + trackCls(q.track) + '">' + esc(trackName(q.track)) + '</span>' +
              '<span class="chip plain">' + esc(topicName(q.topic)) + '</span>' +
              '<span class="chip plain">' + DIFF[q.diff] + '</span>' +
              (isMcq ? '<span class="chip s">اختيار متعدد</span>' : '<span class="chip t">سؤال مفتوح</span>') +
              stChip +
            '</div>' +
          '</div>' +
          '<button class="q-fav' + (saved ? " on" : "") + '" type="button" data-qfav="' + q.id + '" title="حفظ السؤال للمراجعة" aria-label="حفظ السؤال">' +
            '<svg viewBox="0 0 24 24" fill="' + (saved ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2"><path d="m12 3 2.7 5.9 6.3.7-4.7 4.3 1.3 6.1L12 17l-5.6 3 1.3-6.1L3 9.6l6.3-.7Z"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="q-body">' + body + '</div>' +
      '</article>';
  }

  function paint(root, reset) {
    list = filtered();
    const box = $("#qList", root);
    if (!box) return;
    shown = reset ? 0 : shown;
    const take = Math.min(list.length, shown + 20);
    const slice = list.slice(shown, take);
    const html = slice.map((q, k) => qCard(q, shown + k)).join("");
    if (reset) box.innerHTML = html; else box.insertAdjacentHTML("beforeend", html);
    shown = take;

    const more = $("#qMore", root);
    if (more) { more.classList.toggle("hidden", shown >= list.length); more.textContent = "عرض المزيد (" + (list.length - shown) + " متبقٍ)"; }
    const cnt = $("#qCount", root);
    if (cnt) cnt.textContent = list.length + " سؤال";
    const none = $("#qEmpty", root);
    if (none) none.classList.toggle("hidden", list.length > 0);
  }

  /* ------------------------------ answer handling (browse) ------------------------------ */
  function answerMcq(cardEl, q, choice) {
    const opts = $$(".opt", cardEl);
    opts.forEach(o => { o.disabled = true; o.classList.add("dim"); });
    const chosen = opts[choice];
    const right = opts[q.a];
    right.classList.remove("dim"); right.classList.add("correct");
    const ok = choice === q.a;
    if (!ok) { chosen.classList.remove("dim"); chosen.classList.add("wrong"); }
    A.recordAnswer(q.id, ok);

    const body = $(".q-body", cardEl);
    if (!$(".q-ans", body)) {
      body.insertAdjacentHTML("beforeend",
        '<div class="q-ans"><b class="lbl">' + (ok ? "إجابة صحيحة" : "الإجابة الصحيحة: " + "ABCD"[q.a]) + '</b>' + q.ans + '</div>');
    }
    A.toast(ok ? "إجابة صحيحة" : "إجابة خاطئة");
  }

  /* ------------------------------ quiz engine ------------------------------ */
  function startQuiz(mode) {
    const pool = window.QBANK.questions.filter(q => {
      if (State.qtrack !== "all" && q.track !== State.qtrack) return false;
      if (State.qtopic !== "all" && q.topic !== State.qtopic) return false;
      if (State.qdiff !== "all" && String(q.diff) !== State.qdiff) return false;
      if (mode === "exam" && q.type !== "mcq") return false;
      return true;
    });
    const count = Math.min(+($("#qzCount") && $("#qzCount").value || 20), pool.length);
    if (!pool.length) { A.toast("لا توجد أسئلة مطابقة للفلاتر"); return; }
    const picked = pool.slice().sort(() => Math.random() - 0.5).slice(0, count);
    const mins = +($("#qzTime") && $("#qzTime").value || 0);

    State.quiz = {
      mode: mode,
      ids: picked.map(q => q.id),
      idx: 0,
      answers: {},
      started: Date.now(),
      limit: mins * 60,
      done: false
    };
    State.qview = "run";
    renderRun();
  }

  function renderRun() {
    const view = $("#view");
    const z = State.quiz;
    if (!z) return;
    const q = window.QBANK.questions.find(x => x.id === z.ids[z.idx]);
    if (!q) return finishQuiz();

    const total = z.ids.length;
    const answered = Object.keys(z.answers).length;
    const correct = Object.values(z.answers).filter(a => a.ok).length;

    view.innerHTML = '' +
      '<div class="quiz-top">' +
        '<div class="quiz-meta">' +
          '<div class="quiz-stat"><span>السؤال</span><b>' + (z.idx + 1) + ' / ' + total + '</b></div>' +
          '<div class="quiz-stat"><span>أُجيب</span><b>' + answered + '</b></div>' +
          '<div class="quiz-stat"><span>صحيح</span><b style="color:var(--primary)">' + correct + '</b></div>' +
          (z.mode === "exam" && z.limit ? '<div class="quiz-stat"><span>الوقت</span><b class="quiz-timer" id="qzTimer">--:--</b></div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:7px">' +
          '<button class="btn btn-sm" id="qzQuit" type="button">إنهاء</button>' +
        '</div>' +
      '</div>' +
      '<div class="bar" style="margin-bottom:16px"><i style="width:' + Math.round((answered / total) * 100) + '%"></i></div>' +
      '<article class="q-card">' +
        '<div class="q-head">' +
          '<span class="q-num">' + String(z.idx + 1).padStart(2, "0") + '</span>' +
          '<div class="q-main">' +
            '<p class="q-text">' + q.q + '</p>' +
            (q.qEn ? '<p class="q-en">' + esc(q.qEn) + '</p>' : '') +
            '<div class="q-tags"><span class="chip ' + trackCls(q.track) + '">' + esc(trackName(q.track)) + '</span>' +
              '<span class="chip plain">' + esc(topicName(q.topic)) + '</span>' +
              '<span class="chip plain">' + DIFF[q.diff] + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="q-body" id="qzBody"></div>' +
      '</article>' +
      '<div style="display:flex;justify-content:space-between;gap:10px;margin-top:14px">' +
        '<button class="btn" id="qzPrev" type="button"' + (z.idx === 0 ? " disabled" : "") + '>السابق</button>' +
        '<button class="btn btn-primary" id="qzNext" type="button">' + (z.idx === total - 1 ? "إنهاء وعرض النتيجة" : "التالي") + '</button>' +
      '</div>';

    paintRunnerBody(q);

    $("#qzQuit", view).addEventListener("click", function () {
      if (confirm("إنهاء الجلسة وعرض النتيجة؟")) finishQuiz();
    });
    $("#qzPrev", view).addEventListener("click", function () {
      if (State.quiz.idx > 0) { State.quiz.idx--; renderRun(); }
    });
    $("#qzNext", view).addEventListener("click", function () {
      const cur = window.QBANK.questions.find(x => x.id === State.quiz.ids[State.quiz.idx]);
      if (cur && cur.type === "mcq" && State.quiz.answers[cur.id] === undefined) {
        A.toast("اختر إجابة أولاً");
        return;
      }
      if (cur && cur.type === "open" && State.quiz.answers[cur.id] === undefined) {
        State.quiz.answers[cur.id] = { ok: true, self: true };
      }
      if (State.quiz.idx === State.quiz.ids.length - 1) finishQuiz();
      else { State.quiz.idx++; renderRun(); }
    });

    if (z.mode === "exam" && z.limit) startTimer();
    window.scrollTo(0, 0);
  }

  function paintRunnerBody(q) {
    const body = $("#qzBody");
    const z = State.quiz;
    const ans = z.answers[q.id];

    if (q.type === "mcq") {
      body.innerHTML = '<div class="opts">' + q.opts.map((o, i) =>
        '<button class="opt' + (ans ? (i === q.a ? " correct" : (ans.choice === i ? " wrong" : " dim")) : "") + '" type="button" data-ropt="' + i + '"' + (ans ? " disabled" : "") + '>' +
        '<span class="k">' + "ABCD"[i] + '</span><span>' + o + '</span></button>').join("") + '</div>' +
        (ans ? '<div class="q-ans"><b class="lbl">' + (ans.ok ? "إجابة صحيحة" : "الإجابة الصحيحة: " + "ABCD"[q.a]) + '</b>' + q.ans + '</div>' : '');

      $$("[data-ropt]", body).forEach(btn => {
        btn.addEventListener("click", function () {
          if (State.quiz.answers[q.id]) return;
          const i = +btn.dataset.ropt;
          const ok = i === q.a;
          State.quiz.answers[q.id] = { choice: i, ok: ok };
          A.recordAnswer(q.id, ok);
          paintRunnerBody(q);
          if (State.quiz.mode === "practice") {
            const nx = $("#qzNext");
            if (nx) nx.focus();
          }
        });
      });
    } else {
      const open = !!revealed[q.id];
      body.innerHTML = '<div class="q-actions">' +
        '<button class="btn btn-sm" type="button" id="qzReveal">' + (open ? "إخفاء الإجابة" : "إظهار الإجابة") + '</button>' +
        (open ? '<button class="btn btn-sm btn-primary" type="button" id="qzSelfOk">أجبت صحيحاً</button>' +
                '<button class="btn btn-sm" type="button" id="qzSelfBad">لم أعرف</button>' : '') +
        '</div>' +
        (open ? '<div class="q-ans"><b class="lbl">الإجابة النموذجية</b>' + q.ans + '</div>' : '');

      const rv = $("#qzReveal", body);
      if (rv) rv.addEventListener("click", function () { revealed[q.id] = !revealed[q.id]; paintRunnerBody(q); });
      const okb = $("#qzSelfOk", body);
      if (okb) okb.addEventListener("click", function () {
        State.quiz.answers[q.id] = { ok: true, self: true }; A.recordAnswer(q.id, true);
        A.toast("سُجّل صحيحاً"); nextAfterSelf();
      });
      const bdb = $("#qzSelfBad", body);
      if (bdb) bdb.addEventListener("click", function () {
        State.quiz.answers[q.id] = { ok: false, self: true }; A.recordAnswer(q.id, false);
        A.toast("سُجّل للمراجعة"); nextAfterSelf();
      });
    }
  }

  function nextAfterSelf() {
    const z = State.quiz;
    if (z.idx === z.ids.length - 1) finishQuiz();
    else { z.idx++; renderRun(); }
  }

  let timerId = null;
  function startTimer() {
    clearInterval(timerId);
    const z = State.quiz;
    const tick = () => {
      if (!State.quiz || State.quiz.done) { clearInterval(timerId); return; }
      const left = z.limit - Math.floor((Date.now() - z.started) / 1000);
      const el = $("#qzTimer");
      if (!el) { clearInterval(timerId); return; }
      if (left <= 0) {
        el.textContent = "00:00"; el.className = "quiz-timer danger";
        clearInterval(timerId);
        A.toast("انتهى الوقت");
        finishQuiz();
        return;
      }
      const m = Math.floor(left / 60), s = left % 60;
      el.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
      el.className = "quiz-timer" + (left < 60 ? " danger" : left < 180 ? " warn" : "");
    };
    tick();
    timerId = setInterval(tick, 500);
  }

  function finishQuiz() {
    clearInterval(timerId);
    const z = State.quiz;
    if (!z) return;
    z.done = true;
    State.qview = "result";
    renderResult();
  }

  function renderResult() {
    const view = $("#view");
    const z = State.quiz;
    const total = z.ids.length;
    const answeredIds = Object.keys(z.answers);
    const correct = answeredIds.filter(id => z.answers[id].ok).length;
    const wrongIds = z.ids.filter(id => z.answers[id] && !z.answers[id].ok);
    const skipped = total - answeredIds.length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const secs = Math.round((Date.now() - z.started) / 1000);
    const circ = 2 * Math.PI * 58;

    const tone = pct >= 85 ? "var(--primary)" : pct >= 60 ? "var(--amber)" : "var(--rose)";

    view.innerHTML = '' +
      '<div class="card result-hero">' +
        '<div class="ring">' +
          '<svg viewBox="0 0 132 132">' +
            '<circle cx="66" cy="66" r="58" fill="none" stroke="var(--card3)" stroke-width="9"/>' +
            '<circle cx="66" cy="66" r="58" fill="none" stroke="' + tone + '" stroke-width="9" stroke-linecap="round" ' +
              'stroke-dasharray="' + circ + '" stroke-dashoffset="' + (circ * (1 - pct / 100)) + '"/>' +
          '</svg>' +
          '<div class="val" style="color:' + tone + '">' + pct + '%<small>' + correct + ' / ' + total + '</small></div>' +
        '</div>' +
        '<h3 style="margin:0 0 4px;font-size:19px;font-weight:800">' +
          (pct >= 85 ? "أداء ممتاز" : pct >= 60 ? "أداء جيد — يحتاج صقلاً" : "يحتاج مراجعة") + '</h3>' +
        '<p style="color:var(--muted);font-size:13px;margin:0 0 18px">' +
          'الوقت: ' + Math.floor(secs / 60) + ' د ' + (secs % 60) + ' ث · ' +
          'خطأ: ' + wrongIds.length + ' · متروك: ' + skipped + '</p>' +
        '<div class="grid g4" style="max-width:520px;margin:0 auto 20px">' +
          '<div class="stat"><span class="lbl">صحيحة</span><span class="val g">' + correct + '</span></div>' +
          '<div class="stat"><span class="lbl">خاطئة</span><span class="val" style="color:var(--rose)">' + wrongIds.length + '</span></div>' +
          '<div class="stat"><span class="lbl">متروكة</span><span class="val">' + skipped + '</span></div>' +
          '<div class="stat"><span class="lbl">الأسئلة</span><span class="val">' + total + '</span></div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
          '<button class="btn btn-primary" id="rzAgain" type="button">اختبار جديد</button>' +
          (wrongIds.length ? '<button class="btn" id="rzWrong" type="button">مراجعة الأخطاء (' + wrongIds.length + ')</button>' : '') +
          '<button class="btn" id="rzBank" type="button">العودة للبنك</button>' +
        '</div>' +
      '</div>';

    $("#rzAgain", view).addEventListener("click", function () { State.qview = "setup"; A.go("questions"); });
    $("#rzBank", view).addEventListener("click", function () { State.quiz = null; State.qview = "bank"; A.go("questions"); });
    window.scrollTo(0, 0);
    const rw = $("#rzWrong", view);
    if (rw) rw.addEventListener("click", function () {
      State.quiz = null; State.qview = "bank";
      State.qstatus = "wrong"; State.qq = "";
      A.go("questions");
    });
  }

  /* ------------------------------ page render ------------------------------ */
  A.RENDER.questions = function (root, opts) {
    const z = State.quiz;
    if (State.qview === "run" && z && !z.done) { renderRun(); return; }
    if (State.qview === "result" && z) { renderResult(); return; }
    if (State.qview === "run" || State.qview === "result") State.qview = "bank";

    // deep link: #questions/q205 must show that card regardless of active filters
    const deepQ = opts && opts.deep ? /^q(\d{3})$/.exec(opts.deep) : null;
    if (deepQ && window.QBANK.questions.some(q => q.id === deepQ[0])) {
      State.qq = ""; State.qtopic = "all"; State.qtrack = "all";
      State.qstatus = "all"; State.qview = "bank";
    }

    const all = window.QBANK.questions;
    const total = all.length;
    const mcq = all.filter(q => q.type === "mcq").length;
    const answered = all.filter(q => (A.qStat(q.id).ok + A.qStat(q.id).bad) > 0).length;
    const wrong = all.filter(q => A.qStat(q.id).bad > 0).length;
    const pctSeen = total ? Math.round((answered / total) * 100) : 0;

    const topics = window.QBANK.topics
      .map(t => ({ t: t, n: all.filter(q => q.topic === t.id).length }))
      .filter(x => x.n > 0);

    root.innerHTML = '' +
      '<div class="grid g4" style="margin-bottom:14px">' +
        '<div class="stat"><span class="lbl">إجمالي الأسئلة</span><span class="val">' + total + '</span><span class="sub">' + mcq + ' اختيار متعدد</span></div>' +
        '<div class="stat"><span class="lbl">تمت الإجابة</span><span class="val g">' + answered + '</span><span class="sub">' + pctSeen + '% من البنك</span></div>' +
        '<div class="stat"><span class="lbl">تحتاج مراجعة</span><span class="val" style="color:var(--rose)">' + wrong + '</span><span class="sub">أسئلة أخطأت فيها</span></div>' +
        '<div class="stat"><span class="lbl">لم تُجرَّب</span><span class="val">' + (total - answered) + '</span><span class="sub">جاهزة للاختبار</span></div>' +
      '</div>' +

      '<div class="card" style="margin-bottom:16px">' +
        '<div class="card-h"><div class="card-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 5 5L20 7"/></svg></div>' +
          '<div><b>ابدأ جلسة اختبار</b><span>اختر النطاق ثم عدد الأسئلة — الأسئلة تُسحب عشوائياً</span></div></div>' +
        '<div class="card-b">' +
          '<div class="toolbar" style="margin:0;border:none;background:transparent;padding:0">' +
            '<select class="field" id="qzTrack"><option value="all">كل المسارات</option>' +
              window.QBANK.tracks.map(t => '<option value="' + t.id + '">' + esc(t.ar) + '</option>').join("") + '</select>' +
            '<select class="field" id="qzTopic"><option value="all">كل المواضيع</option>' +
              topics.map(x => '<option value="' + x.t.id + '">' + esc(x.t.ar) + ' (' + x.n + ')</option>').join("") + '</select>' +
            '<select class="field" id="qzCount"><option value="10">10 أسئلة</option><option value="20" selected>20 سؤالاً</option><option value="30">30 سؤالاً</option><option value="50">50 سؤالاً</option></select>' +
            '<select class="field" id="qzTime"><option value="0">بدون مؤقت</option><option value="10">10 دقائق</option><option value="20" selected>20 دقيقة</option><option value="30">30 دقيقة</option></select>' +
            '<button class="btn btn-primary" id="qzStartExam" type="button">اختبار مُوقَّت</button>' +
            '<button class="btn" id="qzStartPractice" type="button">تدريب مع الشرح</button>' +
          '</div>' +
          '<div class="note i" style="margin:12px 0 0"><b>الفرق بين الوضعين</b>الاختبار المُوقَّت يستخدم أسئلة الاختيار من متعدد فقط ويصحّح تلقائياً. التدريب يشمل الأسئلة المفتوحة ويطلب منك تقييم نفسك بعد كشف الإجابة.</div>' +
        '</div>' +
      '</div>' +

      '<div class="toolbar">' +
        '<div class="grow">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
          '<input id="qq" class="field" type="search" placeholder="ابحث في الأسئلة والإجابات…" value="' + esc(State.qq) + '" autocomplete="off">' +
        '</div>' +
        '<select class="field" id="qtrack"><option value="all">كل المسارات</option>' +
          window.QBANK.tracks.map(t => '<option value="' + t.id + '"' + (State.qtrack === t.id ? " selected" : "") + '>' + esc(t.ar) + '</option>').join("") + '</select>' +
        '<select class="field" id="qtopic"><option value="all">كل المواضيع</option>' +
          topics.map(x => '<option value="' + x.t.id + '"' + (State.qtopic === x.t.id ? " selected" : "") + '>' + esc(x.t.ar) + '</option>').join("") + '</select>' +
        '<select class="field" id="qdiff"><option value="all">كل المستويات</option>' +
          '<option value="1"' + (State.qdiff === "1" ? " selected" : "") + '>أساسي</option>' +
          '<option value="2"' + (State.qdiff === "2" ? " selected" : "") + '>متوسط</option>' +
          '<option value="3"' + (State.qdiff === "3" ? " selected" : "") + '>متقدم</option></select>' +
        '<select class="field" id="qtype"><option value="all">كل الأنواع</option>' +
          '<option value="mcq"' + (State.qtype === "mcq" ? " selected" : "") + '>اختيار متعدد</option>' +
          '<option value="open"' + (State.qtype === "open" ? " selected" : "") + '>مفتوح</option></select>' +
        '<select class="field" id="qstatus"><option value="all">كل الحالات</option>' +
          '<option value="wrong"' + (State.qstatus === "wrong" ? " selected" : "") + '>أخطأت فيها</option>' +
          '<option value="correct"' + (State.qstatus === "correct" ? " selected" : "") + '>أجبتها صحيحة</option>' +
          '<option value="fav"' + (State.qstatus === "fav" ? " selected" : "") + '>المحفوظة ★</option>' +
          '<option value="unseen"' + (State.qstatus === "unseen" ? " selected" : "") + '>لم تُجرَّب</option></select>' +
      '</div>' +

      '<div style="display:flex;align-items:center;justify-content:space-between;margin:0 2px 10px">' +
        '<span id="qCount" class="chip plain">0 سؤال</span>' +
        '<button class="btn btn-sm" id="qReset" type="button">تصفير الفلاتر</button>' +
      '</div>' +

      '<div id="qList" class="q-wrap"></div>' +
      '<div class="empty hidden" id="qEmpty"><b>لا أسئلة مطابقة</b><span>خفّف الفلاتر أو امسح البحث</span></div>' +
      '<div style="text-align:center;margin-top:16px"><button class="btn hidden" id="qMore" type="button">عرض المزيد</button></div>';

    revealed = {};
    paint(root, true);

    // filter events
    const qq = $("#qq", root);
    qq.addEventListener("input", A.debounce(function () { State.qq = qq.value; paint(root, true); }, 150));
    $("#qtrack", root).addEventListener("change", function () { State.qtrack = this.value; paint(root, true); });
    $("#qtopic", root).addEventListener("change", function () { State.qtopic = this.value; paint(root, true); });
    $("#qdiff", root).addEventListener("change", function () { State.qdiff = this.value; paint(root, true); });
    $("#qtype", root).addEventListener("change", function () { State.qtype = this.value; paint(root, true); });
    $("#qstatus", root).addEventListener("change", function () { State.qstatus = this.value; paint(root, true); });
    $("#qMore", root).addEventListener("click", function () { paint(root, false); });
    $("#qReset", root).addEventListener("click", function () {
      State.qq = ""; State.qtrack = "all"; State.qtopic = "all";
      State.qdiff = "all"; State.qtype = "all"; State.qstatus = "all";
      A.go("questions");
    });

    $("#qzStartExam", root).addEventListener("click", function () {
      State.qtrack = $("#qzTrack", root).value;
      State.qtopic = $("#qzTopic", root).value;
      State.qdiff = "all";
      startQuiz("exam");
    });
    $("#qzStartPractice", root).addEventListener("click", function () {
      State.qtrack = $("#qzTrack", root).value;
      State.qtopic = $("#qzTopic", root).value;
      State.qdiff = "all";
      startQuiz("practice");
    });

    // answer / reveal / bookmark
    $("#qList", root).addEventListener("click", function (e) {
      const favBtn = e.target.closest("[data-qfav]");
      if (favBtn) {
        const on = A.toggleQFav(favBtn.dataset.qfav);
        favBtn.classList.toggle("on", on);
        const svg = favBtn.querySelector("svg");
        if (svg) svg.setAttribute("fill", on ? "currentColor" : "none");
        A.toast(on ? "حُفظ السؤال للمراجعة" : "أُزيل من المحفوظات");
        if (State.qstatus === "fav") paint(root, true);
        return;
      }
      const opt = e.target.closest("[data-opt]");
      if (opt) {
        const id = opt.dataset.q;
        const q = window.QBANK.questions.find(x => x.id === id);
        const cardEl = opt.closest(".q-card");
        if (cardEl.dataset.answered) return;
        cardEl.dataset.answered = "1";
        answerMcq(cardEl, q, +opt.dataset.opt);
        return;
      }
      const rv = e.target.closest("[data-reveal]");
      if (rv) {
        const id = rv.dataset.reveal;
        revealed[id] = !revealed[id];
        const ans = document.querySelector('[data-ans="' + id + '"]');
        if (ans) ans.classList.toggle("hidden", !revealed[id]);
        rv.lastChild.textContent = revealed[id] ? "إخفاء الإجابة" : "إظهار الإجابة";
        return;
      }
    });

    // deep link: scroll to the requested card once the list has painted
    if (deepQ) setTimeout(() => A.focusQuestion(deepQ[0]), 120);
  };

  A.startQuiz = startQuiz;

  /* Bring a specific question into view, painting extra pages if needed.
     Used by the command drawer and the quick-search palette. */
  A.focusQuestion = function (id) {
    const find = () => document.querySelector('[data-qid="' + id + '"]');
    let el = find(), guard = 0;
    while (!el && guard++ < 40) {
      const more = $("#qMore");
      if (!more || more.classList.contains("hidden")) break;
      more.click();
      el = find();
    }
    if (el) {
      el.scrollIntoView({ block: "center" });
      el.style.outline = "2px solid var(--primary)";
      el.style.outlineOffset = "2px";
      setTimeout(function () { el.style.outline = ""; el.style.outlineOffset = ""; }, 1800);
      return true;
    }
    return false;
  };
})();
