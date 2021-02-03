<?php

require_once dirname( __DIR__ ) . '/public_html/class-mshots.php';

class TestMshots extends mShots {
	//
	// Stubs to avoid calls to die()
	//
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
			[ '/invalid', '404' ],
			[ '/mshots/v1/default', 'default' ],
			[ '/mshots/v1/https://public-api.wordpress.com/rest/v1/template/demo/rockfield/reynolds?font_base=Fira%20Sans&font_headings=Playfair%20Display&site_title=Reynolds&language=ko',
			 '/opt/mshots/public_html/thumbnails/ed2/ed271f0f0255e9d784e345dc2f0d8cc48ca26019/e295c5f761af9ac029f49726f50b16b1.jpg' ]
		];
	}

    public function test_test() {
		$this->assertTrue( false );
    }
}