"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { OFFICE_AGENTS, type AgentId } from "@/lib/agents";

export type AgentStatus = "idle" | "working" | "done";
export type CameraView = "overview" | "meeting" | AgentId;

type Vec3 = [number, number, number];

// ─── تخطيط المكتب (بالمتر) ───────────────────────────────────────────
// كل وكيل يجلس خلف مكتبه ووجهه نحو الكاميرا (+z)
const DESK_SEATS: Record<AgentId, { pos: Vec3; rot: number }> = {
  musab: { pos: [-1, 0, -5.2], rot: 0 },
  kareem: { pos: [-6.5, 0, -1.5], rot: 0 },
  mona: { pos: [-2.5, 0, 1.6], rot: 0 },
  omar: { pos: [1.8, 0, -1.5], rot: 0 },
};

// مكاتب إضافية فارغة لملء المكتب المفتوح
const EMPTY_DESKS: Vec3[] = [
  [-6.5, 0, 2.6],
  [-5.5, 0, -5.2],
  [1.8, 0, 2.6],
];

const MEETING_TABLE: Vec3 = [7.2, 0, -1.6];
const MEETING_SEATS: Record<AgentId, Vec3> = (() => {
  const [tx, , tz] = MEETING_TABLE;
  return {
    musab: [tx, 0, tz - 1.35],
    kareem: [tx - 1.25, 0, tz],
    mona: [tx, 0, tz + 1.35],
    omar: [tx + 1.25, 0, tz],
  };
})();
// باب غرفة الاجتماعات (فتحة في الجدار الزجاجي)
const DOOR_OUT: Vec3 = [MEETING_TABLE[0] - 3.3, 0, MEETING_TABLE[2] + 2.2];
const DOOR_IN: Vec3 = [MEETING_TABLE[0] - 1.9, 0, MEETING_TABLE[2] + 2.2];
const facing = (from: Vec3, to: Vec3) =>
  Math.atan2(to[0] - from[0], to[2] - from[2]);

const CAMERA_VIEWS: Record<
  "overview" | "meeting",
  { pos: Vec3; target: Vec3 }
> = {
  overview: { pos: [7, 9, 11.5], target: [-0.5, 0.5, -1.2] },
  meeting: { pos: [13.5, 8.5, 6.5], target: MEETING_TABLE },
};

const SKIN = ["#e0ac83", "#c68a62", "#f1c7a3", "#a8714d"];
const HAIR = ["#2b1d14", "#3b2a20", "#1a1a1a", "#4a3426"];

