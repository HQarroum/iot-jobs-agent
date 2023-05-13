import { Command } from 'commander';
import { IoT } from '@aws-sdk/client-iot';
import signale from 'signale';
import Chain from 'middleware-chain-js';
import ora from 'ora';
import pThrottle from 'p-throttle';

// Middlewares.
import initializationRoutines from './lib/middlewares/initialization-routines.js';
import generateDevices from './lib/middlewares/generate-devices.js';
import count from './lib/middlewares/count.js';

// Instanciating the IoT Client.
const iotClient = new IoT({
  maxAttempts: 10
});

// Instanciating the middleware chain.
const chain = new Chain();

// Creating the throttling function,
// limiting 50 calls per second.
const throttle = pThrottle({ limit: 50, interval: 1000 });

// Spinners.
const spinners = {
  deletion: null
};

/**
 * Command-line interface.
 */
const program = new Command()
  .name('iot-jobs-agent delete')
  .description('Deletes the selected amount of IoT things from the AWS IoT registry.')
  .requiredOption('-n, --number <number>', 'Specifies the amount of the things to delete from AWS IoT.')
  .parse(process.argv);

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
 * @param {*} thingName a thing name to delete
 * from the AWS IoT device registry.
 * @return a promise resolved when the given
 * `thing` has been deleted.
 */
const deleteThing = throttle((thingName) => iotClient.deleteThing({ thingName }));

/**
 * Injecting the middlewares into the `chain`.
 */
 chain
  .use(count(program.opts().number))
  .use(initializationRoutines)
  .use(generateDevices);

/**
 * Creating the things on AWS IoT.
 */
chain.use(async (input, _, next) => {
  let deleted = 0;

  // Creating the deletion spinner.
  spinners.deletion = ora(thingsStats(0, input.number)).start();

  try {
    // Deleting the things.
    await Promise.all(
      input.devices.map(async (device) => {
        await deleteThing(device);
        spinners.deletion.text = thingsStats(++deleted, input.number);
      })
    );

    // Marking the spinner as having suceeded.
    spinners.deletion.succeed().stop();
    next();
  } catch (e) {
    next(e);
  }
});

/**
 * Signaling the success of the operation.
 */
chain.use((input) => signale.success(`All '${input.number}' thing(s) have been deleted from the AWS IoT device registry.`));

/**
 * Error handler.
 */
 chain.use((err, _1, output, next) => {
  spinners.deletion.stop();
  output.fail(err);
});

// Starting the middleware chain.
chain.handle({}, {});
