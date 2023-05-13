/**
 * A helper middleware that will assign the number
 * of iterations a program should go through.
 */
export default (number) => (input, _, next) => next(input.number = parseInt(number, 10));
