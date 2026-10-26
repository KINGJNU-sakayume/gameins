// 사건 데이터: docs/02_CLAIM_DENIED_사건설계_001_002.md 를 그대로 옮긴 것.
// `lure`, `rebuttedBy`, `grade`는 내부 정답 정보이며 화면에 직접 노출하지 않는다.

window.CASES = [
  {
    id: '001',
    title: '휴대폰 액정 파손',
    act: '1막 수습',
    claimant: '오세린',
    product: 'NORTHSTAR 휴대폰 안심 특약',
    claimAmount: 420000,
    items: [
      { label: '액정 교체', amount: 380000 },
      { label: '보호필름', amount: 40000 },
    ],
    deductible: 100000,
    expectedPayout: 320000,
    policy: {
      name: 'NORTHSTAR 휴대폰 안심 특약',
      clauses: [
        ['보장', '휴대폰의 우발적 파손에 따른 수리비 전액 (부품과 공임)'],
        ['자기부담금', '청구 1건당 100,000원'],
        ['면책', '고의 파손, 분실, 도난, 계약 효력 개시일 이전에 발생한 손상'],
        ['효력 기간', '2026-01-01 ~ 2026-12-31'],
        ['참고 규정', '기기 구입일은 보장 여부에 영향을 주지 않는다. 판단 기준은 손상 발생일이다.'],
      ],
    },
    evidence: [
      {
        id: 'E1-1', kind: '청구서', title: '보험금 청구서', reliability: '중',
        doc: {
          meta: [
            ['청구인', '오세린'],
            ['주소', '한솔마을 103동'],
            ['상품', 'NORTHSTAR 휴대폰 안심 특약'],
            ['사고 일시', '2026-03-14 00:40경'],
            ['사고 장소', '정류장 계단'],
            ['접수', '2026-03-15 오후'],
            ['청구 금액', '420,000원'],
          ],
          body: [
            '야간 근무를 마치고(종료 약 23:30) 귀가하던 중 정류장 계단에서 휴대폰을 떨어뜨려 액정이 깨졌습니다.',
            '다음 날 협력 수리점에서 견적을 받아 청구합니다.',
          ],
        },
      },
      {
        id: 'E1-2', kind: '계약서', title: '보험 계약서', reliability: '높음',
        doc: {
          meta: [
            ['계약자', '오세린'],
            ['상품', 'NORTHSTAR 휴대폰 안심 특약'],
            ['효력 기간', '2026-01-01 ~ 2026-12-31'],
            ['자기부담금', '청구 1건당 100,000원'],
          ],
          body: ['보장과 면책 조항 전문은 약관 규정집에 있습니다.'],
        },
      },
      {
        id: 'E1-3', kind: '사진', title: '현장 사진 기록 (2장)', reliability: '중',
        doc: {
          table: {
            head: ['사진', '촬영 내용'],
            rows: [
              ['1', '액정 전면에 거미줄 모양 균열'],
              ['2', '케이스 없음, 본체 외관 양호'],
            ],
          },
        },
      },
      {
        id: 'E1-4', kind: '견적서', title: '수리 견적서', reliability: '높음',
        doc: {
          meta: [
            ['발행처', '한결수리센터'],
            ['발행일', '2026-03-15'],
          ],
          table: {
            head: ['항목', '금액'],
            rows: [
              ['액정 교체', '380,000원'],
              ['보호필름', '40,000원'],
            ],
            foot: ['합계', '420,000원'],
          },
        },
      },
      {
        id: 'E1-5', kind: '영수증', title: '기기 구매 영수증', reliability: '높음',
        lure: true, rebuttedBy: ['E1-2'],
        doc: {
          meta: [
            ['구매자', '오세린'],
            ['품목', '휴대폰 본체'],
            ['구입일', '2025-11-02'],
          ],
        },
      },
      {
        id: 'E1-6', kind: '문의 응답', title: '청구인 문의 응답', reliability: '중',
        corroborates: ['E1-1'],
        doc: {
          qa: [
            ['이전에 파손되거나 수리한 적이 있습니까?', '없습니다.'],
            ['사고 당시 무엇을 하고 있었습니까?', '근무를 마치고 귀가하던 중이었습니다.'],
          ],
        },
      },
    ],
    actions: [
      { id: 'inquiry', label: '당사자 문의', cost: 1, delay: 0, unlocks: 'E1-6' },
    ],
    required: ['E1-1', 'E1-2', 'E1-3', 'E1-4'],
    rebuttal: [],
    explanation:
      '구매일(2025-11-02)이 아니라 손상일(2026-03-14)이 효력 기간 안에 있습니다. 견적 합계는 420,000원이며 자기부담금 100,000원을 빼면 320,000원입니다.',
    denyNote:
      '구매 영수증의 날짜를 손상 발생일로 읽었습니다. 약관 참고 규정은 판단 기준이 손상 발생일이라고 정합니다.',
    holdOk: () => false,
  },
  {
    id: '002',
    title: '지하주차장 접촉 사고',
    act: '2막 독립',
    claimant: '강민수',
    product: 'NORTHSTAR 자기차량 손해 담보',
    claimAmount: 1350000,
    items: [
      { label: '후미등 교체', amount: 380000 },
      { label: '범퍼 교체와 도장', amount: 770000 },
      { label: '공임', amount: 200000 },
    ],
    deductible: 200000,
    expectedPayout: 1150000,
    policy: {
      name: 'NORTHSTAR 자기차량 손해 담보',
      clauses: [
        ['보장', '충돌, 접촉으로 인한 자기 차량의 직접 손해 (가해자 미상 포함)'],
        ['자기부담금', '청구 1건당 200,000원'],
        ['면책', '계약 효력 개시일(2026-04-08 00:00) 이전에 발생한 손상'],
        ['참고 규정', '주차장 내 사고는 장소와 무관하게 동일하게 판단한다.'],
      ],
    },
    evidence: [
      {
        id: 'E2-1', kind: '청구서', title: '청구서와 진술서', reliability: '중',
        doc: {
          meta: [
            ['청구인', '강민수'],
            ['주소', '한솔마을 104동'],
            ['상품', 'NORTHSTAR 자기차량 손해 담보'],
            ['주차 위치', '한솔마을 지하 2층 B2-14'],
            ['발견', '2026-04-09 07:15'],
            ['접수', '2026-04-09 09:30'],
            ['청구 금액', '1,350,000원'],
          ],
          body: [
            '4월 8일 밤 11시경 주차할 때는 멀쩡했습니다.',
            '다음 날 아침 출근하려고 내려가 보니 우측 후미가 부서져 있었습니다.',
          ],
        },
      },
      {
        id: 'E2-2', kind: '계약서', title: '보험 계약서', reliability: '높음',
        doc: {
          meta: [
            ['계약자', '강민수'],
            ['상품', 'NORTHSTAR 자기차량 손해 담보'],
            ['효력 개시', '2026-04-08 00:00'],
            ['자기부담금', '청구 1건당 200,000원'],
          ],
          body: ['보장과 면책 조항 전문은 약관 규정집에 있습니다.'],
        },
      },
      {
        id: 'E2-3', kind: '사진', title: '현장 사진 기록 (4장)', reliability: '중',
        corroborates: [],
        doc: {
          meta: [['촬영 시각', '2026-04-09 07:20']],
          table: {
            head: ['사진', '촬영 내용'],
            rows: [
              ['1', '우측 후미 파손, 전경'],
              ['2', '우측 후미 파손, 근접'],
              ['3', '바닥에 떨어진 파편'],
              ['4', '바닥 파편, 근접'],
            ],
          },
        },
      },
      {
        id: 'E2-4', kind: '견적서', title: '수리 견적서', reliability: '높음',
        doc: {
          table: {
            head: ['항목', '금액'],
            rows: [
              ['후미등 교체', '380,000원'],
              ['범퍼 교체와 도장', '770,000원'],
              ['공임', '200,000원'],
            ],
            foot: ['합계', '1,350,000원'],
          },
        },
      },
      {
        id: 'E2-5', kind: '진술', title: '경비원 진술 (관리사무소 메모)', reliability: '낮음~중',
        lure: true, rebuttedBy: ['E2-7', 'E2-8'],
        doc: {
          meta: [
            ['작성', '관리사무소 메모'],
            ['근거', '경비원의 기억'],
          ],
          body: ['“4월 7일 저녁 7시경 B2-14 근처에서 우측 후미가 부서진 차를 봤습니다.”'],
        },
      },
      {
        id: 'E2-6', kind: '시스템 기록', title: '입출차 기록', reliability: '높음',
        doc: {
          meta: [['차량', '강민수 등록 차량']],
          table: {
            head: ['일시', '구분'],
            rows: [
              ['2026-04-08 23:05', '입차'],
              ['2026-04-09 07:40', '출차'],
            ],
          },
        },
      },
      {
        id: 'E2-7', kind: '순찰 일지', title: '경비 순찰 일지', reliability: '높음',
        undermines: ['E2-5'],
        doc: {
          meta: [
            ['순찰 일시', '2026-04-07 19:05'],
            ['작성', '순찰 당시 작성'],
          ],
          table: {
            head: ['구역', '기록'],
            rows: [
              ['B2-12', '흰색 SUV, 좌측 후미등 파손. 신고 스티커 부착'],
              ['B2-14', '이상 없음'],
            ],
          },
        },
      },
      {
        id: 'E2-8', kind: '카메라 기록', title: '입구 차단기 카메라 스냅샷', reliability: '높음',
        undermines: ['E2-5'], corroborates: ['E2-1', 'E2-6'],
        doc: {
          meta: [
            ['촬영 일시', '2026-04-08 23:05'],
            ['위치', '지하주차장 입구 차단기'],
          ],
          body: ['입차 순간 촬영. 차량 우측 후미 정상, 파손 흔적 없음.'],
        },
      },
      {
        id: 'E2-9', kind: '증인 진술', title: '이웃 증인 진술', reliability: '중 (시야 차폐)',
        corroborates: ['E2-1'],
        doc: {
          meta: [
            ['증인', '오세린'],
            ['주소', '한솔마을 103동'],
          ],
          body: [
            '“23시 40분쯤 귀가하면서 B2를 지나는데 쿵 소리와 경보음이 났고, 흰색 차량이 급히 빠져나갔습니다.”',
            '기둥에 가려 접촉 장면은 직접 보지 못함.',
          ],
        },
      },
      {
        id: 'E2-10', kind: '감정 보고', title: '기술 감정 보고서', reliability: '높음',
        corroborates: ['E2-3'], undermines: ['E2-5'],
        doc: {
          table: {
            head: ['감정 항목', '소견'],
            rows: [
              ['B2-14 바닥 파편', '청구 차량 후미등과 일치'],
              ['도료', '외부 백색 도료 전이'],
              ['파단면', '신선함. 오염과 부식 없음'],
            ],
          },
        },
      },
      {
        id: 'E2-11', kind: 'CCTV', title: '주차장 CCTV 영상 기록', reliability: '높음',
        corroborates: ['E2-1', 'E2-9'], undermines: ['E2-5'],
        doc: {
          meta: [
            ['영상 시각', '2026-04-08 23:41'],
            ['위치', '지하 2층 B2-14 인근'],
          ],
          body: ['흰색 차량이 인접 구역에서 후진하다 B2-14 차량 우측 후미를 접촉한 뒤 그대로 이탈.'],
        },
      },
    ],
    actions: [
      { id: 'request', label: '추가 자료 요청', cost: 0, delay: 1, unlocks: 'E2-7' },
      { id: 'records', label: '관리사무소 기록 열람', cost: 1, delay: 0, unlocks: 'E2-8' },
      { id: 'witness', label: '독립 증인 확인', cost: 2, delay: 0, unlocks: 'E2-9' },
      { id: 'expert', label: '기술 감정', cost: 3, delay: 0, unlocks: 'E2-10' },
      { id: 'site', label: '현장 조사 (CCTV)', cost: 4, delay: 0, unlocks: 'E2-11' },
    ],
    required: ['E2-2', 'E2-6', 'E2-4'],
    rebuttal: ['E2-7', 'E2-8'],
    explanation:
      '경비원의 진술은 거짓이 아니라 다른 차량(B2-12, 좌측)에 대한 기억이 섞인 것입니다. 당시 작성된 순찰 일지와 23:05 입차 스냅샷이 이를 뒷받침합니다. 효력 개시일 이후의 신규 손상이므로 청구 1,350,000원에서 자기부담금 200,000원을 뺀 1,150,000원이 지급 대상입니다.',
    denyNote:
      '경비원 진술을 당시 작성된 순찰 일지나 입차 기록과 대조하지 않았습니다. 진술 충돌은 거짓말과 같지 않습니다.',
    // 설계서 8절: E2-7을 요청해 두고 도착을 기다리는 보류는 정당하다.
    holdOk: (s) => s.pending.some((p) => p.evidence === 'E2-7'),
  },
];

