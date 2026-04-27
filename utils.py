import re

def extract_car_id(url: str) -> str | None:
    """엔카 URL에서 차량 ID(carid)를 추출한다."""
    match = re.search(r'(?:fem\.encar\.com/cars/detail/|[?&]carid=)(\d+)', url)
    if match:
        return match.group(1)

    return None
