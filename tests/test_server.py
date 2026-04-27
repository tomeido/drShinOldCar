import pytest
from unittest.mock import patch
from server import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_encar_crawl_missing_url(client):
    response = client.get('/api/encar')
    assert response.status_code == 400
    data = response.get_json()
    assert data['success'] is False
    assert data['error'] == 'URL이 제공되지 않았습니다.'

def test_encar_crawl_invalid_scheme(client):
    response = client.get('/api/encar?url=ftp://encar.com/car')
    assert response.status_code == 400
    data = response.get_json()
    assert data['success'] is False
    assert data['error'] == '유효한 엔카(encar.com) URL이 아닙니다.'

def test_encar_crawl_invalid_domain(client):
    response = client.get('/api/encar?url=https://example.com/car')
    assert response.status_code == 400
    data = response.get_json()
    assert data['success'] is False
    assert data['error'] == '유효한 엔카(encar.com) URL이 아닙니다.'

class MockElement:
    def __init__(self, attrib=None, text=""):
        self.attrib = attrib or {}
        self.text = text

class MockPage:
    def __init__(self, html="", og_title=None, og_desc=None, title=None):
        self.html = html
        self.og_title = og_title
        self.og_desc = og_desc
        self.title_text = title

    def css(self, selector):
        if selector == 'meta[property="og:title"]' and self.og_title:
            return [MockElement(attrib={'content': self.og_title})]
        if selector == 'meta[property="og:description"]' and self.og_desc:
            return [MockElement(attrib={'content': self.og_desc})]
        if selector == 'title' and self.title_text:
            return [MockElement(text=self.title_text)]
        return []

    def __str__(self):
        return self.html

@patch('server.StealthyFetcher.fetch')
def test_encar_crawl_success(mock_fetch, client):
    mock_page = MockPage(
        html="<div>가격: 3,500만원</div>",
        og_title="BMW 5시리즈 (G30) 520i M 스포츠 내차팔기",
        og_desc="연식 : 2021년형, 주행거리 : 30,000 km, 연료 : 가솔린, 색상 : 흰색"
    )
    mock_fetch.return_value = mock_page

    response = client.get('/api/encar?url=https://fem.encar.com/cars/detail/12345678')
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['data']['title'] == "BMW 5시리즈 (G30) 520i M 스포츠"
    assert data['data']['price'] == "3500만원"
    assert data['data']['year'] == "2021년형"
    assert data['data']['mileage'] == "30,000 km"
    assert data['data']['fuel'] == "가솔린"
    assert data['data']['color'] == "흰색"

@patch('server.StealthyFetcher.fetch')
def test_encar_crawl_fetch_none(mock_fetch, client):
    mock_fetch.return_value = None

    response = client.get('/api/encar?url=https://fem.encar.com/cars/detail/12345678')
    assert response.status_code == 502
    data = response.get_json()
    assert data['success'] is False
    assert data['error'] == 'Scrapling 응답이 None입니다.'

@patch('server.StealthyFetcher.fetch')
def test_encar_crawl_fetch_exception(mock_fetch, client):
    mock_fetch.side_effect = Exception("Network Error")

    response = client.get('/api/encar?url=https://fem.encar.com/cars/detail/12345678')
    assert response.status_code == 500
    data = response.get_json()
    assert data['success'] is False
    assert data['error'] == 'Network Error'

@patch('server.StealthyFetcher.fetch')
def test_encar_crawl_fetch_no_car_info(mock_fetch, client):
    mock_page = MockPage(html="<div>Empty Page</div>")
    mock_fetch.return_value = mock_page

    response = client.get('/api/encar?url=https://fem.encar.com/cars/detail/12345678')
    assert response.status_code == 404
    data = response.get_json()
    assert data['success'] is False
    assert data['error'] == 'HTML에서 차량 정보를 추출할 수 없습니다.'
