configure:
	echo "UID=$$(id -u)\nGID=$$(id -g)" > .env
	docker-compose -f docker-compose-core.yml -f docker-compose-dev-override.yml config > docker-compose.yml
	docker-compose build
	docker-compose run mshots bash -c 'npm install'
	docker-compose run mshots bash -c 'cd node_modules/puppeteer; node install.js'

start:
	docker-compose up -d
	docker-compose exec mshots ./mshots_ctl.sh start
	@echo mshots service successfully in the mshots docker container.
	@echo Port 8000 is mapped to localhost, e.g. http://localhost:8000/mshots/v1/example.com

stop:
	docker-compose exec mshots sh -c 'test -f /var/run/mshots.pid && kill `cat /var/run/mshots.pid` && echo Master Process killed && rm -f /var/run/mshots.pid || echo already stopped'
	docker-compose down

restart: stop start

status:
	@docker-compose exec mshots bash -c 'echo mShots Master process: `set -o pipefail; ps ax | grep Master | grep -v grep | awk "{print $1}" || echo not running` ; echo Workers: `ps ax | grep Worker | grep -v grep | wc -l`'

test-js:
	docker-compose exec mshots npm run test:js

test-php:
	docker-compose exec mshots npm run test:php

test: test-js test-php
