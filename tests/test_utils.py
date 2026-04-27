import pytest
from utils import extract_car_id

def test_extract_car_id_fem_format():
    url = "https://fem.encar.com/cars/detail/39053351"
    assert extract_car_id(url) == "39053351"

def test_extract_car_id_standard_format():
    url = "https://www.encar.com/dc/dc_cardetailview.do?carid=39053351"
    assert extract_car_id(url) == "39053351"

def test_extract_car_id_with_multiple_params():
    url = "https://www.encar.com/dc/dc_cardetailview.do?carid=39053351&wtClick_korList=019"
    assert extract_car_id(url) == "39053351"

def test_extract_car_id_with_carid_not_first():
    url = "https://www.encar.com/dc/dc_cardetailview.do?other=val&carid=39053351"
    assert extract_car_id(url) == "39053351"

def test_extract_car_id_invalid_url():
    url = "https://www.google.com"
    assert extract_car_id(url) is None

def test_extract_car_id_no_carid_in_url():
    url = "https://www.encar.com/index.html"
    assert extract_car_id(url) is None

def test_extract_car_id_empty_string():
    assert extract_car_id("") is None

def test_extract_car_id_none():
    with pytest.raises(TypeError):
        extract_car_id(None)
