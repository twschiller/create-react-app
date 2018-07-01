// @remove-on-eject-begin
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @remove-on-eject-end
'use strict';

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

// Ensure environment variables are read.
require('../config/env');
// @remove-on-eject-begin
// Do the preflight check (only happens before eject).
const verifyPackageTree = require('./utils/verifyPackageTree');
if (process.env.SKIP_PREFLIGHT_CHECK !== 'true') {
  verifyPackageTree();
}
// @remove-on-eject-end

const chalk = require('chalk');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const clearConsole = require('react-dev-utils/clearConsole');
const checkRequiredFiles = require('react-dev-utils/checkRequiredFiles');
const {
  choosePort,
  createCompiler,
  prepareProxy,
  prepareUrls,
} = require('react-dev-utils/WebpackDevServerUtils');
const openBrowser = require('react-dev-utils/openBrowser');
const paths = require('../config/paths');
const config = require('../config/webpack.config.dev');
const serverConfig = require('../config/webpack.config.dev-server');
const createDevServerConfig = require('../config/webpackDevServer.config');

const isInteractive = process.stdout.isTTY;

// Warn and crash if required files are missing
if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs])) {
  process.exit(1);
}

// Tools like Cloud9 rely on this.
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

if (process.env.HOST) {
  console.log(
    chalk.cyan(
      `Attempting to bind to HOST environment variable: ${chalk.yellow(
        chalk.bold(process.env.HOST)
      )}`
    )
  );
  console.log(
    `If this was unintentional, check that you haven't mistakenly set it in your shell.`
  );
  console.log(
    `Learn more here: ${chalk.yellow('http://bit.ly/CRA-advanced-config')}`
  );
  console.log();
}

// Copy the defaultFeatures logic from webpack-dev-server. We need to hack the
// default features in order to ensure that our custom serverSideRender
// middleware always runs after contentBaseFiles but before the other default
// features. Running "after" last will result in the public index always being
// rendered (for some reason).
const createDefaultFeatures = (options) => {
  const { after, contentBase } = options
  const defaultFeatures = ['before', 'setup', 'headers', 'middleware'];
  if (options.proxy) { defaultFeatures.push('proxy', 'middleware'); }
  // Ensure "after" runs after "middleware" and "contentBaseFiles" but before evertything else
  if (contentBase !== false) { defaultFeatures.push('contentBaseFiles', 'after'); }
  else if (after) { defaultFeatures.push('after'); }
  if (options.watchContentBase) { defaultFeatures.push('watchContentBase'); }
  if (options.historyApiFallback) {
    defaultFeatures.push('historyApiFallback', 'middleware');
    // Ensure "after" runs after "middleware" and "contentBaseFiles" but before evertything else
    if (contentBase !== false) { defaultFeatures.push('contentBaseFiles', 'after'); }
    else if (after) { defaultFeatures.push('after'); }
  }
  defaultFeatures.push('magicHtml');
  // NOTE: contentBaseIndex is the devil 😈. *Never* enable it.
  // if (contentBase !== false) { defaultFeatures.push('contentBaseIndex'); }
  // compress is placed last and uses unshift so that it will be the first middleware used
  if (options.compress) { defaultFeatures.unshift('compress'); }
  return defaultFeatures
}

// We require that you explictly set browsers and do not fall back to
// browserslist defaults.
const { checkBrowsers } = require('react-dev-utils/browsersHelper');
checkBrowsers(paths.appPath)
  .then(() => {
    // We attempt to use the default port but if it is busy, we offer the user to
    // run on a different port. `choosePort()` Promise resolves to the next free port.
    return choosePort(HOST, DEFAULT_PORT);
  })
  .then(port => {
    if (port == null) {
      // We have not found a port.
      return;
    }
    const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
    const appName = require(paths.appPackageJson).name;
    const urls = prepareUrls(protocol, HOST, port);
    // Create a webpack compiler that is configured with custom messages.
    const compiler = createCompiler(
      webpack,
      [config, serverConfig],
      appName,
      urls,
      paths.useYarn
    );
    // Load proxy config
    const proxySetting = require(paths.appPackageJson).proxy;
    const proxyConfig = prepareProxy(proxySetting, paths.appPublic);
    // Serve webpack assets generated by the compiler over a web server.
    const devServerConfig = createDevServerConfig(
      proxyConfig,
      urls.lanUrlForConfig
    );

    // While webpack-dev-middleware supports a serverSideRender option,
    // webpack-dev-server does not. We're passing in the serverSideRender
    // option from webpackDevServer.config.js but there's no good way to have
    // our reactApp middleware run in the right place. So, we need to override
    // the features option to include our "after" middleware in the right spots.
    // NOTE: this will break if you're already using the features option.
    // TODO: emit a warning if you're using the features option.
    if (devServerConfig.serverSideRender) {
      devServerConfig.features = createDefaultFeatures(devServerConfig)
    }
    const devServer = new WebpackDevServer(compiler, devServerConfig);
    // Launch WebpackDevServer.
    devServer.listen(port, HOST, err => {
      if (err) {
        return console.log(err);
      }
      if (isInteractive) {
        clearConsole();
      }
      console.log(chalk.cyan('Starting the development server...\n'));
      openBrowser(urls.localUrlForBrowser);
    });

    ['SIGINT', 'SIGTERM'].forEach(function(sig) {
      process.on(sig, function() {
        devServer.close();
        process.exit();
      });
    });
  })
  .catch(err => {
    if (err && err.message) {
      console.log(err.message);
    }
    process.exit(1);
  });
