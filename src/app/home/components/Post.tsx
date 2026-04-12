import { Heart, MessageCircle, Repeat2, Share2 } from "lucide-react";

type PostProps = {
  author: string;
  initials: string;
  timeAgo: string;
  game: string;
  content: string;
  imageUrl: string;
  likes: number;
  comments: number;
  shares: number;
};

export function Post({
  author,
  initials,
  timeAgo,
  game,
  content,
  imageUrl,
  likes,
  comments,
  shares,
}: PostProps) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_20px_60px_-45px_rgba(0,0,0,0.5)]">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-sm font-black text-black">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-base font-bold text-black">{author}</h2>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                {game}
              </span>
              <span className="text-sm text-zinc-500">{timeAgo}</span>
            </div>

            <p className="mt-3 text-[15px] leading-7 text-zinc-800">{content}</p>
          </div>
        </div>
      </div>

      <div className="border-y border-zinc-200 bg-zinc-100/70">
        <img
          src={imageUrl}
          alt={`${game} post by ${author}`}
          className="h-72 w-full object-cover"
        />
      </div>

      <div className="flex items-center justify-between px-5 py-4 text-sm text-zinc-600">
        <div className="flex items-center gap-2">
          <Heart size={18} />
          <span>{likes}</span>
        </div>
        <div className="flex items-center gap-2">
          <MessageCircle size={18} />
          <span>{comments}</span>
        </div>
        <div className="flex items-center gap-2">
          <Repeat2 size={18} />
          <span>{shares}</span>
        </div>
        <button className="flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold text-zinc-700 transition hover:bg-zinc-100 hover:text-black">
          <Share2 size={16} />
          Share
        </button>
      </div>
    </article>
  );
}
