/**
 * Manages Socket.IO room membership for workspace isolation.
 */

import type { Server, Socket } from "socket.io";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "room-manager" });

// Track connected sockets per workspace for debugging
const workspaceConnections = new Map<string, Set<string>>();

export function handleSocketConnection(socket: Socket): void {
  log.info("Client connected", { socketId: socket.id });

  socket.on("join-workspace", (workspaceId: string) => {
    if (!workspaceId || typeof workspaceId !== "string") {
      log.warn("Invalid workspace ID", { socketId: socket.id });
      return;
    }

    const roomName = `workspace:${workspaceId}`;
    socket.join(roomName);

    // Track connection
    if (!workspaceConnections.has(workspaceId)) {
      workspaceConnections.set(workspaceId, new Set());
    }
    workspaceConnections.get(workspaceId)!.add(socket.id);

    log.info("Client joined workspace", {
      socketId: socket.id,
      workspaceId,
      roomSize: workspaceConnections.get(workspaceId)!.size
    });
  });

  socket.on("leave-workspace", (workspaceId: string) => {
    const roomName = `workspace:${workspaceId}`;
    socket.leave(roomName);

    // Remove tracking
    workspaceConnections.get(workspaceId)?.delete(socket.id);

    log.info("Client left workspace", { socketId: socket.id, workspaceId });
  });

  socket.on("disconnect", (reason: string) => {
    // Clean up all workspace memberships
    for (const [workspaceId, sockets] of workspaceConnections.entries()) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        workspaceConnections.delete(workspaceId);
      }
    }

    log.info("Client disconnected", { socketId: socket.id, reason });
  });
}

export function getWorkspaceConnectionCount(workspaceId: string): number {
  return workspaceConnections.get(workspaceId)?.size ?? 0;
}
