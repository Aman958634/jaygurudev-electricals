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
import Seo from "../components/common/Seo.jsx";

export default function Home() {
  return (
    <>
      <Seo
        title="JAY GURUDEV ELECTRIICALS | Electrical Products & Solutions"
        description="Explore quality electrical products, brands and electrical solutions at JAY GURUDEV ELECTRIICALS."
        canonicalPath="/"
        imageAlt="JAY GURUDEV ELECTRIICALS — electrical products and solutions in Palanpur, Gujarat"
      />
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
