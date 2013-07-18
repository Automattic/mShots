
#include "blacklist.h"

Blacklist::Blacklist( QObject *parent ): QObject( parent ) {
	loadList();
}

void Blacklist::loadList() {
	QFile file;
	if( true == file.exists( QDir::currentPath() + QDir::separator() + s_BlacklistRelativePath ) ) {
		file.setFileName( QDir::currentPath() + QDir::separator() + s_BlacklistRelativePath );
		file.open( QFile::ReadOnly );
		QTextStream fin( &file );
		v_BlacklistedIPs.clear();
		v_BlacklistedSubnets.clear();
	
		while ( ! fin.atEnd() ) {
			QString line = fin.readLine().trimmed();
			if ( line.length() > 0 ) {
				if ( '#' == line.at( 0 ) ) continue;
				if ( -1 == line.indexOf( '/' ) ) {
					QHostAddress blacklistIP( line );
					if( ! blacklistIP.isNull() )
						v_BlacklistedIPs.push_back( blacklistIP );
				} else {
					v_BlacklistedSubnets.push_back( line );
				}
			}
		}
		file.close();
	}
	QFile fileSchemas;
	if( true == fileSchemas.exists( QDir::currentPath() + QDir::separator() + s_SchemasRelativePath ) ) {
		fileSchemas.setFileName( QDir::currentPath() + QDir::separator() + s_SchemasRelativePath );
		fileSchemas.open( QFile::ReadOnly );
		QTextStream in( &fileSchemas );
		v_AllowedSchemas.clear();
		while ( ! in.atEnd() ) {
			QString line = in.readLine().trimmed();
			if ( line.length() > 0 ) {
				if ( '#' == line.at( 0 ) )
					continue;
				else
					v_AllowedSchemas.push_back( line );
			}
		}
		fileSchemas.close();
	}
}

bool Blacklist::allowedIP( QHostAddress checkIP ) const {
	QVector<const QHostAddress>::Iterator it_IPs = v_BlacklistedIPs.constBegin();
	for ( ; it_IPs != v_BlacklistedIPs.constEnd(); it_IPs++ )
		if ( *it_IPs == checkIP )
			return false;

	QVector<const QString>::Iterator it_Subnets = v_BlacklistedSubnets.constBegin();
	for ( ; it_Subnets != v_BlacklistedSubnets.constEnd(); it_Subnets++ )
		if ( checkIP.isInSubnet( QHostAddress::parseSubnet( ( *it_Subnets ) ) ) )
			return false;

	return true;
}

void Blacklist::reload() {
	this->loadList();
}

void Blacklist::permitURL( const QUrl ckeckHostURL ) {
	bool foundAllowedSchema = false;
	foreach ( const QString checkSchema, v_AllowedSchemas ) {
		if ( 0 == ckeckHostURL.scheme().compare( checkSchema ) ) {
			foundAllowedSchema = true;
			break;
		}
	}
	if ( ! foundAllowedSchema ) {
		emit permitSignal( HOST_INVALIDSCHEMA );
		return;
	}
	QString s_Host = ckeckHostURL.host();
	if( s_Host.isEmpty() ) {
		std::cerr << "No host found in URL information" << std::endl;
		emit permitSignal( HOST_INVALID );
	} else {
		QHostInfo::lookupHost( s_Host, this, SLOT( DNS_ReplySlot( QHostInfo ) ) );
	}
}

void Blacklist::DNS_ReplySlot( QHostInfo hostInfo ) {
	if ( hostInfo.error() != QHostInfo::NoError ) {
		emit permitSignal( HOST_NO_DNS );
	} else {
		foreach ( const QHostAddress &checkAddress, hostInfo.addresses() ) {
			if ( false == allowedIP( checkAddress ) ) {
				emit permitSignal( HOST_BLACKLISTED );
				return;
			}
		}
		emit permitSignal( HOST_PERMITTED );
	}
}
