import { Command } from 'commander';
import Joi from 'joi';
import signale from 'signale';
import Chain from 'middleware-chain-js';
import AWS from 'aws-sdk';
import ora from 'ora';
import Pool from 'promise-pool-js';
import State from './lib/common/states.js';
import defaultExecutor from './lib/executors/default-executor.js';

// Middlewares.
import initializationRoutines from './lib/middlewares/initialization-routines.js';
import endpointResolver from './lib/middlewares/endpoint-resolver.js';
import generateDevices from './lib/middlewares/generate-devices.js';
import schemaValidator from './lib/middlewares/schema-validator.js';

// Instanciating the middleware chain.
const chain = new Chain();

// Creating the promise pool that will throttle
// AWS API calls.
const pool = new Pool(5);

// Spinners.
const spinners = {
  // Jobs retrieval.
  jobRetrieval: null,
  // Completion spinner.
  completion: null
};

/**
 * The command options schema.
 */
 const schema = Joi.object().keys({
  number: Joi.number().min(1).required(),
  failureRate: Joi.number().min(0).max(100).default(0).optional(),
  minDelay: Joi.number().min(0).default(100).optional(),
  maxDelay: Joi.number().min(0).default(10000).optional()
}).unknown();

/**
 * Command-line interface.
 */
const program = new Command()
  .name('jobs-agent-execute')
  .description('Executes any queued job for selected amount of IoT things on the AWS IoT registry.')
  .option('-n, --number <number>', 'Specifies the amount of the things to execute the job of.')
  .option('-f, --failure-rate <percentage>', 'An optional failure percentage to insert when executing jobs.')
  .option('-m, --min-delay <milliseconds>', 'An optional minimum delay to use when executing jobs.')
  .option('-x, --max-delay <milliseconds>', 'An optional maximum delay to use when executing jobs.')
  .parse(process.argv);

/**
 * @return a text associated with the job retrieval spinner.
 * @param {*} current the current number of job retrieval.
 * @param {*} total the total number of jobs to retrieve.
 */
const jobRetrievalStats = (current, total) => `Retrieving ${total} job(s) (${current}/${total})`;

/**
 * @return a text associated with the update completion spinner
 * displaying the current firmware update completion statistics.
 * @param {*} succeeded the current number of succeeded updates.
 * @param {*} failed the current number of failed updates.
 * @param {*} total the total number of devices to update.
 */
const completionStats = (succeeded, failed, total) => `Completion statistics (${succeeded} Success, ${failed} Failures - Overall (${succeeded + failed}/${total}))`;

/**
 * Gets the next job for the thing associated
 * with the given `thingName`.
 * @param {*} endpoint the AWS IoT Jobs endpoint.
 * @param {*} thingName the thing name.
 */
const getNextJob = (endpoint, thingName) => {
  return (pool
    .enqueue(() => new AWS.IoTJobsDataPlane({ endpoint })
    .startNextPendingJobExecution({ thingName })
    .promise()
    .then((data) => data.execution || {})
  ));
};

/**
 * Updates the state of an IoT Job.
 * @param {*} endpoint the AWS IoT Jobs endpoint.
 * @param {*} job the job to update.
 * @param {*} thingName the name of the thing associated
 * with the job.
 * @param {*} state the state to associate with the job.
 */
const updateState = (endpoint, job, thingName, state) => {
  return (pool
    .enqueue(() => new AWS.IoTJobsDataPlane({ endpoint })
    .updateJobExecution({
      jobId: job.jobId,
      status: state,
      thingName
    }).promise())
  );
};

/**
 * Injecting the initialization routines into the `chain`.
 */
chain
  .use(initializationRoutines)
  .use(endpointResolver('iot:Jobs'))
  .use(schemaValidator(schema, program.opts()))
  .use(generateDevices);

/**
 * Initialization of the different components
 * of the application.
 */
chain.use((input, _, next) => {
  // Calculating the number of things to fail.
  input.thingsToFail = Math.ceil(input.number * ((input.failureRate || 0) / 100));
  signale.info(`Setting a failure rate of ${input.thingsToFail} thing(s).`);
  next();
});

/**
 * Retrieving the jobs for the devices.
 */
chain.use(async (input, _, next) => {
  let completed = 0;
  
  // Creating the job retrieval spinner.
  spinners.jobRetrieval = ora(jobRetrievalStats(0, input.number)).start();

  // A list of jobs to execute.
  input.jobs = [];

  // Retrieving all the jobs to be executed.
  await Promise.all(
    input.devices.map(async (thingName) => {
      const result = {
        thingName,
        job: await getNextJob(input.endpoint, thingName)
      };
      // Inserting the device into the array
      // only if the job is valid.
      if (result.job.jobId) {
        input.jobs.push(result);
      }
      // Updating the job retrieval spinner.
      spinners.jobRetrieval.text = jobRetrievalStats(++completed, input.number);
    })
  );
  
  spinners.jobRetrieval.succeed().stop();
  next();
});

/**
 * Executing the job and reporting the state
 * to AWS IoT Jobs.
 */
chain.use(async (input) => {
  let failed     = 0;
  let succeeded  = 0;

  // Creating the executor.
  const executor = defaultExecutor(input.thingsToFail);

  // Creating the job execution spinner.
  spinners.completion = ora(completionStats(0, 0, input.devices.length)).start();

  // Marking the devices as having either succeeded
  // or failed the job execution.
  await Promise.all(
    input.jobs.map(async (device) => {
      // Executing the job.
      const status = await executor(device, input.minDelay, input.maxDelay);
      // Reporting the job execution as succeded or failed.
      await updateState(input.endpoint, device.job, device.thingName, status);
      // Updating the job execution spinner.
      spinners.completion.text = completionStats(
        status === State.SUCCEEDED ? ++succeeded : succeeded,
        status === State.FAILED ? ++failed : failed,
        input.devices.length
      );
    })
  );

  spinners.completion.succeed().stop();
  signale.success(`The job execution has been performed on '${input.devices.length}' devices.`);
});

/**
 * Error handler.
 */
chain.use((err, _1, output, next) => {
  if (spinners.jobRetrieval) {
    spinners.jobRetrieval.stop();
  }
  if (spinners.completion) {
    spinners.completion.stop();
  }
  output.fail(err);
  next();
});

// Starting the middleware chain.
chain.handle({}, {});
