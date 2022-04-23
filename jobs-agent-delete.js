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
  deletion: null
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
  .name('jobs-agent-delete')
  .description('Deletes the selected amount of IoT things from the AWS IoT registry.')
  .option('-n, --number <number>', 'Specifies the amount of the things to delete from AWS IoT.')
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
 * @param {*} thing a thing name to delete
 * from the AWS IoT device registry.
 * @return a promise resolved when the given
 * `thing` has been deleted.
 */
const deleteThing = (thing) => {
  return (pool
    .enqueue(() => new AWS.Iot().deleteThing({ thingName: thing }).promise())
  );
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
  let deleted = 0;

  // Creating the deletion spinner.
  spinners.deletion = ora(thingsStats(0, input.number)).start();

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
  next();
});

// Starting the middleware chain.
chain.handle({}, {});
