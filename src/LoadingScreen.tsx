type Props = {
  visible: boolean;
  fading: boolean;
};

export default function LoadingScreen({ visible, fading }: Props) {
  if (!visible && !fading) return null;

  return (
    <div className={`loading-screen ${fading ? "loading-screen--fade" : ""}`}>
      <div className="loading-ring" aria-hidden="true">
        <div className="loading-ring__track" />
        <div className="loading-ring__arc" />
      </div>
      <p className="loading-label">Finding a cluster…</p>
    </div>
  );
}
