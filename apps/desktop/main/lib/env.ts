// In production, these are replaced by DefinePlugin at build time.
// In dev, they fall through to process.env (loaded by dotenv).

export const API_URL: string =
  process.env.API_URL ?? "";

export const ALLOWLIST_URL: string =
  process.env.ALLOWLIST_URL ?? "";

export const LOG_LEVEL: string =
  process.env.LOG_LEVEL ?? "info";

export const PW_CHANNEL: string =
  process.env.PW_CHANNEL ?? "";

export const LOGIN_URL: string =
  process.env.LOGIN_URL ?? "";

export const DESKTOP_API_KEY: string =
  process.env.DESKTOP_API_KEY ?? "";
