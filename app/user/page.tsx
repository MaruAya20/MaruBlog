import Container from "../components/Container";
import UserProfileCard from "./UserProfileCard";
import UserInfinitePosts from "./UserInfinitePosts";
import { getSession } from "@/lib/auth";

export default async function User() {
  const sess = await getSession();
  // 这里不再预先读取用户全部文章，节省服务端资源，
  // 实际列表交给 UserInfinitePosts 通过 /api/posts 分页加载。
  void sess;
  return (
    <Container>
      <section className="section">
        <h1 className="sr-only">用户界面</h1>
        <UserProfileCard />
      </section>
      <section className="section" style={{display:'grid', gap:12}}>
        <UserInfinitePosts />
      </section>
    </Container>
  );
}
