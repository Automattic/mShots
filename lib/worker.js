
'use strict';

process.title = "mShots.JS - Worker";

const _http              = require( 'http' );
const _cypher            = require( 'crypto' );
const _snapshot          = require( './snapshot' );
const _log4js            = require( 'log4js' );
const logger             = _log4js.getLogger( 'flog' );

const {
    DEFAULT_FORMAT,
    FORMAT_TO_EXTENSION
} = require( './constants' );

const MAX_PROCESS_MEM_USAGE = 500 * 1024 * 1024;
const EXIT_MAXRAMUSAGE = 1;
const EXIT_COMMANDED = 2;
const EXIT_ERROR = 3;

// 3072px is retina display width
const VIEWPORT_MAX_W = 3072;
const VIEWPORT_MAX_H = 3072;
const VIEWPORT_MIN_W = 320;
const VIEWPORT_MIN_H = 320;

// 3072px is retina display width
const SCREEN_MAX_W = 3072;
const SCREEN_MAX_H = 7680;
const SCREEN_MIN_W = 320;
const SCREEN_MIN_H = 320;

const VIEWPORT_DEFAULT_W = 1280;
const VIEWPORT_DEFAULT_H = 960;

const SCALE_FACTOR_DEFAULT = 1;
const SCALE_FACTOR_MIN = 1;
const SCALE_FACTOR_MAX = 2;

const COLOR_SCHEME_DEFAULT = 'light';
const COLOR_SCHEME_VALUES = [ 'light', 'dark' ];

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

	let suffix = '';
	if ( request.width != VIEWPORT_DEFAULT_W || request.height != VIEWPORT_DEFAULT_H ) {
		suffix = '_' + request.width + 'x' + request.height;
	}

	if( request.screenWidth != request.width || request.screenHeight != request.height ) {
		suffix += '_screen' + request.screenWidth + 'x' + request.screenHeight;
	}

	if ( request.scaleFactor != SCALE_FACTOR_DEFAULT ) {
		suffix += '_' + request.scaleFactor + 'x';
	}

	if ( request.colorScheme != COLOR_SCHEME_DEFAULT ) {
		suffix += '_' + request.colorScheme;
	}

	const extension = FORMAT_TO_EXTENSION[request.format];

	let s_filename = _cypher.createHash( 'md5' ).update( request.url ).digest( 'hex' ) + suffix + extension;

	let s_host = _cypher.createHash( 'sha1' ).update( host ).digest( 'hex' );
	let s_fullpath = '/opt/mshots/public_html/thumbnails/' + s_host.substring( 0, 3 ) + "/" + s_host + "/" + s_filename;

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
			let u;
			try {
				// the new URL API doesn't work without a full URL
				u = new URL( request.url, 'http://localhost' );
			} catch ( err ) {
				console.error( err );
				response.write( 'Malformed request\n' );
				response.end();
				return;
			}

			var query = u.searchParams;

			if ( query.get('url') && query.get('f') ) {
				if ( ! readyToSendRequests ) {
					response.write( 'Slap\n' );
					response.end();
					return;
				}

				response.write( 'Snap\n' );
				response.end();

				let site = {};
				site.url = query.get( 'url' );
				site.file = query.get( 'f' );

				site.format = DEFAULT_FORMAT;

				if ( query.get( 'format' ) ) {
					site.format = query.get( 'format' );
				}

				if ( ! query.get( 'vpw' ) || isNaN( query.get( 'vpw' ) ) ) {
					site.width = VIEWPORT_DEFAULT_W;
				} else {
					site.width = parseInt( query.get( 'vpw' ) );
					// bound width by min and max
					site.width = Math.max( VIEWPORT_MIN_W, Math.min( site.width, VIEWPORT_MAX_W ) )
				}
				if ( undefined == query.get( 'vph' ) || isNaN( query.get( 'vph' ) ) ) {
					site.height = VIEWPORT_DEFAULT_H;
				} else {
					site.height = parseInt( query.get( 'vph' ) );
					// bound height by min and max
					site.height = Math.max( VIEWPORT_MIN_H, Math.min( site.height, VIEWPORT_MAX_H ) )
				}

				if( ! query.get( 'screen_width' ) ) {
					site.screenWidth = site.width;
				} else {
					// bound image width by min and max
					site.screenWidth = Math.max( SCREEN_MIN_W, Math.min( query.get( 'screen_width' ), SCREEN_MAX_W ) )
				}

				if( ! query.get('screen_height') ) {
					site.screenHeight = site.height;
				} else {
					// bound image height by min and max
					site.screenHeight = Math.max( SCREEN_MIN_H, Math.min( query.get( 'screen_height' ), SCREEN_MAX_H ) )
				}

				site.scaleFactor = ! query.get( 'scale' ) || isNaN( query.get( 'scale' ) )
					? SCALE_FACTOR_DEFAULT
					: Math.max( SCALE_FACTOR_MIN, Math.min( parseInt( query.get( 'scale' ) ), SCALE_FACTOR_MAX ) );

				site.colorScheme = COLOR_SCHEME_VALUES.includes( _get['color_scheme'] )
					? _get['color_scheme']
					: COLOR_SCHEME_DEFAULT;

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
