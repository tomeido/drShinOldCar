/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const scriptContent = fs.readFileSync(path.resolve(__dirname, '../../script.js'), 'utf8');

const startIndex = scriptContent.indexOf('const parseCarInfoFromHtml = (htmlString) => {');
let endIndex = startIndex;
let braceCount = 0;
let started = false;

for (let i = startIndex; i < scriptContent.length; i++) {
  if (scriptContent[i] === '{') {
    braceCount++;
    started = true;
  } else if (scriptContent[i] === '}') {
    braceCount--;
  }

  if (started && braceCount === 0) {
    endIndex = i;
    break;
  }
}

const functionStr = scriptContent.substring(startIndex, endIndex + 1);

// Instead of eval, we construct a function and execute it to get our target function
const getParser = new Function(`
  ${functionStr}
  return parseCarInfoFromHtml;
`);

const parseCarInfoFromHtml = getParser();

describe('parseCarInfoFromHtml', () => {
    it('should parse car info correctly from og: tags and HTML text', () => {
        const htmlString = `
            <html>
                <head>
                    <meta property="og:title" content="현대 그랜저 IG 2.4 GDi 프리미엄 내차팔기 중고차" />
                    <meta property="og:description" content="연식: 2018년, 주행거리: 50000km, 연료: 가솔린, 색상: 검정색" />
                </head>
                <body>
                    <div class="price">2,500만원</div>
                </body>
            </html>
        `;
        const result = parseCarInfoFromHtml(htmlString);
        expect(result).toEqual({
            title: '현대 그랜저 IG 2.4 GDi 프리미엄',
            price: '2500만원',
            year: '2018년',
            mileage: '50000km',
            fuel: '가솔린',
            color: '검정색',
            details: '연식: 2018년, 주행거리: 50000km, 연료: 가솔린, 색상: 검정색'
        });
    });

    it('should remove region suffix from title', () => {
        const htmlString = `
            <html>
                <head>
                    <meta property="og:title" content="현대 아반떼 CN7 서울" />
                </head>
                <body>
                </body>
            </html>
        `;
        const result = parseCarInfoFromHtml(htmlString);
        expect(result.title).toBe('현대 아반떼 CN7');
    });

    it('should fallback to title tag if og:title is missing', () => {
         const htmlString = `
            <html>
                <head>
                    <title>기아 쏘렌토 MQ4 | 엔카 중고차</title>
                </head>
                <body>
                </body>
            </html>
        `;
        const result = parseCarInfoFromHtml(htmlString);
        expect(result.title).toBe('기아 쏘렌토 MQ4');
    });

    it('should return null if title cannot be found', () => {
         const htmlString = `
            <html>
                <head>
                </head>
                <body>
                </body>
            </html>
        `;
        const result = parseCarInfoFromHtml(htmlString);
        expect(result).toBeNull();
    });

    it('should parse price from plain text with Korean currency format', () => {
         const htmlString = `
            <html>
                <head>
                    <title>기아 쏘렌토 MQ4</title>
                </head>
                <body>
                   <div>판매가 1억 2,500 만원입니다.</div>
                </body>
            </html>
        `;
        const result = parseCarInfoFromHtml(htmlString);
        expect(result.price).toBe('1억2500만원');
    });

    it('should handle partial or missing description data gracefully', () => {
         const htmlString = `
            <html>
                <head>
                    <meta property="og:title" content="제네시스 G80" />
                    <meta property="og:description" content="연식: 2021년, 주행거리: 30000km" />
                </head>
                <body>
                </body>
            </html>
        `;
        const result = parseCarInfoFromHtml(htmlString);
        expect(result).toEqual({
            title: '제네시스 G80',
            price: null,
            year: '2021년',
            mileage: '30000km',
            fuel: null,
            color: null,
            details: '연식: 2021년, 주행거리: 30000km'
        });
    });
});
