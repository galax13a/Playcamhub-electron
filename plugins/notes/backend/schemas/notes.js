'use strict';

const { z } = require('zod');

const IdParamsSchema = z.object({
  id: z.coerce.number({ invalid_type_error: 'El id debe ser numérico' }).int().positive(),
});

// Accepts ISO date strings or 'YYYY-MM-DD' format
const dateOrNull = z
  .string()
  .trim()
  .refine(v => !v || !isNaN(Date.parse(v)), { message: 'Fecha inválida' })
  .nullable()
  .optional();

const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color inválido — usa formato hex #RGB o #RRGGBB')
  .optional()
  .default('#6366f1');

const NoteQuerySchema = z.object({
  username: z.string().trim().max(64).optional(),
});

const NoteCreateSchema = z.object({
  title:          z.string({ required_error: 'El título es obligatorio' }).trim().min(1, 'El título es obligatorio').max(200),
  content:        z.string().max(50_000).optional().nullable(),
  color:          hexColor,
  important_date: dateOrNull,
  username:       z.string().trim().max(64).optional().nullable(),
});

const NoteUpdateSchema = z.object({
  title:          z.string({ required_error: 'El título es obligatorio' }).trim().min(1, 'El título es obligatorio').max(200),
  content:        z.string().max(50_000).optional().nullable(),
  color:          hexColor,
  important_date: dateOrNull,
});

module.exports = { IdParamsSchema, NoteQuerySchema, NoteCreateSchema, NoteUpdateSchema };
