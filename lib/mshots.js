
var master_process = require( './master' );
var o_log4js = require( 'log4js' );
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
o_log4js.PatternLayout = '%d{HH:mm:ss,SSS} p m';

function stop_workerthreads() {
	console.log( 'Caught shutdown signal, disconnecting worker threads.' );
	for ( var workerid in master_process.cluster.workers ) {
		master_process.cluster.workers[workerid].disconnect();
	}
	setTimeout( function() {
		var workerActive = false;
		for ( var id in master_process.cluster.workers ) {
			if ( false == master_process.cluster.workers[id].suicide ) {
				console.log( 'still waiting for a worker(s) to exit.' );
				workerActive = true;
				break;
			}
		}
		
		if ( true === workerActive ) {
			stop_workerthreads();
		} else {
			process.exit();
		}
	}, 500);
}

function signal_blacklist_reload() {
	for ( var workerid in master_process.cluster.workers ) {
		master_process.cluster.workers[workerid].send( { 
				id: master_process.cluster.workers[workerid].id,
				request: 'reload',
				} );
	}
}

process.on( 'SIGHUP', stop_workerthreads );
process.on( 'SIGUSR2', signal_blacklist_reload );

master_process.start();
