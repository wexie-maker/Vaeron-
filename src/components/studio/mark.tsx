export function Mark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M5 12.5h22M7 12.5 10.2 6h4.2L11 12.5M14.4 6l3.4 6.5M18.2 6l3.4 6.5M22 6l3.2 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect x="4.5" y="12.5" width="23" height="14" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M20 19.5h6" className="text-crimson" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function ClapperStripes() {
  return (
    <div className="flex h-3" aria-hidden="true">
      {Array.from({ length: 14 }, (_, index) => (
        <span
          key={index}
          className={`flex-1 ${index === 13 ? "bg-crimson" : index % 2 === 0 ? "bg-fg" : "bg-bg"}`}
        />
      ))}
    </div>
  );
}
