"""
닥신 소환기 — Scrapling 기반 Encar 크롤링 백엔드 서버
Flask + Scrapling을 사용하여 엔카 차량 정보를 크롤링합니다.
"""

import re
import json
import sys
import io
from flask import Flask, request, jsonify
from flask_cors import CORS
from scrapling.fetchers import Fetcher

# Windows 콘솔 인코딩 문제 해결
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


app = Flask(__name__)
CORS(app)  # 프론트엔드에서의 CORS 요청 허용


def extract_car_id(url: str) -> str | None:
    """엔카 URL에서 차량 ID(carid)를 추출한다."""
    # fem.encar.com 형식
    fem_match = re.search(r'fem\.encar\.com/cars/detail/(\d+)', url)
    if fem_match:
        return fem_match.group(1)

    # 기존 encar.com 형식 (query string에서 carid 추출)
    carid_match = re.search(r'[?&]carid=(\d+)', url)
    if carid_match:
        return carid_match.group(1)

    return None


def parse_car_info(page) -> dict | None:
    """
    Scrapling 응답 객체에서 차량 정보를 파싱한다.
    og:title, og:description 메타태그를 활용하며,
    HTML 본문에서 가격 패턴도 추출한다.
    """
    # 1) og:title → 차량명
    og_title_el = page.css('meta[property="og:title"]')
    og_desc_el = page.css('meta[property="og:description"]')
    title_el = page.css('title')

    title = None
    if og_title_el:
        raw_title = og_title_el[0].attrib.get('content', '')
        if raw_title:
            # "뉴SM5 플래티넘 ... 대구 중고차 : 내차팔기·내차사기" → 차량명 추출
            title = re.sub(r'\s*:?\s*내차팔기.*$', '', raw_title, flags=re.IGNORECASE)
            title = re.sub(r'\s*중고차\s*$', '', title)
            title = re.sub(r'\s+', ' ', title).strip()
            # 지역명 제거
            region_pattern = r'\s+(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\s*$'
            title = re.sub(region_pattern, '', title).strip()
    elif title_el:
        raw_title = title_el[0].text or ''
        if raw_title:
            title = re.sub(r'\s*[|:]\s*엔카.*$', '', raw_title, flags=re.IGNORECASE)
            title = re.sub(r'\s*중고차.*$', '', title, flags=re.IGNORECASE)
            title = re.sub(r'\s+', ' ', title).strip()

    # 2) og:description → 연식, 주행거리, 연료, 색상
    year = None
    mileage = None
    fuel = None
    color = None
    details = ''

    if og_desc_el:
        desc = og_desc_el[0].attrib.get('content', '')
        details = desc

        year_match = re.search(r'연식\s*:\s*([^,]+)', desc)
        if year_match:
            year = year_match.group(1).strip()

        mileage_match = re.search(r'주행거리\s*:\s*([\d,]+\s*km)', desc)
        if mileage_match:
            mileage = mileage_match.group(1).strip()

        fuel_match = re.search(r'연료\s*:\s*([^,]+)', desc)
        if fuel_match:
            fuel = fuel_match.group(1).strip()

        color_match = re.search(r'색상\s*:\s*([^,]+)', desc)
        if color_match:
            color = color_match.group(1).strip()

    # 3) 가격 추출: HTML 본문에서 "NNN만원" 패턴
    price = None
    try:
        html_text = page.body.html if hasattr(page, 'body') and page.body else str(page)
    except Exception:
        html_text = str(page)
    price_match = re.search(r'(\d{1,5},?\d*)\s*만\s*원', html_text)
    if price_match:
        price = price_match.group(1).replace(',', '') + '만원'
    # og:description에서도 가격 시도
    if not price and details:
        price_match2 = re.search(r'(\d{1,5},?\d*)\s*만\s*원', details)
        if price_match2:
            price = price_match2.group(1).replace(',', '') + '만원'

    if not title:
        return None

    return {
        'title': title,
        'price': price,
        'year': year or '정보 없음',
        'mileage': mileage or '정보 없음',
        'fuel': fuel,
        'color': color,
        'details': details or '정보 없음',
    }


@app.route('/api/encar', methods=['GET'])
def encar_crawl():
    """
    엔카 차량 URL을 받아 Scrapling으로 크롤링하고,
    파싱된 차량 정보를 JSON으로 반환한다.

    Query Params:
        url (str): 엔카 차량 상세 페이지 URL

    Returns:
        JSON: { success: bool, data: {...} | null, error: str | null }
    """
    target_url = request.args.get('url', '').strip()
    if not target_url:
        return jsonify({'success': False, 'data': None, 'error': 'URL이 제공되지 않았습니다.'}), 400

    if 'encar.com' not in target_url:
        return jsonify({'success': False, 'data': None, 'error': '유효한 엔카(encar.com) URL이 아닙니다.'}), 400

    # 차량 ID 추출하여 fem.encar.com URL로 변환 (더 안정적인 og: 태그 제공)
    car_id = extract_car_id(target_url)
    fetch_url = f'https://fem.encar.com/cars/detail/{car_id}' if car_id else target_url

    try:
        print(f'[Scrapling] 크롤링 시작: {fetch_url}')
        page = Fetcher.get(fetch_url, stealthy_headers=True, follow_redirects=True)

        if page is None:
            return jsonify({'success': False, 'data': None, 'error': 'Scrapling 응답이 None입니다.'}), 502

        car_info = parse_car_info(page)

        if car_info:
            print(f'[Scrapling] 차량 정보 추출 성공: {car_info["title"]}')
            return jsonify({'success': True, 'data': car_info, 'error': None})
        else:
            print('[Scrapling] HTML에서 차량 정보를 찾을 수 없음')
            return jsonify({'success': False, 'data': None, 'error': 'HTML에서 차량 정보를 추출할 수 없습니다.'}), 404

    except Exception as e:
        print(f'[Scrapling] 크롤링 에러: {e}')
        return jsonify({'success': False, 'data': None, 'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    """서버 상태 확인용 헬스체크 엔드포인트"""
    return jsonify({'status': 'ok', 'service': '닥신 소환기 크롤링 서버'})


if __name__ == '__main__':
    print('=' * 50)
    print('🚗 닥신 소환기 — Scrapling 크롤링 서버 시작')
    print('   http://localhost:5000')
    print('=' * 50)
    app.run(host='0.0.0.0', port=5000, debug=True)
