import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { PostComposer } from "./components/PostComposer";
import { Post } from "./components/Post";
import { RightSidebar } from "./components/RightSidebar";

const posts = [
  {
    author: "Alex Kim",
    initials: "AK",
    timeAgo: "2h ago",
    game: "Elden Ring",
    content:
      "Just defeated Malenia after 47 attempts! This boss fight is absolutely insane. The feeling of finally winning is unmatched.",
    imageUrl:
      "https://images.unsplash.com/photo-1774060526585-19be7b4af255?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGRlbiUyMHJpbmclMjBnYW1lfGVufDF8fHx8MTc3NTgyMjY2M3ww&ixlib=rb-4.1.0&q=80&w=1080",
    likes: 324,
    comments: 45,
    shares: 12,
  },
  {
    author: "Maria Santos",
    initials: "MS",
    timeAgo: "5h ago",
    game: "Cyberpunk 2077",
    content:
      "Night City never looked so good with the new graphics update. The ray tracing is absolutely stunning!",
    imageUrl:
      "https://images.unsplash.com/photo-1607796884038-3638822d5ee2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHxjeWJlcnB1bmslMjBnYW1lJTIwbmVvbnxlbnwxfHx8fDE3NzU4MjI2NjR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    likes: 892,
    comments: 67,
    shares: 34,
  },
  {
    author: "Chris Lee",
    initials: "CL",
    timeAgo: "8h ago",
    game: "League of Legends",
    content:
      "Finally hit Diamond! It's been a long journey from Bronze. Thanks to everyone who supported me along the way.",
    imageUrl:
      "https://images.unsplash.com/photo-1529981188441-8a2e6fe30103?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHxmYW50YXN5JTIwZ2FtZSUyMGJhdHRsZXxlbnwxfHx8fDE3NzU4MjI2NjR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    likes: 567,
    comments: 89,
    shares: 23,
  },
  {
    author: "Emma Wilson",
    initials: "EW",
    timeAgo: "1d ago",
    game: "Minecraft",
    content:
      "Spent the entire weekend building this castle. What do you guys think? Should I add more details?",
    imageUrl:
      "https://images.unsplash.com/photo-1759663174567-5e444de2488c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5lY3JhZnQlMjBibG9ja3klMjBnYW1lfGVufDF8fHx8MTc3NTgyMjY2NHww&ixlib=rb-4.1.0&q=80&w=1080",
    likes: 1243,
    comments: 156,
    shares: 78,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Sidebar />

      <main className="px-4 pb-8 pt-20 lg:ml-64 lg:mr-80">
        <div className="mx-auto max-w-2xl">
          <PostComposer />

          <div className="mt-6 space-y-6">
            {posts.map((post) => (
              <Post
                key={`${post.author}-${post.timeAgo}-${post.game}`}
                {...post}
              />
            ))}
          </div>
        </div>
      </main>

      <RightSidebar />
    </div>
  );
}
