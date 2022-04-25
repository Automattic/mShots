/**
 * External imports
 */
const { extractColors } = require('extract-colors');
const nameColor = require('@yatiac/name-that-color');

/**
 * Internal imports
 */
const { supplementUrl } = require('./utils');

async function extractColorsFromImage(url, protocol) {
    const options = { saturationImportance: 0 };
    if (url) {
        const colors = await extractColors(
            supplementUrl(url, protocol),
            options
        );
        return colors.map((c) => {
            c.name = nameColor(c.hex).colorName;
            return c;
        });
    } else {
        return [];
    }
}

function mapColor(colorStr) {
    if (colorStr.startsWith('rgb')) colorStr = '#' + rgbHex(colorStr);

    return {
        hex: colorStr,
        name: nameColor(colorStr).colorName,
    };
}

function mapColors(colors) {
    return Object.keys(colors).reduce((acc, key) => {
        const val = colors[key];

        if (Array.isArray(val)) {
            acc[key] = val.map(mapColor);
        } else {
            acc[key] = mapColor(colors[key]);
        }

        return acc;
    }, {});
}

function rgbHex(red, green, blue, alpha) {
    if (typeof red === 'string') {
        [red, green, blue, alpha] = red
            .match(/(0?\.?\d{1,3})%?\b/g)
            .map((component) => Number(component));
    } else if (alpha !== undefined) {
        alpha = Number.parseFloat(alpha);
    }

    if (
        typeof red !== 'number' ||
        typeof green !== 'number' ||
        typeof blue !== 'number' ||
        red > 255 ||
        green > 255 ||
        blue > 255
    ) {
        throw new TypeError('Expected three numbers below 256');
    }

    return (blue | (green << 8) | (red << 16) | (1 << 24))
        .toString(16)
        .slice(1);
}

module.exports = {
    rgbHex,
    mapColor,
    mapColors,
    extractColorsFromImage,
};
