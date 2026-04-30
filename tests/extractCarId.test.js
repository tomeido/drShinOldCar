const { extractCarId } = require('../script');

describe('extractCarId', () => {
    test('extracts ID from fem.encar.com URL', () => {
        expect(extractCarId('https://fem.encar.com/cars/detail/12345678')).toBe('12345678');
    });

    test('extracts ID from standard encar.com URL with query params', () => {
        expect(extractCarId('https://www.encar.com/dc/dc_cardetailview.do?carid=87654321')).toBe('87654321');
    });

    test('extracts ID from encar.com URL with multiple query params', () => {
        expect(extractCarId('https://www.encar.com/dc/dc_cardetailview.do?pageid=1&carid=11223344&listAdvType=salecar')).toBe('11223344');
    });

    test('returns null for missing carid in query string', () => {
        expect(extractCarId('https://www.encar.com/dc/dc_cardetailview.do?pageid=1')).toBeNull();
    });

    test('returns null for non-numeric carid in query string', () => {
        expect(extractCarId('https://www.encar.com/dc/dc_cardetailview.do?carid=abcdef')).toBeNull();
    });

    test('extracts ID from URL without protocol (using fallback regex)', () => {
        expect(extractCarId('www.encar.com/dc/dc_cardetailview.do?carid=99887766')).toBe('99887766');
    });

    test('returns null for completely invalid URL format', () => {
        expect(extractCarId('not-a-url')).toBeNull();
    });

    test('returns null for invalid inputs', () => {
        expect(extractCarId(null)).toBeNull();
        expect(extractCarId(undefined)).toBeNull();
        expect(extractCarId(12345678)).toBeNull();
        expect(extractCarId({})).toBeNull();
    });
});
