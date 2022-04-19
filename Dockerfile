FROM php:7.4-apache-buster

# Note ARGs UID, GID and USER are defined later to reduce rebuilding time

ENV MSHOTS_CONTAINERIZED 1

# Manually install missing shared libs for Chromium.
RUN apt-get update && \
    apt-get install -yq gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 \
    libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget vim

# From: https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-in-docker
# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer
# installs work.
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    --no-install-recommends


# For arm64 builds on M1 Macs, google-chrome-unstable is not available, so we install chromium instead.
# We use TARGETARCH to switch between these packages
# see: https://docs.docker.com/engine/reference/builder/#automatic-platform-args-in-the-global-scope
ARG TARGETARCH
# ARG variables are not available inside the container, we make this visible inside the container
# using ARCH so that we can switch the puppeteer executable based on ARCH. (see lib/snapshot.js)
ENV ARCH $TARGETARCH
RUN apt-get install -y $( if [ "$TARGETARCH" = "arm64" ]; then echo "chromium"; else echo "google-chrome-unstable"; fi; ) --no-install-recommends
RUN rm -rf /var/lib/apt/lists/*

# Install memcache extension
RUN apt-get update \
    && apt-get install -y memcached libmemcached-dev zlib1g-dev

RUN pecl install memcache-4.0.5.2 \
    && docker-php-ext-enable memcache

# Install GD
RUN apt-get update && apt-get install -y \
    libfreetype6-dev \
    libjpeg62-turbo-dev \
    libpng-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) gd

RUN a2enmod rewrite

# Install Node
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs

# configure Apache and PHP
RUN mv "$PHP_INI_DIR/php.ini-development" "$PHP_INI_DIR/php.ini"

RUN echo "\r\nlog_errors = On" >> "$PHP_INI_DIR/php.ini"
RUN echo "\r\nerror_log = /dev/stderr" >> "$PHP_INI_DIR/php.ini"

ENV APACHE_DOCUMENT_ROOT /opt/mshots/public_html

RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf
RUN sed -i 's/80/8000/g' /etc/apache2/sites-available/000-default.conf /etc/apache2/ports.conf
# Apache requires us to put our "AllowEncodedSlashes" inside our VirtualHost
# https://stackoverflow.com/questions/4390436/need-to-allow-encoded-slashes-on-apache
# -> https://bz.apache.org/bugzilla/show_bug.cgi?id=46830
RUN sed -i '/^<VirtualHost/a   AllowEncodedSlashes On' /etc/apache2/sites-enabled/000-default.conf

# This is where mshots wants to run
WORKDIR /opt/mshots
COPY . /opt/mshots

# Set up node & npm
ENV npm_config_cache=/var/www/.npm
RUN mkdir -p /var/www/.npm /usr/local/node/bin
RUN ln -s /usr/bin/node /usr/local/node/bin

# Setup our user and permissions
# These are overridden by values in ./.env if it exists
ARG UID=33
ARG GID=33
ARG USER=www-data

RUN groupadd --force -g $GID $USER
RUN adduser --disabled-password --no-create-home --uid $UID --gid $GID --gecos '' $USER || true

RUN touch /var/run/mshots.pid \
    && chown -R $UID /var/run/mshots.pid \
    && chown -RL $UID /var/run \
    && chown -R $UID /var/www/html \
    && chown -R $UID /usr/local/node/bin \
    && chown -R $UID /opt/mshots \
    && chown -R $UID /var/www/.npm

USER $UID

RUN npm install --ignore-scripts
# Force chromium binary installation
ENV CHROMEDRIVER_SKIP_DOWNLOAD ''
RUN cd node_modules/puppeteer \
    && node ./install.js

# Get started
EXPOSE 8000
