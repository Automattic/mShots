
process.title = "mShots.JS - Worker";

var http = require( 'http' );
var url = require( 'url' );
var snapshot = require( './snapshot' );
var o_log4js = require( 'log4js' );
var logger = o_log4js.getLogger( 'flog' );

const MAX_PROCESS_MEM_USAGE = 500 * 1024 * 1024;
const EXIT_MAXRAMUSAGE = 1;
const EXIT_COMMANDED = 2;
const EXIT_ERROR = 3;

const VIEWPORT_MAX_W = 1600;
const VIEWPORT_MAX_H = 1200;
const VIEWPORT_MIN_W = 320;
const VIEWPORT_MIN_H = 320;
const VIEWPORT_DEFAULT_W = 1280;
const VIEWPORT_DEFAULT_H = 960;

var PortNum = 7777;
var readyToSendRequests = false;
var global_queuetotal = 0;
var global_processed = 0;
var global_errortotal = 0;

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

var args = process.argv.slice( 2 );
for (var i = 0; i < args.length; i++) {
	if ( args[i] == '-p' ) {
		i++;
		if ( i < args.length ) {
			PortNum = args[i];
		}
	}
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
			var _get = url.parse( request.url, true ).query;
			if ( ( undefined != _get['url'] ) && ( undefined != _get['f'] ) && ( "" != _get['url'] ) && ( "" != _get['f'] ) ) {
				if ( readyToSendRequests ) {
					response.write( 'Snap\n' );
					response.end();
					var site = new Object();
					site.url = _get['url'];
					site.file =_get['f'];

					if ( undefined == _get['vpw'] || isNaN( _get['vpw'] ) ) {
						site.width = VIEWPORT_DEFAULT_W;
					} else {
						site.width = parseInt( _get['vpw'] );
						if ( site.width > VIEWPORT_MAX_W )
							site.width = VIEWPORT_MAX_W;
						else if ( site.width < VIEWPORT_MIN_W )
							site.width = VIEWPORT_MIN_W;
					}
					if ( undefined == _get['vph'] || isNaN( _get['vph'] ) ) {
						site.height = VIEWPORT_DEFAULT_H;
					} else {
						site.height = parseInt( _get['vph'] );
						if ( site.height > VIEWPORT_MAX_H )
							site.height = VIEWPORT_MAX_H;
						else if ( site.height < VIEWPORT_MIN_H )
							site.height = VIEWPORT_MIN_H;
					}

					process.send( { replytype: 'queue-add', workerid: process.pid, payload: site } );
				} else {
					response.write( 'Slap\n' );
					response.end();
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
		snapshot.shutdown();
	};

	var error_handler = function( err ) {
		logger.error( process.pid + ': HTTP error encountered: ' + err );
	}

	var _server = http.createServer().
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
	// this most often called when the process.send node.JS bug creeps in
	// so we exit the process and allow the Mater to redistribute the queue
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
				if ( process.memoryUsage().rss > MAX_PROCESS_MEM_USAGE )
					process.exit( EXIT_MAXRAMUSAGE );
				else
					snapshot.add_to_queue( msg.payload );
				break;
			}
			case 'reload': {
				snapshot.reload_config();
				break;
			}
			default: {
				if ( readyToSendRequests )
					process.send( { replytype: 'unknown', workerid: msg.id, payload: 0 } );
			}
		}
	}
	catch ( Exception ) {
		logger.error( process.pid + ": error receiving Master's message: " + Exception.toString() );
	}
});

// node.JS currently has an issue with the HTTP listener initialising and the inter-process
// coms, so we give the HTTP listening time to init before calling any process.send commands
setTimeout( function () { readyToSendRequests = true; }, 2000 );

new HTTPListner();
