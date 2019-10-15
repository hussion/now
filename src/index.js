#!/usr/bin/env node

import 'core-js/modules/es.symbol.async-iterator';
import { join } from 'path';
import { existsSync } from 'fs';
import sourceMap from '@zeit/source-map-support';
import { mkdirp } from 'fs-extra';
import chalk from 'chalk';
import epipebomb from 'epipebomb';
import error from './util/output/error';
import param from './util/output/param.ts';
import info from './util/output/info';
import getNowDir from './util/config/global-path';
import {
  getDefaultConfig,
} from './util/config/get-default';
import hp from './util/humanize-path';
import commands from './commands/index.ts';
import * as configFiles from './util/config/files';
import pkg from './util/pkg.ts';
import createOutput from './util/output';
import getArgs from './util/get-args';
import cmd from './util/output/cmd';
import { handleError } from './util/error';
import reportError from './util/report-error';
import getConfig from './util/get-config';
import * as ERRORS from './util/errors-ts';
import { NowError } from './util/now-error';
import getUpdateCommand from './util/get-update-command';

const NOW_DIR = getNowDir();
const NOW_CONFIG_PATH = configFiles.getConfigFilePath();

const GLOBAL_COMMANDS = new Set(['help']);

epipebomb();

sourceMap.install();


let debug = () => {};
let apiUrl = 'https://api.xxx.com';

