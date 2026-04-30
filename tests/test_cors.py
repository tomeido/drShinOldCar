import pytest
from server import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_cors_allowed_origin(client):
    # Test allowed origin
    response = client.get('/health', headers={'Origin': 'http://localhost:5000'})
    assert response.status_code == 200
    assert response.headers.get('Access-Control-Allow-Origin') == 'http://localhost:5000'

def test_cors_allowed_origin_127_0_0_1(client):
    # Test another allowed origin
    response = client.get('/health', headers={'Origin': 'http://127.0.0.1:3000'})
    assert response.status_code == 200
    assert response.headers.get('Access-Control-Allow-Origin') == 'http://127.0.0.1:3000'

def test_cors_rejected_origin(client):
    # Test rejected origin
    response = client.get('/health', headers={'Origin': 'http://malicious.com'})
    assert response.status_code == 200
    # Origin should not be in Access-Control-Allow-Origin
    assert response.headers.get('Access-Control-Allow-Origin') is None
