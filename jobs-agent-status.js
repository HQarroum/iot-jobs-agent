import { Command } from 'commander';
import signale from 'signale';
import Chain from 'middleware-chain-js';
import AWS from 'aws-sdk';
import ora from 'ora';
import Pool from 'promise-pool-js';
import Table from 'cli-table';
import chalk from 'chalk';
import Joi from 'joi';

// Middlewares.
import initializationRoutines from './lib/middlewares/initialization-routines.js';
import endpointResolver from './lib/middlewares/endpoint-resolver.js';
import generateDevices from './lib/middlewares/generate-devices.js';
import schemaValidator from './lib/middlewares/schema-validator.js';

// Instanciating the middleware chain.
const chain = new Chain();

// Creating the promise pool.
const pool = new Pool(5);

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
  .name('jobs-agent-status')
  .description('Retrieves the next job and its status for the selected amount of IoT things from the AWS IoT registry.')
  .option('-n, --number <number>', 'Specifies the amount of the things to retrieve the job of from AWS IoT.')
  .parse(process.argv);

/**
 * Gets the next job for the thing associated
 * with the given `thingName`.
 * @param {*} thingName the thing index.
 */
const getJob = (endpoint, thingName) => {
  return (pool.enqueue(() => new Promise((resolve, reject) => {
    new AWS.IoTJobsDataPlane({ endpoint }).describeJobExecution({
      thingName,
      jobId: '$next',
      includeJobDocument: true
    }, (err, data) => {
      if (err) {
        return (reject(err));
      }
      data.execution = data.execution || {};
      data.execution.thingName = thingName;
      resolve(data.execution);
    });
  })));
};

/**
 * Injecting the middlewares into the `chain`.
 */
chain
  .use(initializationRoutines)
  .use(endpointResolver('iot:Jobs'))
  .use(schemaValidator(schema, program.opts()))
  .use(generateDevices);

/**
 * Creating the things on AWS IoT.
 */
chain.use(async (input, _, next) => {
  const spinner = ora(`Retrieving ${input.number} things statuses from the AWS IoT Jobs API`).start();
  
  // Retrieving the current job for each thing.
  input.jobs = await Promise.all(
    input.devices.map((thingName) => getJob(input.endpoint, thingName))
  );
  
  // Marking the spinner as having suceeded.
  spinner.succeed().stop();
  next();
});

/**
 * Dumping thing(s) jobs on the standard output.
 */
chain.use((input, _, next) => {
  const table = new Table({
    head: ['Thing', 'JobId', 'Status', 'Details']
  });
  const noJobScheduled = chalk.grey('No Job Scheduled');
  // Displaying gathered job information for each thing.
  input.jobs.forEach((job) => {
    !job.jobId ?
      table.push([
        job.thingName, noJobScheduled, noJobScheduled, noJobScheduled
      ]) :
      table.push([
        job.thingName, job.jobId, job.status || 'No Status', job.statusDetails ? JSON.stringify(job.statusDetails) : 'No details'
      ])
  });
  console.log(`\n${table.toString()}\n`);
  next();
});

/**
 * Signaling the success of the operation.
 */
chain.use((input) => signale.success(`All '${input.number}' thing(s) statuses have been retrieved from the AWS IoT Jobs API.`));

/**
 * Error handler.
 */
chain.use((err, _1, output, next) => {
  output.fail(err);
  next();
});

// Starting the middleware chain.
chain.handle({}, {});
