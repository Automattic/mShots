
#ifndef ACCESSREPLY_H
#define ACCESSREPLY_H

#include <QNetworkReply>
#include <QTextStream>
#include <QDateTime>
#include <QTimer>
#include <QFile>
#include <QDir>

class AccessReply : public QNetworkReply {
	Q_OBJECT
public:
	AccessReply();

	void set_http_status( int code, const QByteArray &status = QByteArray() );
	void set_content_type( const QByteArray &content_type );
	void set_content( const QString &content );
	void set_content( const QByteArray &content );

	void setHeader( QNetworkRequest::KnownHeaders header, const QVariant &value );
	void abort();
	qint64 bytesAvailable() const;
	bool isSequential() const;

protected:
	qint64 readData( char *data, qint64 maxSize );

private:
	QByteArray m_content;
	qint64 m_offset;

};

#endif // ACCESSREPLY_H
