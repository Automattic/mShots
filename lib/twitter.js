
'use strict';

const _path = require( 'path' );

// time in milliseconds to wait after the last response before taking the screenshot
const WAIT_AFTER_RESPONSE = 1000;
const LOOP_SLEEP_TIME = 500;

// maximum waiting time in milliseconds for requests to finish
const TIMEOUT = 15000;

const sleep = timeInMs => new Promise( resolve => setTimeout( resolve, timeInMs ) );

const isTweetEmbed = url => url.startsWith( 'https://platform.twitter.com/embed/index.html?' );

const snapTweet = async ( { page, filename, logger, makeDirIfRequired } ) => {
    const elements = await page.$x( '//*[@id="app"]/div/div/div' );
    if ( elements.length !== 1 ) {
        logger.error( `${process.pid}: xpath selector returned ${elements.length} elements` );
        return false;
    }
    makeDirIfRequired( _path.dirname( filename ) );
    await elements[0].screenshot( { path: filename, type: 'jpeg', quality: 90 } );
    return true;
};

const takeTweetScreenshot = async ( { page, url, filename, logger, makeDirIfRequired } ) => {
    let isTweetInfoLoaded = false;
    let lastResponseTime = Date.now();
    const activeRequests = [];

    await page.on( 'request', request => {
        if ( isTweetInfoLoaded ) {
            activeRequests.push( request.url() );
        }
    } );

    await page.on( 'response', response => {
        const requestUrl = response.request().url();
        if ( requestUrl.startsWith( 'https://cdn.syndication.twimg.com/tweet' ) ) {
            isTweetInfoLoaded = true;
            lastResponseTime = Date.now();
        } else {
            const index = activeRequests.indexOf( requestUrl );
            if (index > -1) {
                activeRequests.splice( index, 1 );
                lastResponseTime = Date.now();
            }
        }
    } );

    const startTime = Date.now();
    let success = false;

    const response = await page.goto( url )
        .catch( e => {
            logger.error( process.pid + ': Failed to load ' + url + ': ' + e.toString() );
        } );

    if ( ! response ) {
        return false;
    }

    await ( async () => {
        while ( true ) {
            if ( isTweetInfoLoaded && activeRequests.length === 0 ) {
                const currentLastResponseTime = lastResponseTime;
                const waitingTime = currentLastResponseTime + WAIT_AFTER_RESPONSE - Date.now();

                if ( waitingTime > 0 ) {
                    await sleep( waitingTime );
                }

                if ( currentLastResponseTime === lastResponseTime ) {
                    success = await snapTweet( { page, filename, logger, makeDirIfRequired } );
                    return;
                }
            }

            if ( Date.now() - startTime >= TIMEOUT ) {
                logger.error( `${process.pid}: Timed out waiting for requests to finish: ${url}` );
                success = false;
                return;
            }

            await sleep( LOOP_SLEEP_TIME );
        }
    } )();

    return success;
};

const exported = {
    isTweetEmbed,
    takeTweetScreenshot,
};

module.exports = exported;
