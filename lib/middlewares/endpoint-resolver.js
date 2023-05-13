import { IoT } from '@aws-sdk/client-iot';

/**
 * Resolves the current AWS IoT endpoint.
 * @return a promise resolved when the current
 * AWS IoT endpoint has been resolved.
 */
const describeEndpoint = (type) => {
  return (new IoT().describeEndpoint({
    endpointType: type
  })
  .then((data) => `https://${data.endpointAddress}`));
};

/**
 * A middleware that will resolve the given endpoint type
 * and store it in the input of the chain.
 */
export default (type) => async (input, _, next) => {
  try {
    next(input.endpoint = await describeEndpoint(type));
  } catch (e) {
    next(e);
  }
};