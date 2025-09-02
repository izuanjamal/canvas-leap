import backend from "~backend/client";
import type { User } from "~backend/board/types";

const COLORS = [
  "#3B82F6", // blue-500
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#EF4444", // red-500
  "#8B5CF6", // violet-500
  "#EC4899", // pink-500
];

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function randomName() {
  const animals = ["Tiger", "Panda", "Eagle", "Otter", "Koala", "Dolphin", "Hawk", "Lynx"];
  const id = Math.floor(Math.random() * 9000 + 1000);
  return `Guest-${animals[Math.floor(Math.random() * animals.length)]}-${id}`;
}

export async function ensureUser(): Promise<User> {
  const existing = localStorage.getItem("canvasLeapUser");
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as User;
      if (parsed?.id && parsed?.username) return parsed;
    } catch {}
  }

  const username = randomName();
  const color = randomColor();

  const user = await backend.board.createUser({ username, color });
  localStorage.setItem("canvasLeapUser", JSON.stringify(user));
  return user;
}
