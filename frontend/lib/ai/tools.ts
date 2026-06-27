import { z } from "zod";
import { tool } from "@langchain/core/tools";
import {
    getFiles,
    renameFile,
    deleteFile,
    updateFileUsers,
    getTotalSpaceUsed,
} from "@/lib/actions/file.actions";

// --- Tools ---

export const searchFilesTool = tool(
    async ({ searchText, types, sort, limit }) => {
        return await getFiles({
            searchText,
            types: types as any,
            sort,
            limit,
        });
    },
    {
        name: "search_files",
        description:
            "Search for files by name or type. Use this to find files when the user asks for specific files.",
        schema: z.object({
            searchText: z
                .string()
                .optional()
                .describe("The search query for the file name."),
            types: z
                .array(
                    z.enum(["document", "image", "video", "audio", "other"])
                )
                .optional()
                .describe("Filter by file types."),
            sort: z
                .string()
                .optional()
                .describe(
                    "Sort order. Format: '$createdAt-desc', '$createdAt-asc', 'name-asc', 'name-desc', 'size-asc', 'size-desc'."
                ),
            limit: z
                .number()
                .optional()
                .describe("Limit the number of results."),
        }),
    }
);

export const renameFileTool = tool(
    async ({ fileId, name, extension, path }) => {
        return await renameFile({ fileId, name, extension, path });
    },
    {
        name: "rename_file",
        description: "Rename a file.",
        schema: z.object({
            fileId: z.string().describe("The ID of the file to rename."),
            name: z.string().describe("The new name of the file (without extension)."),
            extension: z.string().describe("The extension of the file."),
            path: z.string().describe("The path to revalidate (usually the current path)."),
        }),
    }
);

export const deleteFileTool = tool(
    async ({ fileId, bucketFileId, path }) => {
        return await deleteFile({ fileId, bucketFileId, path });
    },
    {
        name: "delete_file",
        description: "Delete a file.",
        schema: z.object({
            fileId: z.string().describe("The ID of the file document to delete."),
            bucketFileId: z.string().describe("The ID of the file in the bucket."),
            path: z.string().describe("The path to revalidate."),
        }),
    }
);

export const shareFileTool = tool(
    async ({ fileId, emails, path }) => {
        return await updateFileUsers({ fileId, emails, path });
    },
    {
        name: "share_file",
        description: "Share a file with other users by adding their emails.",
        schema: z.object({
            fileId: z.string().describe("The ID of the file to share."),
            emails: z.array(z.string().email()).describe("List of emails to share with."),
            path: z.string().describe("The path to revalidate."),
        }),
    }
);

export const getStorageStatsTool = tool(
    async () => {
        return await getTotalSpaceUsed();
    },
    {
        name: "get_storage_stats",
        description: "Get the total storage space used by the user, broken down by file type.",
        schema: z.object({}),
    }
);

/*
  Placeholder for now. The specific RAG tool 'search_file_content'
  will be defined in lib/ai/rag.ts or here once we implement the vector search.
*/
