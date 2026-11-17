import Hero from "../components/home/Hero.jsx";
import TrustBadges from "../components/home/TrustBadges.jsx";
import CategorySection from "../components/home/CategorySection.jsx";
import BrandSection from "../components/home/BrandSection.jsx";
import FeaturedProducts from "../components/home/FeaturedProducts.jsx";
import HomePromoBanners from "../components/home/HomePromoBanners.jsx";
import WholesaleBanner from "../components/home/WholesaleBanner.jsx";
import AboutSection from "../components/home/AboutSection.jsx";
import Testimonials from "../components/home/Testimonials.jsx";
import ContactSection from "../components/home/ContactSection.jsx";
import GalleryPreview from "../components/home/GalleryPreview.jsx";

export default function Home() {
  return (
    <>
      <Hero />
      <TrustBadges />
      <CategorySection />
      <HomePromoBanners />
      <BrandSection />
      <FeaturedProducts />
      <WholesaleBanner />
      <AboutSection />
      <GalleryPreview />
      <Testimonials />
      <ContactSection />
    </>
  );
}
