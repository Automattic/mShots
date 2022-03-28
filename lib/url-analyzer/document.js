/**
 * Document.js is a module conceived to be
 * a dedicated place for document context methods
 */

function getPageProtocol() {
    return location.protocol;
}


function recognizeLogoSrc() {
    const element = document.querySelector(
        'header img, #header img, img#logo, .header img'
    );

    return element && element.src;
}

function recognizeFaviconSrc() {
    const element = Array.from(document.getElementsByTagName('link')).find(
        (el) => el.rel === 'icon' || el.href.includes('favicon')
    );

    return element && element.href;
}

function recognizeColors() {
    const body = document.getElementsByTagName('body').item(0);
    const links = Array.from(document.getElementsByTagName('a')).reduce(
        (acc, el) => {
            const color = getComputedStyle(el).backgroundColor;
            const transparent = 'rgba(0, 0, 0, 0)';

            if (color !== transparent) acc[color] = color;

            return acc;
        },
        {}
    );

    const metaThemeColor = document.querySelector(
        'head > meta[name="theme-color"]'
    );
    const themeColor =
        (metaThemeColor && metaThemeColor.getAttribute('content')) || undefined;

    return {
        themeColor,
        body: getComputedStyle(body).backgroundColor,
        links: Object.values(links),
    };
}

function documentScrollBottomPage() {
    window.scrollTo(0, document.body.scrollHeight);
}

module.exports = {
    getPageProtocol,
    recognizeLogoSrc,
    recognizeFaviconSrc,
    recognizeColors,
    documentScrollBottomPage,
};
