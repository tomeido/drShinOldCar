document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('encar-url');
    const generateBtn = document.getElementById('generate-btn');
    const errorMessage = document.getElementById('error-message');
    const resultSection = document.getElementById('result-section');
    const copyBtn = document.getElementById('copy-btn');
    const copyOverlay = document.querySelector('.copy-success-overlay');
    const btnText = copyBtn.querySelector('.btn-text');
    const resultTitle = document.getElementById('result-title');

    // 탭 관련
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const promptFull = document.getElementById('prompt-output-full');
    const promptSimple = document.getElementById('prompt-output-simple');
    const promptExplain = document.getElementById('prompt-explain');

    // 모달 관련
    const guideOpenBtn = document.getElementById('guide-open-btn');
    const guideModal = document.getElementById('guide-modal');
    const guideCloseBtn = document.getElementById('guide-close-btn');

    let isLoading = false;
    let currentTab = 'full';

    // ─── 탭 전환 ───
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            currentTab = tab;
            document.getElementById(`tab-${tab}`).classList.add('active');

            // 제목 업데이트
            const titles = {
                full: '생성된 프롬프트 — 전체',
                simple: '생성된 프롬프트 — 간단',
                explain: '프롬프트 구조 설명'
            };
            resultTitle.textContent = titles[tab] || '생성된 프롬프트';
        });
    });

    // ─── 모달 ───
    guideOpenBtn.addEventListener('click', () => {
        guideModal.classList.remove('hidden');
    });
    guideCloseBtn.addEventListener('click', () => {
        guideModal.classList.add('hidden');
    });
    guideModal.addEventListener('click', (e) => {
        if (e.target === guideModal) {
            guideModal.classList.add('hidden');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !guideModal.classList.contains('hidden')) {
            guideModal.classList.add('hidden');
        }
    });

    // ─── 출력 모드 ───
    const getOutputMode = () => {
        return document.querySelector('input[name="output-mode"]:checked').value;
    };

    // ═══════════════════════════════════════════════════════════
    // 프롬프트 템플릿 (3-Layer 구조: Soul + Knowledge + Data)
    // ═══════════════════════════════════════════════════════════

    const SOUL_PROMPT = `당신은 닥신입니다. 한국 중고차 시장에 20년 이상 경력을 가진 전문 컨설턴트 AI입니다.
유튜브 '닥신TV'에서 설명하는 중고차 고르는 원칙을 기반으로 행동하되, 실제 인물을 사칭하지 않고 그와 동일한 기준으로 합리적으로 판단하는 가상의 전문가로 행동합니다.

[성격 및 말투]
- 직설적이고 전문적이며, 소비자 편에 서서 말합니다.
- "뼉다구 먹은 차는 거릅니다", "가성비 좋습니다" 등 닥신TV 특유의 직관적 표현을 자연스럽게 사용합니다.
- 감정적 표현보다 논리적 근거를 중심으로 설명합니다.`;

    const KNOWLEDGE_PROMPT = `[분석 기준 — 닥신 중고차 평가 원칙]

1. 보험 이력(카히스토리)
   - 용도 변경 이력에 대여/영업 사용 이력이 있는지 확인. 초보자에게는 이런 차를 피하라고 조언.
   - 소유자 변경 이력이 1회(1인 소유)인지, 여러 번 바뀌었는지 확인. 1인 신조 최우선.
   - 전손, 침수, 도난 이력이 있으면 무조건 비추천.
   - 내차 피해·타차 가해 사고 금액 확인. 국산차 기준 100~300만 원대는 판금·도색 수준, 500만 원 이상은 대형 사고 리스크.
   - 보험 이력이나 성능 기록부가 비공개이거나 정보 제공 불가능 기간이 길면 즉시 리스크 판정.

2. 성능 점검 기록부
   - 외판(펜더, 문짝, 범퍼 등) 교환/판금은 크지 않은 문제.
   - 인사이드 패널, 휠하우스, 프레임(뼈대) 교환/수리가 있으면 → 큰 사고차 → 비추천.

3. 엔카 진단
   - 엔카 진단 유무 확인. 외판·뼈대 이상 없음이면 삼중 검증(보험 이력 + 성능 기록부 + 엔카 진단) 통과 → 신뢰도 높음.

4. 가격/감가 및 차종 포지셔닝
   - 같은 예산에서 새 아반떼 vs 감가 많이 된 그랜저·수입 대형차 → 한 급 위 차종 전략 평가.
   - 연식, 주행거리, 감가율을 함께 보고 가성비 평가.

5. 기타 신호
   - 타이어 브랜드(미쉐린 등 프리미엄 vs 저가)로 차주의 관리 성향 추정.
   - 딜러의 다른 매물, 누적 판매 이력, 엔카 진단 비율 등으로 딜러 성향 추정. 리스크 높은 매물만 모아 파는 딜러는 경계.

[절대 거름 조건 (Red Flag)]
- 전손 / 침수 / 도난 이력 있음
- 인사이드 패널, 휠하우스, 프레임(뼈대) 교환/수리
- 보험 이력 또는 성능 기록부 비공개
- 정보 비공개 구간이 비정상적으로 김`;

    const getOutputFormat = () => {
        return `[출력 형식]
1) 한줄 요약
- 이 차를 한 줄로 요약하라. (예: "감가 많이 된 1인 소유 그랜저, 리스크 낮은 편")

2) 핵심 스펙 요약
- 차종 / 연식 / 주행거리 / 연료 / 트림
- 신차 대비 추정 감가율

3) 리스크 체크리스트
- 보험 이력: 용도 변경 / 소유자 수 / 사고 금액 / 비공개 여부
- 성능 기록부: 외판 교환 여부, 뼈대 손상 여부
- 엔카 진단: 유무 및 결과
- 기타: 타이어, 딜러 성향 등

4) 닥신 스타일 코멘트
- 닥신TV의 톤으로 직설적으로 평가하되 실제 인물임을 암시하지 말 것.
- 왜 괜찮은지, 왜 애매한지, 왜 위험한지 구체적으로 설명.

5) 최종 결론
- 아래 중 하나를 선택하고 한 문장으로 명확히 써라:
  - "이 조건이면 사도 괜찮은 차다."
  - "아주 싸게만 산다면 고려할 수 있다."
  - "초보자에게는 비추다. 다른 매물을 보는 것이 좋다."
- 핵심 근거를 2~3줄로 정리.`;
    };

    // ─── 전체 프롬프트 생성 ───
    const getFullPrompt = (url, carInfo, userPrefs, mode) => {
        const dataSection = carInfo
            ? `[추출된 차량 기본 정보]
- 차량명: ${carInfo.title || '정보 없음'}
- 가격: ${carInfo.price || '정보 없음'}
- 연식: ${carInfo.year || '정보 없음'}
- 주행거리: ${carInfo.mileage || '정보 없음'}
- 연료: ${carInfo.fuel || '정보 없음'}
- 색상: ${carInfo.color || '정보 없음'}
- 기타 정보: ${carInfo.details || '정보 없음'}`
            : `(참고: 차량 기본 정보를 자동으로 가져오지 못했습니다. 링크를 직접 열어 확인해주세요.)`;

        const userSection = `[사용자 입력]
- 엔카 차량 링크: ${url}
- 내 정보/조건:
  - 예산: ${userPrefs.budget}
  - 주요 용도: ${userPrefs.usage}
  - 리스크 허용도: ${userPrefs.risk}`;

        const instructions = `[지시]
1. 위 제공된 링크의 웹 페이지를 열거나 검색하여, 보험 이력, 성능 기록부, 엔카 진단, 가격, 연식, 주행거리, 타이어, 딜러 정보를 가능한 한 많이 확인해라.
2. 위에서 정의한 닥신 스타일 기준으로 이 매물을 평가해라.
3. 사용자의 예산(${userPrefs.budget}), 용도(${userPrefs.usage}), 성향(${userPrefs.risk})에 맞추어 적절한 차량인지 분석해라.
4. 아래 출력 형식으로 한국어로만 답변해라.`;

        if (mode === 'split') {
            // Claude Projects용: 시스템 / 유저 분리
            const systemPart = `===== 📋 시스템 프롬프트 (Claude Projects의 "Instructions"에 입력) =====

${SOUL_PROMPT}

${KNOWLEDGE_PROMPT}

${getOutputFormat()}`;

            const userPart = `===== 💬 유저 프롬프트 (채팅창에 입력) =====

${userSection}

${dataSection}

${instructions}`;

            return systemPart + '\n\n' + '─'.repeat(60) + '\n\n' + userPart;
        }

        // ChatGPT / Gemini용: 통합
        return `[시스템]
${SOUL_PROMPT}

${KNOWLEDGE_PROMPT}

${userSection}

${dataSection}

${instructions}

${getOutputFormat()}`;
    };

    // ─── 간단 프롬프트 생성 ───
    const getSimplePrompt = (url, carInfo, userPrefs) => {
        const carInfoStr = carInfo
            ? `\n참고 정보: ${carInfo.title || ''} / ${carInfo.price || ''} / ${carInfo.details || ''}`
            : '';

        return `너는 중고차 전문가야. 유튜브 '닥신TV'의 중고차 평가 원칙(1인 소유, 보험 이력, 성능 기록부, 감가/가성비 등)을 기반으로 판단해.

이 엔카 매물을 평가해줘:
${url}
${carInfoStr}

내 조건:
- 예산: ${userPrefs.budget}
- 용도: ${userPrefs.usage}
- 리스크 허용: ${userPrefs.risk}

다음을 포함해서 한국어로 답변해:
1) 한줄 요약
2) 핵심 스펙 & 감가율
3) 리스크 체크리스트 (보험이력/성능기록부/엔카진단/기타)
4) 직설적 코멘트
5) 최종 결론 ("사도 됨" / "애매" / "비추") + 근거`;
    };

    // ─── 프롬프트 구조 설명 ───
    const getExplainContent = () => {
        return `
<h4>🧠 Layer 1: Soul Prompt — 닥신의 정체성</h4>
<p>AI가 "닥신"이라는 캐릭터로 행동하도록 성격과 말투를 정의합니다.</p>
<ul>
    <li><strong>직설적 톤</strong> — 닥신TV 특유의 솔직한 평가 스타일</li>
    <li><strong>소비자 편</strong> — 딜러가 아닌 구매자 관점에서 조언</li>
    <li><strong>사칭 방지</strong> — 실존 인물을 사칭하지 않는 가상 전문가 설정</li>
</ul>

<h4>📚 Layer 2: Knowledge Prompt — 닥신의 판단 기준</h4>
<p>닥신TV 영상에서 반복적으로 강조하는 체크리스트를 AI에게 주입합니다.</p>
<ul>
    <li><strong>보험 이력</strong> — 용도 변경(렌트/영업), 소유자 수, 전손/침수, 사고 금액 (출처: 2025 닥신 기본편, GQ코리아)</li>
    <li><strong>성능 기록부</strong> — 외판 vs 뼈대(프레임) 구분. 뼈대 손상 = 무조건 비추 (출처: 닥신 핵심요약편)</li>
    <li><strong>엔카 진단</strong> — 삼중 검증(보험+성능+진단) 통과 시 신뢰도 상승</li>
    <li><strong>감가/가성비</strong> — 동일 예산에서 한 급 위 차종을 노리는 전략 (출처: 2024 실전 31가지 증례)</li>
    <li><strong>기타</strong> — 타이어 브랜드로 관리 성향, 딜러 성향 분석</li>
</ul>

<h4>📊 Layer 3: Data Prompt — 차량 실제 데이터</h4>
<p>사용자가 입력한 엔카 링크와 구매 조건(예산/용도/리스크)을 조합합니다.</p>
<ul>
    <li>엔카 URL에서 자동 크롤링을 시도하여 차량명, 가격 등 기본 정보 추출</li>
    <li>크롤링 실패 시에도 URL을 LLM에 전달하여 웹 브라우징으로 직접 확인 유도</li>
</ul>

<h4>📝 출력 형식</h4>
<p>LLM이 일관된 구조로 답변하도록 5단계 출력 형식을 강제합니다:</p>
<ul>
    <li>한줄 요약 → 핵심 스펙 → 리스크 체크 → 닥신 코멘트 → 최종 결론</li>
</ul>`;
    };

    // ═══════════════════════════════════════════════════════════
    // URL 유효성 검사 및 크롤링
    // ═══════════════════════════════════════════════════════════

    /**
     * 엔카 URL을 정규화하고, fem.encar.com 형식의 URL도 함께 반환한다.
     * fem.encar.com은 UTF-8 og: 메타태그를 제공하여 크롤링에 유리하다.
     */
    const normalizeEncarUrl = (urlStr) => {
        let url = urlStr.trim();
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }
        try {
            const parsed = new URL(url);
            if (!parsed.hostname.includes('encar.com')) return null;
            return url;
        } catch (e) { return null; }
    };

    /**
     * 엔카 URL에서 차량 ID(carid)를 추출한다.
     * 지원 형식:
     *   - www.encar.com/dc/dc_cardetailview.do?carid=12345678
     *   - fem.encar.com/cars/detail/12345678
     */
    const extractCarId = (url) => {
        // fem.encar.com 형식
        const femMatch = url.match(/fem\.encar\.com\/cars\/detail\/(\d+)/);
        if (femMatch) return femMatch[1];

        // 기존 encar.com 형식 (query string에서 carid 추출)
        try {
            const parsed = new URL(url);
            const carid = parsed.searchParams.get('carid');
            if (carid && /^\d+$/.test(carid)) return carid;
        } catch (e) { /* ignore */ }

        // URL 경로나 쿼리에서 숫자 ID 패턴 추출 시도
        const idMatch = url.match(/[\?&]carid=(\d+)/);
        if (idMatch) return idMatch[1];

        return null;
    };

    // ─── Scrapling 백엔드 서버 설정 ───
    const BACKEND_URL = 'http://localhost:5000';

    /**
     * Scrapling 기반 로컬 백엔드 서버를 통해 차량 정보를 가져온다.
     * 서버가 실행 중이지 않으면 null을 반환한다.
     */
    const fetchFromBackend = async (targetUrl) => {
        try {
            const apiUrl = `${BACKEND_URL}/api/encar?url=${encodeURIComponent(targetUrl)}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(apiUrl, { signal: controller.signal });
            clearTimeout(timeout);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.warn('백엔드 서버 응답 오류:', errorData.error || response.statusText);
                return null;
            }

            const result = await response.json();
            if (result.success && result.data) {
                console.log('✅ Scrapling 백엔드에서 차량 정보 수신:', result.data);
                return result.data;
            }
            console.warn('백엔드 응답에 차량 정보 없음:', result.error);
            return null;
        } catch (e) {
            console.warn('백엔드 서버 연결 실패 (서버가 실행 중인지 확인하세요):', e.message);
            return null;
        }
    };

    /**
     * CORS 프록시를 통해 HTML을 가져온다. (Fallback용)
     * 여러 무료 프록시를 순차적으로 시도하여 안정성을 높인다.
     */
    const fetchWithProxy = async (targetUrl) => {
        const proxies = [
            (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
            (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
            (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
        ];

        const fetchPromise = async (makeUrl) => {
            const proxyUrl = makeUrl(targetUrl);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            try {
                const response = await fetch(proxyUrl, { signal: controller.signal });
                clearTimeout(timeout);

                if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const data = await response.json();
                    return data.contents || null;
                }
                return await response.text();
            } catch (e) {
                console.warn(`프록시 실패:`, e.message);
                throw e;
            }
        };

        try {
            return await Promise.any(proxies.map(makeUrl => fetchPromise(makeUrl)));
        } catch (e) {
            return null;
        }
    };

    /**
     * og: 메타태그와 HTML 텍스트에서 차량 정보를 파싱한다. (Fallback용)
     */
    const parseCarInfoFromHtml = (htmlString) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');

        const ogTitle = doc.querySelector('meta[property="og:title"]');
        const ogDesc = doc.querySelector('meta[property="og:description"]');
        const pageTitle = doc.querySelector('title');

        let title = null;
        if (ogTitle && ogTitle.content) {
            title = ogTitle.content
                .replace(/\s*:?\s*내차팔기.*$/i, '')
                .replace(/\s*중고차\s*$/, '')
                .replace(/\s+/g, ' ')
                .trim();
            const regionPatterns = /\s+(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\s*$/;
            title = title.replace(regionPatterns, '').trim();
        } else if (pageTitle && pageTitle.textContent) {
            title = pageTitle.textContent
                .replace(/\s*[\|:]\s*엔카.*$/i, '')
                .replace(/\s*중고차.*$/i, '')
                .replace(/\s+/g, ' ')
                .trim();
        }

        let year = null, mileage = null, fuel = null, color = null, details = '';
        if (ogDesc && ogDesc.content) {
            const desc = ogDesc.content;
            details = desc;
            const yearMatch = desc.match(/연식\s*:\s*([^,]+)/);
            if (yearMatch) year = yearMatch[1].trim();
            const mileageMatch = desc.match(/주행거리\s*:\s*([^,]+)/);
            if (mileageMatch) mileage = mileageMatch[1].trim();
            const fuelMatch = desc.match(/연료\s*:\s*([^,]+)/);
            if (fuelMatch) fuel = fuelMatch[1].trim();
            const colorMatch = desc.match(/색상\s*:\s*([^,]+)/);
            if (colorMatch) color = colorMatch[1].trim();
        }

        let price = null;
        // HTML 태그 제거 및 공백 정규화
        const textOnly = htmlString.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
        const priceMatch = textOnly.match(/((?:\d+\s*억\s*)?\d{1,5}(?:,\d{3})*|\d+)\s*만\s*원/);
        if (priceMatch) {
            price = priceMatch[1].replace(/,/g, '').replace(/ /g, '') + '만원';
        }

        if (!title) return null;
        return {
            title, price,
            year: year || '정보 없음',
            mileage: mileage || '정보 없음',
            fuel: fuel || null,
            color: color || null,
            details: details || '정보 없음'
        };
    };

    /**
     * 엔카 차량 상세 정보를 크롤링한다.
     * 1차: Scrapling 백엔드 서버 (localhost:5000)
     * 2차 (Fallback): CORS 프록시
     */
    const fetchEncarData = async (targetUrl) => {
        try {
            // 1차 시도: Scrapling 백엔드 서버
            console.log('🔄 Scrapling 백엔드 서버로 크롤링 시도...');
            const backendResult = await fetchFromBackend(targetUrl);
            if (backendResult) {
                return backendResult;
            }

            // 2차 시도: CORS 프록시 (Fallback)
            console.log('🔄 백엔드 사용 불가 — CORS 프록시로 Fallback...');
            const carId = extractCarId(targetUrl);
            const fetchUrl = carId
                ? `https://fem.encar.com/cars/detail/${carId}`
                : targetUrl;

            const htmlString = await fetchWithProxy(fetchUrl);
            if (!htmlString) {
                console.warn('모든 프록시에서 HTML 가져오기 실패');
                return null;
            }

            const carInfo = parseCarInfoFromHtml(htmlString);
            if (carInfo) {
                console.log('차량 정보 추출 성공 (프록시):', carInfo);
            } else {
                console.warn('HTML에서 차량 정보를 찾을 수 없음');
            }
            return carInfo;
        } catch (error) {
            console.error('크롤링 실패:', error);
            return null;
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 핸들러
    // ═══════════════════════════════════════════════════════════

    const handleGenerate = async () => {
        if (isLoading) return;

        const rawUrl = urlInput.value;
        const normalizedUrl = normalizeEncarUrl(rawUrl);

        const budgetInput = document.getElementById('budget');
        const usageInput = document.getElementById('usage');
        const riskInput = document.getElementById('risk');

        const userPrefs = {
            budget: budgetInput.options[budgetInput.selectedIndex].text,
            usage: usageInput.options[usageInput.selectedIndex].text,
            risk: riskInput.options[riskInput.selectedIndex].text
        };

        if (!normalizedUrl) {
            errorMessage.textContent = '올바른 엔카(encar.com) 링크가 아닙니다. 다시 확인해주세요.';
            errorMessage.classList.remove('hidden');
            resultSection.classList.remove('visible');
            setTimeout(() => resultSection.classList.add('hidden'), 300);
            return;
        }

        errorMessage.classList.add('hidden');
        isLoading = true;

        const originalBtnHtml = generateBtn.innerHTML;
        generateBtn.innerHTML = `<span>차량 정보 분석 중...</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>`;
        generateBtn.style.opacity = '0.7';
        generateBtn.style.pointerEvents = 'none';

        try {
            const carInfo = await fetchEncarData(normalizedUrl);
            const mode = getOutputMode();

            // 전체 프롬프트
            promptFull.value = getFullPrompt(normalizedUrl, carInfo, userPrefs, mode);

            // 간단 프롬프트
            promptSimple.value = getSimplePrompt(normalizedUrl, carInfo, userPrefs);

            // 구조 설명
            promptExplain.innerHTML = getExplainContent();

            // 결과 표시
            resultSection.classList.remove('hidden');
            void resultSection.offsetWidth;
            resultSection.classList.add('visible');

            // 첫 번째 탭 활성화
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tabBtns[0].classList.add('active');
            tabContents[0].classList.add('active');
            currentTab = 'full';
            resultTitle.textContent = '생성된 프롬프트 — 전체';

            setTimeout(() => {
                resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);

        } catch (error) {
            const mode = getOutputMode();
            promptFull.value = getFullPrompt(normalizedUrl, null, userPrefs, mode);
            promptSimple.value = getSimplePrompt(normalizedUrl, null, userPrefs);
            promptExplain.innerHTML = getExplainContent();
            resultSection.classList.remove('hidden');
            void resultSection.offsetWidth;
            resultSection.classList.add('visible');
        } finally {
            isLoading = false;
            generateBtn.innerHTML = originalBtnHtml;
            generateBtn.style.opacity = '1';
            generateBtn.style.pointerEvents = '';
        }
    };

    // ─── 이벤트 ───
    generateBtn.addEventListener('click', handleGenerate);

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleGenerate();
    });

    urlInput.addEventListener('input', () => {
        if (!errorMessage.classList.contains('hidden')) {
            errorMessage.classList.add('hidden');
        }
    });

    // 복사: 현재 활성 탭 기준
    copyBtn.addEventListener('click', async () => {
        let textToCopy = '';
        if (currentTab === 'full') {
            textToCopy = promptFull.value;
        } else if (currentTab === 'simple') {
            textToCopy = promptSimple.value;
        } else if (currentTab === 'explain') {
            textToCopy = promptExplain.innerText;
        }

        try {
            await navigator.clipboard.writeText(textToCopy);
            copyOverlay.classList.add('show');
            btnText.textContent = '복사됨!';
            copyBtn.style.color = 'var(--success-color)';

            setTimeout(() => {
                copyOverlay.classList.remove('show');
                btnText.textContent = '복사하기';
                copyBtn.style.color = '';
            }, 2000);
        } catch (err) {
            // Fallback
            const tempTextarea = document.createElement('textarea');
            tempTextarea.value = textToCopy;
            document.body.appendChild(tempTextarea);
            tempTextarea.select();
            document.execCommand('copy');
            document.body.removeChild(tempTextarea);

            btnText.textContent = '복사됨!';
            setTimeout(() => { btnText.textContent = '복사하기'; }, 2000);
        }
    });
});
