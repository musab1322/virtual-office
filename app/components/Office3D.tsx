"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Character, type AgentStatus, type Person } from "./office/Character";
import {
  Bookshelf,
  Chair,
  CoffeeTable,
  Desk,
  GlassWall,
  PendantLamp,
  Plant,
  RoomFloor,
  Rug,
  Sofa,
  WallScreen,
  WindowWall,
} from "./office/furniture";
import {
  AISLE_X,
  CAMERA_PRESETS,
  DESK_SLOTS,
  MANAGER_DOOR,
  MANAGER_ROOM,
  MANAGER_SEAT,
  MEETING_DOOR,
  MEETING_ROOM,
  MEETING_SEATS,
  MEETING_TABLE,
  PRIVATE_DOOR,
  PRIVATE_ROOM,
  PRIVATE_SEATS,
  PRIVATE_TABLE,
  ROOM_TAGS,
  type RoomView,
  type Seat,
  type Vec3,
} from "./office/floorplan";

export type { AgentStatus, Person };
export type CameraView = RoomView | `agent:${string}`;

// ─── الكاميرا ───────────────────────────────────────────────────────
function CameraRig({
  view,
  nonce,
  seats,
}: {
  view: CameraView;
  nonce: number;
  seats: Record<string, Seat>;
}) {
  const { camera, controls, size } = useThree();
  const animating = useRef(true);
  // الشاشات الطولية (الجوال) والضيقة: نبعد الكاميرا حتى يظهر المكتب كاملاً
  const aspect = size.width / Math.max(1, size.height);
  const fit = Math.min(2.3, Math.max(1, 1.5 / aspect));
  const agentSeat = view.startsWith("agent:") ? seats[view.slice(6)] : undefined;
  const goal = useMemo(() => {
    if (view.startsWith("agent:")) {
      const [x, , z] = agentSeat?.pos ?? [0, 0, 0];
      const f = Math.min(fit, 1.6);
      return { pos: new THREE.Vector3(x + 2.8 * f, 0.9 + 2.7 * f, z + 4.8 * f), target: new THREE.Vector3(x, 0.9, z) };
    }
    const p = CAMERA_PRESETS[view as RoomView];
    const target = new THREE.Vector3(...p.target);
    const pos = new THREE.Vector3(...p.pos).sub(target).multiplyScalar(fit).add(target);
    return { pos, target };
  }, [view, agentSeat, fit]);

  useEffect(() => {
    animating.current = true;
  }, [goal, nonce]);

  useFrame((_, dt) => {
    const c = controls as unknown as OrbitControlsImpl | undefined;
    if (!animating.current || !c) return;
    const k = 1 - Math.pow(0.02, Math.min(dt, 0.05));
    camera.position.lerp(goal.pos, k);
    c.target.lerp(goal.target, k);
    c.update();
    if (camera.position.distanceTo(goal.pos) < 0.02) animating.current = false;
  });
  return null;
}

// ─── لافتات (طبقة HTML تتبع نقاطاً في المشهد) ───────────────────────
function LabelProjector({
  ids,
  getAnchor,
  placeLabel,
}: {
  ids: string[];
  getAnchor: (id: string) => THREE.Object3D | Vec3 | null | undefined;
  placeLabel: (id: string, transform: string | null, zIndex: number) => void;
}) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const id of ids) {
      const anchor = getAnchor(id);
      if (!anchor) continue;
      if (Array.isArray(anchor)) v.set(...anchor);
      else anchor.getWorldPosition(v);
      const dist = camera.position.distanceTo(v);
      v.project(camera);
      if (v.z > 1) {
        placeLabel(id, null, 0);
        continue;
      }
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      const sc = THREE.MathUtils.clamp(15 / dist, 0.75, 1.15);
      placeLabel(
        id,
        `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%) scale(${sc})`,
        Math.round(1000 - dist * 10)
      );
    }
  });
  return null;
}