// 설계서 '콘텐츠 검증기 추가 규칙'을 로드 시 실행한다. 문제 목록을 돌려준다.
window.validateCases = function validateCases(cases) {
  const problems = [];
  const dateRe = /\d{4}-\d{2}-\d{2}/;
  cases.forEach((c) => {
    const ids = new Set(c.evidence.map((e) => e.id));
    const unlockable = new Set(c.actions.map((a) => a.unlocks));
    const reachable = (id) => ids.has(id);
    c.evidence.forEach((e) => {
      ['undermines', 'corroborates', 'rebuttedBy'].forEach((k) =>
        (e[k] || []).forEach((ref) => {
          if (!ids.has(ref)) problems.push(`#${c.id} ${e.id}.${k} → 없는 증거 ${ref}`);
        })
      );
      if (e.lure && !(e.rebuttedBy || []).some(reachable)) problems.push(`#${c.id} 유인 증거 ${e.id}를 반증할 자료가 없음`);
    });
    c.actions.forEach((a) => {
      if (!ids.has(a.unlocks)) problems.push(`#${c.id} 조사 ${a.id} → 없는 증거 ${a.unlocks}`);
    });
    const itemSum = c.items.reduce((n, i) => n + i.amount, 0);
    if (itemSum !== c.claimAmount) problems.push(`#${c.id} 손해 항목 합계 ${itemSum} ≠ 청구 ${c.claimAmount}`);
    if (c.claimAmount - c.deductible !== c.expectedPayout) problems.push(`#${c.id} 지급액 불일치`);
    // 정답 경로: 필수 근거는 모두 얻을 수 있어야 하고, 반증 근거가 필요하면 하나는 얻을 수 있어야 한다.
    c.required.forEach((id) => {
      if (!ids.has(id)) problems.push(`#${c.id} 필수 근거 ${id} 없음`);
    });
    if (c.rebuttal.length && !c.rebuttal.some((id) => ids.has(id) && (unlockable.has(id) || !isLocked(c, id))))
      problems.push(`#${c.id} 반증 근거에 도달할 경로가 없음`);
    c.policy.clauses.forEach(([k, v]) => {
      if (/일|기간|개시/.test(k) && /\d{4}[./]\d{1,2}[./]\d{1,2}/.test(v)) problems.push(`#${c.id} 약관 ${k} 날짜 형식`);
    });
    if (!c.policy.clauses.some(([, v]) => dateRe.test(v))) problems.push(`#${c.id} 약관에 효력 날짜 없음`);
  });
  return problems;
};

function isLocked(c, id) {
  return c.actions.some((a) => a.unlocks === id);
}
window.isLockedEvidence = isLocked;
