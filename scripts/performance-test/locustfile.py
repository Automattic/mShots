import time
from random import random
from urllib import parse

import requests
from locust import HttpUser, task


class MshotsUser(HttpUser):
    demo_url = "https://public-api.wordpress.com/rest/v1.1/template/demo/pub/russell/russell?viewport_height=700&language=en&use_screenshot_overrides=true"
    mshots_path = "mshots/v1"
    # HttpUser requires a host before __init__ runs
    host = "http://localhost:8000"

    def __init__(self, environment):
        super().__init__(environment)
        self.request_events = environment.events.request
        # Ignore the host that was set in the web UI or via --host for now,
        # to ensure this doesn't accidentally get run against production
        self.host = MshotsUser.host
        # self.host = environment.host
        self.session = requests.Session()

    def mshots_request(self, snapshot_url, name):
        url = f"{self.host}/{self.mshots_path}/{snapshot_url}"
        start_time = time.time()
        start_perf_counter = time.perf_counter()
        meta = {
            "request_type": "mshots",
            "name": name,
            "url": url,
            "response_length": 0,
            "response": None,
            "context": {},
            "exception": None,
            "start_time": start_time,
        }

        # Retry every 1 second until the preview is loaded or an error
        # Note that we do not have a max_tries because
        # that would free up the worker to add additional jobs to the mShots queue and make matters worse
        while True:
            try:
                resp = self.session.get(url, allow_redirects=False, timeout=30)
            except requests.RequestException as e:
                meta["exception"] = e
                break

            meta["response"] = resp
            if resp.status_code == 200:
                meta["response_length"] = len(resp.content)
                break
            if resp.status_code >= 400:
                meta["exception"] = Exception(f"HTTP {resp.status_code}")
                break
            time.sleep(1)

        meta["response_time"] = (time.perf_counter() - start_perf_counter) * 1000
        self.request_events.fire(**meta)

    @task
    def gen_preview(self):
        # url encode including "/" character
        encoded_preview_url = parse.quote(f"{self.demo_url}&v={random()}", safe="")
        self.mshots_request(encoded_preview_url, "Russell preview")
