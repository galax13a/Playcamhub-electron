'use strict';
// @ts-check

const { z } = require('zod');

const IdParamsSchema = z.object({
  id: z.coerce.number({ invalid_type_error: 'El id debe ser numérico' }).int().positive(),
});

const ContactQuerySchema = z.object({
  search:   z.string().trim().max(200).optional(),
  status:   z.string().trim().max(50).optional(),
  active:   z.string().optional(),
  username: z.string().trim().max(64).optional(),
  page:     z.coerce.number().int().positive().optional().default(1),
  per_page: z.coerce.number().int().min(5).max(100).optional().default(25),
});

const ContactCreateSchema = z.object({
  name:     z.string({ required_error: 'El nombre es obligatorio' }).trim().min(1, 'El nombre es obligatorio').max(120),
  email:    z.string().trim().email('Correo electrónico inválido').max(200).optional().nullable(),
  phone:    z.string().trim().max(30, 'Máximo 30 caracteres').optional().nullable(),
  address:  z.string().trim().max(300).optional().nullable(),
  notes:    z.string().max(2000).optional().nullable(),
  status:   z.string().trim().max(50).optional(),
  username: z.string().trim().max(64).optional().nullable(),
  avatar:   z.string().max(500_000).optional().nullable(),
  active:   z.coerce.boolean().optional().default(true),
}).passthrough();

const ContactUpdateSchema = ContactCreateSchema.partial().extend({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120).optional(),
});

/** @typedef {z.infer<typeof ContactQuerySchema>} ContactQuery */
/** @typedef {z.infer<typeof ContactCreateSchema>} ContactCreateInput */
/** @typedef {z.infer<typeof ContactUpdateSchema>} ContactUpdateInput */

module.exports = { IdParamsSchema, ContactQuerySchema, ContactCreateSchema, ContactUpdateSchema };
