function delete_from_queue( job_key, status ) {
    process.send({
        replytype: 'queue-del',
        workerid: process.pid,
        payload: {
            status,
            job_key,
        }
    });
}

function add_to_queue( job_key, payload ) {
    payload.job_key = job_key;
    process.send( {
        replytype: 'queue-add',
        workerid: process.pid,
        payload
    } );
}

const exported = {
    delete_from_queue,
    add_to_queue,
}

module.exports = exported;
