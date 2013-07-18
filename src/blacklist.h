
#ifndef __BLACKLIST_H__
#define __BLACKLIST_H__

#include <iostream>

#include <QString>
#include <QVector>
#include <QFile>
#include <QTextStream>
#include <QtNetwork>
#include <QUrl>

const QString s_BlacklistRelativePath = "config/blacklist.dat";
const QString s_SchemasRelativePath = "config/schemas.dat";

#define HOST_PERMITTED		0
#define HOST_NO_DNS			1
#define HOST_BLACKLISTED	2
#define HOST_INVALIDSCHEMA	3
#define HOST_INVALID		4

class Blacklist: public QObject {
	Q_OBJECT
public:
	Blacklist( QObject *parent = 0 );

	void permitURL( const QUrl ckeckHostURL );
	void reload();

signals:
	void permitSignal( int returnCode );

private slots:
	void DNS_ReplySlot( QHostInfo hostInfo );

private:
	QVector<QHostAddress> v_BlacklistedIPs;
	QVector<QString> v_BlacklistedSubnets;
	QVector<QString> v_AllowedSchemas;

	void loadList();
	bool allowedIP( QHostAddress checkIP ) const;
};

#endif // __BLACKLIST_H__
