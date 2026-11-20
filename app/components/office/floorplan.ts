// تخطيط المكتب ثلاثي الأبعاد (بالمتر). الأرضية من x=-15 إلى 15 ومن z=-10 إلى 10.
// الجدار الخلفي (بنوافذ) عند z=-10، والجدار الأيسر (بنوافذ) عند x=-15، والكاميرا من الأمام يميناً.

export type Vec3 = [number, number, number];
export type RoomId = "open" | "manager" | "meeting" | "private";

/** موقع جلوس: الغرفة + نقطة الكرسي + اتجاه الوجه */
export interface Seat {
  room: RoomId;
  pos: Vec3;
  rot: number;
}

const v = (x: number, z: number): Vec3 => [x, 0, z];

// ─── المكاتب المفتوحة: كتلتان × 3 أعمدة × 3 صفوف = 18 مكتباً ─────────
const ROWS_Z = [-1.7, 1.5, 4.7];
const BLOCK_B_X = [-5.2, -3.4, -1.6];
const BLOCK_A_X = [-12.2, -10.4, -8.6];
export const AISLE_X = -6.9; // الممر بين الكتلتين
export const EAST_AISLE_X = 0.6;
export const HUB: Vec3 = v(EAST_AISLE_X, -2.6); // نقطة التقاء الممرات

export const DESK_SLOTS: Seat[] = ROWS_Z.flatMap((z) =>
  [...BLOCK_B_X, ...BLOCK_A_X].map((x) => ({ room: "open" as const, pos: v(x, z), rot: 0 }))
);

// ─── مكتب المدير الخاص ─────────────────────────────────────────────
export const MANAGER_ROOM = { x: [-15, -7.5] as [number, number], z: [-10, -4.6] as [number, number] };
export const MANAGER_SEAT: Seat = { room: "manager", pos: v(-11.2, -8.1), rot: 0 };
export const MANAGER_DOOR = { out: v(-8.3, -3.9), in: v(-8.3, -5.4), gap: [-8.9, -7.7] as [number, number] };

// ─── غرفة الاجتماعات الكبيرة ───────────────────────────────────────
export const MEETING_ROOM = { x: [4.5, 15] as [number, number], z: [-10, -2.2] as [number, number] };
export const MEETING_TABLE = { center: v(9.9, -6.1), size: [6.2, 1.5] as [number, number] };
export const MEETING_DOOR = { out: v(5.8, -1.4), in: v(5.8, -3.0), gap: [5.2, 6.4] as [number, number] };
const SIDE_X = [7.5, 8.7, 9.9, 11.1, 12.3];
const NEAR_Z = -4.95;
const FAR_Z = -7.25;
/** أول مقعد لمصعب (رأس الطاولة)، ثم الجانب القريب، ثم البعيد، ثم الرأس الآخر */
export const MEETING_SEATS: Seat[] = [
  { room: "meeting", pos: v(13.6, -6.1), rot: -Math.PI / 2 },
  ...SIDE_X.map((x) => ({ room: "meeting" as const, pos: v(x, NEAR_Z), rot: Math.PI })),
  ...SIDE_X.map((x) => ({ room: "meeting" as const, pos: v(x, FAR_Z), rot: 0 })),
  { room: "meeting", pos: v(6.3, -6.1), rot: Math.PI / 2 },
];

// ─── غرفة الاجتماع الخاص (1:1) ─────────────────────────────────────
export const PRIVATE_ROOM = { x: [10.5, 15] as [number, number], z: [1.5, 6.8] as [number, number] };
export const PRIVATE_TABLE = v(12.9, 4.3);
export const PRIVATE_DOOR = { out: v(9.7, 4.3), in: v(11.3, 4.3), gap: [3.7, 4.9] as [number, number] };
export const PRIVATE_SEATS = {
  manager: { room: "private", pos: v(13.8, 4.3), rot: -Math.PI / 2 } as Seat,
  guest: { room: "private", pos: v(12.0, 4.3), rot: Math.PI / 2 } as Seat,
};

