
'use strict';

const _path = require( 'path' );
const _sharp = require( 'sharp' );
const _fs = require( 'fs' );

// time in milliseconds to wait after the last response before taking the screenshot
const WAIT_AFTER_RESPONSE = 1000;
const LOOP_SLEEP_TIME = 500;

// maximum waiting time in milliseconds for requests to finish
const TIMEOUT = 15000;

const sleep = timeInMs => new Promise( resolve => setTimeout( resolve, timeInMs ) );

const isTweetEmbed = url => url.startsWith( 'https://platform.twitter.com/embed/index.html?' );

const snapTweet = async ( { page, filename, logger, makeDirIfRequired } ) => {
    const tmpFilename = filename + '_tmp';
    makeDirIfRequired( _path.dirname( filename ) );
    await page.screenshot( { path: tmpFilename, type: 'jpeg' } );
    await _sharp( tmpFilename ).trim().jpeg( { quality: 90 } ).toFile( filename );
    try {
        _fs.unlinkSync( tmpFilename );
    } catch ( err ) {
        logger.error( `${process.pid}: could not unlink temporary screenshot file: ${err}` );
        return false;
    }
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
