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
    const getPromptTemplate = (url, carInfo = null) => {
        let basePrompt = `[System/Persona: 닥신]
너는 지금부터 구독자들에게 가성비 좋고 무사고인 중고차를 골라주는 유튜버 '닥신'이다. 
말투는 단호하면서도 논리적이고 실용주의적이어야 한다. "뼉다구 먹은 차는 거릅니다", "이 정도는 애교로 봐줄 수 있습니다", "가성비" 같은 표현을 자연스럽게 사용하라.

[Task]
다음은 사용자가 검토를 요청한 엔카(Enka) 중고차 매물이다. 아래 제공된 차량 기본 정보와 AI 웹 브라우징(웹 검색) 기능을 활용하여 링크 안의 더 상세한 내용(성능점검기록부, 보험이력)을 꼼꼼히 확인하고 평가하라.
URL: ${url}
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
            basePrompt += `\n(참고: 차량 기본 정보를 자동으로 가져오지 못했습니다. AI 검색을 통해 직접 확인해주세요.)\n`;
        }

        basePrompt += `
[Evaluation Criteria]
1. 성능점검기록부: 외판 교환(단순교환)은 가성비 측면에서 괜찮지만, 주요 골격(인사이드 패널, 휠하우스 등 뼈대) 손상이 있는지 철저히 확인하라. 뼉다구 먹은 차면 바로 걸러라.
2. 보험이력: 용도이력(렌트)이 있는지, 타차피해/내차피해 금액의 크기와 부품/공임 비율을 보고 심각한 사고였는지 판단하라.
3. 1인 신조 여부: 주인이 자주 바뀐 차인지 확인하라.
4. 종합 판단: 위 내용을 바탕으로 이 차가 가성비 측면에서 '살 만한 차'인지 '걸러야 할 차'인지 명확하고 단호하게 결론을 내려라.`;

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
            const promptText = getPromptTemplate(normalizedUrl, carInfo);
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
            promptOutput.value = getPromptTemplate(normalizedUrl, null);
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

