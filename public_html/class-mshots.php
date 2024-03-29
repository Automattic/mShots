<?php

if ( ! class_exists( 'mShots' ) ) {

	class mShots {
		const renderer = 'http://localhost:7777';
		const snapshot_age = 86400;
		const disable_requeue = false;
		const location_header = 'X-Accel-Redirect: ';
		const location_base = '/opt/mshots/public_html/thumbnails';
		const snapshot_default = 'https://s0.wp.com/mshots/v1/default';
		const snapshot_default_file = '/opt/mshots/public_html/images/default.gif';

		const VIEWPORT_MAX_W = 3072;
		const VIEWPORT_MAX_H = 3072;
		const VIEWPORT_MIN_W = 320;
		const VIEWPORT_MIN_H = 320;
		const VIEWPORT_DEFAULT_W = 1280;
		const VIEWPORT_DEFAULT_H = 960;
		const SCREEN_MAX_W = 1600;
		const SCREEN_MAX_H = 3600;
		const SCALE_FACTOR_VALUES = [1, 2];
		const SCALE_FACTOR_DEFAULT = 1;

		const JPEG = 'jpeg';
		const PNG = 'png';
		const DEFAULT_FORMAT = self::JPEG;
		const ALLOWED_FORMATS = [ self::PNG, self::JPEG ];
		const FORMAT_TO_EXTENSION = [
			self::PNG => '.png',
			self::JPEG => '.jpg',
		];

		protected $snapshot_url = "";
		protected $snapshot_file = "";
		protected $parsed_url = "";
		protected $requeue = false;
		protected $invalidate = false;
		protected $viewport_w = self::VIEWPORT_DEFAULT_W;
		protected $viewport_h = self::VIEWPORT_DEFAULT_H;
		protected $scale_factor = self::SCALE_FACTOR_DEFAULT;

		function __construct() {
			ob_start();
			$this->parsed_url = parse_url( "http://{$_SERVER['HTTP_HOST']}{$_SERVER['REQUEST_URI']}" );
			$array_check = explode( '/', substr( $this->parsed_url[ 'path' ] , 1 ) );

			if ( isset( $this->parsed_url[ 'query' ] ) && $this->parsed_url[ 'query' ] ) {
				if ( strrpos( $this->parsed_url[ 'query' ], "?" ) ) {
					$this->parsed_url[ 'path' ] .= "?" . substr( $this->parsed_url[ 'query' ], 0, strrpos( $this->parsed_url[ 'query' ], "?" ) );
					$this->parsed_url[ 'query' ] = substr( $this->parsed_url[ 'query' ], strrpos( $this->parsed_url[ 'query' ], "?" ) + 1 );
				}
				if ( isset( $this->parsed_url[ 'query' ] ) && $this->parsed_url[ 'query' ] ) {
					parse_str( $this->parsed_url[ 'query' ], $_GET );
				}
			}

			if ( 2 > count( $array_check ) || $array_check[1] != 'v1' )
				$this->my404();

			if ( 'default' == $array_check[2] ) {
				$this->serve_default_gif();
			}

			if ( ( isset( $_GET[ 'requeue' ] ) && "true" == $_GET[ 'requeue' ] ) ) {
				$this->requeue = true;
				$this->invalidate = true;
			}

			$this->snapshot_url = substr( $this->parsed_url[ 'path' ], 11);
			$this->snapshot_url = preg_replace( "#^http%3A%2F%2Fhiderefer.com%2F%3F?#", "" , $this->snapshot_url );

			if ( 0 === strlen( $this->snapshot_url ) )
				$this->my404();

			$this->snapshot_url = rawurldecode( $this->snapshot_url );

			if ( 0 === strpos( $this->snapshot_url, "http://www.facebook.com/" ) ) {
				$this->snapshot_url = "https://www.facebook.com/" . substr( $this->snapshot_url, 24, strlen( $this->snapshot_url ) );
			}
			if ( 0 === strpos( $this->snapshot_url, "http://twitter.com/" ) ) {
				$this->snapshot_url = "https://twitter.com/" . substr( $this->snapshot_url, 19, strlen( $this->snapshot_url ) );
			}

			if ( isset( $_GET[ 'vpw' ] ) ) {
				$this->viewport_w = min( max( self::VIEWPORT_MIN_W, intval( $_GET[ 'vpw' ] ) ), self::VIEWPORT_MAX_W );
			}

			$this->format = self::DEFAULT_FORMAT;

			if ( isset( $_GET[ 'format' ] ) && in_array( $_GET[ 'format' ], self::ALLOWED_FORMATS ) ) {
				$this->format = $_GET[ 'format' ];
			}

			if ( isset( $_GET[ 'vph' ] ) ) {
				$this->viewport_h = min( max( self::VIEWPORT_MIN_H, intval( $_GET[ 'vph' ] ) ), self::VIEWPORT_MAX_H );
			}

			if ( isset( $_GET[ 'screen_width' ] ) ) {
				$this->screen_width = intval( $_GET[ 'screen_width' ] );
				if ( $this->screen_width > self::SCREEN_MAX_W ) {
					$this->screen_width = self::SCREEN_MAX_W;
				}
			} else {
				// default to viewport width
				$this->screen_width = $this->viewport_w;
			}

			if ( isset( $_GET[ 'screen_height' ] ) ) {
				$this->screen_height = intval( $_GET[ 'screen_height' ] );
				if ( $this->screen_height > self::SCREEN_MAX_H ) {
					$this->screen_height = self::SCREEN_MAX_H;
				}
			} else {
				// default to viewport height
				$this->screen_height = $this->viewport_h;
			}

			if ( isset( $_GET[ 'scale' ] ) ) {
				$this->scale_factor = intval( $_GET[ 'scale' ] );
				if ( ! in_array( $this->scale_factor, self::SCALE_FACTOR_VALUES, true ) ) {
					$this->scale_factor = self::SCALE_FACTOR_DEFAULT;
				}
			}

			$this->snapshot_file = $this->resolve_filename( $this->snapshot_url );
		}

		function __destruct() {
			;
		}

		public function requeue_snapshot() {
			ignore_user_abort( true );
			header( "Connection: Close" );
			flush();
			ob_end_flush();

			$memcache_host = getenv( 'MSHOTS_MEMCACHE_HOST' );
			if ( empty( $memcache_host ) ) {
				$memcache_host = '127.0.0.1';
			}
			$m = memcache_connect( $memcache_host, 11211 );

			$urlkey = sha1( $this->snapshot_url );
			if ( isset( $_GET[ 'requeue' ] ) && ( 'true' != $_GET[ 'requeue' ] ) ) {
				if ( memcache_get( $m, $urlkey ) )
					die();
			}
			memcache_set( $m, $urlkey, 1, 0, 300 );

			$requeue_url = self::renderer . "/queue?url=" . rawurlencode( $this->snapshot_url ) . "&f=" . urlencode( $this->snapshot_file );

			if ( $this->screen_width != $this->viewport_w || $this->screen_height != $this->viewport_h ) {
				$requeue_url .= '&screen_width=' . $this->screen_width . '&screen_height=' . $this->screen_height;
			}

			if ( $this->viewport_w != self::VIEWPORT_DEFAULT_W || $this->viewport_h != self::VIEWPORT_DEFAULT_H )
				$requeue_url .= '&vpw=' . $this->viewport_w . '&vph=' . $this->viewport_h;

			if ( $this->scale_factor != self::SCALE_FACTOR_DEFAULT ) {
				$requeue_url .= '&scale=' . $this->scale_factor;
			}

			$requeue_url .= '&format=' . $this->format;

			$ch = curl_init( $requeue_url );
			curl_setopt( $ch, CURLOPT_TIMEOUT, 10 );
			curl_exec( $ch );
			$http_code = curl_getinfo( $ch, CURLINFO_HTTP_CODE );
			curl_close( $ch );

			$tries = 0;
			while ( ( 200 != $http_code ) && ( $tries < 3 ) ) {
				sleep( 1 );	// in the event that the failed call is due to a mShots.js service restart,
							// we need to be a little patient as the service comes back up
				$ch = curl_init( $requeue_url );
				curl_setopt( $ch, CURLOPT_TIMEOUT, 10 );
				curl_exec( $ch );
				$http_code = curl_getinfo( $ch, CURLINFO_HTTP_CODE );
				curl_close( $ch );
				$tries++;
			}

			if ( ( 200 != $http_code ) && ( $tries >= 3 ) ) {
				error_log( "failed to queue '$requeue_url'" );
			}
			if ( true == $this->invalidate ) {
				$this->invalidate_snapshot( $this->snapshot_url );
			}
		}

		public function send_snapshot() {
			if ( $this->requeue ) {
				$this->send_nocache_header();
			} else {
				$timestamp = filemtime( $this->snapshot_file );
				header( "Last-Modified: " . gmdate( 'D, d M Y H:i:s', $timestamp ) . " GMT" );
				if ( self::snapshot_age < ( time() - $timestamp ) ) {
					header( "Expires: " . gmdate( 'D, d M Y H:i:s', time() + 600 ) . " GMT" );
					header( "Cache-Control: public, max-age=600" );
					$this->requeue = true;
				} else {
					header( "Expires: " . gmdate( 'D, d M Y H:i:s', time() + 43200 ) . " GMT" );
					header( "Cache-Control: public, max-age=43200" );
				}
			}
			$this->image_resize_and_output( $this->snapshot_file, $this->format );
		}

		public function must_requeue() {
			return ( $this->requeue && ( ! self::disable_requeue ) );
		}

		public function have_snapshot() {
			clearstatcache();
			return file_exists( $this->snapshot_file );
		}

		public function send_default_image() {
			$this->requeue = true;
			$matches = array();
			if ( preg_match( '#^http(s)?://([^/]+)/([^/]+)#i' , $this->snapshot_url , $matches ) ) {
				$top_level_url = "http" . $matches[1] . "://" . $matches[2] . "/";
				$toplevel_snapshot_file = $this->resolve_filename( $top_level_url );
				if ( file_exists( $toplevel_snapshot_file ) ) {
					$snapshot_default_url = $this->resolve_mshots_url( $top_level_url ) ;
					$this->my307( $snapshot_default_url );
					return;
				}
			}

			$this->my307( self::snapshot_default );
		}

		private function send_nocache_header() {
			header( 'Expires: Wed, 11 Jan 1984 05:00:00 GMT' );
			header( 'Last-Modified: ' . gmdate( 'D, d M Y H:i:s' ) . ' GMT' );
			header( 'Cache-Control: no-cache, no-store, must-revalidate, max-age=0' );
			header( 'Pragma: no-cache' );
		}

		private function image_resize_and_output( $image_filename, $format ) {
			try {
				if ( $image = imagecreatefromstring( file_get_contents( $image_filename ) ) ) {
					header( "Content-Type: image/$format" );
					$width = imagesx( $image );
					$height = imagesy( $image );
					$original_aspect = $width / $height;
					// if we are not supplied with the width, use the original image's width
					$thumb_width = ( isset( $_GET[ 'w' ] ) && $_GET[ 'w' ] ) ? $_GET[ 'w' ] : $width;
					// keep the requested width within image bounds and limits
					$thumb_width = max( 20, min( $width, min( $thumb_width, self::VIEWPORT_MAX_W ) ) );

					// if we are not supplied with the height, calculate it from the original image aspect ratio
					$thumb_height = ( isset( $_GET[ 'h' ] ) && $_GET[ 'h' ] ) ? $_GET[ 'h' ] : ( $thumb_width / ( $width / $height ) );
					// keep the requested height within image bounds and limits
					$thumb_height = max( 20, min( $height, min( $thumb_height, self::VIEWPORT_MAX_H ) ) );

					$thumb_aspect = $thumb_width / $thumb_height;
					if ( $thumb_width == $width && $thumb_height == $height ) {
						if( $format === self::JPEG ) {
							imagejpeg( $image, null, 90 );
						} else {
							imagepng( $image );
						}
						return;
					}

					if ( $original_aspect >= $thumb_aspect ) {
						$new_height = $thumb_height;
						$new_width = $width / ($height / $thumb_height);
					} else {
						$new_width = $thumb_width;
						$new_height = $height / ($width / $thumb_width);
					}
					$thumb = imagecreatetruecolor( $thumb_width, $thumb_height );
					$indentX = 0 - ( $new_width - $thumb_width ) / 2;
					imagecopyresampled( $thumb, $image, $indentX, 0, 0, 0, $new_width, $new_height, $width, $height );
					if( $format === self::JPEG ) {
						imagejpeg( $thumb, null, 95 );
					} else {
						imagepng( $thumb );
					}
				} else {
					error_log( "error processing filename : " . $image_filename );
					if ( 0 < strlen( $image_filename ) ) {
						clearstatcache();
						if ( file_exists( $image_filename ) && 0 == filesize( $image_filename ) ) {
							error_log( 'file was zero length, removed and now requeuing' );
							@unlink( $image_filename );
							$this->send_default_image();
							$this->requeue_snapshot();
							die();
						}
					}
					$this->my404();
				}
			}
			catch ( Exception $ex ) {
				error_log( "error processing filename : " . $image_filename );
				$this->my404();
			}
		}

		protected function serve_default_gif() {
			header( "HTTP/1.1 200 OK" );
			header( 'Content-Length: ' . filesize( self::snapshot_default_file ) );
			header( 'Content-Type: image/gif' );
			header( 'Last-Modified: ' . gmdate( 'D, d M Y H:i:s', time() ) . ' GMT' );
			header( "Expires: " . gmdate( 'D, d M Y H:i:s', time() + 63115200 ) . " GMT" );
			readfile( self::snapshot_default_file );
			die();
		}

		protected function my404() {
			header( "Content-Type: text/plain" );
			header( "HTTP/1.1 404 Not Found" );
			header( "Last-Modified: " . gmdate( 'D, d M Y H:i:s', 1) . " GMT" );
			header( "Expires: " . gmdate( 'D, d M Y H:i:s', 0) . " GMT" );
			die( "HTTP/1.1 404 Not Found" );
		}

		protected function my307( $redirect_url ) {
			header( "HTTP/1.1 307 Temporary Redirect" );
			header( "Last-Modified: Tue, 01 Jan 2013 01:00:00 GMT" );
			header( "Expires: " . gmdate( 'D, d M Y H:i:s' ) . " GMT" );
			header( "Cache-Control: no-cache, no-store, must-revalidate, max-age=0, pre-check=1, post-check=2" );
			header( "Pragma: no-cache" );
			header( "Location: " . $redirect_url );
			header( "Content-Type: text/html; charset=UTF-8" );
		}

		protected function resolve_filename( $snap_url ) {
			$url_parts = explode( '://', $snap_url );
			if ( 1 < count( $url_parts ) )
				$s_host = explode( '/', $url_parts[1] )[0];
			else
				$s_host = explode( '/', $url_parts[0] )[0];
			$host = sha1( strtolower( $s_host ) );

			$file = md5( $snap_url );

			$suffix = '';

			if ( $this->viewport_w != self::VIEWPORT_DEFAULT_W || $this->viewport_h != self::VIEWPORT_DEFAULT_H ) {
				$suffix .= '_' . $this->viewport_w . 'x' . $this->viewport_h;
			}

			if( $this->screen_width != $this->viewport_w || $this->screen_height != $this->viewport_h ) {
				$suffix .= '_screen' . $this->screen_width . 'x' . $this->screen_height;
			}

			if ( $this->scale_factor != self::SCALE_FACTOR_DEFAULT ) {
				$suffix .= "_{$this->scale_factor}x";
			}

			$extension = self::FORMAT_TO_EXTENSION[ $this->format ];

			$fullpath = self::location_base . '/' . substr( $host, 0, 3 ) . '/' . $host . '/' . $file . $suffix . $extension;

			return $fullpath;
		}

		protected function resolve_mshots_url( $url ) {
			return sprintf(
				"/mshots/v1/%s",
				rawurlencode( $url )
				);
		}

		protected function invalidate_snapshot( $snapshot_url ) {
			$uri = str_replace( '&requeue=true', '', $_SERVER['REQUEST_URI'] );
			$uri = str_replace( '?requeue=true', '', $uri );
			$this->purge_snapshot( $uri );
		}

		private function purge_snapshot( $purge_url ) {
			// Put your content PURGE calls here.
		}
	}
}
