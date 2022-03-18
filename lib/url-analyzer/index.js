/**
 * External imports
 */
const common = require('../common');

const Memcached = require("memcached");

/**
 * @param url
 * @param cache_key
 * @param logger
 */
async function analyze(url, cache_key, logger) {
    const browser = await common.get_browser();


    const page = await browser.newPage();
    await page.setUserAgent(getRandomUserAgent());
    const response = await page.goto(url).catch((error) => ({ error }));

    if (response.error) {
        await browser.close();
        return response;
    }

    let data = {
        title: await page.title(),
        status: 'analyzed'
    }

    save_data(cache_key, data);

    await browser.close();

    common.delete_from_queue( get_job_key( url ), 0 );
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
