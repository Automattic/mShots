#!/bin/bash

### BEGIN INIT INFO
# Provides:          mShots.JS
# Required-Start:
# Required-Stop:
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Start/stop mShots.JS
# Description:       Start/stop the mShots service.
### END INIT INFO

# installation directory
INSTALL_DIR=/opt/mshots
# port to run the mShots.JS service on
PORT=7777
# number of workers to put to work
WORKERS="20"

function startservice {
	if [ ! -d ${INSTALL_DIR} ]; then
		echo "mShots.JS is not installed in the correct directory: ${INSTALL_DIR}"
		exit 1
	fi
	if [ ! -f "${INSTALL_DIR}/lib/snapper.node" ]; then
		if [ ! -f "${INSTALL_DIR}/build/Release/snapper.node" ]; then
			echo "Please build the Snapper Node module, before running the mShots.JS service."
			echo "> cd ${INSTALL_DIR}; node-gyp configure; node-gyp build"
			exit 1
		else
			cp "${INSTALL_DIR}/build/Release/snapper.node" "${INSTALL_DIR}/lib/snapper.node"
		fi
	else
		if [ -f "${INSTALL_DIR}/build/Release/snapper.node" ]; then
			checkDiff1=`md5sum "${INSTALL_DIR}/build/Release/snapper.node" | awk ' { print $(1) } '`
			checkDiff2=`md5sum "${INSTALL_DIR}/lib/snapper.node" | awk ' { print $(1) } '`
			if [ ! "x$checkDiff1" == "x$checkDiff2" ]; then
				cp "${INSTALL_DIR}/build/Release/snapper.node" "${INSTALL_DIR}/lib/snapper.node"
			fi
		fi
	fi
	pid="`ps -ef | grep 'mShots.JS - Master' | grep -v 'grep' | awk ' { print $(2) }'`"
	if [ -z $pid ]; then
		pid=0
	fi
	if [ $pid -gt 0 ] ; then
		echo "mShots.JS service is already running"
		exit 1
	fi
	running=`lsmod | grep vfb | awk '{ print $(1) }'`
	if [ -z $running ] ; then
		echo "loading vfb"
		modprobe -r vfb
		modprobe vfb vfb_enable=yes videomemorysize=7733248
		fbset 1600x1200-76 -depth 24 -accel true
	else
		echo "vfb already loaded, skipping"
	fi
	# create the required log directories
	if [ ! -d "${INSTALL_DIR}/logs" ]; then
		mkdir "${INSTALL_DIR}/logs"
	fi
	if [ ! -d "${INSTALL_DIR}/stats" ]; then
		mkdir "${INSTALL_DIR}/stats"
	fi
	if [ -z "$PORT" ]; then
		echo "PORT not specified. Define it on this script"
		exit 1
	fi

	pid="`ps -ef | grep 'mShots.JS - Worker' | grep -v 'grep' | awk 'NR==1 { print $(2) }'`"
	if [ -z $pid ]; then
		pid=0
	else
		echo "Some orphaned Worker threads found from a previous Master:"
	fi
	while [ $pid -gt 0  ]; do
		echo "Killing orphaned Worker thread: $pid"
		kill -s 9 $pid
		pid="`ps -ef | grep 'mShots.JS - Worker' | grep -v 'grep' | awk 'NR==1 { print $(2) }'`"
		if [ -z $pid ]; then
			pid=0
		fi
	done
	echo "Starting mShots.JS"
    (
        su - wpcom -c "bash -c 'cd ${INSTALL_DIR} ; ( /usr/local/bin/node ${INSTALL_DIR}/lib/mshots.js -p $PORT -n $WORKERS 2>&1 )&'"
        sleep 1
        pid="`ps -ef | grep 'mShots.JS - Master' | grep -v 'grep' | awk ' { print $(2) }'`"
        if [ -z $pid ]; then
            pid=0
        fi
        echo $pid > /var/run/mshots.pid
    )
}

function stopservice {
	pid="`ps -ef | grep 'mShots.JS - Master' | grep -v 'grep' | awk ' { print $(2) }'`"
	if [ -z $pid ]; then
		pid=0
	fi
	if [ $pid -gt 0 ]; then
		echo "Sending the master mShots.JS process the shutdown signal."
		kill -s 1 $pid
		sleep 3
	else
		echo "There is no mShots.JS Master process running."
		echo "checking for orphaned Workers."
		pid="`ps -ef | grep 'mShots.JS - Worker' | grep -v 'grep' | awk 'NR==1 { print $(2) }'`"
		if [ -z $pid ]; then
			pid=0
			echo "No orphaned Workers found."
		fi
		while [ $pid -gt 0  ]; do
			echo "Killing orphaned Worker thread: $pid"
			kill -s 9 $pid
			pid="`ps -ef | grep 'mShots.JS - Worker' | grep -v 'grep' | awk 'NR==1 { print $(2) }'`"
			if [ -z $pid ]; then
				pid=0
			fi
		done
	fi
	rm -f /var/run/mshots.pid
}

function reload_config {
	pid="`ps -ef | grep 'mShots.JS - Master' | grep -v 'grep' | awk ' { print $(2) }'`"
	if [ -z $pid ]; then
		pid=0
	fi
	if [ $pid -gt 0 ]; then
		echo "Sending the master mShots.JS process the reload signal."
		kill -s SIGUSR2 $pid
	else
		echo "There is no mShots.JS Master process running to receive the reload signal."
	fi
}

case "$1" in
start )
	startservice
	;;
stop )
	# Sends the Master Thread a SIGHUP signal to shutdown the slaves and exit
	stopservice
	;;
restart )
	stopservice
	sleep 2
	startservice
	;;
reload )
	reload_config
	;;
* )
	echo "Usage:$0 start|stop|restart|reload"
	exit 1
	;;
esac
exit 0
