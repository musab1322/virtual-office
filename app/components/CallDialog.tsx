"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appendChat, getOffice, teamPayload } from "@/lib/officeStore";
import Avatar from "./Avatar";
import { splitForSpeech, voiceFor } from "@/lib/voice";
import { postJSON } from "./ui";
import type { Person } from "./office/Character";

// ─── أنواع مبسطة لواجهة التعرف على الصوت في المتصفح ─────────────────
interface SRResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface SREvent {
  resultIndex: number;
  results: ArrayLike<SRResult>;
}
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRCtor = new () => SpeechRec;

function getRecognizer(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function pickVoice(gender: "m" | "f") {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const ar = voices.filter((v) => v.lang.toLowerCase().startsWith("ar"));
  if (!ar.length) return null;
  const female = /female|zariyah|salma|hoda|laila|amira|mariam|fatima|sana|hala/i;
  const male = /male|naayf|hamed|shakir|maged|tarik|fahed|omar|hamdan/i;
  return (
    ar.find((v) => (gender === "f" ? female : male).test(v.name) && v.lang.toLowerCase().includes("sa")) ??
    ar.find((v) => (gender === "f" ? female : male).test(v.name)) ??
    ar.find((v) => v.lang.toLowerCase().includes("sa")) ??
    ar[0]
  );
}

type Phase = "idle" | "listening" | "thinking" | "speaking";

/** حركة الوجه: فتح الفم أثناء الكلام، ورمش طبيعي، وحركة رأس خفيفة */
function useTalkingFace(speaking: boolean) {
  const [face, setFace] = useState({ mouth: 0, blink: false, bob: 0, tilt: 0 });
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let nextBlink = performance.now() + 2500;
    let blinkUntil = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 50) return; // ~20 إطار في الثانية يكفي
      last = now;
      const t = now / 1000;
      if (now > nextBlink) {
        blinkUntil = now + 140;
        nextBlink = now + 2200 + Math.random() * 2800;
      }
      const pause = Math.sin(t * 2.3) > 0.82; // وقفات قصيرة بين الكلمات
      const mouth = speaking && !pause ? Math.abs(Math.sin(t * 11)) * (0.55 + 0.45 * Math.sin(t * 3.7 + 1)) : 0;
      setFace({
        mouth,
        blink: now < blinkUntil,
        bob: Math.sin(t * (speaking ? 2.4 : 1.1)) * (speaking ? 3 : 1.5),
        tilt: Math.sin(t * 0.9) * (speaking ? 2.5 : 1),
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);
  return face;
}

export default function CallDialog({
  person,
  withVideo,
  onClose,
}: {
  person: Person;
  withVideo: boolean;
  onClose: () => void;
}) {
  const Recognizer = getRecognizer();
  const [phase, setPhase] = useState<Phase>("idle");
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(withVideo);
  const [heard, setHeard] = useState("");
  const [lastReply, setLastReply] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const rec = useRef<SpeechRec | null>(null);
  const active = useRef(true);
  const mutedRef = useRef(false);
  const history = useRef<{ role: "user" | "assistant"; content: string }[]>(
    (getOffice().chats[person.id] ?? []).slice(-10).map((m) => ({ role: m.role, content: m.content }))
  );

  // مؤقت المكالمة
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // الكاميرا (معاينة ذاتية)
  useEffect(() => {
    if (!camOn) return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setError("تعذّر تشغيل الكاميرا. تأكد من السماح للمتصفح باستخدامها."));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [camOn]);

  // ─── النطق: صوت سعودي من الخادم أولاً، ثم أصوات المتصفح كبديل ───
  const audio = useRef<HTMLAudioElement | null>(null);
  const serverTts = useRef(true);
  const tapResolve = useRef<(() => void) | null>(null);
  const [needTap, setNeedTap] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  const fetchClip = useCallback(
    async (text: string) => {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: voiceFor(person) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `TTS ${res.status}`);
      }
      return URL.createObjectURL(await res.blob());
    },
    [person]
  );

  const playUrl = useCallback(async (url: string) => {
    const a = (audio.current ??= new Audio());
    a.src = url;
    try {
      await a.play();
    } catch (e) {
      if ((e as DOMException).name !== "NotAllowedError") throw e;
      // المتصفح منع التشغيل التلقائي: نطلب ضغطة من المستخدم
      setNeedTap(true);
      await new Promise<void>((r) => (tapResolve.current = r));
      setNeedTap(false);
      await a.play();
    }
    await new Promise<void>((resolve) => {
      a.onended = () => resolve();
      a.onerror = () => resolve();
      a.onpause = () => resolve();
    });
  }, []);

  const browserSpeak = useCallback(
    async (text: string) => {
      const synth = window.speechSynthesis;
      if (!synth) {
        setVoiceNote("متصفحك لا يدعم النطق الصوتي.");
        return;
      }
      if (!synth.getVoices().length) {
        await new Promise<void>((r) => {
          synth.onvoiceschanged = () => r();
          setTimeout(r, 1200);
        });
      }
      const v = pickVoice(person.gender);
      if (!v) setVoiceNote("لا يوجد صوت عربي مثبت في جهازك، لذلك قد لا تسمع الرد. أضف اللغة العربية لنظام التشغيل أو استخدم Edge.");
      for (const chunk of splitForSpeech(text)) {
        if (!active.current) return;
        await new Promise<void>((resolve) => {
          synth.cancel();
          const u = new SpeechSynthesisUtterance(chunk);
          u.lang = "ar-SA";
          if (v) u.voice = v;
          u.onend = () => resolve();
          u.onerror = () => resolve();
          synth.speak(u);
        });
      }
    },
    [person.gender]
  );

  const speak = useCallback(
    async (text: string) => {
      if (serverTts.current) {
        const chunks = splitForSpeech(text);
        try {
          let next = chunks.length ? fetchClip(chunks[0]) : null;
          for (let i = 0; i < chunks.length && next; i++) {
            const url = await next;
            next = i + 1 < chunks.length ? fetchClip(chunks[i + 1]) : null;
            if (!active.current) return;
            await playUrl(url);
            URL.revokeObjectURL(url);
          }
          return;
        } catch (e) {
          serverTts.current = false;
          setVoiceNote(`الصوت السعودي غير متاح الآن، نستخدم صوت المتصفح. (${(e as Error).message})`);
        }
      }
      await browserSpeak(text);
    },
    [fetchClip, playUrl, browserSpeak]
  );

  const listenRef = useRef<() => void>(() => {});

  const respond = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setHeard(text);
      setPhase("thinking");
      history.current = [...history.current, { role: "user" as const, content: text }].slice(-20);
      try {
        const { reply } = await postJSON<{ reply: string }>("/api/employee", {
          action: "chat",
          mode: "call",
          employeeId: person.id,
          employees: teamPayload(),
          messages: history.current,
        });
        if (!active.current) return;
        history.current = [...history.current, { role: "assistant" as const, content: reply }];
        appendChat(person.id, [
          { role: "user", content: text, via: "call" },
          { role: "assistant", content: reply, via: "call" },
        ]);
        setLastReply(reply);
        setPhase("speaking");
        await speak(reply);
      } catch (e) {
        setError((e as Error).message);
      }
      if (active.current) listenRef.current();
    },
    [person.id, speak]
  );

  const listen = useCallback(() => {
    if (!active.current) return;
    if (!Recognizer || mutedRef.current) {
      setPhase("idle");
      return;
    }
    const r = new Recognizer();
    r.lang = "ar-SA";
    r.interimResults = true;
    r.continuous = false;
    let final = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      setHeard(final || interim);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") setError("اسمح للمتصفح باستخدام الميكروفون ثم أعد الاتصال.");
    };
    r.onend = () => {
      rec.current = null;
      if (!active.current) return;
      if (final.trim()) void respond(final);
      else if (!mutedRef.current) setTimeout(() => listenRef.current(), 250);
    };
    rec.current = r;
    setPhase("listening");
    try {
      r.start();
    } catch {
      /* بدأ مسبقاً */
    }
  }, [Recognizer, respond]);

  useEffect(() => {
    listenRef.current = listen;
  }, [listen]);

  // بداية المكالمة: الموظف يرد بالتحية
  useEffect(() => {
    active.current = true;
    const greet = `هلا والله، معك ${person.name}. تفضل، وش تبي؟`;
    const t = setTimeout(async () => {
      setLastReply(greet);
      setPhase("speaking");
      await speak(greet);
      if (active.current) listenRef.current();
    }, 600);
    return () => {
      active.current = false;
      clearTimeout(t);
      rec.current?.abort();
      window.speechSynthesis?.cancel();
      audio.current?.pause();
      tapResolve.current?.();
    };
  }, [person.name, speak]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (next) {
      rec.current?.abort();
      setPhase("idle");
    } else if (phase === "idle") listen();
  }

  const face = useTalkingFace(phase === "speaking");
  const faceStyle = { transform: `translateY(${face.bob}px) rotate(${face.tilt}deg)`, transition: "transform 80ms linear" };
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const phaseText: Record<Phase, string> = {
    idle: muted ? "الميكروفون مكتوم" : "جاهز",
    listening: "🎙️ أسمعك… تكلّم",
    thinking: `${person.name} يفكر…`,
    speaking: `${person.name} يتكلم`,
  };

  return (
    <div className="fixed inset-0 z-[2100] grid place-items-center bg-black/70 p-4">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-zinc-900 text-white shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 text-sm opacity-80">
          <span>📞 مكالمة {withVideo ? "فيديو" : "صوتية"} مع {person.name}</span>
          <span dir="ltr">{mm}:{ss}</span>
        </div>
        {withVideo ? (
          // مكالمة فيديو: صورة الموظف الحية تملأ الشاشة، ومعاينتك في الزاوية
          <div
            className="relative aspect-video w-full overflow-hidden"
            style={{ background: `radial-gradient(circle at 50% 35%, ${person.color}55, #1f2937 55%, #0b0f17)` }}
          >
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute inset-0 grid place-items-center pt-6">
              <div style={faceStyle}>
                <Avatar person={person} size={230} mouth={face.mouth} blink={face.blink} ring={false} speaking={phase === "speaking"} />
              </div>
            </div>
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-0.5 text-xs font-semibold">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" /> مباشر
            </span>
            <div className="absolute bottom-3 right-3 text-start">
              <div className="text-lg font-bold">{person.name}</div>
              <div className="text-xs opacity-75">{person.role} • <span className="text-emerald-300">{phaseText[phase]}</span></div>
            </div>
            {camOn ? (
              <video
                ref={video}
                autoPlay
                muted
                playsInline
                className="absolute bottom-3 left-3 h-24 w-36 rounded-xl border border-white/25 object-cover shadow-lg sm:h-28 sm:w-44"
                style={{ transform: "scaleX(-1)" }}
              />
            ) : (
              <div className="absolute bottom-3 left-3 grid h-24 w-36 place-items-center rounded-xl border border-white/25 bg-black/50 text-xs sm:h-28 sm:w-44">
                كاميرتك مغلقة
              </div>
            )}
          </div>
        ) : (
          <div className="relative grid min-h-[300px] place-items-center bg-gradient-to-b from-zinc-800 to-zinc-900 px-6 pb-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div style={faceStyle}>
                <Avatar person={person} size={150} mouth={face.mouth} blink={face.blink} speaking={phase === "speaking"} />
              </div>
              <div className="text-xl font-bold">{person.name}</div>
              <div className="text-sm opacity-70">{person.role}</div>
              <div className="text-sm text-emerald-300">{phaseText[phase]}</div>
            </div>
            {camOn && (
              <video
                ref={video}
                autoPlay
                muted
                playsInline
                className="absolute bottom-4 left-4 h-28 w-40 rounded-xl border border-white/20 object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
            )}
          </div>
        )}
        <div className="space-y-2 px-5 py-3 text-sm">
          {heard && (
            <p className="opacity-70">
              <b>أنت:</b> {heard}
            </p>
          )}
          {lastReply && (
            <p>
              <b>{person.name}:</b> {lastReply}
            </p>
          )}
          {!Recognizer && (
            <p className="text-amber-300">
              متصفحك لا يدعم التحدث الصوتي. استخدم Chrome أو Edge، أو اكتب رسالتك هنا وسيرد عليك بصوته.
            </p>
          )}
          {needTap && (
            <button
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold"
              onClick={() => tapResolve.current?.()}
            >
              🔊 اضغط هنا لتشغيل الصوت
            </button>
          )}
          {voiceNote && <p className="text-xs text-amber-300">{voiceNote}</p>}
          {error && <p className="text-red-300">{error}</p>}
          {(!Recognizer || muted) && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const t = typed;
                setTyped("");
                void respond(t);
              }}
            >
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="اكتب ما تريد قوله…"
                className="flex-1 rounded-lg bg-white/10 px-3 py-2 outline-none"
              />
              <button className="rounded-lg bg-emerald-600 px-4">إرسال</button>
            </form>
          )}
        </div>
        <div className="flex justify-center gap-3 pb-5">
          <button onClick={toggleMute} className={`call-btn ${muted ? "bg-white text-zinc-900" : "bg-white/15"}`} title="كتم">
            {muted ? "🔇" : "🎙️"}
          </button>
          <button onClick={() => setCamOn((c) => !c)} className={`call-btn ${camOn ? "bg-white/15" : "bg-white text-zinc-900"}`} title="الكاميرا">
            {camOn ? "📹" : "🚫"}
          </button>
          <button onClick={onClose} className="call-btn bg-red-600" title="إنهاء">
            📵
          </button>
        </div>
      </div>
    </div>
  );
}
