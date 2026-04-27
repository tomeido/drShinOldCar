"""
닥신 소환기 — Scrapling 기반 Encar 크롤링 백엔드 서버
Flask + Scrapling을 사용하여 엔카 차량 정보를 크롤링합니다.
"""

import re
import json
import sys
import io
from urllib.parse import urlparse
from flask import Flask, request, jsonify
from flask_cors import CORS
from scrapling.fetchers import StealthyFetcher
from utils import extract_car_id

# Windows 콘솔 인코딩 문제 해결
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


app = Flask(__name__)
CORS(app)  # 프론트엔드에서의 CORS 요청 허용




def _extract_price_from_text(text: str) -> str | None:
    """텍스트에서 가격 정보를 추출한다 (예: '3,500만원', '1억 2,500 만원')."""
    if not text:
        return None
    # "3,500만원", "1억 2,500 만원" 등의 패턴 매치
    price_match = re.search(r'((?:\d+\s*억\s*)?\d{1,5}(?:,\d{3})*|\d+)\s*만\s*원', text)
    if price_match:
        return price_match.group(1).replace(',', '').replace(' ', '') + '만원'
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

    # 3) 가격 추출: HTML 태그를 제거하여 "NNN만원" 패턴 찾기
    price = None
    try:
        html_text = page.body.html if hasattr(page, 'body') and page.body and page.body.html else str(page)
    except Exception:
        html_text = str(page)

    if html_text is None:
        html_text = str(page)

    text_only = re.sub(r'<[^>]*>', ' ', html_text)
    text_only = re.sub(r'\s+', ' ', text_only)  # 공백 정규화 (엔터 등)

    # HTML 본문에서 가격 시도
    price = _extract_price_from_text(text_only)

    # og:description에서도 가격 시도 (만약 HTML 본문에서 못 찾았다면)
    if not price:
        price = _extract_price_from_text(details)

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

    try:
        parsed_url = urlparse(target_url)
        if parsed_url.scheme not in ['http', 'https']:
            return jsonify({'success': False, 'data': None, 'error': '유효한 엔카(encar.com) URL이 아닙니다.'}), 400

        hostname = parsed_url.hostname
        if not hostname or not (hostname == 'encar.com' or hostname.endswith('.encar.com')):
            return jsonify({'success': False, 'data': None, 'error': '유효한 엔카(encar.com) URL이 아닙니다.'}), 400
    except Exception:
        return jsonify({'success': False, 'data': None, 'error': '유효한 엔카(encar.com) URL이 아닙니다.'}), 400

    # 차량 ID 추출하여 fem.encar.com URL로 변환 (더 안정적인 og: 태그 제공)
    car_id = extract_car_id(target_url)
    fetch_url = f'https://fem.encar.com/cars/detail/{car_id}' if car_id else target_url

    try:
        print(f'[StealthyFetcher] 크롤링 시작 (헤드리스 브라우저): {fetch_url}')
        page = StealthyFetcher.fetch(fetch_url, headless=True, network_idle=True)

        if page is None:
            return jsonify({'success': False, 'data': None, 'error': 'Scrapling 응답이 None입니다.'}), 502

        car_info = parse_car_info(page)

        if car_info:
            print(f'[StealthyFetcher] 차량 정보 추출 성공: {car_info["title"]}')
            return jsonify({'success': True, 'data': car_info, 'error': None})
        else:
            print('[StealthyFetcher] HTML에서 차량 정보를 찾을 수 없음')
            return jsonify({'success': False, 'data': None, 'error': 'HTML에서 차량 정보를 추출할 수 없습니다.'}), 404

    except Exception as e:
        print(f'[StealthyFetcher] 크롤링 에러: {e}')
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
