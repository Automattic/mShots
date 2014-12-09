
mshots
=========

Overview
--------
This application is split into four distinct components, the mshots PHP class (receiving requests from the WordPress mshots plugin),
the node.JS cluster service to manage the filtered incoming requests passed on from the mshots class, the native node.JS module,
Snapper, which performs the actual snapshot generation, which runs X-less in the CLI server environment on Debian Linux (Wheezy).
Note: The virtual frame buffer Kernel module (VFB) is required for the service.

Installation for Development (Debian Wheezy)
--------------------------------------------

If anything goes awry or is unclear in one of these steps, take a look at the "Details" section below for slightly more detailed info.

1) Install the latest node.js binaries from http://nodejs.org

2) Place the mshots folder in "/opt/", so the final path is "/opt/mshots/".

3) You will need to install the latest Qt libraries for your distro.

5) mshots requires a logging library, install this with "sudo npm install log4js", while in the mshots root directory "/opt/mshots".

6) While in the mshots root directory ("/opt/mshots"), run "sudo node-gyp rebuild". If node-gyp is not installed, run:

	> sudo npm install -g node-gyp

7) You are now ready to run the mshots service with "./mshots_ctl.sh start|stop". Note: The virtual frame buffer Kernel module (VFB) is required.

Details
-------

**The mshots PHP Class (code in "public_html")**

This class is designed to buffer the thumbnail requests, by limiting snapshots to only be taken every 24 hours. The most useful attribute
of this class is the "disable_requeue" constant, but changing this to true you effectively stop all calls to the mshots service, which
can be used if the service misbehaves for any reason. With this setting changed existing thumbnails will be served, but no new thumbnails
are generated.

**Snapper node.JS Module (code in "src")**

To compile the node module you will need to follow the following steps:

- Install node.JS from http://nodejs.org
- Once this is installed confirm node-gyp is installed by typing "node-gyp -v" at the command prompt.
	If it is not installed, install it with the command:

	> sudo npm install -g node-gyp
- For the compilation of the module you need the Qt5 header and Qt library files. These are provided by your distribution or are available from the qt-project.com website.
- If you are installing onto Debian you will need to ensure that libssl is installed before proceeding to the next step.

	> sudo apt-get install openssl
- To compile the Snapper node module you, whilst in the root of the mshots directory, run:

	> sudo node-gyp configure

	> sudo node-gyp build

	The resulting file will be in the build/Release/ directory and should be copied to the /opt/mshots/lib/ directory.

**mshots node.JS Program (code in "lib")**

The node program has two dependencies, the Snapper module above and the log4js module for program logging.
- At the prompt, change to the root directory of mshots, install the log4js module with the command "npm install log4js".
- Control the execution of the program with the mshots_ctl.sh bash script in the root directory or by manually running the following command from the terminal, whilst in the mshots root directory:

	> node lib/mshots -p portnumber -n numworkers

**QtWebKit**

As mentioned above, the service requires the installation of the Qt libraries. Please install these for your platform before running
