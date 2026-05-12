import { z } from 'zod'

export const ProblemSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  status: z.number().int().min(100).max(599),
  detail: z.string().optional(),
})
export type Problem = z.infer<typeof ProblemSchema>
