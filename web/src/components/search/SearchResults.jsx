import { Card } from '../ui/Card.jsx';

const DownloadIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const Spinner = () => (
  <div
    className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"
    role="status"
    aria-label="loading"
  />
);

export function SearchResults({
  results,
  searching,
  searchSource,
  onDownload,
  isDownloadPending,
  enqueuedTrackIds,
  formatTrackTitle
}) {
  const getTitle = (track) =>
    typeof formatTrackTitle === 'function' ? formatTrackTitle(track) : track?.title || '未命名';

  const buttonClasses =
    'py-2 px-4 rounded-lg font-medium text-sm flex items-center justify-center min-w-[70px] h-9 transition-all shadow';
  const normalButton = 'text-white bg-blue-600 hover:bg-blue-700';
  const loadingButton = 'text-white bg-blue-400 cursor-wait';
  const enqueuedButton = 'text-gray-700 bg-gray-200 dark:bg-gray-700 dark:text-gray-100 cursor-not-allowed';

  const skeletonItems = new Array(4).fill(null);

  return (
    <Card title="搜索结果">
      {searching && (
        <ul className="mt-4 flex flex-col gap-3">
          {skeletonItems.map((_, index) => (
            <li
              key={`skeleton-${index}`}
              className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-2xl animate-pulse bg-gray-50 dark:bg-gray-800 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
              <div className="flex-shrink-0 w-1/4 text-right">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              </div>
              <div className="w-[70px] h-9 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </li>
          ))}
        </ul>
      )}

      {results.length === 0 && !searching && (
        <p className="py-8 text-center text-gray-500">暂无结果</p>
      )}

      {!searching && (
        <ul className="mt-4 flex flex-col gap-3">
          {results.map((track) => {
            const trackId = track.id || track.url_id || track.trackId;
            const trackSource = track.source || searchSource;
            const trackKey = `${trackId}-${trackSource}`;
            const isEnqueued = enqueuedTrackIds.has(trackKey);
            const isDisabled = isDownloadPending || isEnqueued;

            let buttonContent = <DownloadIcon />;
            let buttonStyle = normalButton;

            if (isDownloadPending) {
              buttonContent = <Spinner />;
              buttonStyle = loadingButton;
            } else if (isEnqueued) {
              buttonContent = '队列中';
              buttonStyle = enqueuedButton;
            }

            return (
              <li
                key={`${trackKey}-${track.pic_id || 'nop'}`}
                className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-2xl hover:shadow-lg hover:-translate-y-0.5 transition bg-white/80 dark:bg-gray-900/60 backdrop-blur"
              >
                <div className="flex-1 min-w-0">
                  <strong className="block truncate font-medium text-gray-800 dark:text-gray-100">
                    {getTitle(track)}
                  </strong>
                </div>

                <div className="flex-shrink-0 w-1/4 text-right truncate text-gray-500 dark:text-gray-400 text-sm">
                  {Array.isArray(track.artist) ? track.artist.join(', ') : track.artist || '未知艺术家'}
                </div>

                <button
                  onClick={() => onDownload(track)}
                  disabled={isDisabled}
                  className={`${buttonClasses} ${buttonStyle}`}
                >
                  {buttonContent}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
