/** Surface container with an optional header. The single elevation primitive. */
export function Card({ className = '', children }) {
  return <div className={`surface ${className}`}>{children}</div>;
}

export function CardHeader({ title, description, actions }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className = '', children }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}
