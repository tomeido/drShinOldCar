const fs = require('fs');
const path = require('path');

const scriptContent = fs.readFileSync(path.resolve(__dirname, '../script.js'), 'utf8');

describe('normalizeEncarUrl', () => {
    let normalizeEncarUrl;

    beforeAll(() => {
        const regex = /const normalizeEncarUrl = \(urlStr\) => {[\s\S]*?};/;
        const match = scriptContent.match(regex);
        if (match) {
            eval(`normalizeEncarUrl = ${match[0].replace('const normalizeEncarUrl = ', '')}`);
        } else {
            throw new Error("Could not find normalizeEncarUrl function in script.js");
        }
    });

    test('should add https:// if missing', () => {
        expect(normalizeEncarUrl('fem.encar.com/cars/detail/123')).toBe('https://fem.encar.com/cars/detail/123');
        expect(normalizeEncarUrl('www.encar.com/dc/dc_cardetailview.do?carid=123')).toBe('https://www.encar.com/dc/dc_cardetailview.do?carid=123');
    });

    test('should trim whitespace', () => {
        expect(normalizeEncarUrl('  https://fem.encar.com/cars/detail/123  ')).toBe('https://fem.encar.com/cars/detail/123');
    });

    test('should preserve http://', () => {
        expect(normalizeEncarUrl('http://fem.encar.com/cars/detail/123')).toBe('http://fem.encar.com/cars/detail/123');
    });

    test('should return null for non-encar URLs', () => {
        expect(normalizeEncarUrl('https://www.google.com')).toBeNull();
        expect(normalizeEncarUrl('https://www.boba.com/encar.com')).toBeNull(); // encar.com is in path, not hostname
    });

    test('should allow anything ending with encar.com in hostname', () => {
        expect(normalizeEncarUrl('https://encar.com/cars')).toBe('https://encar.com/cars');
        expect(normalizeEncarUrl('https://m.encar.com/cars')).toBe('https://m.encar.com/cars');
        expect(normalizeEncarUrl('https://fem.encar.com/cars')).toBe('https://fem.encar.com/cars');
    });

    test('should return null for invalid URLs', () => {
        expect(normalizeEncarUrl('not a url at all')).toBeNull();
        expect(normalizeEncarUrl('http://')).toBeNull();
    });
});
