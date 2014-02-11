
#include "accessmanager.h"

AccessManager::AccessManager( QObject *parent ) : QNetworkAccessManager( parent ), m_blacklist( NULL ) {
	;
}

QNetworkReply *AccessManager::createRequest( QNetworkAccessManager::Operation operation, const QNetworkRequest &request, QIODevice *device ) {
	if ( request.url().host().isEmpty() )
		return QNetworkAccessManager::createRequest( operation, request, device );

// https://x.myspacecdn.com/new/discover/js/discoverBundle.0081AA1A4A089FB82C46FC5DFAF4292F.min.js
// http://stackful.com/6516
// http://esgallacreacions.com
// http://kizi8x.com
// http://praguepost.com
// http://freeside.co
// http://suprb.com/apps/nested/

	if ( QString( "https://x.myspacecdn.com/new/discover/js/discoverBundle." ) == request.url().toString().mid( 0, 56 ) )
		return this->createBlacklistRequest( QString( "Bugger '" + request.url().host() + "'" ) );

	if ( ! m_blacklist->allowedHost( request.url().host() ) ) {
		if ( QFile( QDir::currentPath() + QDir::separator() + "logs/blacklisted.log" ).size() > MAX_LOG_FILESIZE )
				this->do_log_rotation();
			QFile logger( QDir::currentPath() + QDir::separator() + "logs/blacklisted.log");
			logger.open( QFile::Append );
			QTextStream out( &logger );
			out << "[" << QDateTime::currentDateTime().toString( "yyyy-MM-dd HH:mm:ss" ) << "]: domain '"
				<< request.url().host() << "' is blacklisted.\n";
			logger.close();

			std::cerr << "blacklisted: " << request.url().toString().toStdString().data() << std::endl;

			return this->createBlacklistRequest( QString( "Host '" + request.url().host() + "'" ) );
	}

	QList<QHostAddress> host_addresses = get_host_addresses( request.url().host() );

	foreach ( const QHostAddress &checkAddress, host_addresses ) {
		if ( false == m_blacklist->allowedIP( checkAddress ) ) {
			if ( QFile( QDir::currentPath() + QDir::separator() + "logs/blacklisted.log" ).size() > MAX_LOG_FILESIZE )
				this->do_log_rotation();
			QFile logger( QDir::currentPath() + QDir::separator() + "logs/blacklisted.log");
			logger.open( QFile::Append );
			QTextStream out( &logger );
			out << "[" << QDateTime::currentDateTime().toString( "yyyy-MM-dd HH:mm:ss" ) << "]: '"
				<< request.url().host() << "', resolves to " << checkAddress.toString() << ".\n";
			logger.close();

			return this->createBlacklistRequest( QString( "IP " + checkAddress.toString() ) );
		}
	}

	return QNetworkAccessManager::createRequest( operation, request, device );
}

QNetworkReply *AccessManager::createBlacklistRequest( QString s_blacklisted ) {
	AccessReply *reply = new AccessReply();
	reply->set_http_status( 403, "Forbidden" );
	reply->set_content_type( "text/html; charset=UTF-8" );
	reply->set_content( QString( "<html><head><title>403</title></head><body>Blacklisted host due to "
						+ s_blacklisted + ".</body></html>" ) );
	return reply;
}

void AccessManager::do_log_rotation() {
	for ( int del_loop = 9; del_loop > 0; del_loop-- ) {
		if ( QFile( QDir::currentPath() + QDir::separator() + "logs/blacklisted.log." + QString::number( del_loop ) ).exists() ) {
			if ( QFile( QDir::currentPath() + QDir::separator() + "logs/blacklisted.log." + QString::number( del_loop + 1 ) ).exists() )
				QFile( QDir::currentPath() + QDir::separator() + "logs/blacklisted.log." + QString::number( del_loop + 1 ) ).remove();
			QFile( QDir::currentPath() + QDir::separator() + "logs/blacklisted.log." + QString::number( del_loop ) ).copy(
					QDir::currentPath() + QDir::separator() + "logs/blacklisted.log." + QString::number( del_loop + 1 ) );
		}
	}
	if ( QFile( QDir::currentPath() + QDir::separator() + "logs/blacklisted.log.1" ).exists() )
		QFile( QDir::currentPath() + QDir::separator() + "logs/blacklisted.log.1" ).remove();
	QFile( QDir::currentPath() + QDir::separator() + "logs/blacklisted.log" ).copy( QDir::currentPath() + QDir::separator() + "logs/blacklisted.log.1" );
	QFile( QDir::currentPath() + QDir::separator() + "logs/blacklisted.log" ).remove();
}

QList<QHostAddress> AccessManager::get_host_addresses( QString s_hostname ) {
	addrinfo *res = 0;
	struct addrinfo hints;
	memset( &hints, 0, sizeof( hints ) );
	hints.ai_family = PF_UNSPEC;
	hints.ai_flags = AI_ADDRCONFIG;

	int result = getaddrinfo( s_hostname.toStdString().data(), 0, &hints, &res );

	if ( EAI_BADFLAGS == result ) {
		// if the lookup failed with AI_ADDRCONFIG set, try again without it
		hints.ai_flags = 0;
		result = getaddrinfo( s_hostname.toStdString().data(), 0, &hints, &res );
	}

	if ( 0 == result ) {
		addrinfo *node = res;
		QList<QHostAddress> addresses;
		while ( node ) {
			if ( AF_INET == node->ai_family ) {
				QHostAddress addr;
				addr.setAddress( ntohl( ( (sockaddr_in *) node->ai_addr)->sin_addr.s_addr ) );
				if ( ! addresses.contains( addr ) )
					addresses.append( addr );
			}
			else if ( AF_INET6 == node->ai_family ) {
				QHostAddress addr;
				sockaddr_in6 *sa6 = (sockaddr_in6 *) node->ai_addr;
				addr.setAddress( sa6->sin6_addr.s6_addr );
				if ( sa6->sin6_scope_id )
					addr.setScopeId( QString::number( sa6->sin6_scope_id ) );
				if ( ! addresses.contains( addr ) )
					addresses.append( addr );
			}
			node = node->ai_next;
		}
		if ( addresses.isEmpty() && ( 0 == node ) ) {
			std::cerr <<  "Unknown address type: " << s_hostname.toStdString().data() << std::endl;
			return QList<QHostAddress>();
		}
		freeaddrinfo( res );
		return addresses;
	} else if ( EAI_NONAME == result || EAI_FAIL == result ) {
		std::cerr << "Host not found: " << s_hostname.toStdString().data() << std::endl;
		return QList<QHostAddress>();
	} else {
		std::cerr << "Unknown error for host: " << s_hostname.toStdString().data() << std::endl;
		return QList<QHostAddress>();
	}
}
