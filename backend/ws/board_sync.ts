import { api, StreamInOut } from "encore.dev/api";
import { boardDB } from "../board/db";
import type { ClientMessage, ServerMessage, BoardSession } from "./types";

// Store active connections per board
const boardConnections = new Map<string, Set<StreamInOut<ClientMessage, ServerMessage>>>();
const sessionData = new Map<StreamInOut<ClientMessage, ServerMessage>, BoardSession>();

interface BoardSyncHandshake {
  boardId: string;
  userId: string;
  username: string;
  color?: string;
}

// Handles real-time collaboration for whiteboard sessions via WebSocket connection.
export const boardSync = api.streamInOut<BoardSyncHandshake, ClientMessage, ServerMessage>(
  { expose: true, path: "/ws/board/:boardId" },
  async (handshake, stream) => {
    const { boardId, userId, username, color = '#3B82F6' } = handshake;
    
    // Initialize board connections set if it doesn't exist
    if (!boardConnections.has(boardId)) {
      boardConnections.set(boardId, new Set());
    }
    
    const connections = boardConnections.get(boardId)!;
    connections.add(stream);
    
    // Store session data for this connection
    const session: BoardSession = {
      boardId,
      userId,
      username,
      color,
      lastSeen: new Date(),
    };
    sessionData.set(stream, session);
    
    // Create or update session in database
    await boardDB.exec`
      INSERT INTO sessions (board_id, user_id, connected_at, last_seen)
      VALUES (${boardId}, ${userId}, NOW(), NOW())
      ON CONFLICT (board_id, user_id) 
      DO UPDATE SET last_seen = NOW()
    `;
    
    // Broadcast user joined message to other clients
    const joinMessage: ServerMessage = {
      type: "user_joined",
      boardId,
      userId,
      data: { username, color },
      timestamp: Date.now(),
    };
    
    await broadcastToBoard(boardId, joinMessage, stream);
    
    try {
      // Listen for incoming messages from this client
      for await (const message of stream) {
        await handleClientMessage(message, stream, session);
      }
    } catch (error) {
      console.error(`WebSocket error for user ${userId} on board ${boardId}:`, error);
    } finally {
      // Clean up when connection closes
      await cleanupConnection(stream, session);
    }
  }
);

// Processes incoming messages from clients and broadcasts updates to other connected users.
async function handleClientMessage(
  message: ClientMessage,
  senderStream: StreamInOut<ClientMessage, ServerMessage>,
  session: BoardSession
): Promise<void> {
  const { type, boardId, userId, data, timestamp } = message;
  
  // Update last seen timestamp
  session.lastSeen = new Date();
  await boardDB.exec`
    UPDATE sessions 
    SET last_seen = NOW() 
    WHERE board_id = ${boardId} AND user_id = ${userId}
  `;
  
  switch (type) {
    case "board_update":
      // Save board data to database
      await boardDB.exec`
        UPDATE boards 
        SET data = ${JSON.stringify(data)}
        WHERE id = ${boardId}
      `;
      
      // Broadcast update to other clients
      const updateMessage: ServerMessage = {
        type: "board_update",
        boardId,
        userId,
        data,
        timestamp,
      };
      await broadcastToBoard(boardId, updateMessage, senderStream);
      break;
      
    case "cursor_move":
      // Broadcast cursor movement to other clients (don't save to DB)
      const cursorMessage: ServerMessage = {
        type: "cursor_move",
        boardId,
        userId,
        data,
        timestamp,
      };
      await broadcastToBoard(boardId, cursorMessage, senderStream);
      break;
      
    case "ping":
      // Respond with pong to keep connection alive
      const pongMessage: ServerMessage = {
        type: "pong",
        boardId,
        timestamp: Date.now(),
      };
      await senderStream.send(pongMessage);
      break;
      
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
  const { boardId, userId, username } = session;
  
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
    DELETE FROM sessions 
    WHERE board_id = ${boardId} AND user_id = ${userId}
  `;
  
  // Broadcast user left message
  const leaveMessage: ServerMessage = {
    type: "user_left",
    boardId,
    userId,
    data: { username },
    timestamp: Date.now(),
  };
  
  await broadcastToBoard(boardId, leaveMessage);
}
