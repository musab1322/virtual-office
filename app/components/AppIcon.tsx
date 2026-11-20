/** أيقونة التطبيق: مبنى مكتب بنوافذ مضيئة (أشكال فقط حتى لا تحتاج خطوطاً) */
export function AppIcon({ size }: { size: number }) {
  const u = size / 16;
  const win = (on: boolean) => ({ width: u * 2, height: u * 2, borderRadius: u * 0.3, background: on ? "#f5c451" : "#9fb3c8" });
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#1f3b5c", borderRadius: size * 0.22 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: u * 0.8, padding: u, width: u * 9, background: "#f1efe9", borderRadius: u * 0.8 }}>
        {[0, 1, 2].map((r) => (
          <div key={r} style={{ display: "flex", gap: u }}>
            <div style={win(r !== 1)} />
            <div style={win(true)} />
            <div style={win(r === 1)} />
          </div>
        ))}
        <div style={{ width: u * 2.4, height: u * 2.6, background: "#7a2e2e", borderRadius: `${u}px ${u}px 0 0` }} />
      </div>
    </div>
  );
}
