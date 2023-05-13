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
  creation: null
};

/**
 * Command-line interface.
 */
const program = new Command()
  .name('iot-jobs-agent create')
  .description('Creates the selected amount of IoT things in the AWS IoT registry.')
  .requiredOption('-n, --number <number>', 'Specifies the amount of the things to create on AWS IoT.')
  .parse(process.argv);

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
const createThing = throttle((thingName) => {
  return (iotClient.createThing({
    thingName,
    attributePayload: {
      attributes: { device_simulator: 'true' }
    }
  }));
});

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
  let created = 0;

  // Creating the creation spinner.
  spinners.creation = ora(thingsStats(0, input.number)).start();
  
  // Creating the things on AWS IoT.
  try {
    await Promise.all(
      input.devices.map(async (device) => {
        await createThing(device);
        spinners.creation.text = thingsStats(++created, input.number);
      })
    );

    // Marking the spinner as having suceeded.
    spinners.creation.succeed().stop();
    next();
  } catch (e) {
    next(e);
  }
});

/**
 * Signaling the success of the operation.
 */
chain.use((input) => signale.success(`All '${input.number}' thing(s) have been created on the AWS IoT device registry.`));

/**
 * Error handler.
 */
chain.use((err, _1, output, next) => {
  spinners.creation.stop();
  output.fail(err);
});

// Starting the middleware chain.
chain.handle({}, {});
