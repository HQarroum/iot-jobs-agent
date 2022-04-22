#!/usr/bin/env node

import _ from 'lodash';
import { Command } from 'commander';
import { createRequire } from "module";

// Retrieving package informations.
const { version, description } = createRequire(import.meta.url)('./package.json');

// Initializing commander.
const program = new Command();

/**
 * Command-line interface.
 */
program
  .version(version)
  .name('jobs-agent')
  .description(description)
  .command('create', 'Creates the selected amount of IoT things on the AWS IoT registry.')
  .command('execute', 'Executes any queued job for selected amount of IoT things on the AWS IoT registry.')
  .command('delete', 'Deletes the selected amount of IoT things from the AWS IoT registry.')
  .command('status', 'Retrieves the next job and its status for the selected amount of IoT things from the AWS IoT registry.')
  .parse(process.argv);

// Error handling.
if (!_.find(program.commands, (cmd) => cmd.name() === program.args[0])) {
  program.outputHelp();
  process.exit(-1);
}