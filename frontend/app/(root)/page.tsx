"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import ActionDropdown from "@/components/ActionDropdown";
import { Chart } from "@/components/Chart";
import { FormattedDateTime } from "@/components/FormattedDateTime";
import { Thumbnail } from "@/components/Thumbnail";
import { Separator } from "@/components/ui/separator";
import { getFiles, getStorageStats } from "@/lib/api/files";
import { convertFileSize, getUsageSummary } from "@/lib/utils";
import { SummaryCard } from "@/components/SummaryCard";

const Dashboard = () => {
  const [files, setFiles] = useState<any[]>([]);
  const [totalSpace, setTotalSpace] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [filesResult, statsResult] = await Promise.all([
          getFiles({ limit: 10 }),
          getStorageStats(),
        ]);

        if (filesResult.success) {
          setFiles(filesResult.data.files || []);
        } else {
          setError(filesResult.message || "Failed to fetch files.");
        }

        if (statsResult.success) {
          // Transform stats to match the expected format for getUsageSummary
          const stats = statsResult.data;
          setTotalSpace({
            document: {
              size: stats.byType?.document?.size || 0,
              latestDate: stats.byType?.document?.latestDate || "",
            },
            image: {
              size: stats.byType?.image?.size || 0,
              latestDate: stats.byType?.image?.latestDate || "",
            },
            video: {
              size: stats.byType?.video?.size || 0,
              latestDate: stats.byType?.video?.latestDate || "",
            },
            audio: {
              size: stats.byType?.audio?.size || 0,
              latestDate: stats.byType?.audio?.latestDate || "",
            },
            other: {
              size: stats.byType?.other?.size || 0,
              latestDate: stats.byType?.other?.latestDate || "",
            },
            used: stats.totalUsed || 0,
            all: stats.totalLimit || 2 * 1024 * 1024 * 1024,
          });
        } else {
          setError(statsResult.message || "Failed to fetch storage stats.");
        }
      } catch (error: any) {
        console.error("Failed to fetch dashboard data:", error);
        setError("Network or server error occurred.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="dashboard-container">
        <section>
          <div className="h-[250px] w-full animate-pulse rounded-lg bg-light-200" />
          <ul className="dashboard-summary-list">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="dashboard-summary-card animate-pulse space-y-4">
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
  }

  if (error || !totalSpace) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="h4 text-red-500">{error || "Failed to load dashboard."}</p>
        <button
          onClick={() => window.location.reload()}
          className="shad-submit-btn px-6 py-2 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  // Get usage summary
  const usageSummary = getUsageSummary(totalSpace);

  return (
    <div className="dashboard-container">
      <section>
        <Chart used={totalSpace.used} />

        {/* Uploaded file type summaries */}
        <ul className="dashboard-summary-list">
          {usageSummary.map((summary) => (
            <SummaryCard
              key={summary.title}
              title={summary.title}
              size={summary.size}
              latestDate={summary.latestDate}
              icon={summary.icon}
              url={summary.url}
            />
          ))}
        </ul>
      </section>

      {/* Recent files uploaded */}
      <section className="dashboard-recent-files">
        <h2 className="h3 xl:h2 text-light-100 dark:text-white">Recent files uploaded</h2>
        {files.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-5">
            {files.map((file: any) => (
              <Link
                href={file.url || "#"}
                target="_blank"
                className="flex items-center gap-3 border-b border-light-300 pb-5 last:border-b-0 last:pb-0 dark:border-light-100/20"
                key={file.id}
              >
                <Thumbnail
                  type={file.type}
                  extension={file.extension}
                  url={file.url}
                />

                <div className="recent-file-details">
                  <div className="flex flex-col gap-1">
                    <p className="recent-file-name">{file.name}</p>
                    <FormattedDateTime
                      date={file.createdAt}
                      className="caption"
                    />
                  </div>
                  <ActionDropdown file={file} />
                </div>
              </Link>
            ))}
          </ul>
        ) : (
          <p className="empty-list">No files uploaded</p>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
