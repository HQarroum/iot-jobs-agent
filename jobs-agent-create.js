import { Command } from 'commander';
import signale from 'signale';
import Chain from 'middleware-chain-js';
import AWS from 'aws-sdk';
import ora from 'ora';
import Pool from 'promise-pool-js';
import Joi from 'joi';

// Middlewares.
import initializationRoutines from './lib/middlewares/initialization-routines.js';
import generateDevices from './lib/middlewares/generate-devices.js';
import schemaValidator from './lib/middlewares/schema-validator.js';

// Instanciating the middleware chain.
const chain = new Chain();

// Creating the promise pool.
const pool = new Pool(10);

// Spinners.
const spinners = {
  creation: null
};

/**
 * The command options schema.
 */
const schema = Joi.object().keys({
  number: Joi.number().min(1).required()
}).unknown();

/**
 * Command-line interface.
 */
const program = new Command()
  .name('jobs-agent-create')
  .description('Creates the selected amount of IoT things on the AWS IoT registry.')
  .option('-n, --number <number>', 'Specifies the amount of the things to create on AWS IoT.')
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
      resolve();
    });
  })));
};

/**
 * Injecting the middlewares into the `chain`.
 */
 chain
  .use(initializationRoutines)
  .use(schemaValidator(schema, program.opts()))
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
