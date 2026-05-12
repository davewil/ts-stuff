import { z } from 'zod'

export const TaskIdSchema = z
  .string()
  .min(1, { error: 'task id must not be empty' })
export type TaskId = z.infer<typeof TaskIdSchema>

export const TaskTitleSchema = z
  .string()
  .trim()
  .min(1, { error: 'title must not be empty' })
  .max(200, { error: 'title must be 200 characters or fewer' })
export type TaskTitle = z.infer<typeof TaskTitleSchema>

export const TaskSchema = z.object({
  id: TaskIdSchema,
  title: TaskTitleSchema,
  createdAt: z.iso.datetime({ error: 'createdAt must be an ISO 8601 datetime' }),
})
export type Task = Readonly<z.infer<typeof TaskSchema>>

export const CreateTaskInputSchema = z
  .object({
    title: TaskTitleSchema,
  })
  .strict()
export type CreateTaskInput = Readonly<z.infer<typeof CreateTaskInputSchema>>
