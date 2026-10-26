(() => {
  const CASES = window.CASES;
  const DAILY = 10;
  const KEY = 'claimdenied.mvp.v1';
  const DECISIONS = { pay: '지급', deny: '기각', hold: '보류' };
  const STAMPS = { pay: '지급 승인', deny: 'CLAIM DENIED', hold: '보류' };

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const won = (n) => n.toLocaleString('ko-KR') + '원';
  const byId = (id) => CASES.find((c) => c.id === id);
  const evOf = (c, id) => c.evidence.find((e) => e.id === id);

  // 진행 상태. localStorage가 막혀 있으면 메모리에만 둔다.
  function fresh() {
    const cases = {};
    CASES.forEach((c) => (cases[c.id] = { status: 'open', unlocked: [], pins: [], used: [], spent: 0, draft: {}, result: null }));
    return { day: 1, resources: DAILY, pending: [], cases };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign(fresh(), JSON.parse(raw));
    } catch (e) { /* 저장소 없음 */ }
    return fresh();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 저장소 없음 */ }
  }
  let S = load();
  let flash = '';
  let pane = 'docs';

  const isOpen = (c, cs, id) => !window.isLockedEvidence(c, id) || cs.unlocked.includes(id);
  const pendingFor = (id) => S.pending.filter((p) => p.case === id);

  // 강등 표식: 해금된 자료 중 이 자료를 약화시키는 것.
  function underminedBy(c, cs, id) {
    return c.evidence.filter((e) => (e.undermines || []).includes(id) && isOpen(c, cs, e.id));
  }

  /* ---------- 채점 (설계서 6절, 8절의 허용 범위) ---------- */
  function grade(c, cs, decision, amount, choices) {
    const notes = [];
    const pins = cs.pins;
    if (decision === 'deny') {
      return { label: '오답', tone: 'wrong', notes: [c.denyNote] };
    }
    if (decision === 'hold') {
      if (c.holdOk({ pending: pendingFor(c.id) }))
        return { label: '정당한 보류', tone: 'ok', notes: ['요청한 순찰 일지가 도착하면 다시 판정할 수 있습니다. 정보가 부족할 때 보류는 합리적입니다.'] };
      if (!cs.used.length)
        return { label: '보류, 처리 효율 감점', tone: 'partial', notes: ['조사 없이 보류했습니다. 보류는 무엇을 기다리는지가 분명할 때 씁니다.'] };
      return { label: '보류, 판단 근거는 이미 있음', tone: 'partial', notes: ['지금 가진 자료로 판정할 수 있었습니다.'] };
    }
    if (c.itemized) {
      const wrong = c.items.filter((it, i) => choices[i] !== it.covered);
      if (wrong.length && choices.every(Boolean)) {
        return { label: '부분 오답, 원인 미분리', tone: 'partial', notes: [c.mergeNote] };
      }
      if (wrong.length) {
        wrong.forEach((it) => notes.push(`${it.label}: ${it.covered ? '보장' : '면책'}입니다. ${it.why}.`));
        return { label: '오답, 항목 판정 불일치', tone: 'wrong', notes };
      }
    }
    if (amount === c.expectedPayout) {
      const missing = c.required.filter((id) => !pins.includes(id));
      const rebutOk = !c.rebuttal.length || c.rebuttal.some((id) => pins.includes(id));
      missing.forEach((id) => notes.push(`필수 근거 ${id} ${evOf(c, id).title}이(가) 판정서에 없습니다.`));
      if (!rebutOk) notes.push(c.rebuttalNote);
      lureNotes(c, pins, notes);
      if (!missing.length && rebutOk) return { label: '정답', tone: 'ok', notes };
      return { label: '부분 정답, 근거 미연결', tone: 'partial', notes };
    }
    const gross = c.expectedPayout + c.deductible;
    if (amount === gross) {
      notes.push(`자기부담금을 빼지 않았습니다. ${c.itemized ? '보장 항목 합계' : '청구'} ${won(gross)}에서 자기부담금 ${won(c.deductible)}을 빼야 합니다.`);
      lureNotes(c, pins, notes);
      return { label: '부분 오답, 자기부담금 누락', tone: 'partial', notes };
    }
    notes.push(`지급액은 ${c.itemized ? '보장 항목 합계' : '청구'} ${won(gross)}에서 자기부담금 ${won(c.deductible)}을 뺀 금액입니다.`);
    return { label: '오답, 금액 불일치', tone: 'wrong', notes };
  }
  function lureNotes(c, pins, notes) {
    c.evidence.filter((e) => e.lure && pins.includes(e.id)).forEach((e) => notes.push(`${e.id} ${e.title}은(는) 지급 근거가 아닙니다.`));
  }

  /* ---------- 상단 바 ---------- */
  function renderBar() {
    $('#day').textContent = `${S.day}일차`;
    $('#res').textContent = `${S.resources} / ${DAILY}`;
    $('#res-wrap').setAttribute('aria-label', `조사 자원 ${S.resources} 남음, 하루 ${DAILY}`);
    $('#status').textContent = flash;
  }

  /* ---------- 사건함 ---------- */
  const STATUS = { open: '미처리', held: '보류', closed: '종결' };
  function renderQueue() {
    const done = CASES.every((c) => S.cases[c.id].status === 'closed');
    const rows = CASES.map((c) => {
      const cs = S.cases[c.id];
      const wait = pendingFor(c.id).map((p) => `${p.arrives}일차 도착 예정`).join(', ');
      return `<tr>
        <th scope="row"><a href="#/case/${c.id}">#${c.id} ${esc(c.title)}</a></th>
        <td>${esc(c.claimant)}</td>
        <td>${esc(c.product)}</td>
        <td class="num r">${won(c.claimAmount)}</td>
        <td>${STATUS[cs.status]}${wait ? `<span class="sub">${esc(wait)}</span>` : ''}${cs.result ? `<span class="sub">${esc(cs.result.label)}</span>` : ''}</td>
      </tr>`;
    }).join('');
    return `<div class="container queue">
      <div class="queue__head">
        <h1>사건함</h1>
        <p class="lead">판정은 약관과 기록으로 합니다. 조사 자원은 하루 ${DAILY}이고, 근무를 마치면 다시 채워집니다.</p>
      </div>
      ${done ? `<div class="empty"><p><strong>오늘 사건을 모두 종결했습니다.</strong> 처음부터 다시 하려면 진행 기록을 지우세요.</p></div>` : ''}
      <table class="tbl">
        <thead><tr><th scope="col">사건</th><th scope="col">청구인</th><th scope="col">상품</th><th scope="col" class="r">청구액</th><th scope="col">상태</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="queue__foot"><button class="btn btn--quiet" type="button" data-act="reset">진행 기록 지우기</button></p>
    </div>`;
  }

  /* ---------- 사건 작업 화면 ---------- */
  function renderCase(c, sel) {
    const cs = S.cases[c.id];
    const open = c.evidence.filter((e) => isOpen(c, cs, e.id));
    if (!sel || (sel !== 'policy' && !open.some((e) => e.id === sel))) sel = open[0].id;

    const evRows = open.map((e) => {
      const weak = underminedBy(c, cs, e.id);
      return `<li><a class="ev${e.id === sel ? ' is-current' : ''}" href="#/case/${c.id}/${e.id}"${e.id === sel ? ' aria-current="page"' : ''}>
        <span class="ev__id num">${e.id}</span>
        <span class="ev__t">${esc(e.title)}</span>
        <span class="ev__m">신뢰도 ${esc(e.reliability)}${cs.pins.includes(e.id) ? ', 근거로 고정' : ''}</span>
        ${weak.length ? `<span class="ev__warn">${esc(weak.map((w) => w.title).join(', '))}와 불일치</span>` : ''}
      </a></li>`;
    }).join('');

    const actRows = c.actions.map((a) => {
      const ev = evOf(c, a.unlocks);
      const used = cs.used.includes(a.id);
      const pend = S.pending.find((p) => p.case === c.id && p.evidence === a.unlocks);
      const cost = a.cost ? `자원 ${a.cost}` : '무료';
      const lag = a.delay ? `, ${a.delay}일 지연` : '';
      let state;
      if (pend) state = `<span class="act__state">${pend.arrives}일차 도착 예정</span>`;
      else if (used) state = `<span class="act__state">${esc(ev.id)} 확보</span>`;
      else if (cs.status === 'closed') state = `<span class="act__state">종결된 사건</span>`;
      else {
        const short = a.cost > S.resources;
        state = `<button class="btn btn--secondary btn--s" type="button" data-act="investigate" data-id="${a.id}"${short ? ' disabled aria-describedby="short-' + a.id + '"' : ''}>실행</button>${short ? `<span class="act__state" id="short-${a.id}">자원 부족</span>` : ''}`;
      }
      return `<li class="act"><span class="act__l">${esc(a.label)}<span class="sub">${cost}${lag}</span></span>${state}</li>`;
    }).join('');

    const viewer = sel === 'policy' ? renderPolicy(c) : renderDoc(c, cs, evOf(c, sel));

    return `<div class="container case">
      <div class="case__head">
        <p class="crumb"><a href="#/queue">사건함</a></p>
        <h1>#${c.id} ${esc(c.title)}</h1>
        <dl class="case__meta">
          <div><dt>청구인</dt><dd>${esc(c.claimant)}</dd></div>
          <div><dt>상품</dt><dd>${esc(c.product)}</dd></div>
          <div><dt>청구액</dt><dd class="num">${won(c.claimAmount)}</dd></div>
          <div><dt>상태</dt><dd>${STATUS[cs.status]}</dd></div>
        </dl>
      </div>
      <div class="panes-tabs" role="tablist" aria-label="작업 영역">
        ${[['list', '증거'], ['docs', '문서'], ['form', '판정서']].map(([k, l]) => `<button type="button" role="tab" id="tab-${k}" aria-controls="pane-${k}" aria-selected="${pane === k}" tabindex="${pane === k ? 0 : -1}" data-act="pane" data-id="${k}">${l}</button>`).join('')}
      </div>
      <div class="desk" data-pane="${pane}">
        <section class="pane pane--list" id="pane-list" aria-labelledby="h-list">
          <h2 id="h-list">증거 목록</h2>
          <ul class="evs">${evRows}</ul>
          <p class="rule-link"><a class="ev${sel === 'policy' ? ' is-current' : ''}" href="#/case/${c.id}/policy"${sel === 'policy' ? ' aria-current="page"' : ''}><span class="ev__t">약관 규정집</span><span class="ev__m">${esc(c.policy.name)}</span></a></p>
          <h2 class="h-act">조사</h2>
          <ul class="acts">${actRows}</ul>
        </section>
        <section class="pane pane--docs" id="pane-docs" aria-label="문서 뷰어">${viewer}</section>
        <section class="pane pane--form" id="pane-form" aria-labelledby="h-form">${renderForm(c, cs)}</section>
      </div>
    </div>`;
  }

  function renderDoc(c, cs, e) {
    const d = e.doc;
    const pinned = cs.pins.includes(e.id);
    const weak = underminedBy(c, cs, e.id);
    const supports = (e.corroborates || []).filter((id) => isOpen(c, cs, id)).map((id) => evOf(c, id));
    const counters = (e.undermines || []).filter((id) => isOpen(c, cs, id)).map((id) => evOf(c, id));
    return `<article class="sheet">
      <header class="sheet__head">
        <h2>${esc(e.title)}</h2>
        <p class="sheet__id"><span class="num">${e.id}</span><span>${esc(e.kind)}</span></p>
      </header>
      ${d.meta ? `<dl class="kv">${d.meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
      ${d.table ? `<table class="tbl tbl--doc"><thead><tr>${d.table.head.map((h, i) => `<th scope="col"${i && /금액/.test(h) ? ' class="r"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${d.table.rows.map((r) => `<tr>${r.map((v, i) => `<td${/원$/.test(v) ? ' class="num r"' : i === 0 ? ' class="num"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
        ${d.table.foot ? `<tfoot><tr>${d.table.foot.map((v, i) => `<td${i ? ' class="num r"' : ''}>${esc(v)}</td>`).join('')}</tr></tfoot>` : ''}</table>` : ''}
      ${d.qa ? `<dl class="qa">${d.qa.map(([q, a]) => `<div><dt>${esc(q)}</dt><dd>${esc(a)}</dd></div>`).join('')}</dl>` : ''}
      ${d.body ? `<div class="sheet__body">${d.body.map((p) => `<p>${esc(p)}</p>`).join('')}</div>` : ''}
      <dl class="sheet__foot">
        <div><dt>신뢰도</dt><dd>${esc(e.reliability)}</dd></div>
        ${weak.length ? `<div class="is-warn"><dt>대조 결과</dt><dd>${weak.map((w) => `<a href="#/case/${c.id}/${w.id}">${esc(w.title)}</a>`).join(', ')}와(과) 맞지 않습니다.</dd></div>` : ''}
        ${counters.length ? `<div><dt>반박하는 자료</dt><dd>${counters.map((w) => `<a href="#/case/${c.id}/${w.id}">${esc(w.title)}</a>`).join(', ')}</dd></div>` : ''}
        ${supports.length ? `<div><dt>보강하는 자료</dt><dd>${supports.map((w) => `<a href="#/case/${c.id}/${w.id}">${esc(w.title)}</a>`).join(', ')}</dd></div>` : ''}
      </dl>
      ${S.cases[c.id].status === 'closed' ? '' : `<p class="sheet__act"><button class="btn btn--secondary" type="button" data-act="pin" data-id="${e.id}" aria-pressed="${pinned}">${pinned ? '근거에서 빼기' : '근거로 고정'}</button></p>`}
    </article>`;
  }

  function renderPolicy(c) {
    return `<article class="sheet">
      <header class="sheet__head"><h2>약관 규정집</h2><p class="sheet__id"><span>${esc(c.policy.name)}</span></p></header>
      <dl class="kv kv--rules">${c.policy.clauses.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    </article>`;
  }

  /* ---------- 판정서 (시그니처) ---------- */
  function renderForm(c, cs) {
    if (cs.status === 'closed') {
      return `<div class="verdict-form verdict-form--closed"><h2 id="h-form">판정서</h2><p>종결된 사건입니다.</p><p><a href="#/result/${c.id}">판정 결과 보기</a></p></div>`;
    }
    const d = cs.draft;
    const pins = cs.pins.map((id) => evOf(c, id));
    return `<form class="verdict-form" data-act="submit" novalidate>
      <h2 id="h-form">판정서</h2>
      <p class="vf__no">사건 <span class="num">#${c.id}</span>, 담당 손해사정사</p>
      <fieldset class="seg"><legend>결정</legend>
        ${Object.entries(DECISIONS).map(([k, l]) => `<input type="radio" name="decision" id="d-${k}" value="${k}"${d.decision === k ? ' checked' : ''}><label for="d-${k}">${l}</label>`).join('')}
      </fieldset>
      ${c.itemized ? renderItems(c, d) : ''}
      <div class="field">
        <label for="amount">지급액 (원)</label>
        <input id="amount" name="amount" type="text" inputmode="numeric" autocomplete="off" value="${d.amount ? esc(d.amount) : ''}" aria-describedby="amount-help"${d.decision !== 'pay' ? ' disabled' : ''}>
        <p class="help" id="amount-help">${c.itemized ? '보장 항목 소계에서' : `청구 금액 ${won(c.claimAmount)}.`} 약관의 자기부담금을 확인하세요.</p>
      </div>
      <div class="basis">
        <p class="basis__l">근거 자료 <span class="num">${pins.length}</span>건</p>
        ${pins.length
          ? `<ul>${pins.map((e) => `<li><span class="num">${e.id}</span> ${esc(e.title)} <button class="link" type="button" data-act="pin" data-id="${e.id}" aria-label="${esc(e.title)} 근거에서 빼기">빼기</button></li>`).join('')}</ul>`
          : `<p class="basis__empty">고정한 자료가 없습니다. 문서를 열고 근거로 고정을 누르면 여기에 들어옵니다.</p>`}
      </div>
      <p class="help help--err" id="form-err" aria-live="polite"></p>
      <button class="btn btn--primary" type="submit">판정 제출</button>
    </form>`;
  }

  // 항목별 사건: 손해 항목마다 보장과 면책을 고르고, 보장 항목 소계를 보여준다.
  function renderItems(c, d) {
    const picks = d.items || [];
    const off = d.decision !== 'pay';
    return `<fieldset class="items"${off ? ' disabled' : ''} aria-describedby="items-help"><legend>항목별 판정</legend>
      <p class="help" id="items-help">${off ? '지급을 고르면 항목별로 판정합니다.' : ''}</p>
      ${c.items.map((it, i) => `<div class="items__row">
        <p class="items__l">${esc(it.label)}<span class="num">${won(it.amount)}</span></p>
        <div class="seg seg--s" role="radiogroup" aria-label="${esc(it.label)}">
          <input type="radio" name="item-${i}" id="i${i}-y" value="y"${picks[i] === 'y' ? ' checked' : ''}><label for="i${i}-y">보장</label>
          <input type="radio" name="item-${i}" id="i${i}-n" value="n"${picks[i] === 'n' ? ' checked' : ''}><label for="i${i}-n">면책</label>
        </div>
      </div>`).join('')}
      <p class="items__sum" aria-live="polite">보장 항목 소계 <span class="num" id="covered-sum">${won(coveredSum(c, picks))}</span></p>
    </fieldset>`;
  }
  function coveredSum(c, picks) {
    return c.items.reduce((n, it, i) => n + (picks[i] === 'y' ? it.amount : 0), 0);
  }

  /* ---------- 결과와 해설 ---------- */
  function renderResult(c) {
    const cs = S.cases[c.id];
    const r = cs.result;
    if (!r) return renderCase(c);
    const pins = r.pins.map((id) => evOf(c, id));
    return `<div class="container result">
      <p class="crumb"><a href="#/queue">사건함</a></p>
      <div class="result__grid">
        <article class="verdict-form verdict-form--done" aria-labelledby="h-done">
          <h1 id="h-done">#${c.id} 판정서</h1>
          <dl class="kv">
            <div><dt>사건</dt><dd>${esc(c.title)}</dd></div>
            <div><dt>결정</dt><dd>${DECISIONS[r.decision]}</dd></div>
            ${r.decision === 'pay' && c.itemized ? `<div><dt>항목</dt><dd>${c.items.map((it, i) => `${esc(it.label)}: ${r.choices[i] ? '보장' : '면책'}`).join('<br>')}</dd></div>` : ''}
            ${r.decision === 'pay' ? `<div><dt>지급액</dt><dd class="num">${won(r.amount)}</dd></div>` : ''}
            <div><dt>근거</dt><dd>${pins.length ? pins.map((e) => `${e.id} ${esc(e.title)}`).join('<br>') : '없음'}</dd></div>
            <div><dt>판정일</dt><dd>${r.day}일차</dd></div>
          </dl>
          <p class="stamp stamp--${r.decision}" aria-label="도장: ${STAMPS[r.decision]}"><span>${STAMPS[r.decision]}</span></p>
        </article>
        <section class="review" aria-labelledby="h-review">
          <h2 id="h-review" class="review__label review__label--${r.tone}">${esc(r.label)}</h2>
          ${r.notes.length ? `<ul class="notes">${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
          <h3>해설</h3>
          <p>${esc(c.explanation)}</p>
          ${c.itemized ? `<table class="tbl tbl--answer">
            <thead><tr><th scope="col">손해 항목</th><th scope="col" class="r">금액</th><th scope="col">판정</th><th scope="col">이유</th></tr></thead>
            <tbody>${c.items.map((it) => `<tr><th scope="row">${esc(it.label)}</th><td class="num r">${won(it.amount)}</td><td>${it.covered ? '보장' : '면책'}</td><td>${esc(it.why)}</td></tr>`).join('')}</tbody>
          </table>` : ''}
          <dl class="kv kv--tight">
            <div><dt>정답 지급액</dt><dd class="num">${won(c.expectedPayout)}</dd></div>
            <div><dt>이 사건에 쓴 자원</dt><dd class="num">${cs.spent}</dd></div>
          </dl>
          <p class="result__acts">
            <a class="btn btn--primary" href="#/queue">사건함으로</a>
            ${r.decision === 'hold' ? `<a class="btn btn--secondary" href="#/case/${c.id}">사건 다시 열기</a>` : `<button class="btn btn--secondary" type="button" data-act="replay" data-id="${c.id}">이 사건 다시 하기</button>`}
          </p>
        </section>
      </div>
    </div>`;
  }

  function renderError(problems) {
    return `<div class="container"><div class="empty empty--err" role="alert">
      <h1>사건 자료를 열 수 없습니다</h1>
      <p>콘텐츠 검증에서 문제가 나왔습니다. cases.js를 고친 뒤 다시 여세요.</p>
      <ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    </div></div>`;
  }

  /* ---------- 라우팅 ---------- */
  function route() {
    const [, view, id, sel] = (location.hash || '#/queue').split('/');
    const main = $('#main');
    const problems = window.validateCases(CASES);
    renderBar();
    if (problems.length) { main.innerHTML = renderError(problems); console.error(problems); return; }
    const c = id && byId(id);
    if (view === 'case' && c) main.innerHTML = renderCase(c, sel);
    else if (view === 'result' && c) main.innerHTML = renderResult(c);
    else main.innerHTML = renderQueue();
    document.title = c ? `#${c.id} ${c.title}, CLAIM DENIED` : '사건함, CLAIM DENIED';
  }
  function rerender() { save(); route(); }
  function currentCase() {
    const [, , id] = location.hash.split('/');
    return byId(id);
  }

  /* ---------- 행동 ---------- */
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act]');
    if (!t || t.tagName === 'FORM') return;
    const act = t.dataset.act;
    const c = currentCase();
    if (act === 'pin' && c) {
      const cs = S.cases[c.id];
      const i = cs.pins.indexOf(t.dataset.id);
      if (i >= 0) cs.pins.splice(i, 1); else cs.pins.push(t.dataset.id);
      flash = '';
      keepDraft(c);
      rerender();
      const again = document.querySelector(`.sheet [data-act="pin"][data-id="${t.dataset.id}"]`) || $('#pane-form h2');
      if (again) again.focus();
    } else if (act === 'investigate' && c) {
      const cs = S.cases[c.id];
      const a = c.actions.find((x) => x.id === t.dataset.id);
      if (!a || cs.used.includes(a.id) || a.cost > S.resources) return;
      S.resources -= a.cost;
      cs.spent += a.cost;
      cs.used.push(a.id);
      const ev2 = evOf(c, a.unlocks);
      if (a.delay) {
        S.pending.push({ case: c.id, evidence: a.unlocks, arrives: S.day + a.delay });
        flash = `${a.label}: ${ev2.title}은(는) ${S.day + a.delay}일차에 도착합니다.`;
        keepDraft(c);
        rerender();
      } else {
        cs.unlocked.push(a.unlocks);
        flash = `${a.label}: ${ev2.title}을(를) 확보했습니다.`;
        keepDraft(c);
        save();
        renderBar();
        location.hash = `#/case/${c.id}/${a.unlocks}`;
      }
    } else if (act === 'pane') {
      pane = t.dataset.id;
      if (c) keepDraft(c);
      route();
      const tab = $(`#tab-${pane}`);
      if (tab) tab.focus();
    } else if (act === 'reset') {
      if (!confirm('진행 기록을 모두 지우고 1일차부터 다시 시작할까요?')) return;
      S = fresh();
      flash = '진행 기록을 지웠습니다.';
      rerender();
    } else if (act === 'replay') {
      const id = t.dataset.id;
      S.cases[id] = fresh().cases[id];
      S.pending = S.pending.filter((p) => p.case !== id);
      flash = `#${id}을(를) 처음 상태로 돌렸습니다. 이미 쓴 자원은 돌아오지 않습니다.`;
      save();
      location.hash = `#/case/${id}`;
    } else if (act === 'endday') {
      S.day += 1;
      S.resources = DAILY;
      const arrived = S.pending.filter((p) => p.arrives <= S.day);
      S.pending = S.pending.filter((p) => p.arrives > S.day);
      arrived.forEach((p) => {
        const cs = S.cases[p.case];
        if (!cs.unlocked.includes(p.evidence)) cs.unlocked.push(p.evidence);
      });
      flash = `${S.day}일차 근무를 시작했습니다. 조사 자원 ${DAILY}.` +
        (arrived.length ? ` 도착한 자료: ${arrived.map((p) => `#${p.case} ${evOf(byId(p.case), p.evidence).title}`).join(', ')}.` : '');
      if (c) keepDraft(c);
      rerender();
    }
  });

  // 판정서 입력값은 다시 그릴 때 사라지지 않도록 보관한다.
  function keepDraft(c) {
    const f = $('.verdict-form[data-act="submit"]');
    if (!f) return;
    const d = new FormData(f);
    S.cases[c.id].draft = { decision: d.get('decision') || '', amount: d.get('amount') || '', items: c.items.map((_, i) => d.get(`item-${i}`) || '') };
  }

  document.addEventListener('change', (ev) => {
    const c = currentCase();
    if (c && /^item-/.test(ev.target.name)) {
      keepDraft(c); save();
      $('#covered-sum').textContent = won(coveredSum(c, S.cases[c.id].draft.items));
      return;
    }
    if (ev.target.name !== 'decision') return;
    const amt = $('#amount');
    amt.disabled = ev.target.value !== 'pay';
    const items = $('fieldset.items');
    if (items) {
      items.disabled = ev.target.value !== 'pay';
      $('#items-help').textContent = items.disabled ? '지급을 고르면 항목별로 판정합니다.' : '';
    }
    if (c) { keepDraft(c); save(); }
  });

  // 탭 사이를 화살표로 이동한다.
  document.addEventListener('keydown', (ev) => {
    const t = ev.target.closest('[role="tab"]');
    if (!t || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
    const tabs = [...t.parentElement.children];
    const next = tabs[(tabs.indexOf(t) + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.click();
  });

  document.addEventListener('submit', (ev) => {
    const f = ev.target.closest('form[data-act="submit"]');
    if (!f) return;
    ev.preventDefault();
    const c = currentCase();
    const cs = S.cases[c.id];
    const err = $('#form-err');
    const amtEl = $('#amount');
    amtEl.removeAttribute('aria-invalid');
    const decision = new FormData(f).get('decision');
    if (!decision) {
      err.textContent = '결정을 고르세요. 지급, 기각, 보류 중 하나입니다.';
      $('#d-pay').focus();
      return;
    }
    let amount = null;
    let choices = null;
    if (decision === 'pay' && c.itemized) {
      const fd = new FormData(f);
      const missing = c.items.findIndex((_, i) => !fd.get(`item-${i}`));
      if (missing >= 0) {
        err.textContent = `${c.items[missing].label}의 보장, 면책을 고르세요. 모든 항목을 판정해야 제출할 수 있습니다.`;
        $(`#i${missing}-y`).focus();
        return;
      }
      choices = c.items.map((_, i) => fd.get(`item-${i}`) === 'y');
    }
    if (decision === 'pay') {
      const digits = amtEl.value.replace(/[^\d]/g, '');
      if (!digits) {
        amtEl.setAttribute('aria-invalid', 'true');
        amtEl.setAttribute('aria-describedby', 'amount-help form-err');
        err.textContent = '지급액을 숫자로 적으세요. 청구 금액과 약관의 자기부담금을 확인하세요.';
        amtEl.focus();
        return;
      }
      amount = Number(digits);
    }
    const g = grade(c, cs, decision, amount, choices);
    cs.result = { decision, amount, choices, pins: cs.pins.slice(), day: S.day, ...g };
    cs.status = decision === 'hold' ? 'held' : 'closed';
    cs.draft = {};
    flash = `#${c.id} 판정을 제출했습니다: ${DECISIONS[decision]}.`;
    save();
    location.hash = `#/result/${c.id}`;
    const h = $('#h-done');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  });

  window.addEventListener('hashchange', () => {
    route();
    const h = $('#main h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  });
  route();
})();
