
'use strict';

process.title = 'mShots.JS - Master';

const cluster = require( 'cluster' );
const http    = require( 'http' );
const fs      = require( 'fs' );
const _log4js = require( 'log4js' );
const logger  = _log4js.getLogger( 'flog' );

const MAX_WORKERS = 50;
const MAX_NO_RESPONSE_COUNT = 3;
const MAX_QUEUE_PROCESS_WAIT_MSECS = 45000;
const STATS_UPDATE_INTERVAL_MSECS = 15000;

const EXIT_MAXRAMUSAGE = 1;
const EXIT_COMMANDED = 2;
const EXIT_ERROR = 3;
const EXIT_FORCED = 143;

const SUCCESS = 0;
const HOST_NO_DNS = 1;
const HOST_BLACKLISTED = 2;
const HOST_INVALIDSCHEMA = 3;
const HOST_INVALID = 4;
const GENERAL_ERROR = 5;
const FORMAT_ERROR = 6;

var arrWorkers = [];
var numWorkers = require( 'os' ).cpus().length * 2
var messageStatus = 'requesting';
var queuetotal = 0;
var processed = 0;
var error_misc = 0;
var error_dns = 0;
var error_hostname = 0;
var error_blacklist = 0;

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

var args = process.argv.slice(2);
for ( var i = 0; i < args.length; i++ ) {
	if ( args[i] == '-n' ) {
		i++;
		if ( i < args.length ) {
			if ( ! isNaN( args[i] ) ) {
				numWorkers = args[i];
			}
			if ( numWorkers > MAX_WORKERS ) {
				numWorkers = MAX_WORKERS;
			}
		}
	}
}

cluster.setupMaster( {
	exec   : './lib/worker.js',
	silent : false,
});

cluster.on( 'online', function( worker ) {
	logger.debug( 'The worker thread #' + worker.id + ' (pid:' + worker.process.pid + ') is online.' );
});

cluster.on( 'disconnect', function( worker ) {
	logger.debug( 'worker thread #' + worker.id + ' (pid:' + worker.process.pid + ') has disconnected.' );
});

cluster.on( 'exit', function( worker, code, signal ) {
	if ( true == worker.exitedAfterDisconnect ) {
		logger.debug( 'worker thread #' + worker.id + ' (pid:' + worker.process.pid + ') is shutting down.' );
	} else {
		var exitCode = worker.process.exitCode;
		logger.debug( 'worker thread #' + worker.id + ' (pid:' + worker.process.pid + ') died (' + exitCode + '). restarting.' );
		if ( ( EXIT_COMMANDED == exitCode ) || ( EXIT_FORCED == exitCode ) ) {
			logger.debug( 'sending "true" to forced reload parameter' );
			createNewWorker( worker, true );
		} else {
			logger.debug( 'sending "false" to forced reload parameter' );
			createNewWorker( worker, false );
		}
	}
});

