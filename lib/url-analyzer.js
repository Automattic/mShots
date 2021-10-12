const { getRandomUserAgent } = require('./url-analyzer/user-agents');
const puppeteer = require("puppeteer");
const Memcached = require("memcached");

const analyze_url = async function (url, cache_key, logger) {
    let data = await get_data(url, logger);
    save_data(cache_key, data);
}

async function get_data(url, logger) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(getRandomUserAgent());
    const response = await page.goto(url).catch((error) => ({ error }));

    if (response.error) {
        await browser.close();
        return response;
    }

    let data = {};

    data.title = await page.title();

    await browser.close();

    return data;
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

module.exports = {
    analyze_url
};
