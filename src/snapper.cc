
#include "./snapper.h"

using namespace v8;

Snapper::Snapper(): QObject(), m_blacklist( this ), m_filename( "" ), m_width( constWidth ), m_height( constHeight ), m_url( "" ) {

	connect( m_page.mainFrame(), SIGNAL( loadFinished( bool ) ), this, SLOT( frameLoad( bool ) ) );
	connect( &m_page, SIGNAL( loadProgress( int ) ), this, SLOT( loadProgress( int ) ) );
	connect( &m_page, SIGNAL( downloadRequested( QNetworkRequest ) ), this, SLOT( downloadRequested( QNetworkRequest ) ) );
	connect( &m_page, SIGNAL( unsupportedContent( QNetworkReply* ) ), this, SLOT( unsupportedContent( QNetworkReply* ) ) );

	connect( m_page.networkAccessManager(), SIGNAL( sslErrors( QNetworkReply*, const QList<QSslError> & ) ),
			this, SLOT( handleSslErrors( QNetworkReply*, const QList<QSslError> & ) ) );

	connect( m_page.networkAccessManager(), SIGNAL( authenticationRequired( QNetworkReply*, QAuthenticator* ) ),
			this, SLOT(handleAuthentication( QNetworkReply*, QAuthenticator* ) ) );

	connect( &m_blacklist, SIGNAL( permitSignal( int ) ), this, SLOT( permitURL( int ) ) );
}

void Snapper::loadProgress( int p_progress ) {
	m_progress = p_progress;
}

void Snapper::downloadRequested( QNetworkRequest request ) {
	this->setBlankPage();
	QString content_type = request.header(QNetworkRequest::ContentTypeHeader).toString();

	std::cerr << m_url.toString().toStdString().data() << ": downloadRequested: "
				<< request.url().toString().toStdString().data() << std::endl;
	std::cerr << content_type.toStdString().data() << std::endl;
}

void Snapper::unsupportedContent( QNetworkReply* reply ) {
	QString content_type = reply->header(QNetworkRequest::ContentTypeHeader).toString();
	reply->abort();

	if ( m_filename.isEmpty() )
		return;

	try {
		if ( content_type.contains( "video/" ) ) {
			if ( QFile( m_filename ).exists() )
				QFile( m_filename ).remove();
			QFile( "./public_html/icons/video.jpg" ).copy( m_filename );
		} else if ( content_type.contains( "audio/" ) ) {
			if ( QFile( m_filename ).exists() )
				QFile( m_filename ).remove();
			QFile( "./public_html/icons/audio.jpg" ).copy( m_filename );
		} else if ( content_type.contains( "application/x-rar-compressed" ) ||
					content_type.contains( "application/x-tar" ) ||
					content_type.contains( "application/x-gtar" ) ||
					content_type.contains( "application/zip" ) ) {
			if ( QFile( m_filename ).exists() )
				QFile( m_filename ).remove();
			QFile( "./public_html/icons/archive.jpg" ).copy( m_filename );
		} else {
			if ( QFile( m_filename ).exists() )
				QFile( m_filename ).remove();
			QFile( "./public_html/icons/document.jpg" ).copy( m_filename );
		}
		// we need to do this to prevent the savePage slot from trying to overwrite the file in saveAsNotFound()
		this->m_filename = "";
	}
	catch (std::exception& ex) {
		this->m_filename = "";
		std::cerr << "exception" << ex.what() << std::endl;
	}
}

void Snapper::setTargetSize( const double &p_width, const double &p_height ) {
	m_width = p_width;
	m_height = p_height;
}

void Snapper::setCallbackFunction( Persistent<Function> p_callback ) {
	m_callback = p_callback;
}

void Snapper::handleAuthentication( QNetworkReply* reply, QAuthenticator* auth ) {
	reply->abort();
	if ( QFile( m_filename ).exists() )
		QFile( m_filename ).remove();
	QFile( "./public_html/icons/403.jpg" ).copy( m_filename );

	const unsigned argc = 2;
	QString err_msg = "This URL (";
	err_msg += m_url.toString().toStdString().data();
	err_msg += ") requires authentication. Using default 403 image.";
	Handle<Value> argv[argc] = { String::New( err_msg.toStdString().data() ), Number::New( GENERAL_ERROR ) };
	this->m_callback->Call( Context::GetCurrent()->Global(), argc, argv );
	this->m_callback.Dispose();
}

