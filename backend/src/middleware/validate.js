/**
 * Request validation via Zod.
 *
 * `validate(schema)` parses and replaces `req.body` with the typed, sanitized result, or
 * returns a 422 with field-level errors. Validating at the edge keeps invalid data out of
 * the service layer entirely.
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({
        error: 'Validation failed',
        issues: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req.body = result.data;
    return next();
  };
}
