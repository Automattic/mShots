
#include "./snapper.h"
#include <QCryptographicHash>

using namespace v8;

Snapper::Snapper(): QObject(), /*m_webview( NULL ),*/ m_page( NULL ), m_blacklist( this ), m_filename( "" ), m_width( maxWidth ), m_height( maxHeight ),
					m_progress( 0 ), m_url( "" ), m_forceSnapshot( false), m_redirecting( false ), m_redirect_count( 0 ) {
	m_gate_keeper = new AccessManager( this );
	m_gate_keeper->set_blacklister( &this->m_blacklist );

	connect( m_gate_keeper, SIGNAL( finished( QNetworkReply* ) ), this, SLOT( onNetworkRequestFinished( QNetworkReply* ) ) );
	connect( m_gate_keeper, SIGNAL( authenticationRequired( QNetworkReply*, QAuthenticator* ) ),
			this, SLOT(handleAuthentication( QNetworkReply*, QAuthenticator* ) ) );
	connect( m_gate_keeper, SIGNAL( sslErrors( QNetworkReply*, const QList<QSslError> & ) ),
			this, SLOT( handleSslErrors( QNetworkReply*, const QList<QSslError> & ) ) );

	connect( &m_blacklist, SIGNAL( permitSignal( int ) ), this, SLOT( permitURL( int ) ) );

	this->loadConfig();
}

void Snapper::initWebpage() {
	if ( m_page )
		delete m_page;
	//if ( m_webview )
	//	delete m_webview;
	//m_webview = new QWebView();
	m_page = new WebPage( m_user_agent );
	//m_webview->setPage( m_page );
	m_page->setNetworkAccessManager( m_gate_keeper );

	connect( m_page, SIGNAL( loadProgress( int ) ), this, SLOT( loadProgress( int ) ) );
	connect( m_page, SIGNAL( downloadRequested( QNetworkRequest ) ), this, SLOT( downloadRequested( QNetworkRequest ) ) );
	connect( m_page, SIGNAL( unsupportedContent( QNetworkReply* ) ), this, SLOT( unsupportedContent( QNetworkReply* ) ) );
}

void Snapper::loadProgress( int p_progress ) {
	m_progress = p_progress;
}

void Snapper::downloadRequested( QNetworkRequest request ) {
	this->setBlankPage();
	QString content_type = request.header( QNetworkRequest::ContentTypeHeader ).toString();

	#ifdef _DEBUG_
	std::cerr << COLOUR_yellow << "downloadRequested:" << COLOUR_normal << " m_filename = " << m_filename.toStdString().data() << std::endl;
	std::cerr << m_url.toString().toStdString().data() << ": downloadRequested: "
				<< request.url().toString().toStdString().data() << std::endl;
	std::cerr << content_type.toStdString().data() << std::endl;
	#endif
}

