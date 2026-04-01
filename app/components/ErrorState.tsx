'use client';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message = 'فشل في تحميل البيانات', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-white font-semibold">{message}</p>
        <p className="text-gray-400 text-sm mt-1">تحقق من الاتصال بالإنترنت أو صلاحية الـ API key</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}
