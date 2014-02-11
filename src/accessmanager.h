
#ifndef ACCESSMANAGER_H
#define ACCESSMANAGER_H

#include <sys/types.h>
#include <sys/socket.h>
#include <netdb.h>
#include <resolv.h>

#include <QNetworkAccessManager>
#include <QNetworkRequest>

#include "./accessreply.h"
#include "./blacklist.h"

#define MAX_LOG_FILESIZE 1024 * 1024 * 10 // 10 MB

class AccessManager : public QNetworkAccessManager {
	Q_OBJECT
public:
	explicit AccessManager( QObject *parent );

	void set_blacklister( Blacklist *p_blacklist ) { m_blacklist = p_blacklist; }

protected:
	QNetworkReply *createRequest( QNetworkAccessManager::Operation operation, const QNetworkRequest &request, QIODevice *device);

private:
	Blacklist *m_blacklist;

	QList<QHostAddress> get_host_addresses( QString s_hostname );
	QNetworkReply *createBlacklistRequest( QString s_blacklisted );
	void do_log_rotation();
};

#endif // ACCESSMANAGER_H
