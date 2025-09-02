import { api, StreamInOut } from "encore.dev/api";
import { boardDB } from "../board/db";
import { getAuthData } from "~encore/auth";

// Enhanced event types for real-time collaboration
export interface BoardEvent {
  type: "DRAW" | "CURSOR" | "PRESENCE" | "PING" | "CLEAR";
  userId: string;
  payload?: any;
}

// Legacy types for backward compatibility
export type ClientEventType =
  | "USER_JOIN"
  | "USER_LEAVE"
  | "BOARD_UPDATE"
  | "CURSOR_UPDATE"
  | "PING";

export type ServerEventType =
  | "USER_JOINED"
  | "USER_LEFT"
  | "BOARD_UPDATE"
  | "CURSOR_UPDATE"
  | "PONG"
  | "ERROR";

// Unified message interfaces for Encore.ts streaming API
export interface UnifiedClientMessage {
  // Legacy ClientMessage fields
  type?: ClientEventType;
  boardId?: string;
  data?: any;
  timestamp?: number;

  // New BoardEvent fields
  eventType?: "DRAW" | "CURSOR" | "PRESENCE" | "PING" | "CLEAR";
  userId?: string;
  payload?: any;
}

export interface UnifiedServerMessage {
  // Legacy ServerMessage fields
  type?: ServerEventType;
  boardId?: string;
  userId?: string;
  data?: any;
  timestamp?: number;

  // New BoardEvent fields
  eventType?: "DRAW" | "CURSOR" | "PRESENCE" | "PING" | "CLEAR";
  payload?: any;
}

export interface BoardSession {
  boardId: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
  lastSeen: Date;
}

// Helper alias to simplify nested generics
type BoardStream = StreamInOut<UnifiedClientMessage, UnifiedServerMessage>;

// Store active connections per board
const boardConnections = new Map<string, Set<BoardStream>>();
const sessionData = new Map<BoardStream, BoardSession>();
const connectedUsers = new Map<string, Map<string, { displayName: string; avatarUrl: string; lastPing: Date }>>();

interface BoardSyncHandshake {
  boardId: string;
}

// Handles real-time collaboration for whiteboard sessions via WebSocket connection.
export const boardSync = api.streamInOut<BoardSyncHandshake, UnifiedClientMessage, UnifiedServerMessage>(
  { expose: true, path: "/ws/:boardId", auth: true },
  async (handshake, stream) => {
    const auth = getAuthData()!;
    const { boardId } = handshake;

    console.log(`[BoardSync] User ${auth.userID} connecting to board ${boardId}`);

    // Initialize board connections set if it doesn't exist
    if (!boardConnections.has(boardId)) {
      boardConnections.set(boardId, new Set());
      connectedUsers.set(boardId, new Map());
    }

    const connections = boardConnections.get(boardId)!;
    const users = connectedUsers.get(boardId)!;
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

    // Add user to connected users list
    users.set(auth.userID, {
      displayName,
      avatarUrl,
      lastPing: new Date(),
    });

    // Create or update presence in database
    await boardDB.exec`
      INSERT INTO presence (board_id, user_id, connected_at, last_seen)
      VALUES (${boardId}, ${auth.userID}, NOW(), NOW())
      ON CONFLICT (board_id, user_id)
      DO UPDATE SET last_seen = NOW()
    `;

    // Broadcast user joined message to other clients (legacy format)
    const joinMessage: UnifiedServerMessage = {
      type: "USER_JOINED",
      boardId,
      userId: auth.userID,
      data: { display_name: displayName, avatar_url: avatarUrl },
      timestamp: Date.now(),
    };

    // Also broadcast as new PRESENCE event
    const presenceEvent: UnifiedServerMessage = {
      eventType: "PRESENCE",
      userId: auth.userID,
      payload: {
        action: "join",
        displayName,
        avatarUrl,
        connectedUsers: Array.from(users.entries()).map(([id, user]) => ({
          userId: id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        })),
      },
    };

    console.log(`[BoardSync] Broadcasting user join for ${auth.userID} to ${connections.size - 1} other clients`);
    await broadcastToBoard(boardId, joinMessage, stream);
    await broadcastToBoard(boardId, presenceEvent, stream);

    // Send existing strokes to the connected client
    try {
      const existing = await boardDB.queryAll<{
        id: string;
        board_id: string;
        user_id: string;
        path_data: any;
        color: string;
        thickness: number;
        created_at: Date;
      }>`
        SELECT id, board_id, user_id, path_data, color, thickness, created_at
        FROM strokes
        WHERE board_id = ${boardId}
        ORDER BY created_at ASC
      `;
      console.log(`[BoardSync] Sending ${existing.length} persisted strokes to user ${auth.userID}`);
      for (const s of existing) {
        const ev: UnifiedServerMessage = {
          eventType: "DRAW",
          userId: s.user_id,
          payload: {
            stroke: {
              id: s.id, // client may ignore
              userId: s.user_id,
              color: s.color,
              width: s.thickness,
              mode: s.path_data?.mode ?? "draw",
              points: s.path_data?.points ?? [],
            },
          },
        };
        try {
          await stream.send(ev);
        } catch (err) {
          console.error("[BoardSync] Failed sending persisted stroke:", err);
          break;
        }
      }
    } catch (err) {
      console.error("[BoardSync] Failed to load persisted strokes:", err);
    }

    // Heartbeat: update last_seen every 10 seconds and clean up inactive users
    const heartbeat = startHeartbeat(stream, session);

    try {
      // Listen for incoming messages from this client
      for await (const message of stream) {
        await handleMessage(message, stream, session);
      }
    } catch (error) {
      console.error(`[BoardSync] WebSocket error for user ${auth.userID} on board ${boardId}:`, error);
    } finally {
      clearInterval(heartbeat);
      // Clean up when connection closes
      await cleanupConnection(stream, session);
    }
  }
);

