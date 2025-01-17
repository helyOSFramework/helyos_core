// External microservices
// ----------------------------------------------------------------------------

import * as requestXHTTP from 'superagent';

const getExtServiceEndpoint = (serviceUrl: string, serviceClass: string): string => {
    const url = serviceUrl;
    if (!url) {
        return " ";
    }
    return url;
};

const parseResponseToJson = (res: any): any => {
    let data:any = null;
    if (Object.keys(res.body).length === 0) {
        try {
            data = JSON.parse(res.text);
        } catch (error) {
            data = {
                'text': res.text,
            };
        }
    } else {
        data = res.body;
    }
    if (!data) {
        data = {};
    }
    return data;
};

const sendRequestToService = (service_url: string, service_licence_key: string, request: any, context: any, config: any): Promise<any> => {
    console.log('=============================\nDispatch request to service:');
    console.log(service_url);
    console.log('=============================');

    const url_string = service_url;
    // const request_string = JSON.stringify({request, context, config});
    return requestXHTTP.post(url_string)
        .set('x-api-key', service_licence_key)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
            request,
            context,
            config,
        })
        .then((res: any) => parseResponseToJson(res))
        .catch((err: any) => {
            if (err.response) {
                err.data = parseResponseToJson(err.response);
            } else if (err.code === 'ENOTFOUND') {
                err.message = 'Microservice is unreachable.';
            }

            err.message = err.message + `: [${service_url}]`;
            throw err;
        });
};

const getServiceResponse = (service_url: string, service_licence_key: string, jobId: string): Promise<any> => {
    const url_string = service_url + jobId;

    return requestXHTTP.get(url_string)
        .set('x-api-key', service_licence_key)
        .then((res: any) => {
            let data;
            if (Object.keys(res.body).length === 0) {
                data = JSON.parse(res.text);
            } else {
                data = res.body;
            }
            return data;
        })
        .catch((err: any) => console.log('\n==== Error in getting microservice response ===', err.message));
};

const cancelService = (service_url: string, service_licence_key: string, jobId: string): Promise<string> => {
    const url_string = service_url + jobId;

    return requestXHTTP.delete(url_string)
        .set('x-api-key', service_licence_key)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .then((res: any) => res.body.toString())
        .catch((err: any) => console.log('Error in canceling microservice', err.message));
};

export {
    sendRequestToService,
    getServiceResponse,
    cancelService,
    getExtServiceEndpoint,
};
