<?php
require_once "./class-mshots.php";

if ( class_exists( 'mShots' ) ) {
	$o_mshots = new mShots();
	if ( $o_mshots->have_snapshot() ) {
		$o_mshots->send_snapshot();
	} else {
		$o_mshots->send_default_image();
	}
	if ( $o_mshots->must_requeue() ) {
		$o_mshots->requeue_snapshot();
	}
} else {
	die( "The mShots class has not been defined." );
}
?>
