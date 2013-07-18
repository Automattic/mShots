
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
    if(fd > 0)
    	write( fd, sbuff, bytes );
    write( STDERR_FD, sbuff, bytes);

    size = backtrace(array, 32);
    if(fd > 0)
    	backtrace_symbols_fd( array, size, fd );
    backtrace_symbols_fd( array, size, STDERR_FD );

    close( fd );
    exit( -1 );
}

static QUrl UrlFromString( const QString &string )
{
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

Handle<Value> Exit( const Arguments& args ) {
	HandleScope scope;
	if ( NULL != websnap ) {
		websnap->stopLoading();
		websnap->setBlankPage();
		websnap->deleteLater();
	}
	if ( NULL != app )
		app->quit();
	return scope.Close( Undefined() );
}

Handle<Value> AbortDownload( const Arguments& args ) {
	HandleScope scope;
	if ( NULL != websnap ) {
		websnap->stopLoading();
		websnap->setBlankPage();
	}
	return scope.Close( Undefined() );
}

Handle<Value> stopLoadingPage( const Arguments& args ) {
	HandleScope scope;
	if ( NULL != websnap ) {
		websnap->stopLoading();
	}
	return scope.Close( Undefined() );
}

Handle<Value> setForceSnapshot( const Arguments& args ) {
	HandleScope scope;
	if ( NULL != websnap ) {
		websnap->setForceSnapshot();
	}
	return scope.Close( Undefined() );
}

Handle<Value> pageLoadProgress( const Arguments& args ) {
	HandleScope scope;
	if ( NULL != websnap )
		return scope.Close( Number::New( websnap->pageLoadProgress() ) );
	else
		return scope.Close( Number::New( 0 ) );
}

Handle<Value> SetBlankPage( const Arguments& args ) {
	HandleScope scope;
	if ( NULL != websnap ) {
		websnap->setBlankPage();
	}
	return scope.Close( Undefined() );
}

Handle<Value> ReloadBlacklistConfig( const Arguments& args ) {
	HandleScope scope;
	if ( NULL != websnap ) {
		websnap->reloadBlacklist();
	}
	return scope.Close( Undefined() );
}

Handle<Value> ProcessEvents( const Arguments& args ) {
	HandleScope scope;
	if ( app->hasPendingEvents() )
		app->processEvents();
	return scope.Close( Undefined() );
}

Handle<Value> SaveThumb( const Arguments& args ) {
	HandleScope scope;

	if (args.Length() < 5) {
		ThrowException( Exception::TypeError( String::New( "Wrong number of arguments" ) ) );
		return scope.Close( Undefined() );
	}

	if ( ! args[2]->IsNumber() || ! args[3]->IsNumber() ) {
		ThrowException( Exception::TypeError( String::New( "The width and height arguments are not valid") ) );
		return scope.Close( Undefined() );
	}

	if ( ! args[4]->IsFunction() ) {
		ThrowException( Exception::TypeError( String::New( "You have not provided a callback function as the 4th parameter" ) ) );
		return scope.Close( Undefined() );
	}

	try {
		String::AsciiValue sURL( args[0]->ToString() );
		QString pURL = *sURL;
		String::AsciiValue sFileName( args[1]->ToString() );
		QString pFileName = *sFileName;

		websnap->setCallbackFunction( Persistent<Function>::New( Local<Function>::Cast( args[4] ) ) );
		websnap->saveThumbnail( UrlFromString( pURL ), pFileName, args[2]->NumberValue(), args[3]->NumberValue() );
	}
	catch (std::exception ex) {
		ThrowException(Exception::TypeError( String::New( "Failed to load the url" ) ) );
	}
	return scope.Close( Undefined() );
}

Handle<Value> LoadPage( const Arguments& args ) {
	HandleScope scope;

	if ( args.Length() < 5 ) {
		ThrowException(Exception::TypeError( String::New( "Wrong number of arguments" ) ) );
		return scope.Close( Undefined() );
	}

	if ( ! args[2]->IsNumber() || ! args[3]->IsNumber() ) {
		ThrowException( Exception::TypeError( String::New( "The width and height arguments are not valid" ) ) );
		return scope.Close( Undefined() );
	}

	if ( ! args[4]->IsFunction() ) {
		ThrowException( Exception::TypeError( String::New( "You have not provided a callback function as the 4th parameter" ) ) );
		return scope.Close( Undefined() );
	}

	try {
		String::AsciiValue sURL( args[0]->ToString() );
		QString pURL = *sURL;
		String::AsciiValue sFileName( args[1]->ToString() );
		QString pFileName = *sFileName;

		websnap->setCallbackFunction( Persistent<Function>::New( Local<Function>::Cast( args[4] ) ) );
		websnap->setTargetSize( args[2]->NumberValue(), args[3]->NumberValue() );
		websnap->load( UrlFromString( pURL ), pFileName );
	}
	catch (std::exception ex) {
		ThrowException( Exception::TypeError( String::New( "Failed to load the url" ) ) );
	}
	return scope.Close( Undefined() );
}

void Initialise( Handle<Object> exports) {
	exports->Set( String::NewSymbol( "load_page" ), FunctionTemplate::New( LoadPage )->GetFunction() );
	exports->Set( String::NewSymbol( "save_thumbnail" ), FunctionTemplate::New( SaveThumb )->GetFunction() );
	exports->Set( String::NewSymbol( "exit" ), FunctionTemplate::New( Exit )->GetFunction() );
	exports->Set( String::NewSymbol( "processEvents" ), FunctionTemplate::New( ProcessEvents )->GetFunction() );
	exports->Set( String::NewSymbol( "abortDownload" ), FunctionTemplate::New( AbortDownload )->GetFunction() );
	exports->Set( String::NewSymbol( "setBlankPage" ), FunctionTemplate::New( SetBlankPage )->GetFunction() );
	exports->Set( String::NewSymbol( "stopLoadingPage" ), FunctionTemplate::New( stopLoadingPage )->GetFunction() );
	exports->Set( String::NewSymbol( "setForceSnapshot" ), FunctionTemplate::New( setForceSnapshot )->GetFunction() );
	exports->Set( String::NewSymbol( "pageLoadProgress" ), FunctionTemplate::New( pageLoadProgress )->GetFunction() );
	exports->Set( String::NewSymbol( "reloadBlacklistConfig" ), FunctionTemplate::New( ReloadBlacklistConfig )->GetFunction() );

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

