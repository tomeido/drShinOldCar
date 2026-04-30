import pytest
from unittest.mock import MagicMock
from server import parse_car_info, _extract_price_from_text

# Tests will be added below

def test_extract_price_from_text():
    # Valid formats
    assert _extract_price_from_text("3,500만원") == "3500만원"
    assert _extract_price_from_text("1억 2,500 만원") == "1억2500만원"
    assert _extract_price_from_text("100 만 원") == "100만원"
    assert _extract_price_from_text("가격: 4,000만원입니다.") == "4000만원"
    assert _extract_price_from_text("500 만원") == "500만원"

    # Invalid or missing formats
    assert _extract_price_from_text("가격 미정") is None
    assert _extract_price_from_text("") is None
    assert _extract_price_from_text(None) is None
    assert _extract_price_from_text("100 dollars") is None


def create_mock_page(html_content, og_title=None, og_desc=None, title=None):
    """Helper to mock a Scrapling page object"""
    page = MagicMock()

    def css_mock(selector):
        if selector == 'meta[property="og:title"]' and og_title is not None:
            el = MagicMock()
            el.attrib = {'content': og_title}
            return [el]
        if selector == 'meta[property="og:description"]' and og_desc is not None:
            el = MagicMock()
            el.attrib = {'content': og_desc}
            return [el]
        if selector == 'title' and title is not None:
            el = MagicMock()
            el.text = title
            return [el]
        return []

    page.css.side_effect = css_mock
    page.body.html = html_content
    return page

def test_parse_car_info_happy_path_og_tags():
    page = create_mock_page(
        html_content="<body><div>가격: 3,500만원</div></body>",
        og_title="뉴SM5 플래티넘 1.6 GDI 프리미엄 대구 중고차 : 내차팔기",
        og_desc="연식 : 2013년 01월, 주행거리 : 100,000 km, 연료 : 가솔린, 색상 : 검정색"
    )
    result = parse_car_info(page)

    assert result is not None
    assert result['title'] == '뉴SM5 플래티넘 1.6 GDI 프리미엄'
    assert result['price'] == '3500만원'
    assert result['year'] == '2013년 01월'
    assert result['mileage'] == '100,000 km'
    assert result['fuel'] == '가솔린'
    assert result['color'] == '검정색'
    assert '연식 : 2013년 01월' in result['details']

def test_parse_car_info_fallback_title():
    page = create_mock_page(
        html_content="<body><div>가격: 1억 2,500 만원</div></body>",
        title="BMW 5시리즈 (G30) | 엔카 중고차"
    )
    result = parse_car_info(page)

    assert result is not None
    assert result['title'] == 'BMW 5시리즈 (G30)'
    assert result['price'] == '1억2500만원'
    assert result['year'] == '정보 없음'
    assert result['mileage'] == '정보 없음'
    assert result['fuel'] is None
    assert result['color'] is None

def test_parse_car_info_missing_titles():
    page = create_mock_page(html_content="<body><div>3,500만원</div></body>")
    result = parse_car_info(page)

    assert result is None

def test_parse_car_info_missing_fields_in_og_desc():
    page = create_mock_page(
        html_content="<body><div>가격: 4,000만원</div></body>",
        og_title="아반떼 AD",
        og_desc="일부 정보만 있음"
    )
    result = parse_car_info(page)

    assert result is not None
    assert result['year'] == '정보 없음'
    assert result['mileage'] == '정보 없음'
    assert result['fuel'] is None
    assert result['color'] is None
    assert result['details'] == '일부 정보만 있음'

def test_parse_car_info_price_from_og_desc():
    # Price is not in HTML body, but is in og:description
    page = create_mock_page(
        html_content="<body><div>설명만 있음</div></body>",
        og_title="아반떼 AD",
        og_desc="연식 : 2018년, 주행거리 : 50,000 km, 가격: 1,500만원"
    )
    result = parse_car_info(page)

    assert result is not None
    assert result['price'] == '1500만원'

def test_parse_car_info_no_price():
    page = create_mock_page(
        html_content="<body><div>가격 안 써있음</div></body>",
        og_title="제네시스 G80",
        og_desc="연식 : 2020년"
    )
    result = parse_car_info(page)

    assert result is not None
    assert result['price'] is None

def test_parse_car_info_malformed_html_body():
    page = create_mock_page(
        html_content=None,
        og_title="쏘나타",
        og_desc="연식 : 2015년"
    )
    # Even if page.body.html is malformed or missing, it falls back to str(page)
    # So we set the string representation
    page.__str__.return_value = "가격: 2,000만원"

    result = parse_car_info(page)

    assert result is not None
    assert result['price'] == '2000만원'


def test_parse_car_info_missing_title_info():
    page = create_mock_page(
        html_content="<body><div>가격 안 써있음</div></body>",
        og_title="", # Empty title
        og_desc="연식 : 2020년"
    )
    result = parse_car_info(page)

    assert result is None
