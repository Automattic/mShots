
'use strict';

const _dns    = require( 'dns' );
const _net    = require( 'net' );
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

// Special-purpose ranges (RFC 6890 and friends) that a public website never uses.
// IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) are matched against the IPv4 rules by BlockList.
const reserved = new _net.BlockList();
[
	[ '0.0.0.0', 8 ],
	[ '10.0.0.0', 8 ],
	[ '100.64.0.0', 10 ],
	[ '127.0.0.0', 8 ],
	[ '169.254.0.0', 16 ],
	[ '172.16.0.0', 12 ],
	[ '192.0.0.0', 24 ],
	[ '192.0.2.0', 24 ],
	[ '192.168.0.0', 16 ],
	[ '198.18.0.0', 15 ],
	[ '198.51.100.0', 24 ],
	[ '203.0.113.0', 24 ],
	[ '224.0.0.0', 4 ],
	[ '240.0.0.0', 4 ],
].forEach( ( [ net, prefix ] ) => reserved.addSubnet( net, prefix, 'ipv4' ) );
[
	[ '::', 96 ],
	[ '64:ff9b::', 96 ],
	[ '64:ff9b:1::', 48 ],
	[ '100::', 64 ],
	[ '2001:db8::', 32 ],
	[ 'fc00::', 7 ],
	[ 'fe80::', 10 ],
	[ 'fec0::', 10 ],
	[ 'ff00::', 8 ],
].forEach( ( [ net, prefix ] ) => reserved.addSubnet( net, prefix, 'ipv6' ) );

var configured = new _net.BlockList();
var hostnames  = [];

function loadConfig( callback ) {
	_fs.readFile( 'config/blacklist.dat', ( err, data ) => {
		if ( err ) {
			logger.error( `${process.pid}: failed to load the blacklist: ${err}` );
			process.exit( 0 );
		}

		// Build fresh lists to support config reloads
		let newConfigured = new _net.BlockList();
		let newHostnames  = [];
		let lines = data.toString().split( '\n' );

		lines.forEach( function( line ) {
			line = line.trim();
			if ( '' == line || line.match( /^\s*#/ ) ) {
				return;
			}
			let [ address, prefix ] = line.split( '/' );
			let family = _net.isIP( address );
			if ( ! family ) {
				newHostnames.push( line );
			} else if ( undefined === prefix ) {
				newConfigured.addAddress( address, `ipv${family}` );
			} else {
				newConfigured.addSubnet( address, parseInt( prefix, 10 ), `ipv${family}` );
			}
		});

		configured = newConfigured;
		hostnames  = newHostnames;
		if ( callback ) {
			callback();
		}
	});
}

function allowAddress( address ) {
	address = String( address ).replace( /^\[(.*)\]$/, '$1' );
	let family = _net.isIP( address );
	if ( ! family ) {
		return HOST_IP_BLACKLISTED;
	}
	let type = `ipv${family}`;
	if ( reserved.check( address, type ) ) {
		return HOST_IP_BLACKLISTED;
	}
	if ( configured.check( address, type ) ) {
		logger.debug( `${process.pid}: IP blacklist match ${address}` );
		return HOST_IP_BLACKLISTED;
	}
	return SUCCESS;
}

function resolveAll( hostname, callback ) {
	let pending   = 2;
	let addresses = [];
	let done = ( err, records ) => {
		if ( ! err && records ) {
			addresses = addresses.concat( records );
		}
		if ( 0 === --pending ) {
			callback( addresses );
		}
	};
	_dns.resolve4( hostname, done );
	_dns.resolve6( hostname, done );
}

function allowHost( hostname, callback ) {
	let parsedUrl;
	try {
		parsedUrl = new URL( hostname );
	} catch ( err ) {
		console.error( err );
		return callback( HOST_INVALID );
	}

	if ( ! parsedUrl.hostname || ! parsedUrl.protocol ) {
		return callback( ( ! parsedUrl.host ? HOST_INVALID : HOST_INVALIDSCHEMA ) );
	}

	let host = parsedUrl.hostname.replace( /^\[(.*)\]$/, '$1' );

	// localhost and *.localhost resolves to loopback without performing DNS lookups
	if ( host.match( /(^|\.)localhost\.?$/i ) ) {
		return callback( HOST_BLACKLISTED );
	}

	let disallow = SUCCESS;
	hostnames.some( function( hostname ) {
		if ( hostname == host ) {
			if ( 'pixel.wp.com' != host ) {
				logger.debug( `${process.pid}: hostname match ${host} == ${hostname}` );
			}
			disallow = HOST_BLACKLISTED;
			return true;
		}
	});
	if ( disallow ) {
		return callback( disallow );
	}

	if ( _net.isIP( host ) ) {
		return callback( allowAddress( host ) );
	}

	resolveAll( host, ( addresses ) => {
		if ( 0 === addresses.length ) {
			return callback( HOST_NO_DNS );
		}
		addresses.some( function( address ) {
			disallow = allowAddress( address );
			return SUCCESS !== disallow;
		});
		return callback( disallow );
	});
}

const exported = {
	loadConfig,
	allowHost,
	allowAddress,
}

module.exports = exported;

