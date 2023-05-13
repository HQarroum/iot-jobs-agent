import { Command } from 'commander';
import { IoTJobsDataPlane } from '@aws-sdk/client-iot-jobs-data-plane';
import signale from 'signale';
import Chain from 'middleware-chain-js';
import ora from 'ora';
import pThrottle from 'p-throttle';
import Table from 'cli-table';
import chalk from 'chalk';

// Middlewares.
import initializationRoutines from './lib/middlewares/initialization-routines.js';
import endpointResolver from './lib/middlewares/endpoint-resolver.js';
import generateDevices from './lib/middlewares/generate-devices.js';
import count from './lib/middlewares/count.js';

// Instanciating the middleware chain.
const chain = new Chain();

// Creating the throttling function,
// limiting 100 calls per second.
const throttle = pThrottle({ limit: 100, interval: 1000 });

/**
 * Command-line interface.
 */
const program = new Command()
  .name('iot-jobs-agent status')
  .description('Retrieves the next job and its status for the selected amount of IoT things from the AWS IoT registry.')
  .requiredOption('-n, --number <number>', 'Specifies the amount of the things to retrieve the job of from AWS IoT.')
  .parse(process.argv);

/**
 * Gets the next job for the thing associated
 * with the given `thingName`.
 * @param {*} iotJobsClient the AWS IoT Jobs data plane client.
 * @param {*} thingName the name of the thing to retrieve the next job of.
 */
const getJob = throttle(async (iotJobsClient, thingName) => {
  // Retrieve the next job for the given thing.
  const data = await iotJobsClient.describeJobExecution({
    thingName,
    jobId: '$next',
    includeJobDocument: true
  });
  
  data.execution = data.execution || {};
  data.execution.thingName = thingName;
  return (data.execution);
});

/**
 * Injecting the middlewares into the `chain`.
 */
chain
  .use(count(program.opts().number))
  .use(initializationRoutines)
  .use(endpointResolver('iot:Jobs'))
  .use(generateDevices);

/**
 * Instanciating and configuring the `IoTJobsDataPlane` client.
 */
chain.use((input, _, next) => {
  next(input.iotJobsClient = new IoTJobsDataPlane({
    endpoint: input.endpoint,
    maxAttempts: 10
  }));
});

/**
 * Creating the things on AWS IoT.
 */
chain.use(async (input, _, next) => {
  const spinner = ora(`Retrieving ${input.number} things statuses from the AWS IoT Jobs API`).start();
  
  // Retrieving the current job for each thing.
  input.jobs = await Promise.all(
    input.devices.map((thingName) => getJob(input.iotJobsClient, thingName))
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
  output.fail(err.message);
  next();
});

// Starting the middleware chain.
chain.handle({}, {});
