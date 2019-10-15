import chalk from 'chalk';

import { NowContext } from '../../types';
import logo from '../../util/output/logo';

const outputHelp = () => {
  console.log(`
  ${chalk.bold(`${logo} FMD`)} [options] <command>

  ${chalk.dim('Commands:')}

    init                 [template]  Initialize an project
    dev                              Start a local development server
    deploy               [path]      Performs a deployment

  ${chalk.dim('Options:')}

    -h, --help                     Output usage information
    -v, --version                  Output the version number
    -d, --debug                    Debug mode [off]
  `);
};

export default async function main(ctx: NowContext) {
  console.log('--- deploy main fn.');
  return 0;
}
