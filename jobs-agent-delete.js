import { Command } from 'commander';
import signale from 'signale';
import Chain from 'middleware-chain-js';
import AWS from 'aws-sdk';
import ora from 'ora';
import Pool from 'promise-pool-js';

// Middlewares.
import initializationRoutines from './lib/middlewares/initialization-routines.js';
import generateDevices from './lib/middlewares/generate-devices.js';

// Instanciating the middleware chain.
const chain = new Chain();

// Creating the promise pool.
const pool = new Pool(10);

// Statistics.
const statistics = {
  deleted: 0
};

// Spinners.
const spinners = {
  deletion: null
};

/**
 * Command-line interface.
 */
const program = new Command()
  .name('jobs-agent-delete')
  .description('Deletes the selected amount of IoT things from the AWS IoT registry.')
  .option('-n, --number <number>', 'Specifies the amount of the things to delete from AWS IoT.')
  .parse(process.argv);

/**
 * Constants.
 */
const deviceNumber = parseInt(program.opts().number, 10);

/**
 * @return a text associated with the deletion spinner
 * displaying the current deletion statistics.
 * @param {*} current the current number of deleted things.
 * @param {*} total the total number of devices to delete.
 */
const thingsStats = (current, total) => `Deleting ${total} thing(s) from AWS IoT (${current}/${total})`;

/**
 * Deletes the given `thing` from the AWS IoT
 * device registry.
 * @param {*} thing a thing name to delete
 * from the AWS IoT device registry.
 * @return a promise resolved when the given
 * `thing` has been deleted.
 */
const deleteThing = async (thing) => {
  return (pool
    .enqueue(() => new AWS.Iot().deleteThing({ thingName: thing }).promise())
    .then(() => {
      // Incrementing the `deleted` statistic.
      statistics.deleted++;
      // Updating the spinner and resolving the promise.
      spinners.deletion.text = thingsStats(statistics.deleted, deviceNumber);
      return (Promise.resolve());
    })
  );
};

/**
 * Injecting the initialization routines into the `chain`.
 */
chain.use(initializationRoutines);

/**
 * Verifying whether the given options are valid.
 */
 chain.use((_, output, next) => {
  if (!deviceNumber) {
    return (output.fail(`Parameter 'number' was expected, but not found.`));
  }
  next();
});

/**
 * Injecting the devices into the `chain`.
 */
chain.use(generateDevices(deviceNumber));

/**
 * Creating the things on AWS IoT.
 */
chain.use(async (input, _, next) => {
  spinners.deletion = ora(thingsStats(0, deviceNumber)).start();
  
  // Deleting the things.
  await Promise.all(
    input.devices.map(deleteThing)
  );

  // Marking the spinner as having suceeded.
  spinners.deletion.succeed().stop();
  next();
});

/**
 * Signaling the success of the operation.
 */
chain.use(() => signale.success(`All '${deviceNumber}' thing(s) have been deleted from the AWS IoT device registry.`));

/**
 * Error handler.
 */
 chain.use((err, _1, output, next) => {
  spinners.deletion.stop();
  output.fail(err);
  next();
});

// Starting the middleware chain.
chain.handle({}, {});
