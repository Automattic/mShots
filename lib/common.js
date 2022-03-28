const _puppeteer = require("puppeteer");
const o_log4js  = require( 'log4js' );
const logger    = o_log4js.getLogger( 'flog' );

o_log4js.configure( {
    appenders: {
        "app": {
            'type'      : 'file',
            'filename'  : 'logs/mshots.log',
            'maxLogSize': 10485760,
            'numBackups': 10,
            'category'  : 'flog',
        },
    },
    "categories": {
        "default": { "appenders": [ "app" ], "level": "DEBUG" }
    }
});

o_log4js.PatternLayout = '%d{HH:mm:ss,SSS} p m';

const EXIT_UNRESPONSIVE   = 4;

/**
 * Deletes a job from the queue
 *
 * @param job_key a unique key that identifies the job.
 * @param status a status code to indicate the result of the job processing.
 */
function delete_from_queue( job_key, status ) {
    process.send({
        replytype: 'queue-del',
        workerid: process.pid,
        payload: {
            status,
            job_key,
        }
    });
}

/**
 * Add a job to the queue
 *
 * @param job_key a unique key that identifies the job.
 * @param payload the data needed for the job to be executed.
 */
function add_to_queue( job_key, payload ) {
    payload.job_key = job_key;
    process.send( {
        replytype: 'queue-add',
        workerid: process.pid,
        payload
    } );
}

let browser    = null;
let default_UA = '';

async function get_browser() {

    if (browser !== null ) {
        return browser;
    }

    const args = process.env.MSHOTS_CONTAINERIZED ? [ '--no-sandbox' ] : [];
    browser = await _puppeteer.launch( { headless: true, timeout: 30000, ignoreHTTPSErrors: true, args } ).
    catch( e => {
        logger.error( process.pid + ': Failed to launch the browser: ' + e.toString() );
        process.exit( EXIT_UNRESPONSIVE );
    });

    default_UA = await browser.userAgent();
    return browser;
}

const exported = {
    delete_from_queue,
    add_to_queue,
    get_browser,
    default_UA,
}

module.exports = exported;
