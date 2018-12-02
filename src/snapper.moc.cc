/****************************************************************************
** Meta object code from reading C++ file 'snapper.h'
**
** Created by: The Qt Meta Object Compiler version 67 (Qt 5.5.1)
**
** WARNING! All changes made in this file will be lost!
*****************************************************************************/

#include "./snapper.h"
#include <QtCore/qbytearray.h>
#include <QtCore/qmetatype.h>
#include <QtCore/QList>
#if !defined(Q_MOC_OUTPUT_REVISION)
#error "The header file 'snapper.h' doesn't include <QObject>."
#elif Q_MOC_OUTPUT_REVISION != 67
#error "This file was generated using the moc from 5.5.1. It"
#error "cannot be used with the include files from this version of Qt."
#error "(The moc has changed too much.)"
#endif

QT_BEGIN_MOC_NAMESPACE
struct qt_meta_stringdata_Snapper_t {
    QByteArrayData data[22];
    char stringdata0[274];
};
#define QT_MOC_LITERAL(idx, ofs, len) \
    Q_STATIC_BYTE_ARRAY_DATA_HEADER_INITIALIZER_WITH_OFFSET(len, \
    qptrdiff(offsetof(qt_meta_stringdata_Snapper_t, stringdata0) + ofs \
        - idx * sizeof(QByteArrayData)) \
    )
static const qt_meta_stringdata_Snapper_t qt_meta_stringdata_Snapper = {
    {
QT_MOC_LITERAL(0, 0, 7), // "Snapper"
QT_MOC_LITERAL(1, 8, 9), // "permitURL"
QT_MOC_LITERAL(2, 18, 0), // ""
QT_MOC_LITERAL(3, 19, 10), // "returnCode"
QT_MOC_LITERAL(4, 30, 9), // "frameLoad"
QT_MOC_LITERAL(5, 40, 4), // "okay"
QT_MOC_LITERAL(6, 45, 12), // "loadProgress"
QT_MOC_LITERAL(7, 58, 10), // "p_progress"
QT_MOC_LITERAL(8, 69, 15), // "handleSslErrors"
QT_MOC_LITERAL(9, 85, 14), // "QNetworkReply*"
QT_MOC_LITERAL(10, 100, 5), // "reply"
QT_MOC_LITERAL(11, 106, 16), // "QList<QSslError>"
QT_MOC_LITERAL(12, 123, 6), // "errors"
QT_MOC_LITERAL(13, 130, 20), // "handleAuthentication"
QT_MOC_LITERAL(14, 151, 15), // "QAuthenticator*"
QT_MOC_LITERAL(15, 167, 4), // "auth"
QT_MOC_LITERAL(16, 172, 17), // "downloadRequested"
QT_MOC_LITERAL(17, 190, 15), // "QNetworkRequest"
QT_MOC_LITERAL(18, 206, 7), // "request"
QT_MOC_LITERAL(19, 214, 18), // "unsupportedContent"
QT_MOC_LITERAL(20, 233, 24), // "onNetworkRequestFinished"
QT_MOC_LITERAL(21, 258, 15) // "emitReadySignal"

    },
    "Snapper\0permitURL\0\0returnCode\0frameLoad\0"
    "okay\0loadProgress\0p_progress\0"
    "handleSslErrors\0QNetworkReply*\0reply\0"
    "QList<QSslError>\0errors\0handleAuthentication\0"
    "QAuthenticator*\0auth\0downloadRequested\0"
    "QNetworkRequest\0request\0unsupportedContent\0"
    "onNetworkRequestFinished\0emitReadySignal"
};
#undef QT_MOC_LITERAL

static const uint qt_meta_data_Snapper[] = {

 // content:
       7,       // revision
       0,       // classname
       0,    0, // classinfo
       9,   14, // methods
       0,    0, // properties
       0,    0, // enums/sets
       0,    0, // constructors
       0,       // flags
       0,       // signalCount

 // slots: name, argc, parameters, tag, flags
       1,    1,   59,    2, 0x0a /* Public */,
       4,    1,   62,    2, 0x08 /* Private */,
       6,    1,   65,    2, 0x08 /* Private */,
       8,    2,   68,    2, 0x08 /* Private */,
      13,    2,   73,    2, 0x08 /* Private */,
      16,    1,   78,    2, 0x08 /* Private */,
      19,    1,   81,    2, 0x08 /* Private */,
      20,    1,   84,    2, 0x08 /* Private */,
      21,    0,   87,    2, 0x08 /* Private */,

 // slots: parameters
    QMetaType::Void, QMetaType::Int,    3,
    QMetaType::Void, QMetaType::Bool,    5,
    QMetaType::Void, QMetaType::Int,    7,
    QMetaType::Void, 0x80000000 | 9, 0x80000000 | 11,   10,   12,
    QMetaType::Void, 0x80000000 | 9, 0x80000000 | 14,   10,   15,
    QMetaType::Void, 0x80000000 | 17,   18,
    QMetaType::Void, 0x80000000 | 9,   10,
    QMetaType::Void, 0x80000000 | 9,    2,
    QMetaType::Void,

       0        // eod
};