// ─── المسارات: كل رحلة = خروج من الموقع الحالي إلى HUB ثم دخول إلى الهدف ──
function enterRoute(seat: Seat): Vec3[] {
  const [x, , z] = seat.pos;
  switch (seat.room) {
    case "open":
      return [HUB, v(EAST_AISLE_X, z - 0.75), v(x, z - 0.75), seat.pos];
    case "manager":
      return [HUB, MANAGER_DOOR.out, MANAGER_DOOR.in, seat.pos];
    case "meeting": {
      const base = [HUB, MEETING_DOOR.out, MEETING_DOOR.in];
      if (Math.abs(z - FAR_Z) < 0.01) return [...base, v(5.5, -7.95), v(x, -7.95), seat.pos];
      if (Math.abs(z - NEAR_Z) < 0.01 || x > 13) return [...base, v(x, -4.2), seat.pos];
      return [...base, seat.pos];
    }
    case "private": {
      const base = [HUB, PRIVATE_DOOR.out, PRIVATE_DOOR.in];
      return x > PRIVATE_TABLE[0] ? [...base, v(12.9, 5.4), seat.pos] : [...base, seat.pos];
    }
  }
}

export function routeBetween(from: Seat | null, to: Seat): Vec3[] {
  if (!from) return [to.pos];
  if (from.pos[0] === to.pos[0] && from.pos[2] === to.pos[2]) return [to.pos];
  const exit = enterRoute(from).slice(0, -1).reverse(); // ينتهي بـ HUB
  const enter = enterRoute(to).slice(1); // يبدأ بعد HUB
  // داخل نفس الغرفة (غير المفتوحة) لا داعي للخروج إلى HUB
  if (from.room === to.room && from.room !== "open") return [to.pos];
  return [...exit, ...enter];
}

// ─── زوايا الكاميرا ────────────────────────────────────────────────
export const CAMERA_PRESETS = {
  overview: { pos: [11, 16, 20] as Vec3, target: [-0.5, 0, -0.8] as Vec3 },
  manager: { pos: [-4.5, 6.5, 0.5] as Vec3, target: [-11, 0.6, -7.2] as Vec3 },
  meeting: { pos: [11.5, 10, 4.5] as Vec3, target: [9.9, 0.6, -6.1] as Vec3 },
  private: { pos: [17.5, 6.5, 10.5] as Vec3, target: [12.9, 0.6, 4.3] as Vec3 },
};
export type RoomView = keyof typeof CAMERA_PRESETS;

// ─── لافتات الغرف ──────────────────────────────────────────────────
export const ROOM_TAGS: { id: string; text: string; pos: Vec3 }[] = [
  { id: "room_manager", text: "🏛️ مكتب المدير العام", pos: [-11.2, 3, -4.6] },
  { id: "room_meeting", text: "👥 غرفة الاجتماعات الكبيرة", pos: [9.9, 3, -2.2] },
  { id: "room_private", text: "🔒 غرفة الاجتماع الخاص", pos: [12.75, 3, 1.5] },
  { id: "room_lounge", text: "☕ الاستراحة", pos: [-10.5, 1.6, 8.3] },
];

// ─── توزيع المقاعد حسب وضع المكتب ───────────────────────────────────
export type OfficeMode = { kind: "desks" } | { kind: "team" } | { kind: "private"; guestId: string };

/** people[0] هو المدير دائماً؛ البقية يأخذون المكاتب بالترتيب */
export function homeSeat(index: number): Seat {
  return index === 0 ? MANAGER_SEAT : DESK_SLOTS[index - 1];
}

export function seatsFor(ids: string[], mode: OfficeMode): Record<string, Seat> {
  const out: Record<string, Seat> = {};
  ids.forEach((id, i) => {
    let seat = homeSeat(i);
    if (mode.kind === "team" && i < MEETING_SEATS.length) seat = MEETING_SEATS[i];
    if (mode.kind === "private") {
      if (i === 0) seat = PRIVATE_SEATS.manager;
      else if (id === mode.guestId) seat = PRIVATE_SEATS.guest;
    }
    out[id] = seat;
  });
  return out;
}

export const MAX_EMPLOYEES = DESK_SLOTS.length; // بدون المدير
