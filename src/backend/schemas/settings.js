'use strict';

const { z } = require('zod');

// Key-value bulk update: { theme: 'dark', volume: '80', ... }
const SettingsManySchema = z
  .record(z.string().trim().min(1), z.string().max(500_000))
  .refine(obj => typeof obj === 'object' && !Array.isArray(obj), {
    message: 'El body debe ser un objeto clave-valor',
  });

module.exports = { SettingsManySchema };
