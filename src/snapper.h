
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
//#include <QtWebKitWidgets/QWebView>
#include <QImage>
#include <QUrl>
#include <QString>

#include "./webpage.h"
#include "./blacklist.h"
#include "./accessmanager.h"

#define constWidth  1600
#define constHeight 1200

#define SUCCESS             0
#define HOST_PERMITTED      0
#define HOST_NO_DNS         1
#define HOST_BLACKLISTED    2
#define HOST_INVALIDSCHEMA  3
#define HOST_INVALID        4
#define GENERAL_ERROR       5

// Uncomment to have debug messages sent to stdout
//#define _DEBUG_             1

#define COLOUR_black        "\033[22;30m"
#define COLOUR_red          "\033[22;31m"
#define COLOUR_green        "\033[22;32m"
#define COLOUR_brown        "\033[22;33m"
#define COLOUR_blue         "\033[22;34m"
#define COLOUR_magenta      "\033[22;35m"
#define COLOUR_cyan         "\033[22;36m"
#define COLOUR_gray         "\033[22;37m"
#define COLOUR_darkgray     "\033[01;30m"
#define COLOUR_lightred     "\033[01;31m"
#define COLOUR_lightgreen   "\033[01;32m"
#define COLOUR_yellow       "\033[01;33m"
#define COLOUR_lightblue    "\033[01;34m"
#define COLOUR_lightmagenta "\033[01;35m"
#define COLOUR_lightcyan    "\033[01;36m"
#define COLOUR_white        "\033[01;37m"
#define COLOUR_normal       "\033[0m"

const QString s_ConfigRelativePath = "config/mshots.conf";

class Snapper : public QObject {
	Q_OBJECT
public:
	Snapper();
	void setTargetSize( const double &p_width, const double &p_height );
	void setCallbackFunction( v8::Isolate* isolate, v8::CopyablePersistentTraits<v8::Function>::CopyablePersistent p_callBack );
	void load( const QUrl &p_url, const QString &p_filename );
	void saveThumbnail( const QUrl &p_url, const QString &p_filename, const double &p_width, const double &p_height );
	void setBlankPage();
	void saveAsNotFound();
	bool mainPageLoaded();
	void reloadBlacklist();
	void reloadConfig() { this->loadConfig(); }
	void stopLoading();
	int pageLoadProgress() { return m_progress; }
	void setForceSnapshot() { m_forceSnapshot = true; }

public slots:
	void permitURL( int returnCode );

private slots:
	void frameLoad( bool okay );
	void loadProgress( int p_progress );
	void handleSslErrors( QNetworkReply* reply, const QList<QSslError> &errors );
	void handleAuthentication( QNetworkReply* reply, QAuthenticator* auth );
	void downloadRequested( QNetworkRequest request );
	void unsupportedContent( QNetworkReply* reply );
	void onNetworkRequestFinished( QNetworkReply* );

private:
	//QWebView *m_webview;
	WebPage *m_page;
	Blacklist m_blacklist;
	AccessManager *m_gate_keeper;
	QString m_user_agent;
	QString m_filename;
	double m_width;
	double m_height;
	int m_progress;
	QUrl m_url;
	v8::CopyablePersistentTraits<v8::Function>::CopyablePersistent m_callback;
	void validate_path();
	bool m_forceSnapshot;
	bool m_redirecting;
	int m_max_redirects;
	int m_redirect_count;

	void initWebpage();
	void loadConfig();
	void processCallback( QString err_msg, int status );
};

#endif // _SNAPPER_H_
