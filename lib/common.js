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

const SUCCESS             = 0;
const HOST_NO_DNS         = 1;
const HOST_BLACKLISTED    = 2;
const HOST_IP_BLACKLISTED = 3;
const HOST_INVALIDSCHEMA  = 4;
const HOST_INVALID        = 5;
const GENERAL_ERROR       = 6;

const EXIT_UNRESPONSIVE   = 4;
const EXIT_ERROR_LIMIT    = 5;

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

function add_to_queue( job_key, payload ) {
    payload.job_key = job_key;
    process.send( {
        replytype: 'queue-add',
        workerid: process.pid,
        payload
    } );
}

const exported = {
    get_browser,
    delete_from_queue,
    add_to_queue,
    default_UA,
    SUCCESS,
    HOST_NO_DNS,
    HOST_BLACKLISTED,
    HOST_IP_BLACKLISTED,
    HOST_INVALIDSCHEMA,
    HOST_INVALID,
    GENERAL_ERROR
}

module.exports = exported;