// ─── الغرف ──────────────────────────────────────────────────────────
function ManagerOffice() {
  const [x0, x1] = MANAGER_ROOM.x;
  const [z0, z1] = MANAGER_ROOM.z;
  const [gx0, gx1] = MANAGER_DOOR.gap;
  return (
    <group>
      <RoomFloor x={MANAGER_ROOM.x} z={MANAGER_ROOM.z} color="#b08d6a" />
      <Rug position={[-11.2, 0, -6.6]} size={[4.2, 3.2]} color="#7a2e2e" />
      <GlassWall from={[x1, z0]} to={[x1, z1]} />
      <GlassWall from={[x0, z1]} to={[gx0, z1]} />
      <GlassWall from={[gx1, z1]} to={[x1, z1]} />
      <Desk position={MANAGER_SEAT.pos} exec />
      <Chair position={MANAGER_SEAT.pos} color="#3b2618" />
      {/* كرسيا الضيوف */}
      <Chair position={[-12.0, 0, -5.9]} rotation={Math.PI} color="#6b4a2f" />
      <Chair position={[-10.4, 0, -5.9]} rotation={Math.PI} color="#6b4a2f" />
      <Sofa position={[-14.3, 0, -6.8]} rotation={Math.PI / 2} />
      <Bookshelf position={[-13.4, 0, -9.7]} />
      <Bookshelf position={[-9.0, 0, -9.7]} />
      <Plant position={[-14.3, 0, -9.3]} scale={1.3} />
      <Plant position={[-8.0, 0, -9.3]} scale={1.1} />
      {/* علم أخضر صغير على المكتب */}
      <group position={[-10.3, 0.78, -7.4]}>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.3]} />
          <meshStandardMaterial color="#ccc" />
        </mesh>
        <mesh position={[0.09, 0.24, 0]}>
          <boxGeometry args={[0.18, 0.12, 0.005]} />
          <meshStandardMaterial color="#006c35" />
        </mesh>
      </group>
    </group>
  );
}

function BigMeetingRoom() {
  const [x0, x1] = MEETING_ROOM.x;
  const [, z1] = MEETING_ROOM.z;
  const [gx0, gx1] = MEETING_DOOR.gap;
  const [cx, , cz] = MEETING_TABLE.center;
  const [w, d] = MEETING_TABLE.size;
  return (
    <group>
      <RoomFloor x={MEETING_ROOM.x} z={MEETING_ROOM.z} color="#d7dde3" />
      <GlassWall from={[x0, MEETING_ROOM.z[0]]} to={[x0, z1]} />
      <GlassWall from={[x0, z1]} to={[gx0, z1]} />
      <GlassWall from={[gx1, z1]} to={[x1, z1]} />
      <mesh position={[cx, 0.75, cz]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.07, d]} />
        <meshStandardMaterial color="#6e4f3a" />
      </mesh>
      {[-w / 2 + 0.6, w / 2 - 0.6].map((x) => (
        <mesh key={x} position={[cx + x, 0.37, cz]}>
          <boxGeometry args={[0.3, 0.74, d - 0.4]} />
          <meshStandardMaterial color="#3d4248" />
        </mesh>
      ))}
      <WallScreen position={[cx, 1.7, -9.85]} width={3.2} />
      {MEETING_SEATS.map((s, i) => (
        <Chair key={i} position={s.pos} rotation={s.rot} />
      ))}
      <Plant position={[14.3, 0, -9.3]} scale={1.3} />
      <Plant position={[5.2, 0, -9.3]} scale={1.1} />
    </group>
  );
}

