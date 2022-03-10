function supplementUrl(url, protocol = 'http') {
    const doubleSlashesStart = /^\/\/.{3,}$/;

    if (doubleSlashesStart.test(url)) {
        return `${protocol}${url}`;
    }

    return url;
}

module.exports = {
    supplementUrl,
};
