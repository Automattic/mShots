
#ifndef __SNAPPER_H__
#define __SNAPPER_H__

#include <iostream>
#include <exception>
#include <unistd.h>
#include <sys/types.h>
#include <sys/time.h>
#include <utime.h>

#include <node.h>

#include <QObject>
#include <QtWidgets/QApplication>
#include <QtNetwork>
#include <QtGui>
#include <QPainter>
#include <QtWebKit>
#include <QtWebKitWidgets/QWebPage>
#include <QtWebKitWidgets/QWebFrame>
#include <QImage>
#include <QUrl>
#include <QString>

#include "./webpage.h"
#include "./blacklist.h"

#define constWidth	1600
#define constHeight	1200

#define SUCCESS				0
#define HOST_PERMITTED		0
#define HOST_NO_DNS			1
#define HOST_BLACKLISTED	2
#define HOST_INVALIDSCHEMA	3
#define HOST_INVALID		4
#define GENERAL_ERROR		5

class Snapper : public QObject {
	Q_OBJECT
public:
	Snapper();
	void setTargetSize( const double &p_width, const double &p_height );
	void setCallbackFunction( v8::Persistent<v8::Function> p_callBack );
	void load( const QUrl &p_url, const QString &p_filename );
	void saveThumbnail( const QUrl &p_url, const QString &p_filename, const double &p_width, const double &p_height );
	void setBlankPage();
	void saveAsNotFound();
	bool mainPageLoaded();
	void reloadBlacklist();
	void stopLoading();
	int pageLoadProgress() { return m_progress; }
	void setForceSnapshot() { m_forceSnapshot = true; }

public slots:
	void permitURL( int returnCode );

private slots:
	void frameLoad( bool okay );
	void mainLoad( bool okay );
	void loadProgress( int p_progress );
	void handleSslErrors( QNetworkReply* reply, const QList<QSslError> &errors );
	void handleAuthentication( QNetworkReply* reply, QAuthenticator* auth );
	void downloadRequested( QNetworkRequest request );
	void unsupportedContent( QNetworkReply* reply );

private:
	WebPage m_page;
	Blacklist m_blacklist;
	QString m_filename;
	double m_width;
	double m_height;
	int m_progress;
	QUrl m_url;
	v8::Persistent<v8::Function> m_callback;
	void validate_path();
	bool b_MainLoaded;
	bool m_forceSnapshot;
};

#endif // _SNAPPER_H_
