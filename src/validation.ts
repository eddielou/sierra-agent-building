/**
 * Response validation: a hook between the LLM's final text and the customer.
 *
 * `ResponseValidator` only *reports*; the agent decides what to do about failures (regenerate,
 * then fall back). Concrete checks live in validators.ts.
 */

/** What a validator can see about the turn that produced the reply. */
export interface ValidationContext {
  userMessage: string;
  /** Every tool call made while producing this reply, with its raw JSON result. */
  toolResults: { name: string; arguments: string; result: string }[];
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export interface Validator {
  name: string;
  validate(reply: string, ctx: ValidationContext): ValidationResult;
}

export interface ValidationReport {
  reply: string;
  ok: boolean;
  /** Reasons from every failing validator (empty when ok). */
  reasons: string[];
  results: { validator: string; result: ValidationResult }[];
}

export class ResponseValidator {
  constructor(private readonly validators: Validator[] = []) {}

  run(reply: string, ctx: ValidationContext): ValidationReport {
    const results = this.validators.map((v) => ({ validator: v.name, result: v.validate(reply, ctx) }));
    const reasons = results.flatMap((r) => (r.result.ok ? [] : [r.result.reason]));
    return { reply, ok: reasons.length === 0, reasons, results };
  }
}
