'use client';

export function KPISkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-gray-800 rounded-xl p-4 animate-pulse">
          <div className="h-3 bg-gray-700 rounded w-3/4 mb-3" />
          <div className="h-6 bg-gray-700 rounded w-full mb-2" />
          <div className="h-2 bg-gray-700 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function PlatformCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-gray-800 rounded-xl p-5 animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/2 mb-4" />
          {Array.from({ length: 5 }).map((_, j) => (
            <div key={j} className="flex justify-between mb-3">
              <div className="h-3 bg-gray-700 rounded w-1/3" />
              <div className="h-3 bg-gray-700 rounded w-1/4" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 animate-pulse">
      <div className="h-4 bg-gray-700 rounded w-1/3 mb-4" />
      <div className="bg-gray-700 rounded" style={{ height }} />
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="bg-gray-800 rounded-xl p-5 animate-pulse">
      <div className="h-4 bg-gray-700 rounded w-1/4 mb-4" />
      <div className="h-8 bg-gray-700 rounded mb-3" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-700 rounded mb-2" />
      ))}
    </div>
  );
}
