<?php


class url_analyzer {


	public function __construct() {
		if( !isset($_GET['url']) ) {
			$this->not_found_response();
		}

		// Validate the url

	}

	public function analyze() {

		$url = rawurldecode($_GET['url']);

		$cache_key = md5($url);

		header('Content-Type: application/json');


		// Check if we already analyzed, else trigger node service and return a response that
		// indicates analyzing is under way.

		$memcache_host = getenv( 'MSHOTS_MEMCACHE_HOST' );
		if ( empty( $memcache_host ) ) {
			$memcache_host = '127.0.0.1';
		}

		$memcache = new Memcache();
		$memcache->connect( $memcache_host, 11211  );

		if( $memcache->get($cache_key) ) {
			echo $memcache->get($cache_key);
		} else {
			$service_url = 'http://localhost:7777/analyze-url';
			$params = http_build_query([
				'cache_key' => $cache_key,
				'url' => $url
			]);

			$ch = curl_init( sprintf("%s?%s", $service_url, $params) );
			curl_setopt( $ch, CURLOPT_TIMEOUT, 10 );
			curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
			curl_exec( $ch );
			$http_code = curl_getinfo( $ch, CURLINFO_HTTP_CODE );
			curl_close( $ch );

			echo json_encode([
				'url' => $url,
				'status' => 'pending'
			]);
		}

	}

	protected function not_found_response() {
		header( "Content-Type: text/plain" );
		header( "HTTP/1.1 404 Not Found" );
		header( "Last-Modified: " . gmdate( 'D, d M Y H:i:s', 1) . " GMT" );
		header( "Expires: " . gmdate( 'D, d M Y H:i:s', 0) . " GMT" );
		die( "HTTP/1.1 404 Not Found" );
	}

}
