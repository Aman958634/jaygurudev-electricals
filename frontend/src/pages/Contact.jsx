import ContactSection from "../components/home/ContactSection.jsx";
import PageHeading from "../components/common/PageHeading.jsx";
import Seo from "../components/common/Seo.jsx";

export default function Contact() {
  return (
    <>
      <Seo
        title="Contact JAY GURUDEV ELECTRIICALS | Palanpur"
        description="Contact JAY GURUDEV ELECTRIICALS about electrical products, home appliances or a visit to our showroom in Palanpur, Gujarat."
        canonicalPath="/contact"
      />
      <PageHeading slug="contact" fallback={{ eyebrow: "We're here to help", title: "Get in", highlight: "touch", description: "Questions about a product? Contact our team or visit the showroom in Palanpur." }} />
      <ContactSection />
    </>
  );
}
