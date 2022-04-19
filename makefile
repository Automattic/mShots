dev:
	echo "UID=$$(id -u)\nGID=$$(id -g)" > .env
	docker-compose -f docker-compose-core.yml -f docker-compose-dev-override.yml config > docker-compose.yml
	docker-compose build
	docker-compose run mshots bash -c 'npm install --ignore-scripts'
	docker-compose run mshots bash -c 'cd node_modules/puppeteer; node install.js'

start:
	docker-compose up -d
	docker-compose exec mshots ./mshots_ctl.sh start
	@echo mshots service successfully in the mshots docker container.
	@echo Port 8000 is mapped to localhost, e.g. http://localhost:8000/mshots/v1/example.com

stop:
	docker-compose down