// ─── عناصر الأثاث ───────────────────────────────────────────────────
function Desk({
  position,
  screenOn = false,
}: {
  position: Vec3;
  screenOn?: boolean;
}) {
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!screen.current) return;
    screen.current.emissiveIntensity = screenOn
      ? 0.9 + Math.sin(clock.elapsedTime * 6) * 0.25
      : 0.35;
  });
  // المكتب أمام المقعد بـ 0.6م
  return (
    <group position={[position[0], 0, position[2] + 0.62]}>
      <RoundedBox
        args={[1.6, 0.06, 0.8]}
        radius={0.02}
        position={[0, 0.75, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#e9e9ea" />
      </RoundedBox>
      {/* لوح أمامي يشبه الصورة */}
      <mesh position={[0, 0.4, 0.38]} castShadow receiveShadow>
        <boxGeometry args={[1.58, 0.68, 0.04]} />
        <meshStandardMaterial color="#9aa0a6" />
      </mesh>
      {[-0.76, 0.76].map((x) => (
        <mesh key={x} position={[x, 0.37, 0]} castShadow>
          <boxGeometry args={[0.05, 0.74, 0.76]} />
          <meshStandardMaterial color="#8b9096" />
        </mesh>
      ))}
      {/* شاشة */}
      <group position={[0, 0.78, 0.18]}>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.12]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        <mesh position={[0, 0.28, 0]} castShadow>
          <boxGeometry args={[0.62, 0.36, 0.03]} />
          <meshStandardMaterial color="#1f2328" />
        </mesh>
        <mesh position={[0, 0.28, -0.017]}>
          <planeGeometry args={[0.57, 0.31]} />
          <meshStandardMaterial
            ref={screen}
            color="#0b1e36"
            emissive={screenOn ? "#3b82f6" : "#1e3a5f"}
            emissiveIntensity={0.35}
            side={THREE.BackSide}
          />
        </mesh>
      </group>
      {/* لوحة مفاتيح */}
      <mesh position={[0, 0.79, -0.15]}>
        <boxGeometry args={[0.45, 0.02, 0.14]} />
        <meshStandardMaterial color="#2a2d31" />
      </mesh>
      {/* كوب */}
      <mesh position={[0.55, 0.83, -0.05]}>
        <cylinderGeometry args={[0.04, 0.035, 0.1, 12]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
    </group>
  );
}

function Chair({
  position,
  rotation = 0,
}: {
  position: Vec3;
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.5, 0.08, 0.48]} />
        <meshStandardMaterial color="#2e3238" />
      </mesh>
      <mesh position={[0, 0.85, -0.24]} castShadow>
        <boxGeometry args={[0.48, 0.62, 0.07]} />
        <meshStandardMaterial color="#2e3238" />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.42]} />
        <meshStandardMaterial color="#777" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.04, 5]} />
        <meshStandardMaterial color="#555" />
      </mesh>
    </group>
  );
}

function Plant({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.44, 16]} />
        <meshStandardMaterial color="#f3f0ea" />
      </mesh>
      {[
        [0, 0.75, 0, 0.32],
        [0.16, 0.95, 0.06, 0.24],
        [-0.14, 1.0, -0.05, 0.25],
        [0.02, 1.2, 0.02, 0.2],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 0]} />
          <meshStandardMaterial
            color={i % 2 ? "#3f8f3a" : "#2f7a35"}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

function PendantLamp({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 1.2]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.28, 24, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#fff6e0"
          emissiveIntensity={0.9}
        />
      </mesh>
    </group>
  );
}

