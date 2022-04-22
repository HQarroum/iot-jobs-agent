import State from '../common/states.js';

/**
 * @param {*} min the minimum delay.
 * @param {*} max the maximum delay.
 * @returns a random delay between the given `min` and `max` values.
 */
const asyncRandom = (min, max) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), Math.floor(Math.random() * (max - min + 1)) + min);
  });
};

/**
 * Simulates the execution of a job by taking
 * the amount of things to fail and a random number
 * between the min and max delay.
 */
export default (thingsToFail) => async (_, delayMin, delayMax) => {
  let status = State.SUCCEEDED;

  // If there are things to fail, mark the status
  // as a state of failure.
  if (thingsToFail > 0) {
    thingsToFail--;
    status = State.FAILED;
  }

  // Simulating work for a random amount of time.
  await asyncRandom(delayMin, delayMax);
  return (status);
};
