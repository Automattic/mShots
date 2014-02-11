
#include "./webpage.h"

WebPage::WebPage( QString p_user_agent ) : m_user_agent( p_user_agent ) {
	QWebPage();
	this->setForwardUnsupportedContent( true );
	this->mainFrame()->setScrollBarPolicy( Qt::Horizontal, Qt::ScrollBarAlwaysOff );
	this->mainFrame()->setScrollBarPolicy( Qt::Vertical, Qt::ScrollBarAlwaysOff );
	this->settings()->setMaximumPagesInCache( 0 );
	this->settings()->setAttribute( QWebSettings::AutoLoadImages, true );
	this->settings()->setAttribute( QWebSettings::DnsPrefetchEnabled, true );
	this->settings()->setAttribute( QWebSettings::JavascriptEnabled, true );
	this->settings()->setAttribute( QWebSettings::LocalContentCanAccessRemoteUrls, true );
	this->settings()->setAttribute( QWebSettings::PluginsEnabled, true );
	this->settings()->setAttribute( QWebSettings::XSSAuditingEnabled, false );
	this->settings()->setAttribute( QWebSettings::JavascriptCanOpenWindows, false );
	this->settings()->setAttribute( QWebSettings::JavascriptCanCloseWindows, false );
	this->settings()->setAttribute( QWebSettings::FrameFlatteningEnabled, true );
	this->settings()->setAttribute( QWebSettings::OfflineStorageDatabaseEnabled, true );
	this->settings()->setAttribute( QWebSettings::LocalStorageEnabled, true );

	connect( this->mainFrame(), SIGNAL( javaScriptWindowObjectCleared() ), this, SLOT( neutraliseSSRF() ) );
}

QString WebPage::userAgentForUrl( const QUrl &url ) const {
    return m_user_agent;
}

void WebPage::neutraliseSSRF() {
	QWebFrame *frame = this->mainFrame();
	QWebElement dom = frame->documentElement();
	QWebElementCollection forms = dom.findAll( "form" );

	foreach ( QWebElement frm, forms ) {
		frm.setAttribute( "action", "javascript:var i = 0;" );
	}
}

bool WebPage::javaScriptPrompt( QWebFrame *frame, const QString &msg, const QString &defaultValue, QString *result ) {
	std::cerr << "javaScriptPrompt | Message: " << msg.toStdString() << "\nDefault value= " << defaultValue.toStdString() << std::endl;
	return false;
}

void WebPage::javaScriptAlert( QWebFrame *frame, const QString &msg ) {
	std::cerr << "javaScriptAlert | Message: " << msg.toStdString() << std::endl;
}

bool WebPage::javaScriptConfirm( QWebFrame *frame, const QString &msg ) {
	std::cerr << "javaScriptConfirm | Message: " << msg.toStdString() << std::endl;
	return false;
}
