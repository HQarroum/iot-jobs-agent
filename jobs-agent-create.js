import signale from 'signale';
import Chain from 'middleware-chain-js';
import AWS from 'aws-sdk';
import ora from 'ora';
import Pool from 'promise-pool-js';
import { Command } from 'commander';

// Middlewares.
import initializationRoutines from './lib/middlewares/initialization-routines.js';
import generateDevices from './lib/middlewares/generate-devices.js';

// Instanciating the middleware chain.
const chain = new Chain();

// Creating the promise pool.
const pool = new Pool(10);

// Statistics.
const statistics = {
  created: 0
};

// Spinners.
const spinners = {
  creation: null
};

/**
 * Command-line interface.
 */
const program = new Command()
  .name('jobs-agent-create')
  .description('Creates the selected amount of IoT things on the AWS IoT registry.')
  .option('-n, --number <number>', 'Specifies the amount of the things to create on AWS IoT.')
  .parse(process.argv);

/**
 * Constants.
 */
const deviceNumber = parseInt(program.opts().number, 10);

/**
 * @return a text associated with the creation spinner
 * displaying the current creation statistics.
 * @param {*} current the current number of created things.
 * @param {*} total the total number of devices to create.
 */
const thingsStats = (current, total) => `Creating ${total} thing(s) on AWS IoT (${current}/${total})`;

/**
 * Creates a thing in the AWS IoT registry.
 * @param {*} thingName the name of the thing to create.
 */
const createThing = (thingName) => {
  return (pool.enqueue(() => new Promise((resolve, reject) => {
    new AWS.Iot().createThing({
      thingName,
      attributePayload: {
        attributes: { device_simulator: 'true' }
      },
    }, (err) => {
      if (err && err.name !== 'ResourceAlreadyExistsException') {
        return (reject(err));
      }
      // Incrementing the `created` statistic.
      statistics.created++;
      // Updating the spinner and resolving the promise.
      resolve(spinners.creation.text = thingsStats(statistics.created, deviceNumber));
    });
  })));
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
  spinners.creation = ora(thingsStats(0, deviceNumber)).start();
  
  // Creating the things on AWS IoT.
  await Promise.all(
    input.devices.map(createThing)
  );

  // Marking the spinner as having suceeded.
  spinners.creation.succeed().stop();
  next();
});

/**
 * Signaling the success of the operation.
 */
chain.use(() => signale.success(`All '${deviceNumber}' thing(s) have been created on the AWS IoT device registry.`));

/**
 * Error handler.
 */
chain.use((err, _1, output, next) => {
  spinners.creation.stop();
  output.fail(err);
  next();
});

// Starting the middleware chain.
chain.handle({}, {});
