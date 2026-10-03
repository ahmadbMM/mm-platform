// The Worker's entry. Only the handler is exported here (the runtime refuses any other export
// from the main module); the logic is in app.ts, which the tests import.
import { handle, type Env } from "./app";

export default {
  fetch: (req: Request, env: Env): Promise<Response> => handle(req, env),
};
