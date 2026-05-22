'use strict';

const { z } = require('zod');

const IdParamsSchema = z.object({
  id: z.coerce.number({ invalid_type_error: 'El id debe ser numérico' }).int().positive(),
});

// CSS color: hex (#fff, #ffffff), rgb(), named color or empty string
const cssColor = z.string().trim().max(50).optional().nullable();

const CategoryCreateSchema = z.object({
  name:  z.string({ required_error: 'El nombre es obligatorio' }).trim().min(1, 'El nombre es obligatorio').max(100),
  color: cssColor,
  icon:  z.string().trim().max(10).optional().nullable(),
});

const CategoryUpdateSchema = z.object({
  name:  z.string().trim().min(1).max(100).optional(),
  color: cssColor,
  icon:  z.string().trim().max(10).optional().nullable(),
});

module.exports = { IdParamsSchema, CategoryCreateSchema, CategoryUpdateSchema };
