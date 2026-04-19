/**
 * Socket.IO server for real-time dashboard updates.
 * Multi-tenant: uses workspace-level rooms for isolation.
 */

import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { createLogger } from "@/server/lib/logger";
import { handleSocketConnection } from "./room-manager";

const log = createLogger({ module: "socket-server" });

let io: Server | null = null;

export interface ActivityEvent {
  id: string;
  type: string;
  clientId?: string;
  clientName?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Initialize Socket.IO server.
 * Call once during server startup.
 */
export function initSocketServer(httpServer: HttpServer): Server {
  if (io) {
    log.warn("Socket.IO server already initialized");
    return io;
  }

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") ?? [
    "http://localhost:3000",
    "http://localhost:3001",
  ];

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", handleSocketConnection);

  log.info("Socket.IO server initialized", { allowedOrigins });

  return io;
}

/**
 * Emit an activity event to a workspace room.
 * Events are received by all connected clients in that workspace.
 */
export function emitActivityEvent(workspaceId: string, event: ActivityEvent): void {
  if (!io) {
    log.warn("Socket.IO not initialized, cannot emit event");
    return;
  }

  const roomName = `workspace:${workspaceId}`;
  io.to(roomName).emit("activity:new", event);

  log.debug("Emitted activity event", {
    workspaceId,
    eventType: event.type,
    eventId: event.id
  });
}

/**
 * Get the Socket.IO server instance.
 * Returns null if not initialized.
 */
export function getSocketServer(): Server | null {
  return io;
}
