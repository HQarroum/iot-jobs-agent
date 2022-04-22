import AWS from 'aws-sdk';

/**
 * Resolves the current AWS IoT endpoint.
 * @return a promise resolved when the current
 * AWS IoT endpoint has been resolved.
 */
 const describeEndpoint = (type) => {
  return (new Promise((resolve, reject) => {
    new AWS.Iot().describeEndpoint({
      endpointType: type
    }, (err, data) => err ? reject(err) : resolve(data.endpointAddress));
  }));
};

/**
 * A middleware that will resolve the given endpoint type
 * and store it in the input of the chain.
 */
export default (type) => async (input, _, next) => {
  input.endpoint = await describeEndpoint(type);
  next();
};