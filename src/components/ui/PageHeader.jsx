import React from "react";

export default function PageHeader({ title, description, children }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-stone-900 tracking-tight">{title}</h1>
        {description && (
          <p className="text-stone-500 mt-1">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap gap-3">
          {children}
        </div>
      )}
    </div>
  );
}