
#ifndef BUILDING_NODE_EXTENSION
#define BUILDING_NODE_EXTENSION
#endif

#include <iostream>
#include <exception>
#include <unistd.h>

#include <execinfo.h>
#include <stdlib.h>
#include <errno.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <assert.h>
#include <stdarg.h>
#include <signal.h>

#include <node.h>

using namespace v8;

#include <QtWidgets/QApplication>
#include <QUrl>

#include "./snapper.h"

#define STDERR_FD 2
//#define LOG_SEGFAULTS	// uncomment to log (Qt) segfaults to the logs directory

QApplication *app = NULL;
Snapper *websnap = NULL;
int counter = 0;

static void segfault_handler( int sig, siginfo_t *si, void *unused ) {
    void    *array[32];
    size_t  size;
    char    sbuff[128];
    int     bytes;
    int     fd = 0;
    time_t  now;
    int     pid;

    time( &now );
    pid = getpid();
    snprintf( sbuff, sizeof( sbuff ), "./logs/stacktrace-%d-%d.log", (int)now, pid );

	#ifdef LOG_SEGFAULTS
    	fd = open(sbuff, O_CREAT | O_APPEND | O_WRONLY, S_IRUSR | S_IRGRP | S_IROTH);
	#endif

    bytes = snprintf(sbuff, sizeof( sbuff ), "PID %d received SIGSEGV for address: 0x%lx\n", pid, (long) si->si_addr);
    if ( fd > 0 )
    	write( fd, sbuff, bytes );
    write( STDERR_FD, sbuff, bytes );

    size = backtrace( array, 32 );
    if ( fd > 0 )
    	backtrace_symbols_fd( array, size, fd );
    backtrace_symbols_fd( array, size, STDERR_FD );

    close( fd );
    exit( -1 );
}

static QUrl UrlFromString( const QString &string ) {
	QString urlStr = string.trimmed();
	QRegExp test( QLatin1String( "^[a-zA-Z]+\\:.*" ) );

	bool hasSchema = test.exactMatch( urlStr );
	if ( hasSchema ) {
		QUrl url( urlStr, QUrl::TolerantMode );
		if ( url.isValid() )
		return url;
	} else {
		int dotIndex = urlStr.indexOf( QLatin1Char( '.' ) );
		if ( -1 != dotIndex ) {
			QString prefix = urlStr.left( dotIndex ).toLower();
			QString schema = ( prefix == QLatin1String( "ftp" ) ) ? prefix : QLatin1String( "http" );
			QUrl url( schema + QLatin1String( "://" ) + urlStr, QUrl::TolerantMode );
			if ( url.isValid() )
				return url;
		}
	}
	return QUrl( string, QUrl::TolerantMode );
}

void Exit( const v8::FunctionCallbackInfo<v8::Value>& info ) {
	if ( NULL != websnap ) {
		websnap->stopLoading();
		websnap->setBlankPage();
		websnap->deleteLater();
	}
	if ( NULL != app )
		app->quit();

	info.GetReturnValue().SetUndefined();
}

void AbortDownload( const v8::FunctionCallbackInfo<v8::Value>& info ) {
	if ( NULL != websnap ) {
		websnap->stopLoading();
		websnap->setBlankPage();
	}
	info.GetReturnValue().SetUndefined();
}

void stopLoadingPage( const v8::FunctionCallbackInfo<v8::Value>& info ) {
	if ( NULL != websnap ) {
		websnap->stopLoading();
	}
	info.GetReturnValue().SetUndefined();
}

void setForceSnapshot( const v8::FunctionCallbackInfo<v8::Value>& info ) {
	if ( NULL != websnap ) {
		websnap->setForceSnapshot();
	}
	info.GetReturnValue().SetUndefined();
}

void pageLoadProgress( const v8::FunctionCallbackInfo<v8::Value>& info ) {
	if ( NULL != websnap )
		info.GetReturnValue().Set( websnap->pageLoadProgress() );
	else
		info.GetReturnValue().Set( 0 );
}

void SetBlankPage( const v8::FunctionCallbackInfo<v8::Value>& info ) {
	if ( NULL != websnap ) {
		websnap->setBlankPage();
	}
	info.GetReturnValue().SetUndefined();
}

void ReloadBlacklistConfig( const v8::FunctionCallbackInfo<v8::Value>& info ) {
	if ( NULL != websnap ) {
		websnap->reloadBlacklist();
	}
	info.GetReturnValue().SetUndefined();
}

void ReloadConfig( const v8::FunctionCallbackInfo<v8::Value>& info ) {
	if ( NULL != websnap ) {
		websnap->reloadConfig();
	}
	info.GetReturnValue().SetUndefined();
}

void ProcessEvents( const v8::FunctionCallbackInfo<v8::Value>& info ) {
	if ( app->hasPendingEvents() )
		app->processEvents();
	info.GetReturnValue().SetUndefined();
}

