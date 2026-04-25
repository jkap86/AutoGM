import Nav from "../components/nav";
import Hero from "../components/hero";
import Features from "../components/features";
import Download from "../components/download";
import SystemRequirements from "../components/system-requirements";
import Footer from "../components/footer";

export default function LandingPage() {
  return (
    <>
      <Nav />
      <Hero />
      <Features />
      <Download />
      <SystemRequirements />
      <Footer />
    </>
  );
}
