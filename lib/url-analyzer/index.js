/**
 * External imports
 */
const common = require('../common');

/**
 * Internal imports
 */
const { getRandomUserAgent } = require('./user-agents');
const { mapColors, extractColorsFromImage } = require('./color');

const {
    getPageProtocol,
    documentScrollBottomPage,
    recognizeLogoSrc,
    recognizeColors,
    recognizeFaviconSrc
} = require('./document');

const Memcached = require("memcached");

/**
 * @param url
 * @param cache_key
 * @param logger
 */
async function analyze(url, cache_key, logger) {
    const browser = await common.get_browser()

    let data = {
        url: url,
        status: 'analyzing'
    }

    save_data(cache_key, data);

    try {
        const page = await browser.newPage();
        await page.setUserAgent(getRandomUserAgent());
        const response = await page.goto(url).catch((error) => ({ error }));
        if (response.error) {
            await browser.close();
            return response;
        }

        await page.evaluate(documentScrollBottomPage); // trigger loading lazy images
        const protocol = await page.evaluate(getPageProtocol);


        const colors = {
            ...{
                logo: await extractColorsFromImage(
                    await page.evaluate(recognizeLogoSrc),
                    protocol
                ).catch((x) => {}),
            },
            ...{
                favicon: await extractColorsFromImage(
                    await page.evaluate(recognizeFaviconSrc),
                    protocol
                ).catch((x) => {}),
            },
            ...mapColors(await page.evaluate(recognizeColors)),
        };

        data = {
            url: url,
            status: 'analyzed',
            colors
        }

        save_data(cache_key, data);
    } catch (error) {
        data.status = 'failed';
        return error;
    } finally {
        await browser.close();
        save_data(cache_key, data);
        common.delete_from_queue( get_job_key( url ), 0 );
    }
}

function save_data(cache_key, data) {
    let memcached_host = process.env.MSHOTS_MEMCACHE_HOST
        ? process.env.MSHOTS_MEMCACHE_HOST
        : '127.0.0.1';

    let memcached = new Memcached( memcached_host + ':11211' );
    // Set the data in memcached
    memcached.set( cache_key, JSON.stringify(data), 3600, (err) => {
        console.log("Handle memcached error....");
    });
}

function get_job_key( url ) {
    return 'analyze' + url;
}


module.exports = {
    analyze: analyze,
    get_job_key
};
