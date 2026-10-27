(() => {
  const CASES = window.CASES;
  const DAILY = 10;
  const KEY = 'claimdenied.desk.v1';
  const DECISIONS = { pay: '지급', deny: '기각', hold: '보류' };
  const STAMPS = { pay: '지급 승인', deny: 'CLAIM DENIED', hold: '보류' };
  const PAPER = {
    청구서: 'form', '청구서와 진술서': 'form', 계약서: 'contract', 사진: 'photo', 견적서: 'invoice', 명세서: 'invoice',
    영수증: 'receipt', 진술: 'memo', 메모: 'memo', '증인 진술': 'memo', '문의 응답': 'memo',
    '시스템 기록': 'log', '카메라 기록': 'log', CCTV: 'log', '순찰 일지': 'log', '기상 기록': 'log', '감정 보고': 'report',
  };
  const narrow = matchMedia('(max-width: 60rem)');
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const won = (n) => n.toLocaleString('ko-KR') + '원';
  const byId = (id) => CASES.find((c) => c.id === id);
  const evOf = (c, id) => c.evidence.find((e) => e.id === id);
  // 받침 유무로 조사를 고른다. 숫자는 한국어 읽기, 영문은 l·m·n·r만 받침으로 본다.
  function josa(word, withBatchim, without) {
    const s = String(word).replace(/[^0-9A-Za-z\uAC00-\uD7A3]+$/, '');
    const ch = s.slice(-1);
    const code = ch.charCodeAt(0);
    let has;
    if (code >= 0xAC00 && code <= 0xD7A3) has = (code - 0xAC00) % 28 !== 0;
    else if (/[0-9]/.test(ch)) has = '013678'.includes(ch);
    else has = /[lmnr]/i.test(ch);
    return word + (has ? withBatchim : without);
  }

  function fresh() {
    const cases = {};
    CASES.forEach((c) => (cases[c.id] = { unlocked: [], pins: [], used: [], spent: 0, pos: {}, draft: {}, result: null }));
    return { day: 1, resources: DAILY, pending: [], z: 10, cases };
  }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return Object.assign(fresh(), JSON.parse(raw)); } catch (e) { /* 저장소 없음 */ }
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 저장소 없음 */ } }
  let S = load();
  let flash = '';
  const arrived = new Set();

  const cur = () => byId((location.hash.match(/#\/(\d{3})/) || [])[1]) || byId('002');
  const isOpen = (c, cs, id) => !window.isLockedEvidence(c, id) || cs.unlocked.includes(id);
  const pendingFor = (id) => S.pending.filter((p) => p.case === id);
  const underminedBy = (c, cs, id) => c.evidence.filter((e) => (e.undermines || []).includes(id) && isOpen(c, cs, e.id));

  /* ---------- 채점: prototype/app.js 의 grade()와 같은 규칙 ---------- */
  function grade(c, cs, decision, amount, choices) {
    const notes = [];
    const pins = cs.pins;
    if (decision === 'deny') return { label: '오답', tone: 'wrong', notes: [c.denyNote] };
    if (decision === 'hold') {
      if (c.holdOk({ pending: pendingFor(c.id) }))
        return { label: '정당한 보류', tone: 'ok', notes: ['요청한 자료가 도착하면 다시 판정할 수 있습니다. 정보가 부족할 때 보류는 합리적입니다.'] };
      if (!cs.used.length) return { label: '보류, 처리 효율 감점', tone: 'partial', notes: ['조사 없이 보류했습니다. 보류는 무엇을 기다리는지가 분명할 때 씁니다.'] };
      return { label: '보류, 판단 근거는 이미 있음', tone: 'partial', notes: ['지금 가진 자료로 판정할 수 있었습니다.'] };
    }
    if (c.itemized) {
      const wrong = c.items.filter((it, i) => choices[i] !== it.covered);
      if (wrong.length && choices.every(Boolean)) return { label: '부분 오답, 원인 미분리', tone: 'partial', notes: [c.mergeNote] };
      if (wrong.length) {
        wrong.forEach((it) => notes.push(`${it.label}: ${it.covered ? '보장' : '면책'}입니다. ${it.why}.`));
        return { label: '오답, 항목 판정 불일치', tone: 'wrong', notes };
      }
    }
    if (amount === c.expectedPayout) {
      const missing = c.required.filter((id) => !pins.includes(id));
      const rebutOk = !c.rebuttal.length || c.rebuttal.some((id) => pins.includes(id));
      missing.forEach((id) => notes.push(`필수 근거 ${id} ${josa(evOf(c, id).title, '이', '가')} 판정서에 없습니다.`));
      if (!rebutOk) notes.push(c.rebuttalNote);
      if (!missing.length && rebutOk) return { label: '정답', tone: 'ok', notes };
      return { label: '부분 정답, 근거 미연결', tone: 'partial', notes };
    }
    const gross = c.expectedPayout + c.deductible;
    if (amount === gross) {
      notes.push(`자기부담금을 빼지 않았습니다. ${c.itemized ? '보장 항목 합계' : '청구'} ${won(gross)}에서 자기부담금 ${won(c.deductible)}을 빼야 합니다.`);
      return { label: '부분 오답, 자기부담금 누락', tone: 'partial', notes };
    }
    notes.push(`지급액은 ${c.itemized ? '보장 항목 합계' : '청구'} ${won(gross)}에서 자기부담금 ${won(c.deductible)}을 뺀 금액입니다.`);
    return { label: '오답, 금액 불일치', tone: 'wrong', notes };
  }

  /* ---------- 창구 ---------- */
  function renderWindow(c) {
    $('#ticket').innerHTML = `<p class="ticket__no">#${c.id}</p>
      <p class="ticket__t">${esc(c.title)}</p>
      <p class="ticket__meta">${esc(c.claimant)}, 청구 <span class="num">${won(c.claimAmount)}</span></p>`;
    $('#cases').innerHTML = CASES.map((x) => {
      const r = S.cases[x.id].result;
      return `<a class="case-tab" href="#/${x.id}"${x.id === c.id ? ' aria-current="page"' : ''}><span class="num">#${x.id}</span><span>${r ? (r.decision === 'hold' ? '보류' : '종결') : '미처리'}</span></a>`;
    }).join('');
    $('#day').textContent = `${S.day}일차`;
    $('#res').textContent = `${S.resources} / ${DAILY}`;
    $('#status').textContent = flash;
  }

  /* ---------- 서류 ---------- */
  function docBody(d) {
    return `${d.meta ? `<dl class="kv">${d.meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
      ${d.table ? `<table class="dtbl"><thead><tr>${d.table.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${d.table.rows.map((r) => `<tr>${r.map((v) => `<td${/원$/.test(v) ? ' class="num r"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
        ${d.table.foot ? `<tfoot><tr>${d.table.foot.map((v) => `<td${/원$/.test(v) ? ' class="num r"' : ''}>${esc(v)}</td>`).join('')}</tr></tfoot>` : ''}</table>` : ''}
      ${d.qa ? `<dl class="qa">${d.qa.map(([q, a]) => `<div><dt>${esc(q)}</dt><dd>${esc(a)}</dd></div>`).join('')}</dl>` : ''}
      ${d.body ? `<div class="doc__body">${d.body.map((p) => `<p>${esc(p)}</p>`).join('')}</div>` : ''}`;
  }

  function renderDoc(c, cs, e) {
    const pinned = cs.pins.includes(e.id);
    const weak = underminedBy(c, cs, e.id);
    const closed = cs.result && cs.result.decision !== 'hold';
    return `<article class="doc doc--${PAPER[e.kind] || 'form'}${arrived.has(e.id) ? ' is-new' : ''}" data-id="${e.id}" tabindex="0" aria-labelledby="t-${e.id}" aria-describedby="kb-help">
      <div class="paper">
        ${weak.length ? `<p class="doc__tag">${esc(josa(weak.map((w) => w.title).join(', '), '과', '와'))} 불일치</p>` : ''}
        ${pinned ? `<p class="doc__clip">첨부됨</p>` : ''}
        <header class="doc__head"><p class="doc__kind">${esc(e.kind)}</p><h3 id="t-${e.id}">${esc(e.title)}</h3><p class="doc__id num">${e.id}</p></header>
        ${docBody(e.doc)}
        <footer class="doc__foot"><span>신뢰도 ${esc(e.reliability)}</span>
          ${closed ? '' : `<button class="clip" type="button" data-act="pin" data-id="${e.id}" aria-pressed="${pinned}">${pinned ? '첨부 빼기' : '판정서에 첨부'}</button>`}</footer>
      </div>
    </article>`;
  }

  function renderPolicy(c) {
    return `<article class="doc doc--book" data-id="policy" tabindex="0" aria-labelledby="t-policy" aria-describedby="kb-help">
      <div class="paper">
        <header class="doc__head"><p class="doc__kind">약관 규정집</p><h3 id="t-policy">${esc(c.policy.name)}</h3></header>
        <dl class="kv kv--rules">${c.policy.clauses.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      </div>
    </article>`;
  }

  function renderNote(c, r) {
    return `<article class="doc doc--note${arrived.has('note') ? ' is-new' : ''}" data-id="note" tabindex="0" aria-labelledby="t-note" aria-describedby="kb-help">
      <div class="paper">
        <header class="doc__head"><p class="doc__kind">심사 결과</p><h3 id="t-note" class="note__label note__label--${r.tone}">${esc(r.label)}</h3></header>
        ${r.notes.length ? `<ul class="notes">${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
        <div class="doc__body"><p>${esc(c.explanation)}</p></div>
        ${c.itemized ? `<table class="dtbl"><thead><tr><th scope="col">항목</th><th scope="col">판정</th></tr></thead>
          <tbody>${c.items.map((it) => `<tr><td>${esc(it.label)}<span class="sub">${esc(it.why)}</span></td><td>${it.covered ? '보장' : '면책'}</td></tr>`).join('')}</tbody></table>` : ''}
        <dl class="kv"><div><dt>정답 지급액</dt><dd class="num">${won(c.expectedPayout)}</dd></div><div><dt>쓴 자원</dt><dd class="num">${S.cases[c.id].spent}</dd></div></dl>
        <footer class="doc__foot"><button class="clip" type="button" data-act="replay">이 사건 다시 하기</button></footer>
      </div>
    </article>`;
  }

  function renderDesk(c) {
    const cs = S.cases[c.id];
    const open = c.evidence.filter((e) => isOpen(c, cs, e.id));
    const surface = $('#surface');
    surface.innerHTML = `<p class="visually-hidden" id="kb-help">서류에 초점을 두고 화살표 키로 옮깁니다. Shift를 함께 누르면 크게 옮기고, Enter는 맨 위로 올립니다.</p>`
      + renderPolicy(c) + open.map((e) => renderDoc(c, cs, e)).join('') + (cs.result ? renderNote(c, cs.result) : '');
    placeAll(c);
    // 판정이 끝나면 결과 쪽지 바로 아래에 막을 깔아 묻힌 서류를 한 단계 가린다. 서류를 끌면 막 위로 올라온다.
    if (cs.result && cs.result.decision !== 'hold' && cs.pos.note) {
      surface.insertAdjacentHTML('afterbegin', `<div class="veil" aria-hidden="true" style="z-index:${cs.pos.note.z - 1}"></div>`);
    }
  }

  // 처음 보는 서류는 사건마다 같은 자리에 흩어 놓는다(새로 고침해도 같은 더미).
  function seeded(str) {
    let h = 2166136261;
    for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296);
  }
  function placeAll(c) {
    const cs = S.cases[c.id];
    const surface = $('#surface');
    const W = surface.clientWidth, H = surface.clientHeight;
    [...surface.querySelectorAll('.doc')].forEach((el, i) => {
      const id = el.dataset.id;
      let p = cs.pos[id];
      if (!p) {
        const rnd = seeded(c.id + id);
        const w = el.offsetWidth;
        if (id === 'note') p = { x: Math.max(0, (W - w) / 2), y: 24, r: 0 };
        else if (arrived.has(id)) p = { x: Math.max(0, W - w - 40 - rnd() * 80), y: Math.max(0, H - el.offsetHeight - 120), r: 0 };
        else {
          const slot = ((i * 0.618) % 1);
          p = { x: Math.max(0, Math.min(W - w, slot * (W - w) + (rnd() - 0.5) * 60)), y: rnd() * Math.max(0, H - el.offsetHeight * 0.75), r: 0 };
        }
        p.z = ++S.z;
        cs.pos[id] = p;
      }
      apply(el, p);
    });
    arrived.clear();
    save();
  }
  function apply(el, p) {
    el.style.setProperty('--x', `${Math.round(p.x)}px`);
    el.style.setProperty('--y', `${Math.round(p.y)}px`);
    el.style.setProperty('--r', `${p.r.toFixed(2)}deg`);
    el.style.zIndex = p.z;
    if (p.w) el.style.setProperty('--w', `${p.w}px`); else el.style.removeProperty('--w');
  }
  function clampPos(el, p) {
    const surface = $('#surface');
    const W = surface.clientWidth, H = surface.clientHeight, w = el.offsetWidth;
    p.x = Math.min(Math.max(p.x, -w * 0.5), W - w * 0.5);
    p.y = Math.min(Math.max(p.y, -20), H - 80);
  }
  function toFront(c, id) {
    const p = S.cases[c.id].pos[id];
    if (!p) return;
    p.z = ++S.z;
    const el = $(`.doc[data-id="${id}"]`);
    if (el) el.style.zIndex = p.z;
  }

  function tidy(c) {
    const cs = S.cases[c.id];
    const surface = $('#surface');
    const W = surface.clientWidth, gap = 16;
    const cols = Math.max(1, Math.floor((W - gap) / (272 + gap)));
    const colW = Math.floor((W - gap * (cols + 1)) / cols);
    const heights = Array(cols).fill(gap);
    [...surface.querySelectorAll('.doc')].forEach((el) => {
      const col = heights.indexOf(Math.min(...heights));
      const p = { x: gap + col * (colW + gap), y: heights[col], r: 0, z: ++S.z, w: colW };
      cs.pos[el.dataset.id] = p;
      apply(el, p);
      heights[col] += el.offsetHeight + gap;
    });
    surface.style.setProperty('--tidy-h', `${Math.max(...heights) + gap}px`);
    save();
  }

  /* ---------- 서류함 ---------- */
  function renderTray(c) {
    const cs = S.cases[c.id];
    const closed = cs.result && cs.result.decision !== 'hold';
    $('#tray').innerHTML = `<h2>서류함</h2>
      <p class="tray__flash" aria-hidden="true">${esc(flash)}</p>
      <ul>${c.actions.map((a) => {
        const ev = evOf(c, a.unlocks);
        const pend = S.pending.find((p) => p.case === c.id && p.evidence === a.unlocks);
        const cost = a.cost ? `자원 ${a.cost}` : '무료';
        const lag = a.delay ? `, ${a.delay}일 지연` : '';
        if (pend) return `<li class="slip slip--wait"><span>${esc(a.label)}</span><span class="sub">봉투 대기, ${pend.arrives}일차 도착</span></li>`;
        if (cs.used.includes(a.id)) return `<li class="slip slip--done"><span>${esc(a.label)}</span><span class="sub">${esc(ev.id)} 책상에 있음</span></li>`;
        const short = a.cost > S.resources;
        return `<li class="slip"><button class="slip__btn" type="button" data-act="investigate" data-id="${a.id}"${short || closed ? ' disabled' : ''}>
          <span>${esc(a.label)}</span><span class="sub">${short ? '자원 부족' : cost + lag}</span></button></li>`;
      }).join('')}</ul>`;
  }

  /* ---------- 판정서 ---------- */
  function coveredSum(c, picks) {
    return c.items.reduce((n, it, i) => n + (picks[i] === 'y' ? it.amount : 0), 0);
  }
  function renderVerdict(c) {
    const cs = S.cases[c.id];
    const n = (cs.result ? cs.result.pins : cs.pins).length;
    $('#jump').textContent = cs.result && cs.result.decision !== 'hold' ? '판정서 보기 (판정 완료)' : `판정서로 (첨부 ${n}건)`;
    const r = cs.result;
    const pins = (r ? r.pins : cs.pins).map((id) => evOf(c, id));
    const stack = `<div class="attach" aria-label="첨부 서류">${pins.length
      ? `<ul>${pins.map((e) => `<li><span class="num">${e.id}</span> ${esc(e.title)}${r && r.decision !== 'hold' ? '' : ` <button class="link" type="button" data-act="pin" data-id="${e.id}" aria-label="${esc(e.title)} 첨부 빼기">빼기</button>`}</li>`).join('')}</ul>`
      : `<p class="attach__empty">첨부한 서류가 없습니다. 서류를 이 판정서 위로 끌어 놓으세요.</p>`}</div>`;
    if (r && r.decision !== 'hold') {
      $('#verdict').innerHTML = `<div class="vsheet vsheet--done">
        <h2>#${c.id} 판정서</h2>
        <dl class="kv"><div><dt>결정</dt><dd>${DECISIONS[r.decision]}</dd></div>
          ${r.decision === 'pay' && c.itemized ? `<div><dt>항목</dt><dd>${c.items.map((it, i) => `${esc(it.label)}: ${r.choices[i] ? '보장' : '면책'}`).join('<br>')}</dd></div>` : ''}
          ${r.decision === 'pay' ? `<div><dt>지급액</dt><dd class="num">${won(r.amount)}</dd></div>` : ''}</dl>
        ${stack}
        <p class="stamp" aria-label="도장: ${STAMPS[r.decision]}"><span>${STAMPS[r.decision]}</span></p>
      </div>`;
      return;
    }
    const d = cs.draft;
    const picks = d.items || [];
    const off = d.decision !== 'pay';
    $('#verdict').innerHTML = `<form class="vsheet" data-act="submit" novalidate>
      <h2>판정서</h2>
      <p class="vsheet__no">사건 <span class="num">#${c.id}</span>, 담당 손해사정사</p>
      <fieldset class="seg"><legend>결정</legend>
        ${Object.entries(DECISIONS).map(([k, l]) => `<input type="radio" name="decision" id="d-${k}" value="${k}"${d.decision === k ? ' checked' : ''}><label for="d-${k}">${l}</label>`).join('')}
      </fieldset>
      ${c.itemized ? `<fieldset class="items"${off ? ' disabled' : ''}><legend>항목별 판정</legend>
        ${off ? '<p class="help">지급을 고르면 항목별로 판정합니다.</p>' : ''}
        ${c.items.map((it, i) => `<div class="items__row"><p class="items__l">${esc(it.label)}<span class="num">${won(it.amount)}</span></p>
          <div class="seg seg--s" role="radiogroup" aria-label="${esc(it.label)}">
            <input type="radio" name="item-${i}" id="i${i}-y" value="y"${picks[i] === 'y' ? ' checked' : ''}><label for="i${i}-y">보장</label>
            <input type="radio" name="item-${i}" id="i${i}-n" value="n"${picks[i] === 'n' ? ' checked' : ''}><label for="i${i}-n">면책</label>
          </div></div>`).join('')}
        <p class="items__sum">보장 항목 소계 <span class="num" id="covered-sum">${won(coveredSum(c, picks))}</span></p>
      </fieldset>` : ''}
      <div class="field"><label for="amount">지급액 (원)</label>
        <input id="amount" name="amount" type="text" inputmode="numeric" autocomplete="off" value="${d.amount ? esc(d.amount) : ''}"${off ? ' disabled' : ''}></div>
      ${stack}
      <p class="help help--err" id="form-err" aria-live="polite"></p>
      <button class="btn btn--primary" type="submit">판정 제출</button>
      ${r ? `<p class="stamp stamp--hold" aria-label="도장: 보류"><span>보류</span></p>` : ''}
    </form>`;
  }

  function render() {
    const c = cur();
    renderWindow(c);
    renderTray(c);
    renderVerdict(c);
    renderDesk(c);
    document.title = `#${c.id} ${c.title}, CLAIM DENIED`;
  }
  function keepDraft(c) {
    const f = $('form.vsheet');
    if (!f) return;
    const d = new FormData(f);
    S.cases[c.id].draft = { decision: d.get('decision') || '', amount: d.get('amount') || '', items: c.items.map((_, i) => d.get(`item-${i}`) || '') };
  }

  /* ---------- 행동 ---------- */
  function togglePin(c, id) {
    const cs = S.cases[c.id];
    if (cs.result && cs.result.decision !== 'hold') return;
    const i = cs.pins.indexOf(id);
    if (i >= 0) cs.pins.splice(i, 1); else cs.pins.push(id);
    flash = i >= 0 ? `${id} 첨부를 뺐습니다.` : `${josa(id, '을', '를')} 판정서에 첨부했습니다.`;
    keepDraft(c);
    save();
    render();
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act]');
    if (!t || t.tagName === 'FORM') return;
    const c = cur();
    const cs = S.cases[c.id];
    const act = t.dataset.act;
    if (act === 'pin') {
      togglePin(c, t.dataset.id);
      const again = $(`.doc[data-id="${t.dataset.id}"] [data-act="pin"]`);
      if (again) again.focus();
    } else if (act === 'investigate') {
      const a = c.actions.find((x) => x.id === t.dataset.id);
      if (!a || cs.used.includes(a.id) || a.cost > S.resources) return;
      S.resources -= a.cost; cs.spent += a.cost; cs.used.push(a.id);
      const e = evOf(c, a.unlocks);
      if (a.delay) {
        S.pending.push({ case: c.id, evidence: a.unlocks, arrives: S.day + a.delay });
        flash = `${josa(e.title, '은', '는')} ${S.day + a.delay}일차에 봉투로 도착합니다.`;
      } else {
        cs.unlocked.push(a.unlocks);
        arrived.add(a.unlocks);
        flash = `${josa(e.title, '이', '가')} 서류함에서 책상으로 왔습니다.`;
      }
      keepDraft(c); save(); render();
    } else if (act === 'endday') {
      S.day += 1; S.resources = DAILY;
      const got = S.pending.filter((p) => p.arrives <= S.day);
      S.pending = S.pending.filter((p) => p.arrives > S.day);
      got.forEach((p) => { const x = S.cases[p.case]; if (!x.unlocked.includes(p.evidence)) x.unlocked.push(p.evidence); if (p.case === c.id) arrived.add(p.evidence); });
      flash = `${S.day}일차. 조사 자원 ${DAILY}.` + (got.length ? ` 도착한 봉투: ${got.map((p) => `#${p.case} ${evOf(byId(p.case), p.evidence).title}`).join(', ')}.` : '');
      keepDraft(c); save(); render();
    } else if (act === 'jump') {
      $('#verdict').scrollIntoView({ block: 'start', behavior: still.matches ? 'auto' : 'smooth' });
      const first = $('#verdict input, #verdict button');
      if (first) first.focus({ preventScroll: true });
    } else if (act === 'tidy') {
      tidy(c);
    } else if (act === 'replay') {
      S.cases[c.id] = fresh().cases[c.id];
      S.pending = S.pending.filter((p) => p.case !== c.id);
      flash = `${josa('#' + c.id, '을', '를')} 처음 상태로 돌렸습니다. 쓴 자원은 돌아오지 않습니다.`;
      save(); render();
    }
  });

  document.addEventListener('change', (ev) => {
    const c = cur();
    if (!ev.target.closest('form.vsheet')) return;
    keepDraft(c); save();
    if (/^item-/.test(ev.target.name)) { $('#covered-sum').textContent = won(coveredSum(c, S.cases[c.id].draft.items)); return; }
    if (ev.target.name === 'decision') renderVerdict(c);
  });

  document.addEventListener('submit', (ev) => {
    const f = ev.target.closest('form.vsheet');
    if (!f) return;
    ev.preventDefault();
    const c = cur();
    const cs = S.cases[c.id];
    const err = $('#form-err');
    const fd = new FormData(f);
    const decision = fd.get('decision');
    if (!decision) { err.textContent = '결정을 고르세요. 지급, 기각, 보류 중 하나입니다.'; $('#d-pay').focus(); return; }
    let amount = null, choices = null;
    if (decision === 'pay' && c.itemized) {
      const miss = c.items.findIndex((_, i) => !fd.get(`item-${i}`));
      if (miss >= 0) { err.textContent = `${c.items[miss].label}의 보장, 면책을 고르세요.`; $(`#i${miss}-y`).focus(); return; }
      choices = c.items.map((_, i) => fd.get(`item-${i}`) === 'y');
    }
    if (decision === 'pay') {
      const digits = String(fd.get('amount') || '').replace(/[^\d]/g, '');
      if (!digits) { err.textContent = '지급액을 숫자로 적으세요.'; $('#amount').setAttribute('aria-invalid', 'true'); $('#amount').focus(); return; }
      amount = Number(digits);
    }
    cs.result = { decision, amount, choices, pins: cs.pins.slice(), day: S.day, ...grade(c, cs, decision, amount, choices) };
    cs.draft = {};
    delete cs.pos.note;
    S.z += 1; // 막이 쓸 자리
    arrived.add('note');
    flash = `#${c.id} 판정을 제출했습니다: ${DECISIONS[decision]}. 결과 쪽지가 책상에 놓였습니다.`;
    save(); render();
    const note = $('.doc[data-id="note"]');
    if (note) note.focus({ preventScroll: true });
  });

  /* ---------- 끌기 ---------- */
  let drag = null;
  document.addEventListener('pointerdown', (ev) => {
    const el = ev.target.closest('.doc');
    if (!el || narrow.matches || ev.button !== 0 || ev.target.closest('button, a, input, label')) return;
    const c = cur();
    const p = S.cases[c.id].pos[el.dataset.id];
    if (!p) return;
    toFront(c, el.dataset.id);
    drag = { el, c, p, sx: ev.clientX, sy: ev.clientY, ox: p.x, oy: p.y, moved: false };
    el.setPointerCapture(ev.pointerId);
    el.classList.add('is-lifted');
  });
  document.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    drag.p.x = drag.ox + dx; drag.p.y = drag.oy + dy;
    clampPos(drag.el, drag.p);
    apply(drag.el, drag.p);
    $('#verdict').classList.toggle('is-target', overVerdict(ev) && isEvidence(drag.c, drag.el.dataset.id));
  });
  document.addEventListener('pointerup', (ev) => {
    if (!drag) return;
    const { el, c, p } = drag;
    el.classList.remove('is-lifted');
    $('#verdict').classList.remove('is-target');
    const id = el.dataset.id;
    if (drag.moved && overVerdict(ev) && isEvidence(c, id)) {
      // 첨부한 서류는 제자리로 돌아가 더미 맨 아래에 깔린다.
      p.x = drag.ox; p.y = drag.oy;
      p.z = Math.min(...Object.values(S.cases[c.id].pos).map((q) => q.z)) - 1;
      drag = null;
      if (!S.cases[c.id].pins.includes(id)) togglePin(c, id); else { apply(el, p); save(); }
      return;
    }
    drag = null;
    save();
  });
  const isEvidence = (c, id) => !!evOf(c, id);
  function overVerdict(ev) {
    const r = $('#verdict').getBoundingClientRect();
    return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
  }

  // 키보드로 서류 옮기기
  document.addEventListener('keydown', (ev) => {
    const el = ev.target.classList && ev.target.classList.contains('doc') ? ev.target : null;
    if (!el || narrow.matches) return;
    const c = cur();
    const p = S.cases[c.id].pos[el.dataset.id];
    const step = ev.shiftKey ? 64 : 16;
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
    if (mv) { ev.preventDefault(); p.x += mv[0]; p.y += mv[1]; clampPos(el, p); apply(el, p); save(); }
    else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toFront(c, el.dataset.id); save(); }
  });

  window.addEventListener('hashchange', () => { flash = ''; render(); });
  narrow.addEventListener('change', render);
  if (still.matches) document.documentElement.classList.add('still');
  const problems = window.validateCases(CASES);
  if (problems.length) { $('#surface').innerHTML = `<p class="desk__hint" role="alert">사건 자료 검증 실패: ${esc(problems.join(', '))}</p>`; return; }
  if (!/#\/\d{3}/.test(location.hash)) history.replaceState(null, '', '#/002');
  render();
})();
