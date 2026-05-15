// Thin React adapter over the vanilla wallpaper engine. The engine
// (cheatsheets/wallpaper-engine.js — vendored at /cheatsheets/wallpaper-engine.js
// in the hub image) owns the canvas, WebGL pipeline, and pointer listeners.
// This component just drives setKind/setIntensity/refresh in response to props.

function Wallpaper({ kind = 'aurora', intensity = 0.85, themeKey }) {
  const ctlRef = React.useRef(null);

  // Mount engine once.
  React.useEffect(() => {
    if (typeof window.mountWallpaper !== 'function') {
      console.warn('wallpaper-engine not loaded — <Wallpaper> is a no-op');
      return;
    }
    ctlRef.current = window.mountWallpaper({ kind, intensity });
    return () => {
      if (ctlRef.current) {
        ctlRef.current.destroy();
        ctlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => { ctlRef.current?.setKind(kind); }, [kind]);
  React.useEffect(() => { ctlRef.current?.setIntensity(intensity); }, [intensity]);

  // Theme/accent CSS vars just changed — re-read so the shader retints.
  React.useEffect(() => {
    const id = setTimeout(() => ctlRef.current?.refresh(), 30);
    return () => clearTimeout(id);
  }, [themeKey]);

  return null;
}

window.Wallpaper = Wallpaper;
