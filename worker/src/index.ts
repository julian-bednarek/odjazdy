import { Errors, json } from "./http";
import type { Env } from "./types";
import { handleDepartures, handlePair } from "./watch";
import { deleteConfig, getConfig, getStationList, handleOpen, putConfig } from "./wizard";

type Handler = (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;

// The wizard page itself is a static asset (public/), served before the worker runs.
const routes: Record<string, Handler> = {
  "POST /v1/departures": handleDepartures,
  "POST /v1/pair": handlePair,
  "GET /open": handleOpen,
  "GET /api/config": getConfig,
  "PUT /api/config": putConfig,
  "DELETE /api/config": deleteConfig,
  "GET /api/stations": getStationList,
};

export default {
  fetch(req, env, ctx) {
    const route = routes[`${req.method} ${new URL(req.url).pathname}`];
    return route ? route(req, env, ctx) : json({ error: Errors.notFound }, 404);
  },
} satisfies ExportedHandler<Env>;
