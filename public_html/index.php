<?php


// Route the request to mshots or url-analyzer
$route = strtok(explode("/", ltrim($_SERVER['REQUEST_URI'], "/"))[0], "?");

switch($route) {

	case "url-analyzer":
			run_url_analyzer();
		break;
	case "mshots":
	default:
		run_mshots();
		break;
}

function run_url_analyzer() {
	require_once  './class-url-analyzer.php';

	$url_analyzer = new url_analyzer();
	$response = $url_analyzer->handle();
	echo $response;
}

function run_mshots() {
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
}



?>
