import { isTcbAccountStatement, parseTcbAccountStatement } from "./tcb-account";
import { isTcbCreditCardStatement, parseTcbCreditCardStatement } from "./tcb-credit-card";
import type { PdfToken } from "./tokens";
import type { ParsedStatement } from "./types";

export * from "./pdf";
export * from "./tcb-account";
export * from "./tcb-credit-card";
export * from "./tokens";
export * from "./types";

/** Recognises the statement and parses it. Throws when the format is not supported. */
export function parseStatement(tokens: readonly PdfToken[]): ParsedStatement {
  if (isTcbAccountStatement(tokens)) return parseTcbAccountStatement(tokens);
  if (isTcbCreditCardStatement(tokens)) return parseTcbCreditCardStatement(tokens);
  throw new Error("Chưa hỗ trợ loại sao kê này (hiện có: Techcombank tài khoản và thẻ tín dụng)");
}