function WindowWall({
  position,
  rotation = 0,
  width,
  panes,
}: {
  position: Vec3;
  rotation?: number;
  width: number;
  panes: number;
}) {
  const paneW = width / panes;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* الجدار */}
      <mesh position={[0, 1.9, -0.06]} receiveShadow>
        <boxGeometry args={[width + 0.4, 3.8, 0.1]} />
        <meshStandardMaterial color="#eceae6" />
      </mesh>
      {Array.from({ length: panes }).map((_, i) => {
        const x = -width / 2 + paneW * (i + 0.5);
        return (
          <group key={i} position={[x, 1.85, 0]}>
            <mesh>
              <planeGeometry args={[paneW - 0.35, 2.6]} />
              <meshStandardMaterial
                color="#9cc6ef"
                emissive="#b9dcff"
                emissiveIntensity={0.45}
              />
            </mesh>
            {/* إطار النافذة */}
            {[
              [0, 1.3, paneW - 0.3, 0.07],
              [0, -1.3, paneW - 0.3, 0.07],
              [0, 0.35, paneW - 0.3, 0.05],
              [-(paneW - 0.35) / 2, 0, 0.07, 2.66],
              [(paneW - 0.35) / 2, 0, 0.07, 2.66],
              [0, 0, 0.05, 2.6],
            ].map(([fx, fy, fw, fh], j) => (
              <mesh key={j} position={[fx, fy, 0.02]}>
                <boxGeometry args={[fw, fh, 0.05]} />
                <meshStandardMaterial color="#3d4248" />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function Bookshelf({
  position,
  rotation = 0,
}: {
  position: Vec3;
  rotation?: number;
}) {
  const books = useMemo(
    () =>
      Array.from({ length: 4 }).flatMap((_, row) =>
        Array.from({ length: 6 }).map((__, i) => ({
          x: -0.45 + i * 0.17,
          y: 0.35 + row * 0.5,
          h: 0.22 + ((i * 7 + row * 3) % 5) * 0.03,
          c: ["#b45309", "#1d4ed8", "#15803d", "#be123c", "#6b7280", "#a16207"][
            (i + row) % 6
          ],
        })),
      ),
    [],
  );
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[1.2, 2.2, 0.35]} />
        <meshStandardMaterial color="#6b4f3a" />
      </mesh>
      {books.map((b, i) => (
        <mesh key={i} position={[b.x, b.y + b.h / 2 - 0.1, 0.12]}>
          <boxGeometry args={[0.12, b.h, 0.2]} />
          <meshStandardMaterial color={b.c} />
        </mesh>
      ))}
    </group>
  );
}

function Sofa({
  position,
  rotation = 0,
}: {
  position: Vec3;
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox
        args={[2.2, 0.4, 0.9]}
        radius={0.08}
        position={[0, 0.3, 0]}
        castShadow
      >
        <meshStandardMaterial color="#5b6b7c" />
      </RoundedBox>
      <RoundedBox
        args={[2.2, 0.6, 0.22]}
        radius={0.08}
        position={[0, 0.65, -0.36]}
        castShadow
      >
        <meshStandardMaterial color="#5b6b7c" />
      </RoundedBox>
      {[-1.05, 1.05].map((x) => (
        <RoundedBox
          key={x}
          args={[0.2, 0.55, 0.9]}
          radius={0.06}
          position={[x, 0.45, 0]}
          castShadow
        >
          <meshStandardMaterial color="#4b5a6a" />
        </RoundedBox>
      ))}
    </group>
  );
}

function MeetingRoom() {
  const [tx, , tz] = MEETING_TABLE;
  return (
    <group>
      {/* أرضية مميزة لغرفة الاجتماعات */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[tx, 0.005, tz]}
        receiveShadow
      >
        <planeGeometry args={[5.2, 5.6]} />
        <meshStandardMaterial color="#d7dde3" />
      </mesh>
      {/* جدار زجاجي */}
      <mesh position={[tx - 2.6, 1.3, tz - 0.65]}>
        <boxGeometry args={[0.04, 2.6, 4.3]} />
        <meshStandardMaterial color="#cfe6f7" transparent opacity={0.22} />
      </mesh>
      {[
        [2.6, tz - 0.65, 4.3, 0.06],
        [1.3, tz + 1.5, 0.06, 2.6],
        [1.3, tz - 2.8, 0.06, 2.6],
      ].map(([y, z, d, h], i) => (
        <mesh key={i} position={[tx - 2.6, y, z]}>
          <boxGeometry args={[0.08, h, d]} />
          <meshStandardMaterial color="#3d4248" />
        </mesh>
      ))}
      {/* الطاولة */}
      <mesh position={[tx, 0.75, tz]} castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 0.95, 0.06, 40]} />
        <meshStandardMaterial color="#7a5a43" />
      </mesh>
      <mesh position={[tx, 0.37, tz]}>
        <cylinderGeometry args={[0.1, 0.25, 0.74, 16]} />
        <meshStandardMaterial color="#3d4248" />
      </mesh>
      {/* شاشة عرض Teams */}
      <group position={[tx + 2.45, 1.6, tz]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh>
          <boxGeometry args={[2.2, 1.25, 0.06]} />
          <meshStandardMaterial color="#1f2328" />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <planeGeometry args={[2.05, 1.1]} />
          <meshStandardMaterial
            color="#5b5fc7"
            emissive="#5b5fc7"
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>
      {(Object.keys(MEETING_SEATS) as AgentId[]).map((id) => {
        const p = MEETING_SEATS[id];
        return (
          <Chair key={id} position={p} rotation={facing(p, MEETING_TABLE)} />
        );
      })}
    </group>
  );
}

// ─── الشخصية ────────────────────────────────────────────────────────
const SIT_HIP = 0.5;
const STAND_HIP = 0.92;

function Character({
  id,
  index,
  status,
  inMeeting,
  selected,
  onSelect,
  registerAnchor,
}: {
  id: AgentId;
  index: number;
  status: AgentStatus;
  inMeeting: boolean;
  selected: boolean;
  onSelect: (id: AgentId) => void;
  registerAnchor: (id: AgentId, el: THREE.Object3D | null) => void;
}) {
  const agent = OFFICE_AGENTS[id];
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const knees = useRef<(THREE.Group | null)[]>([]);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const elbows = useRef<(THREE.Group | null)[]>([]);
  const sit = useRef(1); // 1 = جالس، 0 = واقف/يمشي

  const target = inMeeting
    ? { pos: MEETING_SEATS[id], rot: facing(MEETING_SEATS[id], MEETING_TABLE) }
    : DESK_SEATS[id];
  // المسار يمر عبر باب غرفة الاجتماعات بدل اختراق الجدار الزجاجي
  const path = useRef<THREE.Vector3[]>([new THREE.Vector3(...target.pos)]);
  const leg = useRef(0);
  useEffect(() => {
    const g = root.current;
    // داخل غرفة الاجتماعات = خلف الجدار الزجاجي
    const inside = !!g && g.position.x > DOOR_IN[0] - 0.6;
    const pts: Vec3[] = inMeeting
      ? inside
        ? [target.pos]
        : [DOOR_OUT, DOOR_IN, target.pos]
      : inside
        ? [DOOR_IN, DOOR_OUT, target.pos]
        : [target.pos];
    path.current = pts.map((p) => new THREE.Vector3(...p));
    leg.current = 0;
  }, [inMeeting, target.pos]);

  const skin = SKIN[index % SKIN.length];
  const hair = HAIR[index % HAIR.length];
  const isFemale = id === "mona";

  useFrame(({ clock }, dt) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime + index;
    const d = Math.min(dt, 0.05);

    // المشي نحو المقعد المستهدف عبر نقاط المسار
    const pts = path.current;
    const isLast = leg.current >= pts.length - 1;
    const toTarget = pts[Math.min(leg.current, pts.length - 1)]
      .clone()
      .sub(g.position);
    toTarget.y = 0;
    let dist = toTarget.length();
    if (!isLast && dist < 0.15) {
      leg.current++;
      dist = 1;
    }
    const walking = dist > 0.04;
    if (walking) {
      const step = Math.min(dist, 2.2 * d);
      g.position.addScaledVector(toTarget.normalize(), step);
      const want = Math.atan2(toTarget.x, toTarget.z);
      g.rotation.y = lerpAngle(g.rotation.y, want, 1 - Math.pow(0.0001, d));
      sit.current = Math.max(0, sit.current - d * 4);
    } else {
      g.rotation.y = lerpAngle(
        g.rotation.y,
        target.rot,
        1 - Math.pow(0.001, d),
      );
      sit.current = Math.min(1, sit.current + d * 2.5);
    }
    const s = sit.current;
    const swing = walking ? Math.sin(t * 9) * 0.6 : 0;

    const hipY = THREE.MathUtils.lerp(STAND_HIP, SIT_HIP, s);
    if (body.current) body.current.position.y = hipY;

    const typing = status === "working" && !walking && s > 0.95;
    legs.current.forEach((leg, i) => {
      if (leg)
        leg.rotation.x = THREE.MathUtils.lerp(
          swing * (i ? 1 : -1),
          -Math.PI / 2,
          s,
        );
    });
    knees.current.forEach((knee, i) => {
      if (knee)
        knee.rotation.x = THREE.MathUtils.lerp(
          walking ? Math.max(0, -swing * (i ? 1 : -1)) : 0,
          Math.PI / 2,
          s,
        );
    });
    arms.current.forEach((arm, i) => {
      if (!arm) return;
      const tap = typing ? Math.sin(t * 18 + i * Math.PI) * 0.08 : 0;
      arm.rotation.x = THREE.MathUtils.lerp(
        -swing * (i ? 1 : -1) * 0.8,
        -0.45 + tap,
        s,
      );
    });
    elbows.current.forEach((el) => {
      if (el) el.rotation.x = THREE.MathUtils.lerp(-0.2, -1.05, s);
    });
    if (head.current) {
      head.current.rotation.x = typing
        ? Math.sin(t * 2.5) * 0.06 + 0.12
        : status === "done"
          ? -0.05
          : 0;
      head.current.rotation.y =
        !typing && !walking ? Math.sin(t * 0.4) * 0.25 : 0;
    }
  });

  const shirt = agent.color;
  const pants = "#2d3340";
  const start = DESK_SEATS[id];

  return (
    <group
      ref={root}
      position={start.pos}
      rotation={[0, start.rot, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <group ref={body} position={[0, SIT_HIP, 0]}>
        {/* الساقان */}
        {[-0.1, 0.1].map((x, i) => (
          <group
            key={x}
            position={[x, 0, 0]}
            ref={(el) => void (legs.current[i] = el)}
          >
            <mesh position={[0, -0.22, 0]} castShadow>
              <boxGeometry args={[0.15, 0.46, 0.16]} />
              <meshStandardMaterial color={pants} />
            </mesh>
            <group
              position={[0, -0.45, 0]}
              ref={(el) => void (knees.current[i] = el)}
            >
              <mesh position={[0, -0.2, 0]} castShadow>
                <boxGeometry args={[0.13, 0.42, 0.14]} />
                <meshStandardMaterial color={pants} />
              </mesh>
              <mesh position={[0, -0.43, 0.05]} castShadow>
                <boxGeometry args={[0.14, 0.07, 0.26]} />
                <meshStandardMaterial color="#1b1b1b" />
              </mesh>
            </group>
          </group>
        ))}
        {/* الجذع */}
        <RoundedBox
          args={[0.44, 0.56, 0.24]}
          radius={0.06}
          position={[0, 0.3, 0]}
          castShadow
        >
          <meshStandardMaterial color={shirt} />
        </RoundedBox>
        {/* ياقة/ربطة عنق للمدير */}
        {id === "musab" && (
          <mesh position={[0, 0.42, 0.125]}>
            <boxGeometry args={[0.06, 0.26, 0.01]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        )}
        {/* الذراعان */}
        {[-0.27, 0.27].map((x, i) => (
          <group
            key={x}
            position={[x, 0.52, 0]}
            ref={(el) => void (arms.current[i] = el)}
          >
            <mesh position={[0, -0.15, 0]} castShadow>
              <boxGeometry args={[0.11, 0.3, 0.12]} />
              <meshStandardMaterial color={shirt} />
            </mesh>
            <group
              position={[0, -0.29, 0]}
              ref={(el) => void (elbows.current[i] = el)}
            >
              <mesh position={[0, -0.13, 0]} castShadow>
                <boxGeometry args={[0.1, 0.27, 0.1]} />
                <meshStandardMaterial color={shirt} />
              </mesh>
              <mesh position={[0, -0.29, 0]}>
                <sphereGeometry args={[0.055, 10, 8]} />
                <meshStandardMaterial color={skin} />
              </mesh>
            </group>
          </group>
        ))}
        {/* الرأس */}
        <group ref={head} position={[0, 0.66, 0]}>
          <mesh position={[0, -0.06, 0]}>
            <cylinderGeometry args={[0.055, 0.06, 0.1, 10]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          <mesh position={[0, 0.1, 0]} castShadow>
            <sphereGeometry args={[0.14, 20, 16]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          {/* شعر */}
          <mesh
            position={[0, 0.14, -0.015]}
            scale={[1.05, isFemale ? 1.05 : 0.85, 1.05]}
          >
            <sphereGeometry
              args={[0.145, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <meshStandardMaterial color={hair} />
          </mesh>
          {isFemale && (
            <mesh position={[0, 0.0, -0.08]}>
              <boxGeometry args={[0.27, 0.3, 0.1]} />
              <meshStandardMaterial color={hair} />
            </mesh>
          )}
          {/* عينان */}
          {[-0.05, 0.05].map((x) => (
            <mesh key={x} position={[x, 0.12, 0.13]}>
              <sphereGeometry args={[0.016, 8, 6]} />
              <meshStandardMaterial color="#111" />
            </mesh>
          ))}
          {/* نقطة تثبيت لافتة الاسم العائمة */}
          <group position={[0, 0.5, 0]} ref={(el) => registerAnchor(id, el)} />
        </group>
      </group>
      {/* حلقة تحديد */}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.1]}>
          <ringGeometry args={[0.45, 0.55, 40]} />
          <meshBasicMaterial color={agent.color} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

function lerpAngle(a: number, b: number, t: number) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

// ─── الكاميرا ───────────────────────────────────────────────────────
function CameraRig({ view, nonce }: { view: CameraView; nonce: number }) {
  const { camera, controls } = useThree();
  const animating = useRef(true);
  const goal = useMemo(() => {
    if (view === "overview" || view === "meeting") {
      const v = CAMERA_VIEWS[view];
      return {
        pos: new THREE.Vector3(...v.pos),
        target: new THREE.Vector3(...v.target),
      };
    }
    const [x, , z] = DESK_SEATS[view].pos;
    return {
      pos: new THREE.Vector3(x + 2.6, 3.4, z + 4.6),
      target: new THREE.Vector3(x, 0.9, z),
    };
  }, [view]);

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

// ─── لافتات الأسماء (طبقة HTML تتبع رؤوس الشخصيات) ────────────────
function LabelProjector({
  getAnchor,
  placeLabel,
}: {
  getAnchor: (id: AgentId) => THREE.Object3D | null | undefined;
  placeLabel: (id: AgentId, transform: string | null, zIndex: number) => void;
}) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const id of Object.keys(OFFICE_AGENTS) as AgentId[]) {
      const anchor = getAnchor(id);
      if (!anchor) continue;
      anchor.getWorldPosition(v);
      const dist = camera.position.distanceTo(v);
      v.project(camera);
      if (v.z > 1) {
        placeLabel(id, null, 0);
        continue;
      }
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      const sc = THREE.MathUtils.clamp(13 / dist, 0.8, 1.15);
      placeLabel(
        id,
        `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%) scale(${sc})`,
        Math.round(1000 - dist * 10),
      );
    }
  });
  return null;
}

// ─── المشهد ─────────────────────────────────────────────────────────
export default function Office3D({
  statuses,
  inMeeting,
  view,
  viewNonce,
  selected,
  onSelect,
}: {
  statuses: Record<AgentId, AgentStatus>;
  inMeeting: boolean;
  view: CameraView;
  viewNonce: number;
  selected: AgentId | null;
  onSelect: (id: AgentId) => void;
}) {
  const ids = Object.keys(OFFICE_AGENTS) as AgentId[];
  const anchors = useRef<Partial<Record<AgentId, THREE.Object3D | null>>>({});
  const labels = useRef<Partial<Record<AgentId, HTMLDivElement | null>>>({});
  const registerAnchor = (id: AgentId, el: THREE.Object3D | null) => {
    anchors.current[id] = el;
  };
  const getAnchor = (id: AgentId) => anchors.current[id];
  const placeLabel = (id: AgentId, transform: string | null, zIndex: number) => {
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
  return (
    <div className="relative h-full w-full" dir="ltr">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          position: CAMERA_VIEWS.overview.pos,
          fov: 42,
          near: 0.1,
          far: 100,
        }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#dfe6ee"]} />
        <fog attach="fog" args={["#dfe6ee", 28, 50]} />
        <hemisphereLight args={["#ffffff", "#b9a58c", 1.1]} />
        <directionalLight
          position={[-8, 14, 6]}
          intensity={1.7}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-bias={-0.0005}
        />
        <ambientLight intensity={0.25} />

        {/* أرضية خشبية */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[24, 17]} />
          <meshStandardMaterial color="#cdb497" />
        </mesh>
        {/* سجادة ممر بلون تركوازي */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-2.3, 0.004, 0.05]}
          receiveShadow
        >
          <planeGeometry args={[12.5, 1.3]} />
          <meshStandardMaterial color="#2f8f8a" />
        </mesh>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-0.2, 0.003, -3.4]}
          receiveShadow
        >
          <planeGeometry args={[1.2, 7]} />
          <meshStandardMaterial color="#2f8f8a" />
        </mesh>

        {/* جدران بنوافذ كبيرة */}
        <WindowWall position={[0, 0, -8.5]} width={23.6} panes={7} />
        <WindowWall
          position={[-12, 0, 0]}
          rotation={Math.PI / 2}
          width={16.6}
          panes={5}
        />

        {/* إضاءة معلقة */}
        {[
          [-6, 3.2, -4],
          [-1, 3.2, -4],
          [-6, 3.2, 1],
          [-1, 3.2, 1],
          [4, 3.2, -4],
          [7.2, 3.2, -1.6],
        ].map((p, i) => (
          <PendantLamp key={i} position={p as Vec3} />
        ))}

        {/* المكاتب */}
        {ids.map((id) => (
          <group key={id}>
            <Desk
              position={DESK_SEATS[id].pos}
              screenOn={statuses[id] === "working"}
            />
            <Chair position={DESK_SEATS[id].pos} rotation={0} />
          </group>
        ))}
        {EMPTY_DESKS.map((p, i) => (
          <group key={i}>
            <Desk position={p} />
            <Chair position={p} rotation={0.4} />
          </group>
        ))}

        {/* ديكور */}
        <Plant position={[-11, 0, -7.6]} scale={1.4} />
        <Plant position={[-11.2, 0, 6.5]} scale={1.2} />
        <Plant position={[3.9, 0, -7.6]} scale={1.3} />
        <Plant position={[-3.8, 0, -1.4]} />
        <Plant position={[4.3, 0, 2.4]} />
        <Plant position={[10.8, 0, -7.6]} scale={1.3} />
        <Bookshelf position={[1.2, 0, -8.2]} />
        <Bookshelf position={[-11.6, 0, -4]} rotation={Math.PI / 2} />
        <Sofa position={[-9.5, 0, 5.8]} rotation={Math.PI / 2} />
        <mesh position={[-8.3, 0.22, 5.8]} castShadow>
          <cylinderGeometry args={[0.45, 0.45, 0.06, 24]} />
          <meshStandardMaterial color="#e9e9ea" />
        </mesh>

        <MeetingRoom />

        {ids.map((id, i) => (
          <Character
            key={id}
            id={id}
            index={i}
            status={statuses[id]}
            inMeeting={inMeeting}
            selected={selected === id}
            onSelect={onSelect}
            registerAnchor={registerAnchor}
          />
        ))}
        <LabelProjector getAnchor={getAnchor} placeLabel={placeLabel} />

        <OrbitControls
          makeDefault
          enableDamping
          maxPolarAngle={Math.PI / 2.25}
          minDistance={3}
          maxDistance={30}
          target={CAMERA_VIEWS.overview.target}
        />
        <CameraRig view={view} nonce={viewNonce} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {ids.map((id) => {
          const agent = OFFICE_AGENTS[id];
          const status = statuses[id];
          return (
            <div
              key={id}
              ref={(el) => void (labels.current[id] = el)}
              className="agent-tag-wrap"
              style={{ display: "none" }}
            >
              <div
                dir="rtl"
                onClick={() => onSelect(id)}
                className={`agent-tag ${selected === id ? "selected" : ""}`}
                style={{ ["--c" as string]: agent.color }}
              >
                <span className={`dot ${status}`} />
                <b>{agent.name}</b>
                <span className="role">{agent.role}</span>
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
