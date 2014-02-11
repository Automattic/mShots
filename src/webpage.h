
#ifndef __WEBPAGE_H__
#define __WEBPAGE_H__

#include <iostream>

#include <QObject>
#include <QtWebKit>
#include <QtWebKitWidgets/QWebPage>
#include <QtWebKitWidgets/QWebFrame>
#include <QString>

class WebPage: public QWebPage {
	Q_OBJECT
public:
	explicit WebPage( QString p_user_agent );

	QString userAgentForUrl( const QUrl &url ) const;
	bool javaScriptPrompt( QWebFrame *frame, const QString &msg, const QString &defaultValue, QString *result );
	void javaScriptAlert( QWebFrame *frame, const QString &msg );
	bool javaScriptConfirm( QWebFrame *frame, const QString &msg );

private slots:
	void neutraliseSSRF();

private:
	QString m_user_agent;
};

#endif //__WEBPAGE_H__
