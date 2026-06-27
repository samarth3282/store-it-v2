"use client";

import React, { useEffect, useState } from "react";
import Sort from "@/components/Sort";
import { getFiles } from "@/lib/api/files";
import Card from "@/components/Card";
import { getFileTypesParams } from "@/lib/utils";
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

        const result = await getFiles({
          types,
          searchText,
          sortBy,
          sortOrder,
        });

        if (result.success) {
          setFiles(result.data.files || []);
          setTotal(result.data.total || 0);
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

  return (
    <div className="page-container">
      <section className="w-full">
        <h1 className="h1 capitalize">{type}</h1>

        <div className="total-size-section">
          <p className="body-1">
            Total: <span className="h5">0 MB</span>
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
