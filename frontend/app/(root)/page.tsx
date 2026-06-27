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

const Dashboard = () => {
  const [files, setFiles] = useState<any[]>([]);
  const [totalSpace, setTotalSpace] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [filesResult, statsResult] = await Promise.all([
          getFiles({ limit: 10 }),
          getStorageStats(),
        ]);

        if (filesResult.success) {
          setFiles(filesResult.data.files || []);
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
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading || !totalSpace) {
    return (
      <div className="flex h-full items-center justify-center">
        <Image
          src="/assets/icons/loader.svg"
          alt="Loading..."
          width={40}
          height={40}
          className="animate-spin"
        />
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
            <Link
              href={summary.url}
              key={summary.title}
              className="dashboard-summary-card"
            >
              <div className="space-y-4">
                <div className="flex justify-between gap-3">
                  <Image
                    src={summary.icon}
                    width={100}
                    height={100}
                    alt="uploaded image"
                    className="summary-type-icon"
                  />
                  <h4 className="summary-type-size">
                    {convertFileSize(summary.size) || 0}
                  </h4>
                </div>

                <h5 className="summary-type-title">{summary.title}</h5>
                <Separator className="bg-light-400" />
                <FormattedDateTime
                  date={summary.latestDate}
                  className="text-center"
                />
              </div>
            </Link>
          ))}
        </ul>
      </section>

      {/* Recent files uploaded */}
      <section className="dashboard-recent-files">
        <h2 className="h3 xl:h2 text-light-100">Recent files uploaded</h2>
        {files.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-5">
            {files.map((file: any) => (
              <Link
                href={file.url || "#"}
                target="_blank"
                className="flex items-center gap-3"
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