// Periodically update last_seen for presence and clean up inactive users
function startHeartbeat(
  stream: StreamInOut<UnifiedClientMessage, UnifiedServerMessage>,
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

      // Clean up inactive users (no ping for more than 30 seconds)
      const users = connectedUsers.get(session.boardId);
      if (users) {
        const now = new Date();
        const inactiveUsers: string[] = [];

        for (const [userId, user] of users.entries()) {
          if (now.getTime() - user.lastPing.getTime() > 30000) {
            inactiveUsers.push(userId);
          }
        }

        for (const userId of inactiveUsers) {
          console.log(`[BoardSync] Removing inactive user ${userId} from board ${session.boardId}`);
          users.delete(userId);

          // Broadcast user left
          const presenceEvent: UnifiedServerMessage = {
            eventType: "PRESENCE",
            userId,
            payload: {
              action: "leave",
              connectedUsers: Array.from(users.entries()).map(([id, user]) => ({
                userId: id,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
              })),
            },
          };
          await broadcastToBoard(session.boardId, presenceEvent);
        }
      }

      // Send heartbeat pong
      const pong: UnifiedServerMessage = {
        type: "PONG",
        boardId: session.boardId,
        timestamp: Date.now(),
      };
      await stream.send(pong);
    } catch (err) {
      console.error(`[BoardSync] Heartbeat error for user ${session.userId}:`, err);
    }
  }, 10_000);
}

// Enhanced message handler that supports both legacy and new event formats
async function handleMessage(
  message: UnifiedClientMessage,
  senderStream: StreamInOut<UnifiedClientMessage, UnifiedServerMessage>,
  session: BoardSession
): Promise<void> {
  console.log(`[BoardSync] Received message from ${session.userId}:`, message);

  // Handle new BoardEvent format (check for eventType field)
  if (message.eventType && ["DRAW", "CURSOR", "PRESENCE", "PING", "CLEAR"].includes(message.eventType)) {
    await handleBoardEvent(message, senderStream, session);
    return;
  }

  // Handle legacy ClientMessage format (check for type field)
  if (message.type) {
    await handleClientMessage(message, senderStream, session);
    return;
  }

  console.warn(`[BoardSync] Unknown message format from ${session.userId}:`, message);
}

