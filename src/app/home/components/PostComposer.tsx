import { ImagePlus, Sparkles, Video } from "lucide-react";

export function PostComposer() {
  return (
    <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_20px_60px_-45px_rgba(0,0,0,0.5)]">
      <div className="flex gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-sm font-black text-black">
          ME
        </div>

        <div className="min-w-0 flex-1">
          <textarea
            placeholder="Share your latest game moment..."
            className="min-h-28 w-full resize-none border-none bg-transparent text-base text-black outline-none placeholder:text-zinc-400"
          />

          <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200">
                <ImagePlus size={18} />
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200">
                <Video size={18} />
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200">
                <Sparkles size={18} />
              </button>
            </div>

            <button className="rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800">
              Post
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
