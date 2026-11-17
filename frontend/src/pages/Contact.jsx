import ContactSection from "../components/home/ContactSection.jsx";
import PageHeading from "../components/common/PageHeading.jsx";

export default function Contact() {
  return (
    <>
      <PageHeading slug="contact" fallback={{ eyebrow: "We're here to help", title: "Get in", highlight: "touch", description: "Questions about a product? Contact our team or visit the showroom in Palanpur." }} />
      <ContactSection />
    </>
  );
}
