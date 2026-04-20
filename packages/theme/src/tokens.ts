import tokensJson from "../tokens.json" with { type: "json" };

export const tokens = tokensJson;
export type Tokens = typeof tokensJson;