function PrivateRoom() {
  const [x0, x1] = PRIVATE_ROOM.x;
  const [z0, z1] = PRIVATE_ROOM.z;
  const [gz0, gz1] = PRIVATE_DOOR.gap;
  return (
    <group>
      <RoomFloor x={PRIVATE_ROOM.x} z={PRIVATE_ROOM.z} color="#e4dccd" />
      <GlassWall from={[x0, z0]} to={[x1, z0]} />
      <GlassWall from={[x0, z0]} to={[x0, gz0]} />
      <GlassWall from={[x0, gz1]} to={[x0, z1]} />
      <GlassWall from={[x0, z1]} to={[x1, z1]} />
      <CoffeeTable position={[PRIVATE_TABLE[0], 0.33, PRIVATE_TABLE[2]]} radius={0.55} />
      <Chair position={PRIVATE_SEATS.manager.pos} rotation={PRIVATE_SEATS.manager.rot} color="#3b2618" />
      <Chair position={PRIVATE_SEATS.guest.pos} rotation={PRIVATE_SEATS.guest.rot} color="#3b2618" />
      <Plant position={[14.4, 0, 2.1]} />
      <Plant position={[14.4, 0, 6.3]} />
    </group>
  );
}

function Lounge() {
  return (
    <group>
      <Rug position={[-10.5, 0, 8.4]} size={[6.5, 2.8]} color="#c9b18f" />
      <Sofa position={[-10.5, 0, 9.3]} rotation={Math.PI} />
      <Sofa position={[-13.6, 0, 8.3]} rotation={Math.PI / 2} />
      <CoffeeTable position={[-10.8, 0, 8.0]} />
      {/* دلة قهوة وفناجين */}
      <mesh position={[-10.8, 0.55, 8.0]}>
        <cylinderGeometry args={[0.05, 0.08, 0.2, 12]} />
        <meshStandardMaterial color="#d4a72c" metalness={0.7} roughness={0.3} />
      </mesh>
      <Plant position={[-14.3, 0, 9.4]} scale={1.3} />
      <Plant position={[-7.2, 0, 9.4]} scale={1.2} />
    </group>
  );
}

