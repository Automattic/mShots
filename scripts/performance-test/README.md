## Performance testing for mshots
Uses the [locust](https://docs.locust.io) python library to test mshots performance.

#### Install and run
First run mshots locally in docker

```
brew install python3
pip3 install -r requirements.txt
locust
```

A web ui will open on http://localhost:8089, choose a number of users and spawn rate. 
Note: `Host` is currently hardcoded to use http://localhost:8000 regardless of what you enter.

#### Configuring mshots with more workers

Note that mshots runs with only two workers by default. To change this, modify the line `MSHOTS_WORKERS=2` in `docker-compose-dev-override.yml` and restart the docker container.

```bash
npm run stop:docker
npm run start
```