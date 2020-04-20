
'use strict';

process.title = "mShots.JS - Worker";

const _http     = require( 'http' );
const _url      = require( 'url' );
const _cypher   = require( 'crypto' );
const _snapshot = require( './snapshot' );
const _log4js   = require( 'log4js' );
const logger    = _log4js.getLogger( 'flog' );

const MAX_PROCESS_MEM_USAGE = 500 * 1024 * 1024;
const EXIT_MAXRAMUSAGE = 1;
const EXIT_COMMANDED = 2;
const EXIT_ERROR = 3;

// 3072px is retina display width
const VIEWPORT_MAX_W = 3072;
const VIEWPORT_MAX_H = 1920;
const VIEWPORT_MIN_W = 320;
const VIEWPORT_MIN_H = 320;

// 3072px is retina display width
const SCREEN_MAX_W = 3072;
const SCREEN_MAX_H = 7680;
const SCREEN_MIN_W = 320;
const SCREEN_MIN_H = 320;

const VIEWPORT_DEFAULT_W = 1280;
const VIEWPORT_DEFAULT_H = 960;

var PortNum = 7777;
var readyToSendRequests = false;
var global_queuetotal = 0;
var global_processed = 0;
var global_errortotal = 0;

_log4js.configure( {
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

_log4js.PatternLayout = '%d{HH:mm:ss,SSS} p m';

var args = process.argv.slice( 2 );
for (var i = 0; i < args.length; i++) {
	if ( args[i] == '-p' ) {
		i++;
		if ( i < args.length ) {
			PortNum = args[i];
		}
	}
}

function validateFileName( request ) {
	let url_parts = request.url.split( "://" );
	let host = '';
	if ( url_parts.length > 1 ) {
		host = url_parts[1].split( "/" )[0];
	} else {
		host = url_parts[0].split( "/" )[0];
	}

	let viewport = '';
	if ( request.width != VIEWPORT_DEFAULT_W || request.height != VIEWPORT_DEFAULT_H ) {
		viewport = '_' + request.width + 'x' + request.height;
	}

	let s_filename = _cypher.createHash( 'md5' ).update( request.url ).digest( 'hex' ) + viewport + '.jpg';
	let s_host = _cypher.createHash( 'sha1' ).update( host ).digest( 'hex' );
	let s_fullpath = '/opt/mshots/public_html/thumbnails/' + s_host.substring( 0, 3 ) + "/" + s_host + "/" + s_filename;

	console.log(s_fullpath, request.file);

	return ( s_fullpath == request.file );
}

var HTTPListner = function() {

	var routes = {
		'/' : function( request, response ) {
			response.writeHead( 404, { 'Content-Type': 'text/html' } );
			response.write( 'Unsupported call\n' );
			response.end();
		},

		'/queue' : function( request, response ) {
			response.writeHead( 200, { 'Content-Type': 'text/plain' } );
			var _get = _url.parse( request.url, true ).query;
			if ( _get['url'] && _get['f'] ) {
				if ( ! readyToSendRequests ) {
					response.write( 'Slap1\n' );
					response.end();
					return;
				}

				response.write( 'Snap2\n' );
				response.end();

				let site = {};
				site.url = _get['url'];
				site.file =_get['f'];


				if ( !_get['vpw'] || isNaN( _get['vpw'] ) ) {
					site.width = VIEWPORT_DEFAULT_W;
				} else {
					site.width = parseInt( _get['vpw'] );
					// bound width by min and max
					site.width = Math.max(VIEWPORT_MIN_W, Math.min(site.width, VIEWPORT_MAX_W))
				}
				if ( undefined == _get['vph'] || isNaN( _get['vph'] ) ) {
					site.height = VIEWPORT_DEFAULT_H;
				} else {
					site.height = parseInt( _get['vph'] );
					// bound height by min and max
					site.height = Math.max(VIEWPORT_MIN_H, Math.min(site.height, VIEWPORT_MAX_H))
				}

				if( !_get['screen_width']) {
					site.screenWidth = site.width;
				} else {
					// bound image width by min and max
					site.screenWidth = Math.max(SCREEN_MIN_W, Math.min(_get['screen_width'], SCREEN_MAX_W))
				}

				if( !_get['screen_height']) {
					site.screenHeight = site.height;
				} else {
					// bound image height by min and max
					site.screenHeight = Math.max(SCREEN_MIN_H, Math.min(_get['screen_height'], SCREEN_MAX_H))
				}

				if ( ! validateFileName( site ) ) {
					logger.error( process.pid + ': invalid filename: validation failed' );
				} else {
					process.send( { replytype: 'queue-add', workerid: process.pid, payload: site } );
				}
			} else {
				response.write( 'Malformed request\n' );
				response.end();
			}
		},

		'/get-queuecount' : function( request, response ) {
			response.writeHead( 200, { 'Content-Type': 'text/plain' } );
			response.write( 'queue count: ' + global_queuetotal + '\n' );
			response.end();
		},

		'/get-processedtotal' : function( request, response ) {
			response.writeHead( 200, { 'Content-Type': 'text/plain' } );
			response.write( 'total processed: ' + global_processed + '\n' );
			response.end();
		},

		'/get-errorcount' : function( request, response ) {
			response.writeHead( 200, { 'Content-Type': 'text/plain' } );
			response.write( 'error count: ' + global_errortotal + '\n' );
			response.end();
		},
	}

	var request_handler = function( request, response ) {
		var arr_req = request.url.toString().split( '?' );
		if ( arr_req instanceof Array ) {
			if( undefined === routes[ arr_req[0] ] ) {
				response.writeHead( 404, { 'Content-Type': 'text/plain' } );
				response.write( 'not found\n' );
				response.end();
			} else {
				routes[ arr_req[0] ].call( this, request, response );
			}
		} else {
			response.writeHead( 404, { 'Content-Type': 'text/plain' } );
			response.write( 'Unsupported call\n' );
			response.end();
		}
	};

	var close_handler = function() {
		logger.trace( process.pid + ': HTTP server has been shutdown. Shutting down snapshot object.' );
		_snapshot.shutdown();
	};

	var error_handler = function( err ) {
		logger.error( process.pid + ': HTTP error encountered: ' + err );
	}

	var _server = _http.createServer().
		 addListener( 'request', request_handler )
		.addListener( 'close', close_handler )
		.addListener( 'error', error_handler )
		.listen( PortNum );
};

process.on( 'SIGUSR2', function() {
	logger.trace( process.pid + ': commanded to exit()' );
	process.exit( EXIT_COMMANDED );
});

process.on( 'uncaughtException', function( err_desc ) {
	// print and exit the process and allow the Master to redistribute the queue
	console.log( process.pid + ': uncaughtException error: ' + err_desc );
	logger.error( process.pid + ': uncaughtException error: ' + err_desc );
	process.exit( EXIT_ERROR );
});

process.on( 'message', function( msg ) {
	try {
		switch (msg.request)
		{
			case 'ping': {
				global_queuetotal = msg.payload.queuetotal;
				global_processed = msg.payload.processed;
				global_errortotal = msg.payload.errortotal;
				if ( readyToSendRequests ) {
					process.send( { replytype: 'pong', workerid: msg.id, payload: 1 } );
				}
				break;
			}
			case 'queue-add': {
				if ( process.memoryUsage().rss > MAX_PROCESS_MEM_USAGE ) {
					process.exit( EXIT_MAXRAMUSAGE );
				} else {
					_snapshot.add_to_queue( msg.payload );
				}
				break;
			}
			case 'reload': {
				_snapshot.reload_all_config();
				break;
			}
			default: {
				if ( readyToSendRequests ) {
					process.send( { replytype: 'unknown', workerid: msg.id, payload: 0 } );
				}
			}
		}
	}
	catch ( Exception ) {
		logger.error( process.pid + ": error receiving Master's message: " + Exception.toString() );
	}
});

// Initialize the snapshot browser
_snapshot.init_browser();

// node.JS currently has an issue with the HTTP listener initialising and the inter-process
// coms, so we give the HTTP listening time to init before calling any process.send commands
setTimeout( function () { readyToSendRequests = true; }, 500 );

new HTTPListner();

