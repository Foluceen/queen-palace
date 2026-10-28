export function GridSkeleton() {
  return (
    <div className="container section--tight" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 48, width: "min(420px, 80%)", marginBottom: 32 }} />
      <div className="grid-skeleton">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>
            <div className="skeleton" style={{ aspectRatio: "4 / 5" }} />
            <div className="skeleton" style={{ height: 16, width: "70%", marginTop: 14 }} />
            <div className="skeleton" style={{ height: 14, width: "40%", marginTop: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductSkeleton() {
  return (
    <div className="container pdp-wrap" aria-busy="true" aria-label="Loading">
      <div className="pdp">
        <div className="skeleton" style={{ aspectRatio: "4 / 5", borderRadius: 30 }} />
        <div style={{ display: "grid", gap: 16 }}>
          <div className="skeleton" style={{ height: 56, width: "80%" }} />
          <div className="skeleton" style={{ height: 22, width: "50%" }} />
          <div className="skeleton" style={{ height: 40, width: "40%" }} />
          <div className="skeleton" style={{ height: 120 }} />
          <div className="skeleton" style={{ height: 54, borderRadius: 999 }} />
        </div>
      </div>
    </div>
  );
}
