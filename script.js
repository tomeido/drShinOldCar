document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('encar-url');
    const generateBtn = document.getElementById('generate-btn');
    const errorMessage = document.getElementById('error-message');
    const resultSection = document.getElementById('result-section');
    const promptOutput = document.getElementById('prompt-output');
    const copyBtn = document.getElementById('copy-btn');
    const copyOverlay = document.querySelector('.copy-success-overlay');
    const btnText = copyBtn.querySelector('.btn-text');

    // 로딩 상태 처리용 변수
    let isLoading = false;

    // 닥신 페르소나 프롬프트 템플릿 (기본 + 크롤링 정보 병합)
    const getPromptTemplate = (url, carInfo = null, userPrefs) => {
        let basePrompt = `[시스템]
너는 한국 중고차 시장에 매우 익숙한 중고차 전문 컨설턴트다. 
유튜브 '닥신TV'에서 설명하는 중고차 고르는 원칙을 참고하되, 실제 인물을 사칭하지 말고 그와 비슷한 기준으로 합리적으로 판단하는 전문가로 행동한다.

분석 기준은 다음과 같다.
1. 보험 이력(카히스토리)
   - 용도 변경 이력에 대여/영업 사용 이력이 있는지 확인하고, 초보자에게는 이런 차를 피하라고 조언한다.
   - 소유자 변경 이력이 1회(1인 소유)인지, 여러 번 바뀌었는지 본다.
   - 전손, 침수, 도난 이력이 있으면 무조건 비추천한다.
   - 내차 피해·타차 가해 사고 금액을 보고, 국산차 기준 100~300만 원대의 소액 사고는 판금·도색 수준으로 보고, 500만 원 이상 대형 사고는 리스크로 본다.
   - 보험 이력이나 성능 기록부가 비공개이거나, 정보 제공 불가능 기간이 길면 바로 리스크가 크다고 판단한다.

2. 성능 점검 기록부
   - 외판(펜더, 문짝, 범퍼 등) 교환/판금은 큰 문제가 아니라고 보되,
   - 인사이드 패널, 휠하우스, 프레임(뼈대) 교환/수리가 있으면 큰 사고차로 보고 비추천한다.

3. 엔카 진단
   - 엔카 진단을 받았는지, 외판·뼈대에 이상 없음으로 나오는지 확인하고, 삼중 검증(보험 이력 + 성능 기록부 + 엔카 진단)을 통과하면 신뢰도를 높게 본다.

4. 가격/감가 및 차종 포지셔닝
   - 같은 예산에서 새 아반떼 vs 감가 많이 된 그랜저·수입 대형차처럼, 한 급 위 차종을 살 수 있는지 본다.
   - 연식, 주행거리, 감가율을 함께 보고 가성비를 평가한다.

5. 기타 신호
   - 타이어 브랜드(미쉐린 등 프리미엄 vs 싸구려)로 차주의 관리 성향을 추정한다.
   - 딜러의 다른 매물, 누적 판매 이력, 엔카 진단 비율 등을 통해 딜러 성향을 추정하고, 지나치게 리스크 높은 매물만 모아 파는 딜러는 경계한다.

위 기준을 일관되게 적용해서, 감정적인 표현보다 논리적인 근거를 중심으로 설명해라.

[사용자 입력]
- 엔카 차량 링크: ${url}
- 내 정보/조건:
  - 예산: ${userPrefs.budget}
  - 주요 용도: ${userPrefs.usage}
  - 리스크 허용도: ${userPrefs.risk}
`;

        // 크롤링에 성공하여 정보가 있으면 주입
        if (carInfo) {
            basePrompt += `
[추출된 차량 기본 정보]
- 차량명: ${carInfo.title || '정보 없음'}
- 가격: ${carInfo.price || '정보 없음'}
- 연식: ${carInfo.year || '정보 없음'}
- 주행거리: ${carInfo.mileage || '정보 없음'}
- 기타 정보: ${carInfo.details || '정보 없음'}
`;
        } else {
            basePrompt += `\n(참고: 차량 기본 정보를 자동으로 가져오지 못했습니다. 링크를 열거나 검색을 통해 직접 확인해주세요.)\n`;
        }

        basePrompt += `
[지시]
1. 위 제공된 [사용자 입력]의 링크 웹 페이지를 읽거나 검색하여, 보험 이력, 성능 기록부, 엔카 진단, 가격, 연식, 주행거리, 타이어, 딜러 정보를 가능한 한 많이 확인해라.
2. 위에서 정의한 닥신 스타일 기준으로 이 매물을 평가해라.
3. 아래 출력 형식으로 한국어로만 답변해라.

[출력 형식]
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
- 닥신TV에서 설명하는 톤을 참고하되, 실제 인물임을 암시하지 말고 가상의 전문가로서 직설적으로 평가하라. ("뼉다구 먹은 차는 거릅니다", "가성비 좋습니다" 등 자연스럽게)
- 왜 괜찮은지, 왜 애매한지, 왜 위험한지 구체적으로 설명하라.
- 사용자의 예산(${userPrefs.budget})과 용도(${userPrefs.usage}), 그리고 성향(${userPrefs.risk})에 맞추어 적절한 차량인지 객관적으로 분석하라.

5) 최종 결론
- 아래 중 하나를 선택하고, 한 문장으로 명확히 써라.
  - "이 조건이면 사도 괜찮은 차다."
  - "아주 싸게만 산다면 고려할 수 있다."
  - "초보자에게는 비추다. 다른 매물을 보는 것이 좋다."
- 그 판단의 핵심 근거를 2~3줄로 정리하라.`;

        return basePrompt;
    };

    // URL 유효성 검사 및 정규화
    const normalizeEncarUrl = (urlStr) => {
        let url = urlStr.trim();
        // http/https가 없으면 붙여줌
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        try {
            const parsed = new URL(url);
            // encar.com 도메인이 포함되어야 함 (모바일 fem.encar.com 포함)
            if (parsed.hostname.includes('encar.com')) {
                return url; // 정규화된 유효한 URL 반환
            }
        } catch (e) {
            // 파싱 실패
        }
        return null;
    };

    // CORS Proxy를 이용한 엔카 HTML 크롤링
    const fetchEncarData = async (targetUrl) => {
        // allorigins 프록시 사용 (encodeURIComponent로 URL 감싸기)
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            const htmlString = data.contents;

            // DOMParser를 이용해 HTML 파싱
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlString, 'text/html');

            // 엔카 상세 페이지 구조에서 정보 추출 (PC버전 기준 선택자)
            // 엔카의 구조는 자주 변할 수 있으므로 실패 시 null을 우아하게 반환하도록 예외처리
            try {
                // 차량 제목 영역
                const titleEl = doc.querySelector('.prod_name .name') || doc.querySelector('h1');
                // 가격 정보
                const priceEl = doc.querySelector('.prod_price .reg') || doc.querySelector('.price');
                // 상세 정보 ul 목록 (연식, 주행거리 등)
                const detailItems = Array.from(doc.querySelectorAll('.prod_item li') || []);

                const title = titleEl ? titleEl.textContent.trim().replace(/\s+/g, ' ') : null;
                const price = priceEl ? priceEl.textContent.trim().replace(/\s+/g, ' ') : null;

                let detailsStr = '';
                if (detailItems.length > 0) {
                    detailsStr = detailItems.map(item => item.textContent.trim()).join(' / ');
                } else {
                    // 모바일 페이지 등 다른 구조 대비 태그 메타 데이터 수집 시도
                    const metaDesc = doc.querySelector('meta[name="description"]');
                    if (metaDesc) {
                        detailsStr = metaDesc.content;
                    }
                }

                // 정보가 충분히 수집되었는지 확인 (제목이라도 있으면 성공으로 간주)
                if (title) {
                    return {
                        title: title,
                        price: price,
                        details: detailsStr,
                        year: '상세 정보 참조', // 특정 요소로 분리가 어려울 경우 details 로 퉁침
                        mileage: '상세 정보 참조'
                    };
                }
            } catch (e) {
                console.warn("DOM 추출 중 에러:", e);
            }

            return null; // 파싱 실패 시
        } catch (error) {
            console.error('크롤링 실패:', error);
            return null;
        }
    };

    // 프롬프트 생성 처리 로직
    const handleGenerate = async () => {
        if (isLoading) return; // 이미 로딩 중이면 방어

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

        // 유효한 URL인 경우 시작
        errorMessage.classList.add('hidden');
        isLoading = true;

        // 버튼 상태 변경 (로딩 중 표시)
        const originalBtnHtml = generateBtn.innerHTML;
        generateBtn.innerHTML = `<span>차량 정보 분석 중...</span>
        <svg viewBox="0 0 24 24" fill="none" class="animate-spin" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>`;
        generateBtn.style.opacity = '0.7';

        try {
            // 크롤링 시도 (최대 3~4초 대기)
            const carInfo = await fetchEncarData(normalizedUrl);

            // 프롬프트 생성 및 주입
            const promptText = getPromptTemplate(normalizedUrl, carInfo, userPrefs);
            promptOutput.value = promptText;

            // 결과 섹션 표시 애니메이션
            resultSection.classList.remove('hidden');
            void resultSection.offsetWidth; // 리플로우 강제
            resultSection.classList.add('visible');

            setTimeout(() => {
                resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);

        } catch (error) {
            // 시스템 에러 시 (그래도 기본 프롬프트는 띄운다)
            promptOutput.value = getPromptTemplate(normalizedUrl, null, userPrefs);
            resultSection.classList.remove('hidden');
            void resultSection.offsetWidth;
            resultSection.classList.add('visible');
        } finally {
            // 버튼 상태 원상복구
            isLoading = false;
            generateBtn.innerHTML = originalBtnHtml;
            generateBtn.style.opacity = '1';
        }
    };

    // 클릭 이벤트
    generateBtn.addEventListener('click', handleGenerate);

    // 엔터키 이벤트
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleGenerate();
        }
    });

    // 입력 시 에러 메시지 숨김
    urlInput.addEventListener('input', () => {
        if (!errorMessage.classList.contains('hidden')) {
            errorMessage.classList.add('hidden');
        }
    });

    // 클립보드 복사 기능
    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(promptOutput.value);

            // 성공 애니메이션
            copyOverlay.classList.add('show');
            btnText.textContent = '복사됨!';
            copyBtn.style.color = 'var(--success-color)';

            setTimeout(() => {
                copyOverlay.classList.remove('show');
                btnText.textContent = '복사하기';
                copyBtn.style.color = '';
            }, 2000);

        } catch (err) {
            console.error('Failed to copy text: ', err);
            promptOutput.select();
            document.execCommand('copy');
            alert('클립보드에 복사되었습니다.');
        }
    });
});

