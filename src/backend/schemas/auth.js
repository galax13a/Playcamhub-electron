'use strict';
// @ts-check

const { z } = require('zod');

const LoginSchema = z.object({
  username: z.string({ required_error: 'El usuario es obligatorio' }).trim().min(1, 'El usuario es obligatorio'),
  password: z.string({ required_error: 'La contraseña es obligatoria' }).min(1, 'La contraseña es obligatoria'),
});

const RegisterSchema = z.object({
  username: z.string({ required_error: 'El usuario es obligatorio' })
    .trim()
    .min(3,  'El usuario debe tener al menos 3 caracteres')
    .max(64, 'El usuario no puede superar 64 caracteres'),
  password: z.string({ required_error: 'La contraseña es obligatoria' })
    .min(6,   'La contraseña debe tener al menos 6 caracteres')
    .max(128, 'La contraseña no puede superar 128 caracteres'),
});

const ProfileQuerySchema = z.object({
  username: z.string({ required_error: 'username es obligatorio' }).trim().min(1),
});

const ProfileUpdateSchema = z.object({
  username:  z.string().trim().min(1, 'username es obligatorio'),
  full_name: z.string().trim().max(120, 'Máximo 120 caracteres').optional().default(''),
  nickname:  z.string().trim().max(80,  'Máximo 80 caracteres').optional().default(''),
  whatsapp:  z.string().trim().max(30,  'Máximo 30 caracteres').optional().nullable().default(null),
  avatar:    z.string().max(500_000, 'Avatar demasiado grande').optional().nullable().default(null),
});

/** @typedef {z.infer<typeof LoginSchema>} LoginInput */
/** @typedef {z.infer<typeof RegisterSchema>} RegisterInput */
/** @typedef {z.infer<typeof ProfileQuerySchema>} ProfileQuery */
/** @typedef {z.infer<typeof ProfileUpdateSchema>} ProfileUpdateInput */

module.exports = { LoginSchema, RegisterSchema, ProfileQuerySchema, ProfileUpdateSchema };
