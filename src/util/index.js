import { homedir } from 'os';
import { resolve as resolvePath } from 'path';
import EventEmitter from 'events';
import qs from 'querystring';
import { parse as parseUrl } from 'url';
import bytes from 'bytes';
import chalk from 'chalk';
import retry from 'async-retry';
import { parse as parseIni } from 'ini';
import fs from 'fs-extra';
import ms from 'ms';
import fetch from 'node-fetch';
import { URLSearchParams } from 'url';
import {
  staticFiles as getFiles,
  npm as getNpmFiles,
  docker as getDockerFiles,
} from './get-files';
import ua from './ua.ts';
import highlight from './output/highlight';
import createOutput from './output';
import { responseError } from './error';
import stamp from './output/stamp';
import { BuildError } from './errors-ts';

// Check if running windows
const IS_WIN = process.platform.startsWith('win');
const SEP = IS_WIN ? '\\' : '/';

export default class Now extends EventEmitter {
  constructor({ apiUrl, token, currentTeam, forceNew = false, debug = false }) {
    super();

    this._token = token;
    this._debug = debug;
    this._forceNew = forceNew;
    this._output = createOutput({ debug });
    this._apiUrl = apiUrl;
    this._onRetry = this._onRetry.bind(this);
    this.currentTeam = currentTeam;
  }

  retry(fn, { retries = 3, maxTimeout = Infinity } = {}) {
    return retry(fn, {
      retries,
      maxTimeout,
      onRetry: this._onRetry,
    });
  }

  _onRetry(err) {
    this._output.debug(`Retrying: ${err}\n${err.stack}`);
  }

  close() {}

  get id() {
    return this._id;
  }

  get url() {
    return `https://${this._host}`;
  }

  get fileCount() {
    return this._fileCount;
  }

  get host() {
    return this._host;
  }

  get syncAmount() {
    if (!this._syncAmount) {
      this._syncAmount = this._missing
        .map(sha => this._files.get(sha).data.length)
        .reduce((a, b) => a + b, 0);
    }

    return this._syncAmount;
  }

  get syncFileCount() {
    return this._missing.length;
  }

  _fetch(_url, opts = {}) {
    if (opts.useCurrentTeam !== false && this.currentTeam) {
      const parsedUrl = parseUrl(_url, true);
      const query = parsedUrl.query;

      query.teamId = this.currentTeam;
      _url = `${parsedUrl.pathname}?${qs.encode(query)}`;
      delete opts.useCurrentTeam;
    }

    opts.headers = opts.headers || {};
    opts.headers.accept = 'application/json';
    opts.headers.Authorization = `Bearer ${this._token}`;
    opts.headers['user-agent'] = ua;

    if (
      opts.body &&
      typeof opts.body === 'object' &&
      opts.body.constructor === Object
    ) {
      opts.body = JSON.stringify(opts.body);
      opts.headers['Content-Type'] = 'application/json';
    }

    return this._output.time(
      `${opts.method || 'GET'} ${this._apiUrl}${_url} ${opts.body || ''}`,
      fetch(`${this._apiUrl}${_url}`, opts)
    );
  }

  // public retry with built-in retrying that can be
  // used from external utilities. it optioanlly
  // receives a `retry` object in the opts that is
  // passed to the retry utility
  // it accepts a `json` option, which defaults to `true`
  // which automatically returns the json response body
  // if the response is ok and content-type json
  // it does the same for JSON` body` in opts
  async fetch(url, opts = {}) {
    return this.retry(async bail => {
      if (opts.json !== false && opts.body && typeof opts.body === 'object') {
        opts = Object.assign({}, opts, {
          body: JSON.stringify(opts.body),
          headers: Object.assign({}, opts.headers, {
            'Content-Type': 'application/json',
          }),
        });
      }
      const res = await this._fetch(url, opts);
      if (res.ok) {
        if (opts.json === false) {
          return res;
        }

        if (!res.headers.get('content-type')) {
          return null;
        }

        return res.headers.get('content-type').includes('application/json')
          ? res.json()
          : res;
      }
      const err = await responseError(res);
      if (res.status >= 400 && res.status < 500) {
        return bail(err);
      }
      throw err;
    }, opts.retry);
  }

  async getPlanMax() {
    return 10;
  }
}

function toRelative(path, base) {
  const fullBase = base.endsWith(SEP) ? base : base + SEP;
  let relative = path.substr(fullBase.length);

  if (relative.startsWith(SEP)) {
    relative = relative.substr(1);
  }

  return relative.replace(/\\/g, '/');
}

function hasNpmStart(pkg) {
  return pkg.scripts && (pkg.scripts.start || pkg.scripts['now-start']);
}

function hasFile(base, files, name) {
  const relative = files.map(file => toRelative(file, base));
  console.log(731, relative);
  return relative.indexOf(name) !== -1;
}

async function readAuthToken(path, name = '.npmrc') {
  try {
    const contents = await fs.readFile(resolvePath(path, name), 'utf8');
    const npmrc = parseIni(contents);
    return npmrc['//registry.npmjs.org/:_authToken'];
  } catch (err) {
    // Do nothing
  }
}
