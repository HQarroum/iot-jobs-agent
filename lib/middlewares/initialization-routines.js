import signale from 'signale';
import SDK from 'aws-sdk';
import agent from 'proxy-agent';
import proxy from '../common/proxy.js';

/**
 * Exits the application with the given `err` message.
 * @param {*} err the error message to display.
 */
const fail = (err) => {
  signale.fatal(err);
  process.exit(1);
};

/**
 * @return an AWS region specified in the current
 * process environment.
 */
const getEnvironmentRegion = () => process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || process.env.AMAZON_REGION;

/**
 * Exporting the initialization routines, ensuring
 * that the environment is properly configured.
 */
export default [

  /**
   * Registers `outputs`.
   */
  (_, output, next) => {
    next(output.fail = fail);
  },

  /**
   * Trying to load the current region from the current
   * AWS profile.
   */
  (_1, _2, next) => {
    // The currently defined region.
    let region = getEnvironmentRegion();
    
    try {
      // If no `region` is set, we try to load it using the current
      // AWS profile.
      if (!region) {
        const toCheck = [
          { filename: process.env[SDK.util.sharedCredentialsFileEnv] },
          { isConfig: true, filename: process.env[SDK.util.sharedConfigFileEnv] }
        ];
        // Trying to compute the region.
        while (!region && toCheck.length) {
          const configFile = SDK.util.iniLoader.loadFrom(toCheck.shift());
          let profile = configFile[process.env.AWS_PROFILE || SDK.util.defaultProfile];
          region = profile && profile.region;
        }
        if (region) {
          // If a region is found, we update the SDK configuration.
          SDK.config.update({ region });
        }
      }
    } catch (e) { /**/ }
    next();
  },

  /**
   * Computing the AWS Region.
   */
  (input, _1, next) => {
    // Using the `region` given as an environment parameter.
    const env = getEnvironmentRegion();

    if (env) {
      signale.success(`Using the region provided as an environment parameter ('${env}')`);
      SDK.config.update({ region: env });
      return (next(input.region = env));
    }

    // Using the `region` loaded by the AWS SDK.
    if (SDK.config.region) {
      signale.success(`Using the region loaded by the AWS SDK ('${SDK.config.region}')`);
      return (next(input.region = SDK.config.region));
    }

    // Using the default region.
    input.region = 'us-east-1';
    signale.warn(`Using the default region ('${input.region}')`);
    SDK.config.update({ region: input.region });
    next();
  },

  /**
   * Configuring the AWS SDK to handle proper
   * timeouts and proxy agents.
   */
  (input, _1, next) => {
    if (proxy.hasProxy()) {
      signale.info(`Tunneling requests through the proxy server '${proxy.getProxy()}'.`);
    }
    // Configuring the AWS SDK.
    SDK.config.update({
      httpOptions: {
        agent: proxy.hasProxy() ? agent(proxy.getProxy()) : null,
        connectTimeout: 5 * 1000,
        timeout: 5 * 1000,
        maxRetries: 10
      }
    });
    next();
  }
];