import { WebSocket } from "ws";

declare module "express" {
  interface Application {
    ws(route: string, handler: (ws: WebSocket, req: Request) => void): void;
  }

  interface Router {
    ws(route: string, handler: (ws: WebSocket, req: Request) => void): void;
  }
}
