/**
 * CSS-only background. Use this instead of ShaderBackground when
 * @react-three/fiber / three are not installed, so the app runs for everyone.
 */
export default function FallbackBackground() {
  return (
    <div
      className="fixed inset-0 -z-10 min-h-screen w-screen overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #0d0d12 100%)',
      }}
      aria-hidden
    >
      <div
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 45%)',
        }}
      />
    </div>
  );
}
