<?php


class url_analyzer {


	/**
	 * @var Memcache
	 */
	protected $cache;

	/**
	 * Handle a URL-analyzer request.
	 *
	 * @return void
	 */
	public function handle() {

		if( !isset($_GET['url']) ) {
			$this->incorrect_input( 'The url parameter is missing.' );
		}

		$url = rawurldecode( trim( $_GET['url'] ) );

		if( filter_var( $url, FILTER_VALIDATE_URL ) === false ) {
			$this->incorrect_input( 'The url is invalid.' );
		}

		$cache_key = md5( $url );
		$cache = $this->get_memcache();

		// Purge the cache to force the url to be analyzed again.
		if( isset( $_GET['purge'] ) ) {
			$cache->delete( $cache_key );
		}

		// Check if there is an entry for the cache key and return it if it exists.
		if( $cache->get( $cache_key ) ) {
			$this->send_response( json_decode( $cache->get( $cache_key ), true ) );
		}

		// If there was no cache entry for the key, we trigger the node service to start analyzing the URL
		$this->call_analyzer( $url, $cache_key );

		$this->send_response([
			'url' => $url,
			'status' => 'pending'
		]);
	}

	protected function send_response( $data, $status = 200 ) {

		header('Content-Type: application/json');
		header( "Last-Modified: " . gmdate( 'D, d M Y H:i:s', 1) . " GMT" );
		header( "Expires: " . gmdate( 'D, d M Y H:i:s', 0) . " GMT" );
		header( sprintf( "HTTP/1.1 %d", $status ) );

		$response = [
			'http_status' => $status,
			'data' => $data
		];

		echo json_encode( $response );
		die();
	}

	protected function incorrect_input( $error_message ) {
		$this->send_response([
			'error' => $error_message
		], 400 );
	}

	/**
	 * Sends an API call to the Node service that will asynchronously
	 * analyze the given URL.
	 *
	 * @param string $url The url to analyze.
	 * @param string $cache_key The cache key used to store the result.
	 */
	protected function call_analyzer( $url, $cache_key ) {
		$service_url = 'http://localhost:7777/analyze-url';

		$params = http_build_query([
			'cache_key' => $cache_key,
			'url' => $url
		]);

		// Try to hit the Node service endpoint up to 3 times in case the service is temporarily unavailable.
		$attempts = 3;
		do {
			$ch = curl_init( sprintf("%s?%s", $service_url, $params) );
			curl_setopt( $ch, CURLOPT_TIMEOUT, 10 );
			curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
			curl_exec( $ch );
			$http_code = curl_getinfo( $ch, CURLINFO_HTTP_CODE );
			curl_close( $ch );
		} while (
			$http_code !== 200 &&
			$attempts-- > 1 &&
			sleep(1) === 0
		);
	}

	/**
	 * @return Memcache
	 */
	protected function get_memcache() {

		if( $this->cache !== null ) {
			return $this->cache;
		}

		$memcache_host = getenv( 'MSHOTS_MEMCACHE_HOST' );
		if ( empty( $memcache_host ) ) {
			$memcache_host = '127.0.0.1';
		}

		$this->cache = new Memcache();
		$this->cache->connect( $memcache_host, 11211  );

		return $this->cache;
	}

}
