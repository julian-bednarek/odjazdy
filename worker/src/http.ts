export const Errors = {
  badRequest: "bad_request",
  noConfig: "no_config",
  unauthorized: "unauthorized",
  password: "password",
  closed: "closed",
  upstream: "upstream",
  notFound: "not_found",
} as const;

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });

export const readJson = (req: Request) => req.json<Record<string, unknown> | null>().catch(() => null);
