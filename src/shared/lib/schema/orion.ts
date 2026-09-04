import { z } from 'zod';

/**
 * Peças de Zod para os payloads do Orion.
 *
 * `optionalText` nasceu duplicado em `auth.schema.ts` e `liberacao.schema.ts`;
 * o terceiro uso (`cliente.schema.ts`) o trouxe para cá, como manda o
 * CLAUDE.md §4.2 — em vez de virar uma terceira cópia.
 */

/**
 * Texto do Firebird: `null`, `undefined` e string só de espaço são a mesma
 * coisa — ausência. Campo ausente não vira linha vazia na tela.
 */
export const optionalText = z
  .string()
  .nullish()
  .transform((value) => value?.trim() || null);
