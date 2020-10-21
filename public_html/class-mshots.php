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

		const VIEWPORT_MAX_W = 1600;
		const VIEWPORT_MAX_H = 1200;
		const VIEWPORT_MIN_W = 320;
		const VIEWPORT_MIN_H = 320;
		const VIEWPORT_DEFAULT_W = 1280;
		const VIEWPORT_DEFAULT_H = 960;

		private $snapshot_url = "";
		private $snapshot_file = "";
		private $parsed_url = "";
		private $requeue = false;
		private $invalidate = false;
		private $viewport_w = self::VIEWPORT_DEFAULT_W;
		private $viewport_h = self::VIEWPORT_DEFAULT_H;

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
				$this->viewport_w = intval( $_GET[ 'vpw' ] );
				if ( $this->viewport_w > self::VIEWPORT_MAX_W )
					$this->viewport_w = self::VIEWPORT_MAX_W;
				else if ( $this->viewport_w < self::VIEWPORT_MIN_W )
					$this->viewport_w = self::VIEWPORT_MIN_W;
			}

			if ( isset( $_GET[ 'vph' ] ) ) {
				$this->viewport_h = intval( $_GET[ 'vph' ] );
				if ( $this->viewport_h > self::VIEWPORT_MAX_H )
					$this->viewport_h = self::VIEWPORT_MAX_H;
				else if ( $this->viewport_h < self::VIEWPORT_MIN_H )
					$this->viewport_h = self::VIEWPORT_MIN_H;
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

			$is_docker_server = isset( $_SERVER['SERVER_PORT'] ) && 8000 == $_SERVER['SERVER_PORT']; 
			$m = memcache_connect( $is_docker_server ? 'memcached' : '127.0.0.1', 11211 );

			$urlkey = sha1( $this->snapshot_url );
			if ( isset( $_GET[ 'requeue' ] ) && ( 'true' != $_GET[ 'requeue' ] ) ) {
				if ( memcache_get( $m, $urlkey ) )
					die();
			}
			memcache_set( $m, $urlkey, 1, 0, 300 );

			$requeue_url = self::renderer . "/queue?url=" . rawurlencode( $this->snapshot_url ) . "&f=" . urlencode( $this->snapshot_file );
			if ( $this->viewport_w != self::VIEWPORT_DEFAULT_W || $this->viewport_h != self::VIEWPORT_DEFAULT_H )
				$requeue_url .= '&vpw=' . $this->viewport_w . '&vph=' . $this->viewport_h;

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
			$this->image_resize_and_output( $this->snapshot_file );
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

		private function image_resize_and_output( $image_filename ) {
			try {
				if ( $image = imagecreatefromstring( file_get_contents( $image_filename ) ) ) {
					header("Content-Type: image/jpeg");
					$width = imagesx($image);
					$height = imagesy($image);
					$original_aspect = $width / $height;
					// if we are not supplied with the width, use the original image's width
					$thumb_width = ( isset( $_GET[ 'w' ] ) && $_GET[ 'w' ] ) ? $_GET[ 'w' ] : $width;
					if ( $thumb_width > 1280 ) $thumb_width = 1280;
					if ( $thumb_width < 20 ) $thumb_width = 20;
					// if we are not supplied with the height, calculate it from the original image aspect ratio
					$thumb_height = ( isset( $_GET[ 'h' ] ) && $_GET[ 'h' ] ) ? $_GET[ 'h' ] : ( $thumb_width / ( $width / $height ) );
					if ( $thumb_height > 960 ) $thumb_height = 960;
					if ( $thumb_height < 20 ) $thumb_height = 20;
					$thumb_aspect = $thumb_width / $thumb_height;
					if ( ( $thumb_width == $width &&  $thumb_height == $height ) ) {
						imagejpeg( $image, null, 90 );
					} else {
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
						imagejpeg( $thumb, null, 95 );
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

		private function serve_default_gif() {
			header( "HTTP/1.1 200 OK" );
			header( 'Content-Length: ' . filesize( self::snapshot_default_file ) );
			header( 'Content-Type: image/gif' );
			header( 'Last-Modified: ' . gmdate( 'D, d M Y H:i:s', time() ) . ' GMT' );
			header( "Expires: " . gmdate( 'D, d M Y H:i:s', time() + 63115200 ) . " GMT" );
			readfile( self::snapshot_default_file );
			die();
		}

		private function my404() {
			header( "Content-Type: text/plain" );
			header( "HTTP/1.1 404 Not Found" );
			header( "Last-Modified: " . gmdate( 'D, d M Y H:i:s', 1) . " GMT" );
			header( "Expires: " . gmdate( 'D, d M Y H:i:s', 0) . " GMT" );
			die( "HTTP/1.1 404 Not Found" );
		}

		private function my307( $redirect_url ) {
			header( "HTTP/1.1 307 Temporary Redirect" );
			header( "Last-Modified: Tue, 01 Jan 2013 01:00:00 GMT" );
			header( "Expires: " . gmdate( 'D, d M Y H:i:s' ) . " GMT" );
			header( "Cache-Control: no-cache, no-store, must-revalidate, max-age=0, pre-check=1, post-check=2" );
			header( "Pragma: no-cache" );
			header( "Location: " . $redirect_url );
			header( "Content-Type: text/html; charset=UTF-8" );
		}

		private function resolve_filename( $snap_url ) {
			$url_parts = explode( '://', $snap_url );
			if ( 1 < count( $url_parts ) )
				$s_host = explode( '/', $url_parts[1] )[0];
			else
				$s_host = explode( '/', $url_parts[0] )[0];
			$host = sha1( strtolower( $s_host ) );
			$file = md5( $snap_url );
			$viewport = '';
			if ( $this->viewport_w != self::VIEWPORT_DEFAULT_W || $this->viewport_h != self::VIEWPORT_DEFAULT_H )
				$viewport = '_' . $this->viewport_w . 'x' . $this->viewport_h;
			$fullpath = self::location_base . '/' . substr( $host, 0, 3 ) . '/' . $host . '/' . $file . $viewport. '.jpg';

			return $fullpath;
		}

		private function resolve_mshots_url( $url ) {
			return sprintf(
				"/mshots/v1/%s",
				rawurlencode( $url )
				);
		}

		private function invalidate_snapshot( $snapshot_url ) {
			$uri = str_replace( '&requeue=true', '', $_SERVER['REQUEST_URI'] );
			$uri = str_replace( '?requeue=true', '', $uri );
			$this->purge_snapshot( $uri );
		}

		private function purge_snapshot( $purge_url ) {
			// Put your content PURGE calls here.
		}
	}
}