void Snapper::saveAsNotFound() {
	if ( ! m_filename.isEmpty() ) {
		if ( QFile( m_filename ).exists() ) {
			QFile( m_filename ).remove();
		}
		QFile( "./public_html/icons/404.jpg" ).copy( m_filename );

		struct timeval tval;
		struct timezone tz;
		int retval = gettimeofday(&tval, &tz);

		if ( retval == 0 ) {
			utimbuf newtimes;
			newtimes.actime = tval.tv_sec - 82800;
			newtimes.modtime = newtimes.actime;
			retval = utime(m_filename.toStdString().data(), &newtimes);
		}
	}
}

void Snapper::handleSslErrors( QNetworkReply* reply, const QList<QSslError> &errors ) {
	foreach ( QSslError err, errors ) {
		std::cerr << m_url.toString().toStdString().data() << ": ssl error: "
				<< err.errorString().toStdString().data() << std::endl;
	}
	reply->ignoreSslErrors();
}

void Snapper::validate_path() {
	if ( m_filename.contains( "/" ) ) {
		QString sdirname = m_filename.left( m_filename.lastIndexOf( "/" ) );
		QDir file_directory( sdirname );
		if ( ! file_directory.exists() ) {
			file_directory.mkpath( "." );
		}
	} else if  ( m_filename.contains( "\\" ) ) {
		QString sdirname = m_filename.left( m_filename.lastIndexOf( "\\" ) );
		QDir file_directory( sdirname );
		if ( ! file_directory.exists() ) {
			file_directory.mkpath( "." );
		}
	}
}

void Snapper::stopLoading() {
	m_page.triggerAction( QWebPage::Stop );
    m_page.triggerAction( QWebPage::StopScheduledPageRefresh );
}

void Snapper::load( const QUrl &p_url, const QString &p_filename ) {
	try {
		if ( m_width > constWidth ) {
			const unsigned argc = 2;
			QString err_msg = "The width of the page is greater than the surface provided by the window manager.\nRequested a width of ";
			err_msg += QString::number( m_width ) + ", but only have a surface of " + QString::number( constWidth ) + " available.";
			Handle<Value> argv[argc] = { String::New( err_msg.toStdString().data() ), Number::New( GENERAL_ERROR ) };
			this->m_callback->Call( Context::GetCurrent()->Global(), argc, argv );
			this->m_callback.Dispose();
			return;
		}
		m_filename = p_filename;
		m_url.setUrl( p_url.toString() );
		m_blacklist.permitURL( p_url );
	}
	catch ( std::exception& ) {
		this->saveAsNotFound();
		const unsigned argc = 2;
		QString err_msg = "Unknown error processing the Blacklist DNS call: ";
		err_msg += m_url.toString().toStdString().data();
		Handle<Value> argv[argc] = { String::New( err_msg.toStdString().data() ), Number::New( GENERAL_ERROR ) };
		this->m_callback->Call( Context::GetCurrent()->Global(), argc, argv );
		this->m_callback.Dispose();
	}
}

void Snapper::permitURL( int returnCode ) {
	try {
		this->validate_path();
		if ( HOST_PERMITTED == returnCode ) {
			b_MainLoaded = false;
			m_page.mainFrame()->load( m_url );
		} else {
			this->saveAsNotFound();
			const unsigned argc = 2;
			QString err_msg = "";
			switch ( returnCode ) {
				case HOST_NO_DNS:
					err_msg = "The requested host has no DNS entry: ";
					break;
				case HOST_BLACKLISTED:
					err_msg = "The requested host was blocked, as it is Blacklisted: ";
					break;
				case HOST_INVALIDSCHEMA:
					err_msg = "The requested host schema is not allowed: ";
					break;
				case HOST_INVALID:
					err_msg = "The requested host is invalid: ";
					break;
				default:
					err_msg = "The requested host was blocked: ";
			}
			if ( 0 == m_url.host().length() )
				err_msg += m_url.toString().toStdString().data();
			else
				err_msg += m_url.host().toStdString().data();
			Handle<Value> argv[argc] = { String::New( err_msg.toStdString().data() ), Number::New( returnCode ) };
			this->m_callback->Call( Context::GetCurrent()->Global(), argc, argv );
			this->m_callback.Dispose();
		}
	}
	catch ( std::exception& ) {
		this->saveAsNotFound();
		const unsigned argc = 2;
		QString err_msg = "Error initialising the load of the URL: ";
		err_msg += m_url.toString().toStdString().data();
		Handle<Value> argv[argc] = { String::New( err_msg.toStdString().data() ), Number::New( GENERAL_ERROR ) };
		this->m_callback->Call( Context::GetCurrent()->Global(), argc, argv );
		this->m_callback.Dispose();
	}
}

