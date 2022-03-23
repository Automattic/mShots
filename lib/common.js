/**
 * Deletes a job from the queue
 *
 * @param job_key a unique key that identifies the job.
 * @param status a status code to indicate the result of the job processing.
 */
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

/**
 * Add a job to the queue
 *
 * @param job_key a unique key that identifies the job.
 * @param payload the data needed for the job to be executed.
 */
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