const main = async argv_ => {
  const { isTTY } = process.stdout;

  let argv = null;

  try {
    argv = getArgs(
      argv_,
      {
        '--version': Boolean,
        '-v': '--version',
        '--debug': Boolean,
        '-d': '--debug',
      },
      { permissive: true }
    );
  } catch (err) {
    handleError(err);
    return 1;
  }

  const isDebugging = argv['--debug'];
  const output = createOutput({ debug: isDebugging });

  debug = output.debug;

  const localConfigPath = argv['--local-config'];
  const localConfig = await getConfig(output, localConfigPath);

  if (localConfigPath && localConfig instanceof ERRORS.CantFindConfig) {
    output.error(
      `Couldn't find a project configuration file at \n    ${localConfig.meta.paths.join(
        ' or\n    '
      )}`
    );
    return 1;
  }

  if (localConfig instanceof ERRORS.CantParseJSONFile) {
    output.error(`Couldn't parse JSON file ${localConfig.meta.file}.`);
    return 1;
  }

  if (
    localConfig instanceof NowError &&
    !(localConfig instanceof ERRORS.CantFindConfig)
  ) {
    output.error(`Failed to load local config file: ${localConfig.message}`);
    return 1;
  }

  // the second argument to the command can be a path
  // (as in: `now path/`) or a subcommand / provider
  // (as in: `now ls`)
  const targetOrSubcommand = argv._[2];

  let update = null;

  // 版本更新检查
  try {
    if (targetOrSubcommand !== 'update') {
      update = null; //{latest: 'xxxx'};
    }
  } catch (err) {
    console.error(
      error(`Checking for updates failed${isDebugging ? ':' : ''}`)
    );

    if (isDebugging) {
      console.error(err);
    }
  }

  if (update && isTTY) {
    console.log(
      info(
        `${chalk.bgRed('UPDATE AVAILABLE')} ` +
          `Run ${cmd(await getUpdateCommand())} to install FMD CLI ${
            update.latest
          }`
      )
    );
  }

  debug(`Using FMD CLI ${pkg.version}`);

  // we want to handle version or help directly only
  if (!targetOrSubcommand) {
    if (argv['--version']) {
      console.log(require('../package').version);
      return 0;
    }
  }

  let fmdDirExists;

  try {
    fmdDirExists = existsSync(NOW_DIR);
  } catch (err) {
    console.error(
      error(
        `${'An unexpected error occurred while trying to find the ' +
          'fmd global directory: '}${err.message}`
      )
    );

    return 1;
  }

  if (!fmdDirExists) {
    try {
      await mkdirp(NOW_DIR);
    } catch (err) {
      console.error(
        error(
          `${'An unexpected error occurred while trying to create the ' +
            `fmd global directory "${hp(NOW_DIR)}" `}${err.message}`
        )
      );
    }
  }

  let configExists;

  try {
    configExists = existsSync(NOW_CONFIG_PATH);
  } catch (err) {
    console.error(
      error(
        `${'An unexpected error occurred while trying to find the ' +
          `fmd config file "${hp(NOW_CONFIG_PATH)}" `}${err.message}`
      )
    );

    return 0;
  }

  let config;

  if (configExists) {
    try {
      config = configFiles.readConfigFile();
    } catch (err) {
      console.error(
        error(
          `${'An unexpected error occurred while trying to read the ' +
            `fmd config in "${hp(NOW_CONFIG_PATH)}" `}${err.message}`
        )
      );

      return 1;
    }

    // This is from when Now CLI supported
    // multiple providers. In that case, we really
    // need to migrate.
    if (
      config.sh ||
      config.user ||
      typeof config.user === 'object' ||
      typeof config.currentTeam === 'object'
    ) {
      configExists = false;
    }
  }

  if (!configExists) {
    const results = await getDefaultConfig(config);

    config = results.config;
    migrated = results.migrated;

    try {
      configFiles.writeToConfigFile(config);
    } catch (err) {
      console.error(
        error(
          `${'An unexpected error occurred while trying to write the ' +
            `default fmd config to "${hp(NOW_CONFIG_PATH)}" `}${err.message}`
        )
      );

      return 1;
    }
  }

  // the context object to supply to the providers or the commands
  const ctx = {
    config,
    authConfig: null,
    localConfig,
    argv: argv_,
  };

  let subcommand;

  // we check if we are deploying something
  if (targetOrSubcommand) {
    const targetPath = join(process.cwd(), targetOrSubcommand);
    const targetPathExists = existsSync(targetPath);
    const subcommandExists =
      GLOBAL_COMMANDS.has(targetOrSubcommand) ||
      commands.has(targetOrSubcommand);

    if (targetPathExists && subcommandExists) {
      console.error(
        error(
          `The supplied argument ${param(targetOrSubcommand)} is ambiguous. ` +
            'Both a directory and a subcommand are known'
        )
      );
      return 1;
    }

    if (subcommandExists) {
      debug('user supplied known subcommand', targetOrSubcommand);
      subcommand = targetOrSubcommand;
    } else {
      debug('user supplied a possible target for deployment');
      // our default command is deployment
      // at this point we're
      subcommand = 'help';
    }
  } else {
    debug('user supplied no target, defaulting to help');
    subcommand = 'help';
  }

  if (subcommand === 'help') {
    ctx.argv.push('-h');
  }

  const targetCommand = commands.get(subcommand);

  if (!targetCommand) {
    const sub = param(subcommand);
    console.error(error(`The ${sub} subcommand does not exist`));
    return 1;
  }

  let exitCode;

  try {
    const full = require(`./commands/${targetCommand}`).default;
    exitCode = await full(ctx);

  } catch (err) {

    await reportError(err, apiUrl, configFiles);

    // If there is a code we should not consider the error unexpected
    // but instead show the message. Any error that is handled by this should
    // actually be handled in the sub command instead. Please make sure
    // that happens for anything that lands here. It should NOT bubble up to here.
    if (err.code) {
      output.debug(err.stack);
      output.error(err.message);

      return 1;
    }

    // Otherwise it is an unexpected error and we should show the trace
    // and an unexpected error message
    output.error(`An unexpected error occurred in ${subcommand}: ${err.stack}`);
    return 1;
  }

  return exitCode;
};

debug('start');

const handleRejection = async err => {
  debug('handling rejection');

  if (err) {
    if (err instanceof Error) {
      await handleUnexpected(err);
    } else {
      console.error(error(`An unexpected rejection occurred\n  ${err}`));
      await reportError(err, apiUrl, configFiles);
    }
  } else {
    console.error(error('An unexpected empty rejection occurred'));
  }

  process.exit(1);
};

const handleUnexpected = async err => {
  const { message } = err;

  // We do not want to render errors about Sentry not being reachable
  if (message.includes('sentry') && message.includes('ENOTFOUND')) {
    debug(`Sentry is not reachable: ${err}`);
    return;
  }

  await reportError(err, apiUrl, configFiles);
  debug('handling unexpected error');

  console.error(
    error(`An unexpected error occurred!\n  ${err.stack} ${err.stack}`)
  );

  process.exit(1);
};

process.on('unhandledRejection', handleRejection);
process.on('uncaughtException', handleUnexpected);

// Don't use `.then` here. We need to shutdown gracefully, otherwise
// subcommands waiting for further data won't work (like `logs` and `logout`)!
main(process.argv)
  .then(exitCode => {
    process.exitCode = exitCode;
    process.emit('nowExit');
  })
  .catch(handleUnexpected);
