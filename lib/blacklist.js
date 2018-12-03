
'use strict';

const _dns    = require( 'dns' );
const _url    = require( 'url' );
const _ip     = require( 'ip' );
const _fs     = require( 'fs' );
const _log4js = require( 'log4js' );
const logger  = _log4js.getLogger( 'blacklog' );

const SUCCESS             = 0;
const HOST_NO_DNS         = 1;
const HOST_BLACKLISTED    = 2;
const HOST_IP_BLACKLISTED = 3;
const HOST_INVALIDSCHEMA  = 4;
const HOST_INVALID        = 5;

_log4js.configure( {
	appenders: {
		"app": {
			'type'      : 'file',
			'filename'  : 'logs/blacklist.log',
			'maxLogSize': 10485760,
			'numBackups': 10,
			},
		},
		"categories": {
			"default": { "appenders": [ "app" ], "level": "DEBUG" }
		}
	});

_log4js.PatternLayout = '%d{HH:mm:ss,SSS} p m';

var ips       = [];
var subnets   = [];
var hostnames = [];

function loadConfig() {
	// Reset the arrays to support config reloads
	ips       = [];
	subnets   = [];
	hostnames = [];

	_fs.readFile( 'config/blacklist.dat', ( err, data ) => {
		if ( err ) {
			logger.error( process.pid + ': failed to load the blacklist:', err );
			process.exit( 0 );
		}

		let lines = data.toString().split( '\n' );

		lines.forEach( function( line ) {
			line = line.trim();
			if ( '' == line || line.match( /^\s*#/ ) ) {
				return;
			}
			if ( _ip.isV4Format( line ) || _ip.isV6Format( line ) ) {
				ips.push( line );
			} else if ( line.match( /\d{1,2}$/ ) ) {
				subnets.push( line );
			} else {
				hostnames.push( line );
			}
		});
	});
}

function allowHost( hostname, callback ) {
	let parsedUrl = _url.parse( hostname, false );
	if ( ! parsedUrl || ! parsedUrl.hostname || ! parsedUrl.protocol ) {
		return callback( ( ! parsedUri.host ? HOST_INVALID : HOST_INVALIDSCHEMA ) );
	}

	let disallow = SUCCESS;
	hostnames.some( function( hostname ) {
		if ( hostname == parsedUrl.hostname ) {
			if ( 'pixel.wp.com' != parsedUrl.hostname ) {
				logger.debug( process.pid + ': hostname match ' + parsedUrl.hostname + ' == ' + hostname );
			}
			disallow = HOST_BLACKLISTED;
			return true;
		}
	});
	if ( disallow ) {
		return callback( disallow );
	}

	if ( _ip.isV4Format( parsedUrl.hostname ) || _ip.isV6Format( parsedUrl.hostname ) ) {
		if ( _ip.isPrivate( parsedUrl.hostname ) ) {
			return callback( HOST_IP_BLACKLISTED );
		}
		ips.some( function( ip ) {
			if ( _ip.isEqual( ip, parsedUrl.hostname ) ) {
				logger.debug( process.pid + ': IP match ' + ip + ' == ' + parsedUrl.hostname );
				disallow = HOST_IP_BLACKLISTED;
				return true;
			}
		});
		if ( disallow ) {
			return callback( disallow );
		}
		subnets.some( function( subnet ){
			if ( _ip.cidrSubnet( subnet ).contains( parsedUrl.hostname ) ) {
				logger.debug( process.pid + ': IP subnet match ' + subnet + ' == ' + parsedUrl.hostname );
				disallow = HOST_IP_BLACKLISTED;
				return true;
			}
		});
		return callback( disallow );
	} else {
		_dns.resolve( parsedUrl.hostname, ( err, records ) => {
			if ( err ) {
				return callback( HOST_NO_DNS );
			}
			records.some( function( rec ) {
				if ( _ip.isPrivate( rec ) ) {
					disallow = HOST_IP_BLACKLISTED;
					return true;
				}
				ips.some( function( ip ) {
					if ( _ip.isEqual( ip, rec ) ) {
						logger.debug( process.pid + ': IP match ' + ip + ' == ' + rec );
						disallow = HOST_IP_BLACKLISTED;
						return true;
					}
				});
				if ( disallow ) {
					return true;
				}
				subnets.some( function( subnet ){
					if ( _ip.cidrSubnet( subnet ).contains( rec ) ) {
						logger.debug( process.pid + ': IP subnet match ' + subnet + ' == ' + rec );
						disallow = HOST_IP_BLACKLISTED;
						return true;
					}
				});
				if ( disallow ) {
					return true;
				}
			});
			return callback( disallow );
		});
	}
}

const exported = {
	loadConfig,
	allowHost,
}

module.exports = exported;

