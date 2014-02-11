
#include "accessreply.h"

AccessReply::AccessReply() : QNetworkReply() {
	;
}

void AccessReply::set_http_status( int code, const QByteArray &status ) {
	setAttribute( QNetworkRequest::HttpStatusCodeAttribute, code );
	if ( status.isNull() )
		return;

	setAttribute( QNetworkRequest::HttpReasonPhraseAttribute, status );
}

void AccessReply::setHeader( QNetworkRequest::KnownHeaders header, const QVariant &value ) {
	QNetworkReply::setHeader( header, value );
}

void AccessReply::set_content_type( const QByteArray &content_type ) {
	setHeader( QNetworkRequest::ContentTypeHeader, content_type );
}

void AccessReply::set_content( const QString &content ) {
	set_content( content.toUtf8() );
}

void AccessReply::set_content( const QByteArray &content ) {
	m_content = content;
	m_offset = 0;

	open( ReadOnly | Unbuffered );
	setHeader( QNetworkRequest::ContentLengthHeader, QVariant( content.size() ) );

	QTimer::singleShot( 0, this, SIGNAL( readyRead() ) );
	QTimer::singleShot( 0, this, SIGNAL( finished() ) );
}

void AccessReply::abort() {
	;
}

bool AccessReply::isSequential() const {
	return true;
}

qint64 AccessReply::bytesAvailable() const {
	return m_content.size() - m_offset;
}

qint64 AccessReply::readData( char *data, qint64 max_size ) {

	if ( m_offset >= m_content.size() )
		return -1;

	qint64 number = qMin( max_size, m_content.size() - m_offset );
	memcpy( data, m_content.constData() + m_offset, number );
	m_offset += number;
	return number;
}