void Snapper::unsupportedContent( QNetworkReply* reply ) {
	#ifdef _DEBUG_
	std::cerr << COLOUR_yellow << "unsupportedContent:" << COLOUR_normal << " m_filename = " << m_filename.toStdString().data() << std::endl;
	#endif
	QString content_type = reply->header( QNetworkRequest::ContentTypeHeader ).toString();
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

void Snapper::setCallbackFunction( Isolate* isolate, CopyablePersistentTraits<Function>::CopyablePersistent p_callback ) {
	m_callback.Reset( isolate, p_callback );
}

void Snapper::handleAuthentication( QNetworkReply* reply, QAuthenticator* auth ) {
	#ifdef _DEBUG_
	std::cerr << COLOUR_yellow << "handleAuthentication:" << COLOUR_normal << " m_filename = " << m_filename.toStdString().data() << std::endl;
	#endif
	reply->abort();
	if ( m_filename.isEmpty() )
		return;

	if ( QFile( m_filename ).exists() )
		QFile( m_filename ).remove();
	QFile( "./public_html/icons/403.jpg" ).copy( m_filename );

	QString err_msg = "This URL (";
	err_msg += m_url.toString().toStdString().data();
	err_msg += ") requires authentication. Using default 403 image.";
	this->processCallback( err_msg, GENERAL_ERROR );
}

void Snapper::saveAsNotFound() {
	#ifdef _DEBUG_
	std::cerr << COLOUR_yellow << "saveAsNotFound:" << COLOUR_normal << " m_filename = " << m_filename.toStdString().data() << std::endl;
	#endif

	if ( ! m_filename.isEmpty() ) {
		// Only use the 404 image if we do not have a prevous image,
		// which, in the case of an outage, would be a valid snapshot
		if ( ! QFile( m_filename ).exists() ) {
			QFile( "./public_html/icons/404.jpg" ).copy( m_filename );
		}

		struct timeval tval;
		struct timezone tz;
		int retval = gettimeofday(&tval, &tz);

		if ( retval == 0 ) {
			utimbuf newtimes;
			// Keep the "404" for 3600 seconds (1 hour), afterwhich it would
			// be able to be requeued by the mtime check in mshots-class.php
			newtimes.actime = tval.tv_sec - 82800;
			newtimes.modtime = newtimes.actime;
			retval = utime(m_filename.toStdString().data(), &newtimes);
		}
	}
}

void Snapper::handleSslErrors( QNetworkReply* reply, const QList<QSslError> &errors ) {
	#ifdef _DEBUG_
	foreach ( QSslError err, errors ) {
		std::cerr << m_url.toString().toStdString().data() << ": ssl error: "
				<< err.errorString().toStdString().data() << std::endl;
	}
	#endif
	reply->ignoreSslErrors();
}

void Snapper::validate_path() {
	if ( m_filename.contains( "/" ) ) {
		QString sdirname = m_filename.left( m_filename.lastIndexOf( "/" ) );
		QDir file_directory( sdirname );
		if ( ! file_directory.exists() ) {
			file_directory.mkpath( "." );
		}
	} else if ( m_filename.contains( "\\" ) ) {
		QString sdirname = m_filename.left( m_filename.lastIndexOf( "\\" ) );
		QDir file_directory( sdirname );
		if ( ! file_directory.exists() ) {
			file_directory.mkpath( "." );
		}
	}
}

bool Snapper::filenameValid( const QString &p_url ) const {
	QCryptographicHash mdFiver( QCryptographicHash::Md5 );
	mdFiver.addData( p_url.toStdString().c_str(), p_url.length() );
	QString s_filename = mdFiver.result().toHex();

	QStringList url_parts = p_url.split( "://" );
	QString s_host = "";
	if ( url_parts.length() > 1 )
		s_host = url_parts[1].split( "/" )[0];
	else
		s_host = url_parts[0].split( "/" )[0];

	#ifdef _DEBUG_
	std::cerr << "p_url = " << p_url.toStdString().c_str() << " == " << s_filename.toStdString().c_str() << std::endl;
	std::cerr << "s_host = " << s_host.toLower().toStdString().c_str();
	#endif

	QCryptographicHash shaOne( QCryptographicHash::Sha1 );
	shaOne.addData( s_host.toLower().toStdString().c_str(), s_host.length() );
	s_host = shaOne.result().toHex();

	#ifdef _DEBUG_
	std::cerr << s_host.toStdString().c_str() << std::endl;
	#endif

	QString viewport = "";
	if ( m_width != defaultWidth || m_height != defaultHeight )
		viewport = "_" + QString::number( m_width ) + "x" + QString::number( m_height );

	QString c_filename = s_LocationBase + s_host.left( 3 ) + "/" + s_host + "/" + s_filename + viewport + ".jpg";

	#ifdef _DEBUG_
	std::cerr << "check: m_filename = " << c_filename.toStdString().c_str() << std::endl;
	#endif

	return ( c_filename == m_filename );
}

QUrl Snapper::UrlFromString( const QString &string ) const {
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

void Snapper::stopLoading() {
	#ifdef _DEBUG_
	std::cerr << COLOUR_yellow << "stopLoading:" << COLOUR_normal << " m_filename = " << m_filename.toStdString().data() << std::endl;
	#endif
	m_redirecting = false;
	if ( NULL != m_page ) {
		m_page->triggerAction( QWebPage::Stop );
		m_page->triggerAction( QWebPage::StopScheduledPageRefresh );
	}
}

void Snapper::load( const QString &p_url, const QString &p_filename ) {
	try {
		if ( m_width > maxWidth ) {
			QString err_msg = "The width of the page is greater than the surface provided by the window manager.\nRequested a width of ";
			err_msg += QString::number( m_width ) + ", but only have a surface of " + QString::number( maxWidth ) + " available.";
			this->processCallback( err_msg, GENERAL_ERROR );
			return;
		}
		#ifdef _DEBUG_
		std::cerr << "load: m_filename = " << p_filename.toStdString().data() << std::endl;
		#endif
		m_filename = p_filename;
		if ( ! this->filenameValid( p_url ) ) {
			this->processCallback( "The specified filename is not valid.", GENERAL_ERROR );
			return;
		}
		m_url = UrlFromString( p_url );
		m_blacklist.permitURL( m_url );
	}
	catch ( std::exception& ) {
		this->saveAsNotFound();
		QString err_msg = "Unknown error processing the Blacklist DNS call: " + m_url.toString();
		this->processCallback( err_msg, GENERAL_ERROR );
	}
}

void Snapper::permitURL( int returnCode ) {
	try {
		this->validate_path();
		if ( HOST_PERMITTED == returnCode ) {
			this->initWebpage();
			connect( m_page->mainFrame(), SIGNAL( loadFinished( bool ) ), this, SLOT( frameLoad( bool ) ) );
			m_page->mainFrame()->load( m_url );
		} else {
			this->saveAsNotFound();
			QString err_msg = "";
			switch ( returnCode ) {
				case HOST_NO_DNS:
					err_msg = "The requested host has no DNS entry: ";
					break;
				case HOST_BLACKLISTED:
					err_msg = "The requested host was blocked, as it is Blacklisted: ";
					break;
				case HOST_INVALIDSCHEMA:
					err_msg = "The requested host scheme is not allowed: ";
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
			this->processCallback( err_msg, returnCode );
		}
	}
	catch ( std::exception& ) {
		this->saveAsNotFound();
		QString err_msg = "Error initialising the load of the URL: " + m_url.toString();
		this->processCallback( err_msg, GENERAL_ERROR );
	}
}

void Snapper::setBlankPage() {
	#ifdef _DEBUG_
	std::cerr << "setting to Blank Page" << std::endl;
	#endif
	m_filename = "";
	if ( NULL != m_page )
		m_page->mainFrame()->setHtml( "<!doctype html><html><head><title>Place Holder</title></head><body><h1>mShots.JS</h1></body></html>" );
	#ifdef _DEBUG_
	std::cerr << "Blank Page set" << std::endl;
	#endif
}

void Snapper::reloadBlacklist() {
	m_blacklist.reload();
}

void Snapper::loadConfig() {
	try {
		QFile file;
		file.setFileName( QDir::currentPath() + QDir::separator() + s_ConfigRelativePath );
		file.open( QFile::ReadOnly );
		QTextStream fin( &file );
		while ( ! fin.atEnd() ) {
			QString line = fin.readLine().trimmed();
			if ( line.length() > 0 ) {
				if ( '#' == line.at( 0 ) ) continue;
				if ( -1 != line.indexOf( "user-agent" ) ) {
					m_user_agent = line.replace( QRegExp( "user-agent", Qt::CaseInsensitive ), "" ).trimmed();
					continue;
				}
				if ( -1 != line.indexOf( "max-redirects" ) ) {
					line = line.replace( QRegExp( "max-redirects", Qt::CaseInsensitive ), "" ).trimmed();
					m_max_redirects = line.toInt();
					continue;
				}
			}
		}
		file.close();
		// load defaults if necessary
		if ( 0 == m_user_agent.length() )
			m_user_agent = "WordPress.com mShots; http://support.wordpress.com/contact/";
		if ( 0 == m_max_redirects )
			m_max_redirects = 2;

		#ifdef _DEBUG_
		std::cerr  << "Loaded config file: " << std::endl << "user-agent: " << m_user_agent.toStdString().data()
				<< std::endl << "max-redirects: " << m_max_redirects << std::endl;
		#endif
	}
	catch( std::exception &ex ) {
		#ifdef _DEBUG_
		std::cerr  << "Error loading config file: "
				<< QString( QDir::currentPath() + QDir::separator() + s_ConfigRelativePath ).toStdString().data()
				<< std::endl << "Error: " << ex.what() << std::endl;
		#endif
	}
}

void Snapper::onNetworkRequestFinished( QNetworkReply* reply ) {
	int statusCode = reply->attribute( QNetworkRequest::HttpStatusCodeAttribute ).toInt();
	if ( reply->error() == QNetworkReply::NoError ) {
		#ifdef _DEBUG_
		std::cerr << statusCode << ": " << reply->url().toString().toStdString().data() << std::endl;
		#endif
		switch ( statusCode ) {
			case 301:
			case 302:
			case 307:
			case 308: {
				if ( ( reply->url().toString() == m_url.toString() ) ||
					( reply->url().toString() == QString( m_url.toString() + "/" ) ) ) {
					if ( m_max_redirects <= m_redirect_count ) {
						std::cerr << "redirect request denied, limit reached" << std::endl;
						reply->abort();
						this->frameLoad( false );
					} else {
						#ifdef _DEBUG_
						std::cerr << COLOUR_magenta << "redirect: " << reply->attribute( QNetworkRequest::RedirectionTargetAttribute ).toUrl().toString().toStdString().data() << COLOUR_normal << std::endl;
						#endif
						m_redirecting = true;
						m_redirect_count++;
						m_url.setUrl( reply->attribute( QNetworkRequest::RedirectionTargetAttribute ).toUrl().toString() );
					}
				}
				break;
			}
			default: {
				m_redirecting = false;
				m_redirect_count = 0;
				break;
			}
		}
	} else {
		#ifdef _DEBUG_
		std::cerr << COLOUR_lightred << reply->errorString().toStdString().data() << COLOUR_normal
				<< ": " << reply->url().toString().toStdString().data() << std::endl;
		#endif
		m_redirecting = false;

		if ( ( reply->url().toString() == m_url.toString() ) && ( 404 == statusCode ) ) {
			#ifdef _DEBUG_
			std::cerr << COLOUR_lightblue << "caught a " << statusCode << " for the main request" << COLOUR_normal << std::endl;
			#endif
			this->frameLoad( false );
		}
	}
	reply->deleteLater();
}

void Snapper::frameLoad( bool okay ) {
	#ifdef _DEBUG_
	std::cerr << COLOUR_yellow << "frameLoad:" << COLOUR_normal << " okay = " << okay << std::endl;
	std::cerr << COLOUR_yellow << "frameLoad:" << COLOUR_normal << " m_redirecting = " << m_redirecting << std::endl;
	std::cerr << COLOUR_yellow << "frameLoad:" << COLOUR_normal << " m_forceSnapshot = " << m_forceSnapshot << std::endl;
	#endif
	m_progress = 0;
	if ( m_redirecting )
		return;

	disconnect( m_page->mainFrame(), SIGNAL( loadFinished( bool ) ), this, SLOT( frameLoad( bool ) ) );
	disconnect( m_page, SIGNAL( loadProgress( int ) ), this, SLOT( loadProgress( int ) ) );
	disconnect( m_page, SIGNAL( downloadRequested( QNetworkRequest ) ), this, SLOT( downloadRequested( QNetworkRequest ) ) );
	disconnect( m_page, SIGNAL( unsupportedContent( QNetworkReply* ) ), this, SLOT( unsupportedContent( QNetworkReply* ) ) );

	m_page->triggerAction( QWebPage::Stop );

	if ( okay || m_forceSnapshot ) {
		m_forceSnapshot = false;
		// filename not supplied (setBlankPage call or a Snapper object unload event)
		if ( m_filename.isEmpty() || m_url.isEmpty() ) {
			return;
		}
		QTimer::singleShot( 1000, this, SLOT( emitReadySignal() ) );
	} else {
		this->saveAsNotFound();
		QString err_msg = "Error in loading the URL: "+ m_url.toString();
		this->processCallback( err_msg, GENERAL_ERROR );
	}
}

void Snapper::emitReadySignal() {
	this->processCallback( "", SUCCESS );
}

void Snapper::saveThumbnail( const QUrl &p_url, const QString &p_filename, const double &p_width, const double &p_height ) {
	#ifdef _DEBUG_
	std::cerr << COLOUR_lightblue << "saveThumbnail: " << p_url.toString().toStdString().data() << ", filename: "
				<< p_filename.toStdString().data() << COLOUR_normal << std::endl;
	#endif
	// make sure this function is called for the pre-prepared URL
	if ( ( m_width == p_width ) && ( m_height == p_height ) && ( p_filename == m_filename ) ) {
		QImage m_image = QImage( QSize( m_width, m_height ), QImage::Format_RGB888 );
		m_image.fill( Qt::transparent );
		QPainter *painter = new QPainter( &m_image );
		painter->setRenderHint( QPainter::SmoothPixmapTransform, true );
		m_page->setViewportSize( QSize( m_width, m_height ) );
		m_page->mainFrame()->render( painter );
		painter->end();
		delete painter;

		if ( ! m_filename.isEmpty() ) {
			if ( m_image.save( m_filename, "jpg", 90 ) ) {
				this->processCallback( "", SUCCESS );
			} else {
				this->processCallback( "Failed to save the snapshot image file.", GENERAL_ERROR );
			}
		}
	} else {
		this->processCallback( "incorrect saveThumbnail parameters", GENERAL_ERROR );
	}
}

void Snapper::processCallback( const QString err_msg, int status ) {
	const unsigned argc = 2;
	Isolate* isolate = Isolate::GetCurrent();
	HandleScope scope( isolate );

	Local<Value> argv[argc] = { String::NewFromUtf8( isolate, err_msg.toStdString().data() ),
								Number::New( isolate, status ) };

	Local<Function> cb_func = Local<Function>::New( isolate, this->m_callback );
	cb_func->Call( isolate->GetCurrentContext()->Global(), argc, argv );

	this->m_callback.Reset();
}
