
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

3) Run `npm install` in the `/opt/mshots/` directory.

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