// Handle new BoardEvent format
async function handleBoardEvent(
  message: UnifiedClientMessage,
  senderStream: StreamInOut<UnifiedClientMessage, UnifiedServerMessage>,
  session: BoardSession
): Promise<void> {
  const eventType = message.eventType!;

  // Update last seen timestamp
  session.lastSeen = new Date();
  await boardDB.exec`
    UPDATE presence
    SET last_seen = NOW()
    WHERE board_id = ${session.boardId} AND user_id = ${session.userId}
  `;

  // Update user's last ping time
  const users = connectedUsers.get(session.boardId);
  if (users && users.has(session.userId)) {
    users.get(session.userId)!.lastPing = new Date();
  }

  switch (eventType) {
    case "DRAW": {
      console.log(`[BoardSync] Broadcasting DRAW event from ${session.userId} to board ${session.boardId}`);

      // Save stroke to DB if provided
      const stroke = message.payload?.stroke;
      if (stroke && Array.isArray(stroke.points)) {
        try {
          await boardDB.exec`
            INSERT INTO strokes (board_id, user_id, path_data, color, thickness)
            VALUES (
              ${session.boardId},
              ${session.userId},
              ${JSON.stringify({ points: stroke.points, mode: stroke.mode ?? "draw" })},
              ${String(stroke.color || "#000000")},
              ${Number.isFinite(stroke.width) ? Math.max(1, Math.min(64, Math.floor(stroke.width))) : 2}
            )
          `;
        } catch (err) {
          console.error("[BoardSync] Failed to persist stroke:", err);
        }
      }

      // Enhance payload with user info
      const enhancedEvent: UnifiedServerMessage = {
        eventType: "DRAW",
        userId: session.userId,
        payload: {
          ...message.payload,
          // keep original stroke structure
          timestamp: Date.now(),
        },
      };

      await broadcastToBoard(session.boardId, enhancedEvent, senderStream);
      break;
    }

    case "CURSOR": {
      console.log(`[BoardSync] Broadcasting CURSOR event from ${session.userId}`);

      // Enhance payload with user info
      const enhancedEvent: UnifiedServerMessage = {
        eventType: "CURSOR",
        userId: session.userId,
        payload: {
          ...message.payload,
          displayName: session.displayName,
          avatarUrl: session.avatarUrl,
          timestamp: Date.now(),
        },
      };

      await broadcastToBoard(session.boardId, enhancedEvent, senderStream);
      break;
    }

    case "PRESENCE": {
      console.log(`[BoardSync] Handling PRESENCE event from ${session.userId}:`, message.payload);

      if (message.payload?.action === "leave") {
        await cleanupConnection(senderStream, session);
      }
      break;
    }

    case "PING": {
      console.log(`[BoardSync] Received PING from ${session.userId}`);

      // Update user's last ping time
      if (users && users.has(session.userId)) {
        users.get(session.userId)!.lastPing = new Date();
      }

      // Send pong response
      const pongEvent: UnifiedServerMessage = {
        eventType: "PING",
        userId: "server",
        payload: {
          action: "pong",
          timestamp: Date.now(),
        },
      };
      await senderStream.send(pongEvent);
      break;
    }

    case "CLEAR": {
      console.log(`[BoardSync] Broadcasting CLEAR event on board ${session.boardId} by ${session.userId}`);

      const clearEvent: UnifiedServerMessage = {
        eventType: "CLEAR",
        userId: session.userId,
        payload: {
          timestamp: Date.now(),
        },
      };
      await broadcastToBoard(session.boardId, clearEvent, senderStream);
      // Note: We do not delete strokes from DB automatically on CLEAR to preserve history.
      break;
    }

    default:
      console.warn(`[BoardSync] Unknown BoardEvent type: ${eventType}`);
  }
}