function updateStats() {
	if ( messageStatus == 'requesting' ) {
		let totalO = {};
		totalO.queuetotal = queuetotal;
		totalO.processed = processed;
		totalO.errortotal = error_misc + error_dns + error_hostname + error_blacklist;
		for ( var count in arrWorkers ) {
			arrWorkers[count].replytype = '';
			try {
				arrWorkers[count].worker.send( { id: arrWorkers[count].worker.id, request: 'ping', payload: totalO } );
			}
			catch ( Exception ) {
				logger.error( 'error sending ping request to worker in slot ' + count );
			}
		}
		messageStatus = 'receiving';
		setTimeout( updateStats, ( STATS_UPDATE_INTERVAL_MSECS / 2 ) );
	} else {
		for ( var count in arrWorkers ) {
			let killSignalled = false;
			if ( 'pong' == arrWorkers[count].replytype ) {
				arrWorkers[count].no_response_count = 0;
			} else {
				arrWorkers[count].no_response_count++;
				if ( arrWorkers[count].no_response_count >= MAX_NO_RESPONSE_COUNT ) {
					try {
						logger.debug( 'Worker unresponsive: ' + arrWorkers[count].worker.process.pid + ', setting it "free".' );
						const spawn = require( 'child_process' ).spawn,
						killer = spawn('kill', [ '-s', '9', arrWorkers[count].worker.process.pid ] );
						killSignalled = true;
					}
					catch ( Exception ) {
						logger.error( 'error "killing" worker in slot ' + count );
					}
				}
			}
			if ( ! killSignalled && ( null != arrWorkers[count].lastQueueDelete ) ) {
				if ( 0 == arrWorkers[count].site_queue.length ) {
					arrWorkers[count].lastQueueDelete = null;
				} else {
					var now = new Date();
					if ( ( now - arrWorkers[count].lastQueueDelete ) >= MAX_QUEUE_PROCESS_WAIT_MSECS ) {
						try {
							logger.debug( 'Worker not deleting queue: ' + arrWorkers[count].worker.process.pid + ', setting it "free".' );
							const spawn = require( 'child_process' ).spawn,
							killer = spawn('kill', [ '-s', '9', arrWorkers[count].worker.process.pid ] );
						}
						catch ( Exception ) {
							logger.error( 'error "killing" worker in slot ' + count );
						}
					}
				}
			}
		}
		try {
			var queueFile = fs.createWriteStream( 'stats/queue', { flags : "w" } );
			queueFile.once( 'open', function( fd ) {
				queueFile.write( 'queue total: ' + queuetotal + '\n' );
				queueFile.end();
			});
			var totalFile = fs.createWriteStream( 'stats/total', { flags : "w" } );
			totalFile.once( 'open', function( fd ) {
				totalFile.write( 'processed total: ' + processed + '\n' );
				totalFile.end();
			});
			var errFile = fs.createWriteStream( 'stats/error', { flags : "w" } );
			errFile.once( 'open', function( fd ) {
				errFile.write( 'errors misc: ' + error_misc + '\n' );
				errFile.write( 'errors DNS: ' + error_dns + '\n' );
				errFile.write( 'errors hostname: ' + error_hostname + '\n' );
				errFile.write( 'errors blacklist: ' + error_blacklist + '\n' );
				errFile.end();
			});
			var threadFile = fs.createWriteStream( 'stats/workers', { flags : "w" } );
			threadFile.once( 'open', function( fd ) {
				var now = new Date();
				threadFile.write( 'pid\tqueue\tstatus\tlast delete\n' );
				for ( var count in arrWorkers ) {
					var w_pid = 0;
					try {
						if ( undefined != arrWorkers[count].worker ) {
							w_pid = arrWorkers[count].worker.process.pid;
						}
					}
					catch ( Exception ) {
						;
					}
					threadFile.write( w_pid + '\t' +
						arrWorkers[count].site_queue.length + '\t' +
						arrWorkers[count].no_response_count + '\t' +
						( ( null == arrWorkers[count].lastQueueDelete ) ? "-" : ( now - arrWorkers[count].lastQueueDelete ) + "ms" ) + '\n' );
				}
				threadFile.end();
			});
		}
		catch  ( Exception ) {
			logger.error( 'Error updating queue stats file: ' + Exception.toString() );
		}
		finally {
			messageStatus = 'requesting';
			setTimeout( updateStats, ( STATS_UPDATE_INTERVAL_MSECS / 2 ) );
		}
	}
}

function workerCallback( msg ) {
	try {
		switch ( msg.replytype ) {
			case 'pong': {
				for ( var count in arrWorkers ) {
					if ( ( undefined != arrWorkers[count].worker ) && ( arrWorkers[count].worker.id == msg.workerid ) ) {
						arrWorkers[count].replytype = 'pong';
						arrWorkers[count].payload = msg.payload;
						break;
					}
				}
				break;
			}
			case 'queue-add': {
				var siteQueued = false;
				for ( var count in arrWorkers ) {
					for ( var queuecount in arrWorkers[count].site_queue ) {
						if ( ( arrWorkers[count].site_queue[queuecount].url == msg.payload.url ) &&
							( arrWorkers[count].site_queue[queuecount].file == msg.payload.file ) ) {
							siteQueued = true;
							break;
						}
					}
				}
				if ( ! siteQueued ) {
					var smallestQueueIndex = -1;
					var smallestQueueTotal = -1;
					for ( var count in arrWorkers ) {
						if ( -1 == smallestQueueTotal ) {
							smallestQueueTotal = arrWorkers[count].site_queue.length;
							smallestQueueIndex = count;
						} else if ( arrWorkers[count].site_queue.length < smallestQueueTotal ) {
							smallestQueueTotal = arrWorkers[count].site_queue.length;
							smallestQueueIndex = count;
						}
					}
					if ( -1 !== smallestQueueIndex ) {
						if ( 0 == arrWorkers[smallestQueueIndex].site_queue.length ) {
							arrWorkers[smallestQueueIndex].lastQueueDelete = new Date();
						}
						arrWorkers[smallestQueueIndex].site_queue.push( msg.payload );
						arrWorkers[smallestQueueIndex].worker.send( { id: arrWorkers[smallestQueueIndex].worker.id, request: 'queue-add', payload: msg.payload } );
						queuetotal++;
					}
				}
				break;
			}
			case 'queue-del': {
				for ( var count in arrWorkers ) {
					if ( ( undefined != arrWorkers[count].worker ) &&  ( msg.workerid === arrWorkers[count].worker.process.pid ) ) {
						arrWorkers[count].lastQueueDelete = new Date();
						if ( SUCCESS != msg.payload.status ) {
							var delIndex = -1;
							for (var queuecount in arrWorkers[count].site_queue ) {
								if ( ( arrWorkers[count].site_queue[queuecount].url == msg.payload.url ) &&
									( arrWorkers[count].site_queue[queuecount].file == msg.payload.file ) ) {
									delIndex = queuecount;
									break;
								}
							}
							if ( -1 != delIndex ) {
								arrWorkers[count].site_queue.splice( delIndex, 1 );
								queuetotal--;
								if ( queuetotal < 0 )
									queuetotal = 0;
							}
							switch ( msg.payload.status ) {
								case HOST_NO_DNS:
									error_dns++;
									break;
								case HOST_BLACKLISTED:
									error_blacklist++;
									break;
								case HOST_INVALIDSCHEMA:
								case HOST_INVALID:
									error_hostname++
									break;
								case GENERAL_ERROR:
								default:
									error_misc++;
							}
						} else {
							var delIndex = -1;
							for (var queuecount in arrWorkers[count].site_queue ) {
								if ( ( arrWorkers[count].site_queue[queuecount].url == msg.payload.url ) &&
									( arrWorkers[count].site_queue[queuecount].file == msg.payload.file ) ) {
									delIndex = queuecount;
									break;
								}
							}
							if ( -1 != delIndex ) {
								arrWorkers[count].site_queue.splice( delIndex, 1 );
								queuetotal--;
								if ( queuetotal < 0 )
									queuetotal = 0;
							}
						}
						processed++;
						break;
					}
				}
				break;
			}
		}
	}
	catch ( Exception ) {
		logger.error( "Error receiving worker's message: " + Exception.toString() );
	}
}