void Snapper::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    if (_c == QMetaObject::InvokeMetaMethod) {
        Snapper *_t = static_cast<Snapper *>(_o);
        Q_UNUSED(_t)
        switch (_id) {
        case 0: _t->permitURL((*reinterpret_cast< int(*)>(_a[1]))); break;
        case 1: _t->frameLoad((*reinterpret_cast< bool(*)>(_a[1]))); break;
        case 2: _t->loadProgress((*reinterpret_cast< int(*)>(_a[1]))); break;
        case 3: _t->handleSslErrors((*reinterpret_cast< QNetworkReply*(*)>(_a[1])),(*reinterpret_cast< const QList<QSslError>(*)>(_a[2]))); break;
        case 4: _t->handleAuthentication((*reinterpret_cast< QNetworkReply*(*)>(_a[1])),(*reinterpret_cast< QAuthenticator*(*)>(_a[2]))); break;
        case 5: _t->downloadRequested((*reinterpret_cast< QNetworkRequest(*)>(_a[1]))); break;
        case 6: _t->unsupportedContent((*reinterpret_cast< QNetworkReply*(*)>(_a[1]))); break;
        case 7: _t->onNetworkRequestFinished((*reinterpret_cast< QNetworkReply*(*)>(_a[1]))); break;
        case 8: _t->emitReadySignal(); break;
        default: ;
        }
    } else if (_c == QMetaObject::RegisterMethodArgumentMetaType) {
        switch (_id) {
        default: *reinterpret_cast<int*>(_a[0]) = -1; break;
        case 3:
            switch (*reinterpret_cast<int*>(_a[1])) {
            default: *reinterpret_cast<int*>(_a[0]) = -1; break;
            case 1:
                *reinterpret_cast<int*>(_a[0]) = qRegisterMetaType< QList<QSslError> >(); break;
            case 0:
                *reinterpret_cast<int*>(_a[0]) = qRegisterMetaType< QNetworkReply* >(); break;
            }
            break;
        case 4:
            switch (*reinterpret_cast<int*>(_a[1])) {
            default: *reinterpret_cast<int*>(_a[0]) = -1; break;
            case 0:
                *reinterpret_cast<int*>(_a[0]) = qRegisterMetaType< QNetworkReply* >(); break;
            }
            break;
        case 5:
            switch (*reinterpret_cast<int*>(_a[1])) {
            default: *reinterpret_cast<int*>(_a[0]) = -1; break;
            case 0:
                *reinterpret_cast<int*>(_a[0]) = qRegisterMetaType< QNetworkRequest >(); break;
            }
            break;
        case 6:
            switch (*reinterpret_cast<int*>(_a[1])) {
            default: *reinterpret_cast<int*>(_a[0]) = -1; break;
            case 0:
                *reinterpret_cast<int*>(_a[0]) = qRegisterMetaType< QNetworkReply* >(); break;
            }
            break;
        case 7:
            switch (*reinterpret_cast<int*>(_a[1])) {
            default: *reinterpret_cast<int*>(_a[0]) = -1; break;
            case 0:
                *reinterpret_cast<int*>(_a[0]) = qRegisterMetaType< QNetworkReply* >(); break;
            }
            break;
        }
    }
}

const QMetaObject Snapper::staticMetaObject = {
    { &QObject::staticMetaObject, qt_meta_stringdata_Snapper.data,
      qt_meta_data_Snapper,  qt_static_metacall, Q_NULLPTR, Q_NULLPTR}
};


const QMetaObject *Snapper::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *Snapper::qt_metacast(const char *_clname)
{
    if (!_clname) return Q_NULLPTR;
    if (!strcmp(_clname, qt_meta_stringdata_Snapper.stringdata0))
        return static_cast<void*>(const_cast< Snapper*>(this));
    return QObject::qt_metacast(_clname);
}

int Snapper::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = QObject::qt_metacall(_c, _id, _a);
    if (_id < 0)
        return _id;
    if (_c == QMetaObject::InvokeMetaMethod) {
        if (_id < 9)
            qt_static_metacall(this, _c, _id, _a);
        _id -= 9;
    } else if (_c == QMetaObject::RegisterMethodArgumentMetaType) {
        if (_id < 9)
            qt_static_metacall(this, _c, _id, _a);
        _id -= 9;
    }
    return _id;
}
QT_END_MOC_NAMESPACE
