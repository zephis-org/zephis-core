declare module "express-ws" {
  import { Application } from "express";
  import * as ws from "ws";

  interface WsOptions {
    leaveRouterUntouched?: boolean;
    wsOptions?: ws.ServerOptions;
  }

  interface Instance {
    app: Application;
    getWss(): ws.Server;
    applyTo(target: any): void;
  }

  function expressWs(
    app: Application,
    server?: any,
    options?: WsOptions,
  ): Instance;

  export = expressWs;
}

declare module "snarkjs" {
  export const groth16: {
    fullProve: (
      input: any,
      wasmPath: any,
      zkeyPath: any,
    ) => Promise<{
      proof: any;
      publicSignals: any[];
    }>;
    verify: (vKey: any, publicSignals: any[], proof: any) => Promise<boolean>;
  };
}

declare global {
  namespace NodeJS {
    interface Global {
      testUtils: {
        generateMockSession: () => any;
        generateMockTemplate: () => any;
        generateMockProof: () => any;
      };
    }
  }
}

export {};
