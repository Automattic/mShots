
mshots
======

Overview
----------
This application is split into two distinct components, the mshots PHP class (receiving requests from the WordPress mshots plugin),
the node.JS cluster service to process the filtered incoming requests passed on from the mshots class.
Note: The virtual frame buffer Kernel module (VFB) is required for the service.

Installation
------------

If anything goes awry or is unclear in one of these steps, take a look at the "Details" section below for slightly more detailed info.

1) Install the latest node.js binaries from http://nodejs.org

2) Place the code in this repository in an mshots folder in `/opt/`, so the final path is `/opt/mshots/`.

3) Run `npm install --ignore-scripts` in the `/opt/mshots/` directory.

4) You are now ready to run the mshots service with "./mshots_ctl.sh start|stop".
    Note: The virtual frame buffer Kernel module (VFB) is required on your distro.

Details
--------

**The mshots PHP Class (code in "public_html")**

This class is designed to buffer the thumbnail requests, by limiting snapshots to only be taken every 24 hours. The most useful attribute
of this class is the "disable_requeue" constant, but changing this to true you effectively stop all calls to the mshots service, which
can be used if the service misbehaves for any reason. With this setting enabled existing thumbnails will be served, but no new thumbnails
are generated.

**Snapper node.JS Module (code in "src")**

This node backend is no longer in use, but is left in it's latest incarnation (bug fixes) should someone wish to continue using it.

**mshots node.JS Program (code in "lib")**

Control the execution of the application with the `mshots_ctl.sh` bash script in the root directory or by manually running the following command from the terminal, whilst in the  `/opt/mshots/` directory:

	> node lib/mshots -p <port number> -n <number of workers>

Dev Setup
---------

Docker can be used to run the mshots service on OSX for dev/testing purposes:

- `npm install`: This will also configure the docker container for development and build the docker image (unless you pass `--ignore-scripts`)
- `npm start`: spins up the `mshots` (docker) service in the `mshots-dev` container and starts the mshots (*nix) service within it
- Ignore the errors about the missing commands. We don't use the kernel extension in the dev container.
- Check that mshots is available on localhost:8000, e.g. http://localhost:8000/mshots/v1/example.com

### Troubleshooting

##### Missing chromium binary
The container requires a linux chromium binary, so if puppeteer can't find chromium, run `install.js` in the puppeteer directory in the appropriate environment. Binaries for different OSes can live side-by-side so you can just install both:

```
# check what's already installed
ls /opt/mshots/node_modules/puppeteer/.local-chromium
# install native binary
(cd /opt/mshots/node_modules/puppeteer; node install.js)
# install linux binary in container
docker-compose exec dev bash -c 'cd node_modules/puppeteer; node install.js'
```

The local `/opt/mshots` directory is mounted into the container, so code changes are immediately reflected in the container and generated images will appear under `/opt/mshots/public_html` both in and out of the container.

The purpose of the container is to provide the linux service environment used by `mshots_ctl.sh` (particularly `start-stop-daemon`), and the javascript generally works inside or outside the container or both.

##### Permission errors

You can get get a root shell `docker-compose exec -u 0 dev bash`, or change the user in the image & container permanently by modifying the UID in `/opt/mshots/.env` file and re-running `docker-compose build`.

Background: Docker containers share the kernel with the docker host (the machine that `dockerd` is running on - physical or virtual). Of particular note is that this means that the same UIDs drive file permissions inside and outside the container.

This means that you'll want to have the same UID inside the container that you used to create your local files. Normally, this will be set up automatically when you `npm install` locally, but some docker setups may mess with your user IDs (e.g. running `dockerd` in a VM through `docker-machine`).

It's the uid that matters, not the username, so use `id -u <username>` inside the container to find the right value.

##### mshots_ctl.sh stop doesn't work

I'm not sure why `mshots_ctl.sh stop` doesn't work in the container, but you can emulate it with the `npm run stop` command.

#### ENOSPC

```
npm ERR! nospc ENOSPC: no space left on device, mkdir '/var/www/.npm/_cacache'
npm ERR! nospc There appears to be insufficient space on your system to finish.
npm ERR! nospc Clear up some disk space and try again.
```

Try `docker image prune` to remove old images.