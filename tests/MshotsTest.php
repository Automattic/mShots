<?php

require_once dirname( __DIR__ ) . '/public_html/class-mshots.php';

class TestMshots extends mShots {
	//
	// Stubs to avoid calls to die()
	//
	public $served_404 = false;
	public $served_default_gif = false;

	public function serve_default_gif() {
		$this->served_default_gif = true;
	}

	public function my404() {
		$this->served_404 = true;
	}

	//
	// Getters to expose (carefully considered) private variables to tests
	//
	public function get_snapshot_url() {
		return $this->snapshot_url;
	}

	public function get_parsed_url() {
		return $this->parsed_url;
	}

	public function get_snapshot_file() {
		return $this->snapshot_file;
	}

	//
	// Convenience function to coerce statuses for dataProvider
	//
	public function status_string_or_value( $value ) {
		if ( $this->served_404 ) {
			return '404';
		}

		if ( $this->served_default_gif ) {
			return 'default';
		}

		return $this->$value;
	}
}

class MshotsTest extends \PHPUnit\Framework\TestCase {
	/**
	 * @dataProvider uri_and_filenames
	 */
	public function test_backwards_compatible_caching( $uri, $expected_file_name ) {
		$_SERVER['HTTP_HOST'] = 's0.wp.com';
		$_SERVER['REQUEST_URI'] = $uri;

		$mshots = new TestMshots();

		// Clear the output buffer to avoid errors
		ob_end_flush();

		$this->assertEquals( $expected_file_name, $mshots->status_string_or_value( 'snapshot_file' ) );
	}

	public function uri_and_filenames() {
		return [
			[ '/mshots/invalid/http://example.com', '404' ],
			[ '/mshots/v1/default', 'default' ],
			[ '/mshots/v1/https://public-api.wordpress.com/rest/v1/template/demo/rockfield/reynolds?font_base=Fira%20Sans&font_headings=Playfair%20Display&site_title=Reynolds&language=ko',
			 '/opt/mshots/public_html/thumbnails/ed2/ed271f0f0255e9d784e345dc2f0d8cc48ca26019/e295c5f761af9ac029f49726f50b16b1.jpg' ],
			// A couple of examples from a google search:
			[ '/mshots/v1/http%3A%2F%2Fcreatemockup.com%2F?w=250', '/opt/mshots/public_html/thumbnails/08b/08bcf1d9cc9648502091e6d3e4738cb87e410391/598882683350e71c7f0803b28f2d4089.jpg' ],
			// https://shkspr.mobi/blog/2018/12/using-the-wordpress-mshots-screenshot-api/
			[ '/mshots/v1/https%3A%2F%2Ftwitter.com%2FJennyVass%2Fstatus%2F1067855777040338944?w=800', '/opt/mshots/public_html/thumbnails/465/465806fbb3547c258cfa20becfef6e08f41c233b/3bdc1867dd156a7c3d63a894557592bc.jpg' ],
			// A gravatar example:
			[ '/mshots/v1/http%3A%2F%2Fcentrodelahoya.es', '/opt/mshots/public_html/thumbnails/9c2/9c2aba28f0d90f31dace1cf44f078ef8a084f07b/b633ca3b16327c692df17133f00d6554.jpg' ]
		];
	}

	// Ensure that different viewport and/or screen dimensions get different filenames
	public function test_unique_caching() {
		$different_dimensions = [
			'',
			'?vpw=320',
			'?vph=320',
			'?vph=320&vpw=320',
			'?screen_height=320',
			'?screen_width=320',
			'?screen_height=320&screen_width=320',

			'?vph=640&screen_height=320',
			'?vph=320&screen_height=640',

			// if screen_height matches vph it's a null-op
			// '?vph=320&screen_height=320',
			// '?vph=320&vpw=320&screen_height=320&screen_width=320',
			// '?vph=640&screen_height=640',

			'?vph=320&vpw=320&screen_height=640',
			'?vph=320&vpw=320&screen_width=640',
			'?vph=320&vpw=320&screen_height=640&screen_width=640',
		];

		$filenames_to_dimensions = array();

		$_SERVER['HTTP_HOST'] = 's0.wp.com';

		foreach ( $different_dimensions as $current_dimensions ) {
			$_SERVER['REQUEST_URI'] = '/mshots/v1/example.com'  . $current_dimensions;

			$mshots = new TestMshots();
			// Clear the output buffer to avoid errors
			ob_end_flush();

			$current_filename = $mshots->get_snapshot_file();
			$this->assertArrayNotHasKey(
				$current_filename,
				$filenames_to_dimensions,
				'Cache collision: ' . $current_dimensions
					. ( empty( $filenames_to_dimensions[ $current_filename ] ) ? '' : ' & ' . $filenames_to_dimensions[ $current_filename ] )
					. '( filename: ' . $current_filename . ' )'
			);
			$filenames_to_dimensions [ $current_filename ] = $current_dimensions;
		}
	}
}

