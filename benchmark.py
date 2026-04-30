import time
from server import app

def run_benchmark():
    client = app.test_client()
    url = "https://fem.encar.com/cars/detail/38459424" # Some car ID

    print("Running benchmark...")

    # Warmup / first request
    start = time.time()
    resp1 = client.get(f'/api/encar?url={url}')
    t1 = time.time() - start
    print(f"Request 1 (cache miss): {t1:.4f}s - Status: {resp1.status_code}")

    # Second request
    start = time.time()
    resp2 = client.get(f'/api/encar?url={url}')
    t2 = time.time() - start
    print(f"Request 2 (potential cache hit): {t2:.4f}s - Status: {resp2.status_code}")

if __name__ == '__main__':
    run_benchmark()
