"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { createComment, deleteComment } from "@/actions/comment";
import { Avatar } from "@/components/assignees/avatar";

export type CommentItem = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string };
};

export function TaskComments({
  taskId,
  initialComments,
  currentUserId,
}: {
  taskId: string;
  initialComments: CommentItem[];
  currentUserId: string;
}) {
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const comment = await createComment({ taskId, content: trimmed });
      setComments((prev) => [
        ...prev,
        {
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
          author: comment.author,
        },
      ]);
      setContent("");
    });
  }

  function handleDelete(commentId: string) {
    if (!confirm("Bu yorumu silmek istediğinize emin misiniz?")) return;
    startTransition(async () => {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Yorumlar</h3>

      <div className="flex flex-col gap-3">
        {comments.length === 0 ? (
          <p className="text-sm text-zinc-400">Henüz yorum yok.</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-2">
              <Avatar name={comment.author.name} size="sm" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {comment.author.name}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {new Date(comment.createdAt).toLocaleString("tr-TR")}
                  </span>
                  {comment.author.id === currentUserId ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      disabled={isPending}
                      aria-label="Yorumu sil"
                      className="ml-auto rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                  {comment.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Bir yorum yaz..."
          rows={3}
          className="w-full resize-none rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button
          type="submit"
          disabled={isPending || !content.trim()}
          className="self-end rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Gönder
        </button>
      </form>
    </div>
  );
}