void Snapper::setBlankPage() {
	m_filename = "";
	m_page.mainFrame()->setHtml( "<!doctype html><html><head><title>Place Holder</title></head><body></body></html>" );
}

void Snapper::reloadBlacklist() {
	m_blacklist.reload();
}

void Snapper::mainLoad( bool okay ) {
	// unused, but kept for possible future use
	b_MainLoaded = okay;
}

void Snapper::frameLoad( bool okay ) {
	m_progress = 0;
	if ( okay || m_forceSnapshot ) {
		m_forceSnapshot = false;
		// filename not supplied (setBlankPage call or a Snapper object unload event)
		if ( m_filename.isEmpty() || m_url.isEmpty() ) {
			return;
		}
		const unsigned argc = 2;
		Handle<Value> argv[argc] = { String::New( "" ), Number::New( SUCCESS ) };
		this->m_callback->Call( Context::GetCurrent()->Global(), argc, argv );
		this->m_callback.Dispose();
	} else {
		this->saveAsNotFound();
		const unsigned argc = 2;
		QString err_msg = "Error in loading the URL: ";
		err_msg += m_url.toString().toStdString().data();
		Handle<Value> argv[argc] = { String::New( err_msg.toStdString().data() ), Number::New( GENERAL_ERROR ) };
		this->m_callback->Call( Context::GetCurrent()->Global(), argc, argv );
		this->m_callback.Dispose();
	}
}

void Snapper::saveThumbnail( const QUrl &p_url, const QString &p_filename, const double &p_width, const double &p_height ) {
	// make sure this function is called for the pre-prepared URL
	if ( ( m_width == p_width ) && ( m_height == p_height ) && ( p_filename == m_filename ) ) {
		QImage m_image = QImage( QSize( m_width, m_height ), QImage::Format_RGB888 );
		m_image.fill( Qt::transparent );
		QPainter *painter = new QPainter( &m_image );
		painter->setRenderHint( QPainter::SmoothPixmapTransform, true );
		m_page.setViewportSize( QSize( m_width, m_height ) );
		m_page.mainFrame()->render( painter );
		painter->end();
		delete painter;

		if ( ! m_filename.isEmpty() ) {
			if ( m_image.save( m_filename, "jpg", 90 ) ) {
                const unsigned argc = 2;
				Handle<Value> argv[argc] = { String::New( "" ), Number::New( SUCCESS ) };
				this->m_callback->Call( Context::GetCurrent()->Global(), argc, argv );
				this->m_callback.Dispose();
			} else {
				const unsigned argc = 2;
				Handle<Value> argv[argc] = { String::New( "Failed to save the snapshot image file." ),  Number::New( GENERAL_ERROR ) };
				this->m_callback->Call( Context::GetCurrent()->Global(), argc, argv );
				this->m_callback.Dispose();
			}
		}
	} else {
		const unsigned argc = 2;
		QString err_msg = "Incorrect parameters for 'saveThumbnail': ";
		err_msg += m_filename.toStdString().data();
		err_msg += " = ";
		err_msg += p_filename.toStdString().data();
		err_msg += ", ";
		err_msg += QString::number( m_width ).toStdString().data();
		err_msg += " = ";
		err_msg += QString::number( p_width ).toStdString().data();
		err_msg += ", ";
		err_msg += QString::number( m_height ).toStdString().data();
		err_msg += " = ";
		err_msg += QString::number( p_height ).toStdString().data();
		Handle<Value> argv[argc] = { String::New( err_msg.toStdString().data() ), Number::New( GENERAL_ERROR ) };
		this->m_callback->Call( Context::GetCurrent()->Global(), argc, argv );
		this->m_callback.Dispose();
	}
}

