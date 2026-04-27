import re

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
