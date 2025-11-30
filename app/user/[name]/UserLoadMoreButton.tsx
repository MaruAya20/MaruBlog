"use client";
import { useRouter } from "next/navigation";

export default function UserLoadMoreButton({
  name,
  nextPage,
}: {
  name: string;
  nextPage: number;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="nav-link"
      style={{ justifySelf: "center", textAlign: "center" }}
      onClick={() => {
        router.push(
          `/user/${encodeURIComponent(name)}?page=${nextPage}`,
          { scroll: false },
        );
      }}
    >
      加载更多
    </button>
  );
}

