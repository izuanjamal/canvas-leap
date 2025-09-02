import { api, StreamInOut } from "encore.dev/api";
import { boardDB } from "../board/db";
import type { ClientMessage, ServerMessage, BoardSession } from "./types";
import { getAuthData } from "~encore/auth";

// Store active connections per board
const boardConnections = new Map<string, Set<StreamInOut<ClientMessage, ServerMessage>>>();
const sessionData = new Map<StreamInOut<ClientMessage, ServerMessage>, BoardSession>();

interface BoardSyncHandshake {
  boardId: string;
}

// Handles real-time collaboration for whiteboard sessions via WebSocket connection.
export const boardSync = api.streamInOut<BoardSyncHandshake, ClientMessage, ServerMessage>(
  { expose: true, path: "/ws/:boardId", auth: true },
  async (handshake, stream) => {
    const auth = getAuthData()!;
    const { boardId } = handshake;

    // Initialize board connections set if it doesn't exist
    if (!boardConnections.has(boardId)) {
      boardConnections.set(boardId, new Set());
    }

    const connections = boardConnections.get(boardId)!;
    connections.add(stream);

    const displayName = auth.displayName ?? "User";
    const avatarUrl = auth.avatarUrl ?? "";

    // Store session data for this connection
    const session: BoardSession = {
      boardId,
      userId: auth.userID,
      displayName,
      avatarUrl,
      lastSeen: new Date(),
    };
    sessionData.set(stream, session);

    // Create or update presence in database
    await boardDB.exec`
      INSERT INTO presence (board_id, user_id, connected_at, last_seen)
      VALUES (${boardId}, ${auth.userID}, NOW(), NOW())
      ON CONFLICT (board_id, user_id)
      DO UPDATE SET last_seen = NOW()
    `;

    // Broadcast user joined message to other clients
    const joinMessage: ServerMessage = {
      type: "USER_JOINED",
      boardId,
      userId: auth.userID,
      data: { display_name: displayName, avatar_url: avatarUrl },
      timestamp: Date.now(),
    };

    await broadcastToBoard(boardId, joinMessage, stream);

    // Heartbeat: update last_seen every 10 seconds
    const heartbeat = startHeartbeat(stream, session);

    try {
      // Listen for incoming messages from this client
      for await (const message of stream) {
        await handleClientMessage(message, stream, session);
      }
    } catch (error) {
      console.error(`WebSocket error for user ${auth.userID} on board ${boardId}:`, error);
    } finally {
      clearInterval(heartbeat);
      // Clean up when connection closes
      await cleanupConnection(stream, session);
    }
  }
);

// Periodically update last_seen for presence
function startHeartbeat(
  stream: StreamInOut<ClientMessage, ServerMessage>,
  session: BoardSession
): NodeJS.Timer {
  return setInterval(async () => {
    try {
      session.lastSeen = new Date();
      await boardDB.exec`
        UPDATE presence
        SET last_seen = NOW()
        WHERE board_id = ${session.boardId} AND user_id = ${session.userId}
      `;
      // Optionally echo pong to client as a keep-alive signal.
      const pong: ServerMessage = {
        type: "PONG",
        boardId: session.boardId,
        timestamp: Date.now(),
      };
      await stream.send(pong);
    } catch (err) {
      // ignore errors; if stream is dead cleanup will remove it
    }
  }, 10_000);
}

// Processes incoming messages from clients and broadcasts updates to other connected users.
async function handleClientMessage(
  message: ClientMessage,
  senderStream: StreamInOut<ClientMessage, ServerMessage>,
  session: BoardSession
): Promise<void> {
  const { type, boardId, data, timestamp } = message;

  // Update last seen timestamp
  session.lastSeen = new Date();
  await boardDB.exec`
    UPDATE presence
    SET last_seen = NOW()
    WHERE board_id = ${boardId} AND user_id = ${session.userId}
  `;

  switch (type) {
    case "BOARD_UPDATE": {
      // Save board data to database
      await boardDB.exec`
        UPDATE boards
        SET data = ${JSON.stringify(data)}
        WHERE id = ${boardId}
      `;

      // Broadcast update to other clients
      const updateMessage: ServerMessage = {
        type: "BOARD_UPDATE",
        boardId,
        userId: session.userId,
        data,
        timestamp,
      };
      await broadcastToBoard(boardId, updateMessage, senderStream);
      break;
    }

    case "CURSOR_UPDATE": {
      // Broadcast cursor movement to other clients (don't save to DB)
      const cursorMessage: ServerMessage = {
        type: "CURSOR_UPDATE",
        boardId,
        userId: session.userId,
        data: { ...data, display_name: session.displayName, avatar_url: session.avatarUrl },
        timestamp,
      };
      await broadcastToBoard(boardId, cursorMessage, senderStream);
      break;
    }

    case "USER_LEAVE": {
      await cleanupConnection(senderStream, session);
      break;
    }

    case "USER_JOIN": {
      // Already handled by handshake; ignore or re-broadcast as needed
      break;
    }

    case "PING": {
      // Respond with PONG to keep connection alive
      const pongMessage: ServerMessage = {
        type: "PONG",
        boardId,
        timestamp: Date.now(),
      };
      await senderStream.send(pongMessage);
      break;
    }

    default:
      console.warn(`Unknown message type: ${type}`);
  }
}

// Sends a message to all clients connected to a specific board, optionally excluding the sender.
async function broadcastToBoard(
  boardId: string,
  message: ServerMessage,
  excludeStream?: StreamInOut<ClientMessage, ServerMessage>
): Promise<void> {
  const connections = boardConnections.get(boardId);
  if (!connections) return;

  const deadConnections: StreamInOut<ClientMessage, ServerMessage>[] = [];

  for (const connection of connections) {
    if (connection === excludeStream) continue;

    try {
      await connection.send(message);
    } catch (error) {
      // Connection is dead, mark for removal
      deadConnections.push(connection);
    }
  }

  // Clean up dead connections
  for (const deadConnection of deadConnections) {
    connections.delete(deadConnection);
    const session = sessionData.get(deadConnection);
    if (session) {
      await cleanupConnection(deadConnection, session);
    }
  }
}

// Cleans up resources when a WebSocket connection is closed.
async function cleanupConnection(
  stream: StreamInOut<ClientMessage, ServerMessage>,
  session: BoardSession
): Promise<void> {
  const { boardId, userId } = session;

  // Remove from active connections
  const connections = boardConnections.get(boardId);
  if (connections) {
    connections.delete(stream);

    // Remove empty board connection sets
    if (connections.size === 0) {
      boardConnections.delete(boardId);
    }
  }

  // Remove session data
  sessionData.delete(stream);

  // Remove from database
  await boardDB.exec`
    DELETE FROM presence
    WHERE board_id = ${boardId} AND user_id = ${userId}
  `;

  // Broadcast user left message
  const leaveMessage: ServerMessage = {
    type: "USER_LEFT",
    boardId,
    userId,
    timestamp: Date.now(),
  };

  await broadcastToBoard(boardId, leaveMessage);
}