void SaveThumb( const v8::FunctionCallbackInfo<v8::Value>& args ) {
	args.GetReturnValue().SetUndefined();
	Isolate* isolate = args.GetIsolate();
	HandleScope scope( isolate );

	if ( args.Length() < 5 ) {
		isolate->ThrowException( Exception::TypeError(
			String::NewFromUtf8( isolate, "Wrong number of arguments" ) ) );
		return;
	}

	if ( ! args[2]->IsNumber() || ! args[3]->IsNumber() ) {
		isolate->ThrowException( Exception::TypeError(
			String::NewFromUtf8( isolate, "The width and height arguments are not valid" ) ) );
		return;
	}

	if ( ! args[4]->IsFunction() ) {
		isolate->ThrowException( Exception::TypeError(
			String::NewFromUtf8( isolate, "You have not provided a callback function as the 4th parameter" ) ) );
		return;
	}

	try {
		String::Utf8Value sURL( args[0]->ToString() );
		QString pURL = *sURL;
		String::Utf8Value sFileName( args[1]->ToString() );
		QString pFileName = *sFileName;

		Local<Function> cb = Local<Function>::Cast( args[4] );
		CopyablePersistentTraits<Function>::CopyablePersistent percy( isolate, cb );

		websnap->setCallbackFunction( isolate, percy );
		websnap->saveThumbnail( UrlFromString( pURL ), pFileName, args[2]->NumberValue(), args[3]->NumberValue() );
	}
	catch (std::exception ex) {
		isolate->ThrowException(Exception::TypeError(
			String::NewFromUtf8( isolate, "Failed to load the url" ) ) );
	}
}

void LoadPage( const v8::FunctionCallbackInfo<v8::Value>& args ) {
	args.GetReturnValue().SetUndefined();
	Isolate* isolate = args.GetIsolate();
	HandleScope scope( isolate );

	if ( args.Length() < 5 ) {
		isolate->ThrowException(Exception::TypeError(
			String::NewFromUtf8( isolate, "Wrong number of arguments" ) ) );
		return;
	}

	if ( ! args[2]->IsNumber() || ! args[3]->IsNumber() ) {
		isolate->ThrowException( Exception::TypeError(
			String::NewFromUtf8( isolate, "The width and height arguments are not valid" ) ) );
		return;
	}

	if ( ! args[4]->IsFunction() ) {
		isolate->ThrowException( Exception::TypeError(
			String::NewFromUtf8( isolate, "You have not provided a callback function as the 4th parameter" ) ) );
		return;
	}

	try {
		String::Utf8Value sURL( args[0]->ToString() );
		QString pURL = *sURL;
		String::Utf8Value sFileName( args[1]->ToString() );
		QString pFileName = *sFileName;

		Local<Function> cb = Local<Function>::Cast( args[4] );
		CopyablePersistentTraits<Function>::CopyablePersistent percy( isolate, cb );

		websnap->setCallbackFunction( isolate, percy );
		websnap->setTargetSize( args[2]->NumberValue(), args[3]->NumberValue() );
		websnap->load( UrlFromString( pURL ), pFileName );
	}
	catch (std::exception ex) {
		isolate->ThrowException( Exception::TypeError(
			String::NewFromUtf8( isolate, "Failed to load the url" ) ) );
	}
}

void Initialise( Handle<Object> exports) {
	NODE_SET_METHOD( exports, "load_page", LoadPage );
	NODE_SET_METHOD( exports, "save_thumbnail", SaveThumb );
	NODE_SET_METHOD( exports, "exit", Exit );
	NODE_SET_METHOD( exports, "processEvents", ProcessEvents );
	NODE_SET_METHOD( exports, "abortDownload", AbortDownload );
	NODE_SET_METHOD( exports, "setBlankPage", SetBlankPage );
	NODE_SET_METHOD( exports, "stopLoadingPage", stopLoadingPage );
	NODE_SET_METHOD( exports, "setForceSnapshot", setForceSnapshot );
	NODE_SET_METHOD( exports, "pageLoadProgress", pageLoadProgress );
	NODE_SET_METHOD( exports, "reloadBlacklistConfig", ReloadBlacklistConfig );
	NODE_SET_METHOD( exports, "reloadConfig", ReloadConfig );

	struct sigaction sa;
    memset( &sa, 0, sizeof( struct sigaction ) );
    sigemptyset( &sa.sa_mask );
    sa.sa_sigaction = segfault_handler;
    sa.sa_flags = SA_SIGINFO;
    sigaction( SIGSEGV, &sa, NULL );

	int argc = 0;
	char** argv = NULL;
	app = new QApplication( argc, argv );

	websnap = new Snapper();

	app->processEvents();
}

NODE_MODULE(snapper, Initialise)

