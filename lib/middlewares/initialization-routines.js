import signale from 'signale';

/**
 * Exits the application with the given `err` message.
 * @param {*} err the error message to display.
 */
const fail = (err) => {
  signale.fatal(err);
  process.exit(1);
};

/**
 * Exporting the initialization routines, ensuring
 * that the environment is properly configured.
 */
export default [

  /**
   * Registers `outputs`.
   */
  (_, output, next) => {
    next(output.fail = fail);
  }
];