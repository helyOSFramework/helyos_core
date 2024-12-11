const { stringify } = require('querystring');
// ----------------------------------------------------------------------------
// External microservices
// ----------------------------------------------------------------------------
const requestXHTTP = require('superagent');

const getExtServiceEndpoint = (serviceUrl, serviceClass) => {
    let url = serviceUrl;
    if (!url) return " ";
    return url;
}


const parseResponseToJson = (res) => {
    let data = null;
    if (Object.keys(res.body).length === 0) {
        try {
            data = JSON.parse(res.text)
        } catch (error) {
            data = { 'text': res.text }
        }
    } else {
        data = res.body;
    }
    if (!data) { data = {} }
    return data
}


const sendRequestToService = (service_url, service_licence_key, request, context, config) => {

    console.log('=============================\nDispatch request to service:');
    console.log(service_url);
    console.log('=============================');

    url_string = service_url;
    // const request_string = JSON.stringify({request, context, config});
    return requestXHTTP.post(url_string)
        .set('x-api-key', service_licence_key)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .send({ request, context, config })
        .then((res) => parseResponseToJson(res))
        .catch((err) => {
            if (err.response) {
                err.data = parseResponseToJson(err.response);
            } else {
                if (err.code === 'ENOTFOUND') {
                    err.message = 'Microservice is unreachable.';
                }
            }

            err.message = err.message + `: [${service_url}]`;
            throw err;
        });
}


const getServiceResponse = (service_url, service_licence_key, jobId) => {

    url_string = service_url + jobId;

    return requestXHTTP.get(url_string)
        .set('x-api-key', service_licence_key)
        .then((res) => {
            let data;
            if (Object.keys(res.body).length === 0) {
                data = JSON.parse(res.text);
            } else {
                data = res.body;
            }
            return data;
        })
        .catch((err) => console.log('\n==== Error in getting microservice response ===', err.message));
}



const cancelService = (service_url, service_licence_key, jobId) => {

    url_string = service_url + jobId;

    return requestXHTTP.delete(url_string)
        .set('x-api-key', service_licence_key)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .then((res) => res.body.toString())
        .catch((err) => console.log('Error in canceling microservice', err.message));

}


module.exports.sendRequestToService = sendRequestToService;
module.exports.getServiceResponse = getServiceResponse;
module.exports.cancelService = cancelService;
module.exports.getExtServiceEndpoint = getExtServiceEndpoint
