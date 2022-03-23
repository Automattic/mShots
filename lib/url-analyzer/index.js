const common = require( '../common' );
const Memcached = require( 'memcached' );

async function analyze( url, cache_key ) {
       let  data = {
            url: url,
            status: 'analyzed',
            colors: {
                foo: 'bar' // todo, implement logic to retrieve colors
            }
        }

        save_data(cache_key, data);
        common.delete_from_queue( get_job_key( url ), 0 );
}

function save_data(cache_key, data) {
    let memcached_host = process.env.MSHOTS_MEMCACHE_HOST
        ? process.env.MSHOTS_MEMCACHE_HOST
        : '127.0.0.1';

    let memcached = new Memcached( memcached_host + ':11211' );
    // Set the data in memcached
    memcached.set( cache_key, JSON.stringify(data), 3600, (err) => {
        console.log("Handle memcached error....");
    });
}

function get_job_key( url ) {
    return 'analyze' + url;
}


module.exports = {
    analyze: analyze,
    get_job_key
};
