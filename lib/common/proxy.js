/**
 * Proxy variables.
 */
const HTTP_PROXY = process.env.HTTP_PROXY || process.env.http_proxy;
const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;
const PROXY_ADDR = HTTPS_PROXY || HTTP_PROXY;
const HAS_PROXY = !!PROXY_ADDR;

/**
 * @return a proxy address by type.
 * @param {*} type the type of the proxy (e.g `http` or `https`);
 */
const getProxyType = (type) => global[`${type.toUpperCase()}_PROXY`];

/**
 * @return whether an HTTP or an HTTPS proxy
 * has been defined.
 */
const hasProxy = () => HAS_PROXY;

/**
 * @return a proxy address from the defined HTTP or HTTPS
 * defined proxy, undefined if not proxy address has been defined.
 */
const getProxy = () => PROXY_ADDR;

/**
 * Exporting the proxy helpers.
 */
export default { getProxyType, getProxy, hasProxy };