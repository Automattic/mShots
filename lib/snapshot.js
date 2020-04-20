
'use strict';

const _puppeteer = require( 'puppeteer' );
const _url       = require( 'url' );
const _fs        = require( 'fs' );
const _path      = require( 'path' );
const _blacklist = require( './blacklist' )

const o_log4js  = require( 'log4js' );
const logger    = o_log4js.getLogger( 'flog' );

const LOAD_TIMEOUT        = 40;
const REDIRECT_LIMIT      =  2;

const SUCCESS             = 0;
const HOST_NO_DNS         = 1;
const HOST_BLACKLISTED    = 2;
const HOST_IP_BLACKLISTED = 3;
const HOST_INVALIDSCHEMA  = 4;
const HOST_INVALID        = 5;
const GENERAL_ERROR       = 6;

const EXIT_UNRESPONSIVE   = 4;
const EXIT_ERROR_LIMIT    = 5;

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

var site_queue         = [];
var running            = true;
var downloading        = false;
var reload_config      = false;
var time_downloading   = 0;
var browser            = null;
var default_UA         = '';

async function init_browser() {
	browser = await _puppeteer.launch( { headless: true, timeout: 30000, ignoreHTTPSErrors: true } ).
		catch( e => {
			logger.error( process.pid + ': Failed to launch the browser: ' + e.toString() );
			process.exit( EXIT_UNRESPONSIVE );
		});

	default_UA = await browser.userAgent();
	return browser;
}