// Handle legacy ClientMessage format (for backward compatibility)
async function handleClientMessage(
  message: UnifiedClientMessage,
  senderStream: StreamInOut<UnifiedClientMessage, UnifiedServerMessage>,
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
      console.log(`[BoardSync] Broadcasting BOARD_UPDATE from ${session.userId} to board ${boardId}`);

      // Save board data to database (legacy)
      await boardDB.exec`
        UPDATE boards
        SET data = ${JSON.stringify(data)}
        WHERE id = ${boardId}
      `;

      // Broadcast update to other clients
      const updateMessage: UnifiedServerMessage = {
        type: "BOARD_UPDATE",
        boardId,
        userId: session.userId,
        data,
        timestamp,
      };
      await broadcastToBoard(boardId!, updateMessage, senderStream);
      break;
    }

    case "CURSOR_UPDATE": {
      console.log(`[BoardSync] Broadcasting CURSOR_UPDATE from ${session.userId}`);

      // Broadcast cursor movement to other clients (don't save to DB)
      const cursorMessage: UnifiedServerMessage = {
        type: "CURSOR_UPDATE",
        boardId,
        userId: session.userId,
        data: { ...data, display_name: session.displayName, avatar_url: session.avatarUrl },
        timestamp,
      };
      await broadcastToBoard(boardId!, cursorMessage, senderStream);
      break;
    }

    case "USER_LEAVE": {
      console.log(`[BoardSync] User ${session.userId} leaving board ${boardId}`);
      await cleanupConnection(senderStream, session);
      break;
    }

    case "USER_JOIN": {
      console.log(`[BoardSync] User ${session.userId} joining board ${boardId} (already handled in handshake)`);
      // Already handled by handshake; ignore or re-broadcast as needed
      break;
    }

    case "PING": {
      console.log(`[BoardSync] Received legacy PING from ${session.userId}`);

      // Update user's last ping time
      const users = connectedUsers.get(session.boardId);
      if (users && users.has(session.userId)) {
        users.get(session.userId)!.lastPing = new Date();
      }

      // Respond with PONG to keep connection alive
      const pongMessage: UnifiedServerMessage = {
        type: "PONG",
        boardId,
        timestamp: Date.now(),
      };
      await senderStream.send(pongMessage);
      break;
    }

    default:
      console.warn(`[BoardSync] Unknown ClientMessage type: ${type}`);
  }
}

// Sends a message to all clients connected to a specific board, optionally excluding the sender.
async function broadcastToBoard(
  boardId: string,
  message: UnifiedServerMessage,
  excludeStream?: StreamInOut<UnifiedClientMessage, UnifiedServerMessage>
): Promise<void> {
  const connections = boardConnections.get(boardId);
  if (!connections) {
    console.log(`[BoardSync] No connections found for board ${boardId}`);
    return;
  }

  console.log(`[BoardSync] Broadcasting to ${connections.size} connections on board ${boardId}:`, message);

  const deadConnections: StreamInOut<UnifiedClientMessage, UnifiedServerMessage>[] = [];

  for (const connection of connections) {
    if (connection === excludeStream) continue;

    try {
      await connection.send(message);
    } catch (error) {
      console.error(`[BoardSync] Failed to send message to connection:`, error);
      // Connection is dead, mark for removal
      deadConnections.push(connection);
    }
  }

  // Clean up dead connections
  for (const deadConnection of deadConnections) {
    console.log(`[BoardSync] Cleaning up dead connection`);
    connections.delete(deadConnection);
    const session = sessionData.get(deadConnection);
    if (session) {
      await cleanupConnection(deadConnection, session);
    }
  }
}

// Cleans up resources when a WebSocket connection is closed.
async function cleanupConnection(
  stream: StreamInOut<UnifiedClientMessage, UnifiedServerMessage>,
  session: BoardSession
): Promise<void> {
  const { boardId, userId } = session;

  console.log(`[BoardSync] Cleaning up connection for user ${userId} on board ${boardId}`);

  // Remove from active connections
  const connections = boardConnections.get(boardId);
  if (connections) {
    connections.delete(stream);

    // Remove empty board connection sets
    if (connections.size === 0) {
      console.log(`[BoardSync] Removing empty board connection set for ${boardId}`);
      boardConnections.delete(boardId);
      connectedUsers.delete(boardId);
    }
  }

  // Remove from connected users
  const users = connectedUsers.get(boardId);
  if (users) {
    users.delete(userId);
  }

  // Remove session data
  sessionData.delete(stream);

  // Remove from database
  await boardDB.exec`
    DELETE FROM presence
    WHERE board_id = ${boardId} AND user_id = ${userId}
  `;

  // Broadcast user left message (legacy format)
  const leaveMessage: UnifiedServerMessage = {
    type: "USER_LEFT",
    boardId,
    userId,
    timestamp: Date.now(),
  };

  // Also broadcast as new PRESENCE event
  const presenceEvent: UnifiedServerMessage = {
    eventType: "PRESENCE",
    userId,
    payload: {
      action: "leave",
      connectedUsers: users ? Array.from(users.entries()).map(([id, user]) => ({
        userId: id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      })) : [],
    },
  };

  console.log(`[BoardSync] Broadcasting user leave for ${userId}`);
  await broadcastToBoard(boardId, leaveMessage);
  await broadcastToBoard(boardId, presenceEvent);
}
