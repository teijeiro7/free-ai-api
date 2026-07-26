// Merges our hand-maintained Env (src/types.ts) and worker entrypoint into the
// ambient `Cloudflare` namespace that `cloudflare:workers`' `env`/`exports`
// (used from tests) are typed against. See @cloudflare/workers-types'
// `declare namespace Cloudflare { interface Env {} interface GlobalProps {} }`.
import type * as workerModule from "./src/index";
import type { Env as WorkerEnv } from "./src/types";

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {}
    interface GlobalProps {
      mainModule: typeof workerModule;
    }
  }
}

export {};
