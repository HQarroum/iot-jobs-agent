/**
 * @return the name of a thing given its `idx`.
 * @param {*} idx the index of the thing.
 */
const thingName = (idx) => `jobs-thing-${idx}`;

/**
 * A middleware that will generate an array of devices
 * with their thing names.
 */
export default (n) => async (input, _, next) => {
  input.devices = [...Array(n).keys()].map(thingName);
  next();
};