'use strict';

/**
 * Zod validation middleware factory.
 *
 * Usage:
 *   router.post('/route', validate(MySchema), handler)
 *   router.get('/route', validate(MySchema, 'query'), handler)
 *   router.get('/:id',   validate(MySchema, 'params'), handler)
 *
 * On success  → req[target] is replaced with the parsed/coerced data and next() is called.
 * On failure  → 400 JSON { error, fields, form? }
 */
function validate(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const flat = result.error.flatten();
      return res.status(400).json({
        error:  'Datos inválidos',
        fields: flat.fieldErrors,
        ...(flat.formErrors.length ? { form: flat.formErrors } : {}),
      });
    }
    req[target] = result.data;
    next();
  };
}

module.exports = { validate };
