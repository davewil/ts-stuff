import { describe, it } from 'vitest'
import {
  assigns_sequential_ids_across_creates,
  persists_task_with_trimmed_title,
  rejects_empty_title,
  rejects_title_over_200_chars,
  returns_undefined_for_unknown_id,
} from './tasks.steps.ts'


describe('Task domain', () => {
  describe('createTask', () => {
    it('persists a task with id, trimmed title, and ISO createdAt', persists_task_with_trimmed_title)
    it('assigns sequential ids across successive creates', assigns_sequential_ids_across_creates)
    it('rejects whitespace-only titles', rejects_empty_title)
    it('rejects titles longer than 200 characters', rejects_title_over_200_chars)
  })
})

  describe('getTask', () => {
    it('returns undefined for an unknown id', returns_undefined_for_unknown_id)
  })
  
