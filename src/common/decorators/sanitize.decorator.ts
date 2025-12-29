import { Transform } from 'class-transformer';

/**
 * Decorator que sanitiza strings removendo HTML/scripts
 * 
 * Remove:
 * - Tags HTML (<script>, <iframe>, etc.)
 * - Event handlers (onclick, onerror, etc.)
 * - Protocolos perigosos (javascript:)
 * 
 * @example
 * ```typescript
 * export class CreateCategoryDto {
 *   @Sanitize()
 *   @IsString()
 *   name: string;
 * }
 * ```
 */
export function Sanitize() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') return value;

    return value
      // Remove tags HTML
      .replace(/<[^>]*>/g, '')
      // Remove javascript: protocol
      .replace(/javascript:/gi, '')
      // Remove event handlers (onclick, onerror, etc)
      .replace(/on\w+\s*=/gi, '')
      // Trim whitespace
      .trim();
  });
}
