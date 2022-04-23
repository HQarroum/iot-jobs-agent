/**
 * A middleware that will validate the given parameters
 * with the given schema.
 */
export default (schema, params) => (input, _, next) => {
  const result = schema.validate(params);

  // If there is a validator error, we fail.
  if (result.error) {
    return (next(new Error(result.error)));
  }
  Object.assign(input, result.value);
  next();
};