// ─── المشهد ─────────────────────────────────────────────────────────
export default function Office3D({
  people,
  seats,
  homeDesk,
  statuses,
  view,
  viewNonce,
  selected,
  onSelect,
  onEmptyDesk,
}: {
  people: Person[];
  seats: Record<string, Seat>;
  /** رقم المكتب المفتوح لكل موظف (المدير غير مدرج) */
  homeDesk: Record<string, number>;
  statuses: Record<string, AgentStatus>;
  view: CameraView;
  viewNonce: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onEmptyDesk: () => void;
}) {
  const anchors = useRef<Record<string, THREE.Object3D | null>>({});
  const labels = useRef<Record<string, HTMLDivElement | null>>({});
  const registerAnchor = (id: string, el: THREE.Object3D | null) => {
    anchors.current[id] = el;
  };
  const roomAnchors = useMemo(() => Object.fromEntries(ROOM_TAGS.map((r) => [r.id, r.pos])), []);
  const getAnchor = (id: string) => anchors.current[id] ?? roomAnchors[id];
  const placeLabel = (id: string, transform: string | null, zIndex: number) => {
    const el = labels.current[id];
    if (!el) return;
    if (transform === null) {
      el.style.display = "none";
      return;
    }
    el.style.display = "";
    el.style.transform = transform;
    el.style.zIndex = String(zIndex);
  };
  const labelIds = useMemo(
    () => [...people.map((p) => p.id), ...ROOM_TAGS.map((r) => r.id)],
    [people]
  );
  const deskOwner = useMemo(() => {
    const m: Record<number, string> = {};
    for (const [id, i] of Object.entries(homeDesk)) m[i] = id;
    return m;
  }, [homeDesk]);

  return (
    <div className="relative h-full w-full" dir="ltr">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: CAMERA_PRESETS.overview.pos, fov: 42, near: 0.1, far: 120 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#dfe6ee"]} />
        <fog attach="fog" args={["#dfe6ee", 38, 70]} />
        <hemisphereLight args={["#ffffff", "#b9a58c", 1.1]} />
        <directionalLight
          position={[-10, 18, 8]}
          intensity={1.7}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-18}
          shadow-camera-right={18}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
          shadow-bias={-0.0005}
        />
        <ambientLight intensity={0.25} />

        {/* أرضية خشبية */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[30, 20]} />
          <meshStandardMaterial color="#cdb497" />
        </mesh>
        {/* ممرات بسجاد تركوازي */}
        <Rug position={[AISLE_X, 0, 2.1]} size={[1.2, 9.4]} color="#2f8f8a" />
        <Rug position={[-5.2, 0, -3.3]} size={[18.6, 1.1]} color="#2f8f8a" />

        <WindowWall position={[0, 0, -10]} width={29.6} panes={9} />
        <WindowWall position={[-15, 0, 0]} rotation={Math.PI / 2} width={19.6} panes={6} />

        {[
          [-10.4, 3.2, 0],
          [-3.4, 3.2, 0],
          [-10.4, 3.2, 4.2],
          [-3.4, 3.2, 4.2],
          [-11.2, 3.2, -7],
          [9.9, 3.2, -6.1],
          [12.9, 3.2, 4.3],
        ].map((p, i) => (
          <PendantLamp key={i} position={p as Vec3} />
        ))}

        {/* المكاتب المفتوحة (الشاغرة قابلة للنقر لإضافة موظف) */}
        {DESK_SLOTS.map((slot, i) => {
          const owner = deskOwner[i];
          return (
            <group key={i}>
              <Desk
                position={slot.pos}
                screenOn={!!owner && statuses[owner] === "working"}
                onClick={owner ? () => onSelect(owner) : onEmptyDesk}
              />
              <Chair position={slot.pos} rotation={owner ? 0 : 0.35} />
            </group>
          );
        })}

        <Plant position={[-7.0, 0, -1.2]} />
        <Plant position={[-7.0, 0, 6.6]} />
        <Plant position={[0.2, 0, 6.6]} />
        <Plant position={[3.8, 0, -1.4]} scale={1.2} />
        <Plant position={[-14.3, 0, -3.6]} scale={1.3} />

        <ManagerOffice />
        <BigMeetingRoom />
        <PrivateRoom />
        <Lounge />

        {people.map((p) => (
          <Character
            key={p.id}
            person={p}
            seat={seats[p.id]}
            status={statuses[p.id] ?? "idle"}
            selected={selected === p.id}
            onSelect={onSelect}
            registerAnchor={registerAnchor}
          />
        ))}
        <LabelProjector ids={labelIds} getAnchor={getAnchor} placeLabel={placeLabel} />

        <OrbitControls
          makeDefault
          enableDamping
          maxPolarAngle={Math.PI / 2.25}
          minDistance={3}
          maxDistance={40}
          target={CAMERA_PRESETS.overview.target}
        />
        <CameraRig view={view} nonce={viewNonce} seats={seats} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {ROOM_TAGS.map((r) => (
          <div
            key={r.id}
            ref={(el) => void (labels.current[r.id] = el)}
            className="agent-tag-wrap"
            style={{ display: "none", pointerEvents: "none" }}
          >
            <div dir="rtl" className="room-tag">
              {r.text}
            </div>
          </div>
        ))}
        {people.map((p) => {
          const status = statuses[p.id] ?? "idle";
          return (
            <div
              key={p.id}
              ref={(el) => void (labels.current[p.id] = el)}
              className="agent-tag-wrap"
              style={{ display: "none" }}
            >
              <div
                dir="rtl"
                onClick={() => onSelect(p.id)}
                className={`agent-tag ${selected === p.id ? "selected" : ""}`}
                style={{ ["--c" as string]: p.color }}
              >
                <span className={`dot ${status}`} />
                <b>{p.name}</b>
                <span className="role">{p.role}</span>
                {status === "working" && <span className="st">⏳</span>}
                {status === "done" && <span className="st">✅</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
