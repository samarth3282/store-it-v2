"use client";

import React, { useEffect, useState } from "react";
import Sort from "@/components/Sort";
import { getFiles, getStorageStats } from "@/lib/api/files";
import Card from "@/components/Card";
import { getFileTypesParams, convertFileSize } from "@/lib/utils";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";

const Page = () => {
  const params = useParams();
  const searchParams = useSearchParams();

  const type = (params?.type as string) || "";
  const searchText = searchParams.get("query") || "";
  const sort = searchParams.get("sort") || "";

  const [files, setFiles] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const types = getFileTypesParams(type) as FileType[];

  useEffect(() => {
    const fetchFiles = async () => {
      setIsLoading(true);
      try {
        // Parse sort string
        let sortBy, sortOrder;
        if (sort) {
          const parts = sort.split("-");
          sortBy = parts[0].replace("$", "");
          sortOrder = parts[1];
        }

        const [result, statsResult] = await Promise.all([
          getFiles({
            types,
            searchText,
            sortBy,
            sortOrder,
          }),
          getStorageStats(),
        ]);

        if (result.success) {
          setFiles(result.data.files || []);
          setTotal(result.data.total || 0);
        }

        if (statsResult.success) {
          const stats = statsResult.data;
          // Determine the key in byType based on the current page type
          let typeKey = "other";
          if (type === "documents") typeKey = "document";
          else if (type === "images") typeKey = "image";
          else if (type === "media") typeKey = "video"; // or sum audio+video

          // If type is media, we should probably combine video and audio size
          let size = 0;
          if (type === "media") {
             size = (stats.byType?.video?.size || 0) + (stats.byType?.audio?.size || 0);
          } else {
             size = stats.byType?.[typeKey]?.size || 0;
          }
          setTotalSize(size);
        }
      } catch (error) {
        console.error("Failed to fetch files:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFiles();
  }, [type, searchText, sort]);

  if (isLoading) {
    return (
      <div className="page-container">
        <section className="w-full">
          <div className="h-10 w-48 animate-pulse rounded-md bg-light-200" />
          <div className="total-size-section">
            <div className="h-6 w-32 animate-pulse rounded-md bg-light-200" />
            <div className="h-10 w-40 animate-pulse rounded-md bg-light-200" />
          </div>
        </section>
        <section className="file-list">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="flex h-[200px] flex-col gap-3 rounded-[18px] border border-light-100 p-5">
              <div className="h-[120px] w-full animate-pulse rounded-md bg-light-200" />
              <div className="space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-light-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-light-200" />
              </div>
            </div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="page-container">
      <section className="w-full">
        <h1 className="h1 capitalize">{type}</h1>

        <div className="total-size-section">
          <p className="body-1">
            Total: <span className="h5">{convertFileSize(totalSize)}</span>
          </p>

          <div className="sort-container">
            <p className="body-1 hidden text-light-200 sm:block">Sort by:</p>

            <Sort />
          </div>
        </div>
      </section>

      {/* Render the files */}
      {total > 0 ? (
        <section className="file-list">
          {files.map((file: any) => (
            <Card key={file.id} file={file} />
          ))}
        </section>
      ) : (
        <p className="empty-list">No files uploaded</p>
      )}
    </div>
  );
};

export default Page;
