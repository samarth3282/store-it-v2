import React from "react";

const Loading = () => {
  return (
    <div className="dashboard-container">
      <section>
        {/* Chart skeleton */}
        <div className="h-[250px] w-full animate-pulse rounded-lg bg-light-200" />

        {/* Summary cards skeleton */}
        <ul className="dashboard-summary-list">
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className="dashboard-summary-card animate-pulse space-y-4"
            >
              <div className="flex justify-between gap-3">
                <div className="size-12 rounded bg-light-200" />
                <div className="h-6 w-16 rounded bg-light-200" />
              </div>
              <div className="h-5 w-24 rounded bg-light-200" />
              <div className="h-px w-full bg-light-400" />
              <div className="h-4 w-32 rounded bg-light-200" />
            </div>
          ))}
        </ul>
      </section>

      {/* Recent files skeleton */}
      <section className="dashboard-recent-files">
        <div className="h-8 w-48 animate-pulse rounded-md bg-light-200" />
        <ul className="mt-5 flex flex-col gap-5">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="size-12 animate-pulse rounded bg-light-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-light-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-light-200" />
              </div>
            </div>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default Loading;
