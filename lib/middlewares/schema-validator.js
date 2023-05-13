/**
 * A middleware that will validate the given parameters
 * with the given schema.
 */
export default (schema, params) => (input, _, next) => {
  const result = schema.validate(params);

  // If there is a validator error, we fail.
  if (result.error) {
    const err = new Error(result.error);
    err.displayOpts = true;
    return (next(err));
  }
  Object.assign(input, result.value);
  next();
};