from locust import HttpUser, task
from random import random
import time
import requests
from urllib import parse

class MshotsUser( HttpUser ):
    demo_url = "https://public-api.wordpress.com/rest/v1.1/template/demo/pub/russell/russell?viewport_height=700&language=en&use_screenshot_overrides=true"
    mshots_path = "mshots/v1"

    def __init__( self, environment ):
        super().__init__( environment )
        self.request_events = environment.events.request
        # Ignore the host that was set in the web UI for now to ensure this doesn't accidentally get run against production
        self.host = "http://localhost:8000"
        # self.host = environment.host

    def mshots_request( self, snapshot_url, name ):
        start_perf_counter = time.perf_counter()
        meta = {
            "request_type": "mshots",
            "response_length": 0,
            "context": {},
            "exception": None,
            "name": name,
            "start_time": start_perf_counter * 1000,
        }

        # Retry every 1 second until the preview is loaded or an error
        # Note that we do not have a max_tries because
        # that would free up the worker to add additional jobs to the mshots queue and make matters worse
        while True:
            resp = requests.get( f"{ self.host }/{ self.mshots_path }/{ snapshot_url }", allow_redirects=False )

            if resp.status_code == 200:
                meta["response_length"] = len( resp.content )
                break
            if resp.status_code >= 400:
                meta["exception"] = "error: " + resp.status_code
                break
            time.sleep(1)

        meta["response_time"] = ( time.perf_counter() - start_perf_counter ) * 1000
        self.request_events.fire( **meta )

    @task
    def gen_preview( self ):
        # url encode including "/" character
        encoded_preview_url = parse.quote( f"{ self.demo_url }&v={ random() }", safe='' )
        self.mshots_request( encoded_preview_url, "Russell preview" )
