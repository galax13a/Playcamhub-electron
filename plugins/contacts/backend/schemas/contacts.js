'use strict';

const { z } = require('zod');

const IdParamsSchema = z.object({
  id: z.coerce.number({ invalid_type_error: 'El id debe ser numérico' }).int().positive(),
});

const ContactQuerySchema = z.object({
  search:   z.string().trim().max(200).optional(),
  status:   z.string().trim().max(50).optional(),
  active:   z.string().optional(),
  username: z.string().trim().max(64).optional(),
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

module.exports = { IdParamsSchema, ContactQuerySchema, ContactCreateSchema, ContactUpdateSchema };
