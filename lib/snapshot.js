
global.snapper = require( './snapper.node' );
var o_log4js = require( 'log4js' );
var logger = o_log4js.getLogger( 'flog' );

global.site_queue = new Array();
global.running = true;
global.downloading = false;
global.reloadblacklist = false;
global.time_downloading = 0;

global.p_uri = "";
global.p_filename = "";
global.p_width = 1280;
global.p_height = 960;
global.p_prev_timeout_uri = "";

const LOAD_TIMEOUT = 25;
const MIN_LOAD_PRECENTAGE = 85;

const SUCCESS = 0;
const HOST_NO_DNS = 1;
const HOST_BLACKLISTED = 2;
const HOST_INVALIDSCHEMA = 3;
const HOST_INVALID = 4;
const GENERAL_ERROR = 5;

const EXIT_UNRESPONSIVE = 4;

o_log4js.configure( {
  appenders: [ {
		'type'      : 'file',
		'filename'  : 'logs/mshots.log',
		'maxLogSize': 10485760,
		'backups'   : 10,
		'category'  : 'flog',
		'levels'    : 'DEBUG',
		}
	]
});

function save_snapshot() {
	snapper.save_thumbnail( p_uri, p_filename, p_width, p_height, function( err_desc, returnCode ) {
			try {
				if ( SUCCESS != returnCode ) {
					logger.error( process.pid + ': ' + err_desc );
				}
			}
			catch ( Exception ) {
				logger.error( process.pid + ': exception in save_page callback function:' + Exception.toString() );
			}
			finally {
				time_downloading = 0;
				if ( site_queue.length == 0 )
					snapper.setBlankPage();
				var resultO = new Object();
				resultO.url = p_uri;
				resultO.file = p_filename;
				resultO.status = returnCode;
				process.send( { replytype: 'queue-del', workerid: process.pid, payload: resultO } );
				downloading = false;
			}
		});
}

function take_snapshot() {
	setTimeout( process_download_events, 50 );
	snapper.load_page( p_uri, p_filename, p_width, p_height, function( err_desc, returnCode ) {
		try {
			p_prev_timeout_uri = "";
			if ( SUCCESS == returnCode )
				setTimeout( save_snapshot, 400 );
			else {
				time_downloading = 0;
				snapper.abortDownload();
				logger.error( process.pid + ': ' + err_desc );
				var resultO = new Object();
				resultO.url = p_uri;
				resultO.file = p_filename;
				resultO.status = returnCode;
				process.send( { replytype: 'queue-del', workerid: process.pid, payload: resultO } );
				downloading = false;
			}
		}
		catch ( Exception ) {
			time_downloading = 0;
			logger.error( process.pid + ': exception in save_page callback function:' + Exception.toString() );
			var resultO = new Object();
			resultO.url = p_uri;
			resultO.file = p_filename;
			resultO.status = returnCode;
			process.send( { replytype: 'queue-del', workerid: process.pid, payload: resultO } );
			downloading = false;
		}
	});
}

function check_site_queue() {
	if ( false === downloading ) {
		if ( reloadblacklist ) {
			reloadblacklist = false;
			snapper.reloadBlacklistConfig();
			logger.debug( process.pid + ': blacklist file reloaded' );
		}
		if ( site_queue.length > 0 ) {
			downloading = true;
			logger.debug( process.pid + ': site queue size = ' + site_queue.length );
			var s_details = site_queue[0];
			site_queue.shift();
			logger.debug( process.pid + ': snapping: ' + s_details.url );
			p_uri = s_details.url;
			p_filename = s_details.file;
			take_snapshot( p_uri, p_filename, p_width, p_height );
		}
	}
}

function process_events() {
	if ( true === running ) {
		try {
			snapper.processEvents();
			if ( true === downloading ) {
				time_downloading++;
				if ( time_downloading >= LOAD_TIMEOUT ) {
					time_downloading = 0;
					if ( snapper.pageLoadProgress() >= MIN_LOAD_PRECENTAGE ) {
						if ( p_prev_timeout_uri == p_uri ) {
							p_prev_timeout_uri = "";
							logger.trace( process.pid + ': previously timed out at progress ' +
											snapper.pageLoadProgress() + '%, unresponsive, to the ether.' );
							process.exit( EXIT_UNRESPONSIVE );
						} else {
							p_prev_timeout_uri = p_uri;
							logger.trace( process.pid + ': timed out at progress ' +
											snapper.pageLoadProgress() + '%, forcing a snapshot.' );
							snapper.setForceSnapshot();
							snapper.stopLoadingPage();
						}
					} else {
						p_prev_timeout_uri = "";
						snapper.abortDownload();
						logger.error( process.pid + ': ' + p_uri + ' load timed out. Saved as 404 and continued with queue.' );
						downloading = false;
					}
				}
			} else {
				time_downloading = 0;
				check_site_queue();
			}
		}
		finally {
			setTimeout( process_events, 1000 );
		}
	} else {
		snapper.exit();
	}
}

function process_download_events() {
	if ( ( true === downloading ) && ( true === running ) ) {
		snapper.processEvents();
		setTimeout( process_download_events, 25 );
	}
}

function shutdown() {
	running = false;
}

function reload_blacklist() {
	reloadblacklist = true;
}

function add_to_queue( siteObject ) {
	site_queue.push( siteObject );
}

setTimeout( process_events, 2000 );

exports.add_to_queue     = add_to_queue;
exports.shutdown         = shutdown;
exports.reload_blacklist = reload_blacklist;
