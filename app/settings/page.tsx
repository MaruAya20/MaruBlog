import Container from "../components/Container";
import WallpaperForm from "../components/WallpaperForm";
import WallpaperUploadCard from "../components/WallpaperUploadCard";

export default function Settings(){
  return (
    <Container>
      <section className="section">
        <h1 className="sr-only">外观设置</h1>
        <WallpaperForm />
        <WallpaperUploadCard />
      </section>
    </Container>
  );
}


