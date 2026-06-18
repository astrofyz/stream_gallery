type Props = {
  visible: boolean;
  fading: boolean;
};

export default function LoadingScreen({ visible, fading }: Props) {
  if (!visible && !fading) return null;

  return (
    <div className={`loading-screen ${fading ? "loading-screen--fade" : ""}`}>
      <img
        src="/loading-cluster.svg"
        alt=""
        aria-hidden="true"
        className="loading-cluster"
      />
      <p className="loading-label">Finding a cluster…</p>
    </div>
  );
}