function take_snapshot( p_uri, p_filename, p_width, p_height, screen_width, screen_height ) {
	let m_uri = p_uri;
	if ( ! m_uri.match( /^([a-z][a-z0-9+\-.]*):/i ) ) {
		m_uri = 'http://' + m_uri;
	}

	const parsedUri = _url.parse( m_uri );
	if ( ! parsedUri || ! parsedUri.host || ! parsedUri.protocol ) {
		saveAs( 404, p_filename );
		time_downloading = 0;
		downloading = false;
		logger.error( process.pid + ': Invalid URL: ' + p_uri + '. Saved as 404 and continued with queue.' );
		process.send({
			replytype: 'queue-del',
			workerid: process.pid,
			payload: {
				status: ( ! parsedUri.host ? HOST_INVALID : HOST_INVALIDSCHEMA ),
				url   : p_uri,
				file  : p_filename,
			}
		});
		return;
	}

	let redirect_uri   = m_uri;
	let redirect_count = 0;
	let block_all_code = 0;
	let error_code     = -1;
	let page_loaded    = false;

	(async() => {
		if ( null === browser ) {
			await init_browser();
		}
		const page = await browser.newPage();

		await page.setUserAgent( default_UA + ' WordPress.com mShots' );
		await page.setCacheEnabled( false );
		await page.setRequestInterception( true );
		await page._client.send( 'Page.setDownloadBehavior', { behavior: 'deny' } );

		page.setViewport( { width: p_width, height: p_height } );

		await page.on( 'request', request => {
			if ( 0 < block_all_code ) {
				request.abort( 'accessdenied' );
				return;
			}
			_blacklist.allowHost( request.url(), function( result ) {
				if ( SUCCESS === result ) {
					request.continue();
				} else {
					let reason = 'ACCESS DENIED';
					let abortReason = 'failed';
					switch ( result )  {
					case HOST_NO_DNS:
						reason = 'HOST_NO_DNS';
						abortReason = 'namenotresolved';
						break;
					case HOST_BLACKLISTED:
						reason = 'HOST_BLACKLISTED';
						abortReason = 'accessdenied';
						break;
					case HOST_IP_BLACKLISTED:
						reason = 'HOST_IP_BLACKLISTED';
						abortReason = 'accessdenied';
						break;
					case HOST_INVALIDSCHEMA:
						reason = 'HOST_INVALIDSCHEMA';
						break;
					case HOST_INVALID:
						reason = 'HOST_INVALID';
						break;
					}
					if ( ! request.url().match( /https?:\/\/pixel.wp.com\// ) ) {
						logger.debug( process.pid + ': ' + reason + ':', request.method(), request.url() );
					}
					request.abort( abortReason );
				}
			});
		});

		await page.on( 'response', response => {
			const status = response.status();
			const url    = response.request().url();

			if ( url == redirect_uri && ( 301 == status || 302 == status || 307 == status || 308 == status ) ) {
				redirect_count++;
				redirect_uri = response.headers().location;
				if ( redirect_count > REDIRECT_LIMIT ) {
					logger.error( process.pid + ': redirect limit for ' + p_uri + ' reached at ', redirect_uri );
					block_all_code = GENERAL_ERROR;
				}
			}
		});

		await page.on( 'load', () => {
			logger.debug( process.pid + ': loaded: ' + page.url() );
			page_loaded = true;
		});

		await page.on( 'requestfailed', request => {
			if ( 'document' == request.resourceType() && request.response() ) {
				const content_type = request.response().headers()['content-type'];
				logger.debug( process.pid + ': failed request for content type = ' + content_type );
				block_all_code = GENERAL_ERROR;
				error_code = 415; // Unsupported Media Type
				saveAsUnsupportedContent( p_filename, content_type );
			}
		});

		const response = await page.goto( m_uri, { waitUntil: 'networkidle2' } ).
			catch( e => {
				logger.error( process.pid + ': Failed to load ' + m_uri + ': ' + e.toString() );
				if ( -1 !== e.toString().indexOf( 'ERR_ACCESS_DENIED' ) ) {
					error_code = 403;
				} else if ( -1 !== e.toString().indexOf( 'Error: Navigation Timeout Exceeded' ) ) {
					error_code = 0;
				}
			});

		if ( response && response.ok() || page_loaded ) {
			await page.waitFor( 2000 );
			makeDirIfRequired( _path.dirname( p_filename ) );

			await page.screenshot( { path: p_filename, fullPage: false, type: 'jpeg', quality: 90, clip: {
				x: 0,
				y: 0,
				width: screen_width || p_width,
				height: screen_height || p_height
			} } );
			
			await page.close();
			logger.debug( process.pid + ': snapped: ' + p_uri );

			let pages = await browser.pages();
			pages.forEach( function( p ) {
				p.close();
			});

			process.send({
				replytype: 'queue-del',
				workerid: process.pid,
				payload: {
					status: SUCCESS,
					url   : p_uri,
					file  : p_filename,
				}
			});

			time_downloading = 0;
			downloading = false;
			return;
		}

		await page.close();
		let pages = await browser.pages();
		pages.forEach( function( p ) {
			p.close();
		});

		let status = ( response ? response.status() : error_code );

		switch ( status ) {
			case 0:
				saveAs( 404, p_filename );
				logger.error( process.pid + ': Timed out loading ' + p_uri + '. Saved as 404.' );
				break;
			case 401:
				saveAs( 401, p_filename );
				logger.error( process.pid + ': Failed to load ' + p_uri + '. Authentication required.' );
				break;
			case 403:
				saveAs( 403, p_filename );
				logger.error( process.pid + ': Failed to load ' + p_uri + '. Access denied.' );
				break;
			case 415:
				logger.error( process.pid + ': Failed to load ' + p_uri + '. Unsupported content.' );
				break;
			case 400:
			case 404:
			case 500:
			default:
				saveAs( 404, p_filename );
				logger.error( process.pid + ': Failed to load ' + p_uri + '. Saved as 404.' );
				break;
		}

		process.send({
			replytype: 'queue-del',
			workerid: process.pid,
			payload: {
				status: ( 0 < block_all_code ? block_all_code : GENERAL_ERROR ),
				url   : p_uri,
				file  : p_filename,
			}
		});

		time_downloading = 0;
		downloading = false;
	})();
}

function makeDirIfRequired( dirname ) {
	if ( ! _fs.existsSync( dirname ) ) {
		let p = dirname.split('/');
		for ( var i = 1; i < p.length; i++) {
			let part_path = p.slice( 0, i + 1 ).join('/');
			if ( ! _fs.existsSync( part_path ) ) {
				_fs.mkdirSync( part_path )
			}
		}
	}
}

function saveAs( httpCode, filename ) {
	try {
		if ( 0 == filename.length ) {
			return;
		}

		if ( _fs.existsSync( filename ) ) {
			_fs.unlinkSync( filename );
		} else {
			makeDirIfRequired( _path.dirname( filename ) );
		}

		_fs.copyFileSync( './public_html/icons/' + httpCode + '.jpg' , filename );

		let now_sec = new Date().getTime() / 1000;
		// Set the last access time to be 1 hour less than a
		// full day, so it can get re-requested in an hour.
		let actime = now_sec - 82800;

		_fs.utimes( filename, actime, actime, () => { ; } );
	}
	catch ( Exception ) {
		logger.error( process.pid + ': exception in function saveAs( ' +
			httpCode + ', ' + filename + ' ): ' + Exception.toString() );
	}
}

function saveAsUnsupportedContent( filename, content_type ) {
	try {
		if ( 0 == filename.length ) {
			return;
		}

		makeDirIfRequired( _path.dirname( filename ) );

		if ( -1 !== content_type.indexOf( "video/" ) ) {
			if ( _fs.existsSync( filename ) ) {
				_fs.unlinkSync( filename );
			}
			_fs.copyFileSync( './public_html/icons/video.jpg' , filename );
		} else if ( content_type.includes( "audio/" ) ) {
			if ( _fs.existsSync( filename ) ) {
				_fs.unlinkSync( filename );
			}
			_fs.copyFileSync( './public_html/icons/audio.jpg' , filename );
		} else if ( content_type.includes( "application/x-rar-compressed" ) ||
					content_type.includes( "application/x-tar" ) ||
					content_type.includes( "application/x-gtar" ) ||
					content_type.includes( "application/zip" ) ) {
			if ( _fs.existsSync( filename ) ) {
				_fs.unlinkSync( filename );
			}
			_fs.copyFileSync( './public_html/icons/archive.jpg' , filename );
		} else {
			if ( _fs.existsSync( filename ) ) {
				_fs.unlinkSync( filename );
			}
			_fs.copyFileSync( './public_html/icons/document.jpg' , filename );
		};
	}
	catch ( Exception ) {
		logger.error( process.pid + ': exception in function unsupportedContent( ' +
			filename + ', ' + content_type + ' ): ' + Exception.toString() );
	}

}

function check_site_queue() {
	if ( false === downloading ) {
		if ( reload_config ) {
			reload_config = false;
			_blacklist.loadConfig();
			logger.debug( process.pid + ': blacklist file reloaded' );
		}
		if ( site_queue.length > 0 ) {
			downloading = true;
			logger.debug( process.pid + ': site queue size = ' + site_queue.length );

			var s_details = site_queue[0];
			site_queue.shift();
			logger.debug( process.pid + ': snapping: ' + s_details.url );
			take_snapshot( s_details.url, s_details.file, s_details.width, s_details.height, s_details.screenWidth, s_details.screenHeight );
		}
	}
}

function shutdown() {
	running = false;
}

function reload_all_config() {
	logger.trace( 'reload_config set to true' );
	reload_config = true;
}

function add_to_queue( siteObject ) {
	site_queue.push( siteObject );
}

function process_events() {
	if ( ! running ) {
		process.exit( 0 );
	}

	if ( downloading ) {
		time_downloading++;
		if ( time_downloading >= LOAD_TIMEOUT ) {
			logger.error( process.pid + ': load timed out. Forcing exit.' );
			process.exit( EXIT_UNRESPONSIVE );
		}
	} else {
		time_downloading = 0;
		check_site_queue();
	}
}
setInterval( process_events, 1000 );

_blacklist.loadConfig();

const exported = {
	add_to_queue,
	shutdown,
	reload_all_config,
	init_browser,
}

module.exports = exported;