function createNewWorker( worker, forcedReload ) {
	var newWorker = cluster.fork();
	newWorker.on( 'message', workerCallback );

	for ( var count in arrWorkers ) {
		if ( ( undefined != arrWorkers[count].worker ) && ( arrWorkers[count].worker.process.pid == worker.process.pid ) ) {
			logger.trace( 'Setting the new worker up in slot ' + count );
			arrWorkers[count].worker = null;
			arrWorkers[count].worker = newWorker;
			arrWorkers[count].replytype = '';
			arrWorkers[count].payload = 0;
			arrWorkers[count].no_response_count = 0;
			arrWorkers[count].lastQueueDelete = null;

			/* if the outgoing worker was killed as a result of a hung URL, we must remove the URL before sharing the rest of its queue out */
			if ( forcedReload ) {
				if ( arrWorkers[count].site_queue.length > 0 ) {
					arrWorkers[count].site_queue.shift();
					queuetotal--;
					if ( queuetotal < 0 )
						queuetotal = 0;
				}
			}

			/* redistribute the outgoing worker's site_queue while the new Worker "boots up" (randomly choose starting location) */
			var cyclicIndex = Math.floor( Math.random() * ( arrWorkers.length - 1 ) );
			while ( arrWorkers[count].site_queue.length > 0 ) {
				if ( ( cyclicIndex != count ) && ( undefined != arrWorkers[cyclicIndex] ) && ( undefined != arrWorkers[cyclicIndex].worker ) ) {
					var s_details = arrWorkers[count].site_queue[0];
					arrWorkers[count].site_queue.shift();
					arrWorkers[cyclicIndex].site_queue.push( s_details );
					try {
						arrWorkers[cyclicIndex].worker.send( { id: arrWorkers[cyclicIndex].worker.id, request: 'queue-add', payload: s_details } );
					}
					catch ( Exception ) {
						logger.error( 'error sending queue item to worker in slot ' + cyclicIndex );
					}
				}
				cyclicIndex++;
				if ( cyclicIndex >= arrWorkers.length )
					cyclicIndex = 0;
			}

			arrWorkers[count].site_queue = new Array();
			break;
		}
	}
}

function start() {
	logger.debug( 'starting mShots.JS service.' );

	try {
		fs.readFile( 'stats/total', function( err, data ) {
			if ( undefined != data ) {
				var aData = data.toString().split( ' ' );
				if ( 3 == aData.length )
					processed = parseInt( aData[2] );
			}
		});
		fs.readFile( 'stats/error', function( err, data ) {
			if ( undefined != data ) {
				var aDataLines = data.toString().split( '\n' );
				if ( 5 == aDataLines.length ) {
					var aData = aDataLines[0].split( ' ' );
					if ( 3 == aData.length )
						error_misc = parseInt( aData[2] );
					aData = aDataLines[1].split( ' ' );
					if ( 3 == aData.length )
						error_dns = parseInt( aData[2] );
					aData = aDataLines[2].split( ' ' );
					if ( 3 == aData.length )
						error_hostname = parseInt( aData[2] );
					aData = aDataLines[3].split( ' ' );
					if ( 3 == aData.length )
						error_blacklist = parseInt( aData[2] );
				}
			}
		});
	}
	catch ( Exception ) {
		logger.error( 'error loading stats values: ' + Exception.toString() );
	}

	for (var i = 0; i < numWorkers; i++) {
		var worker = cluster.fork();
		worker.on( 'message', workerCallback );

		var oWorker = new Object();
		oWorker.worker = worker;
		oWorker.replytype = '';
		oWorker.payload = 0;
		oWorker.site_queue = new Array();
		oWorker.no_response_count = 0;
		oWorker.lastQueueDelete = null;

		arrWorkers.push( oWorker );
	}

	setTimeout( updateStats, ( STATS_UPDATE_INTERVAL_MSECS * 2 ) );
}

exports.cluster = cluster;
exports.start   = start;
