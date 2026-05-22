'use strict';

const { z } = require('zod');

const TASK_STATUSES  = ['pending', 'in_progress', 'completed', 'cancelled'];
const TASK_PRIORITIES = ['urgent', 'high', 'medium', 'low'];

const IdParamsSchema = z.object({
  id: z.coerce.number({ invalid_type_error: 'El id debe ser numérico' }).int().positive(),
});

const dueDateOrNull = z
  .string()
  .trim()
  .refine(v => !v || !isNaN(Date.parse(v)), { message: 'Fecha inválida' })
  .nullable()
  .optional();

const TaskQuerySchema = z.object({
  username: z.string().trim().max(64).optional(),
  status:   z.enum(TASK_STATUSES).optional(),
});

const TaskCreateSchema = z.object({
  title:       z.string({ required_error: 'El título es obligatorio' }).trim().min(1, 'El título es obligatorio').max(200),
  description: z.string().max(5000).optional().nullable(),
  status:      z.enum(TASK_STATUSES,   { errorMap: () => ({ message: `Estado inválido. Válidos: ${TASK_STATUSES.join(', ')}` }) }).optional().default('pending'),
  priority:    z.enum(TASK_PRIORITIES, { errorMap: () => ({ message: `Prioridad inválida. Válidas: ${TASK_PRIORITIES.join(', ')}` }) }).optional().default('medium'),
  due_date:    dueDateOrNull,
  username:    z.string().trim().max(64).optional().nullable(),
});

const TaskUpdateSchema = TaskCreateSchema.omit({ username: true });

const TaskStatusSchema = z.object({
  status: z.enum(TASK_STATUSES, { errorMap: () => ({ message: `Estado inválido. Válidos: ${TASK_STATUSES.join(', ')}` }) }),
});

module.exports = { IdParamsSchema, TaskQuerySchema, TaskCreateSchema, TaskUpdateSchema, TaskStatusSchema };
