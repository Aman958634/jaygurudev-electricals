import { Route, Routes } from "react-router-dom";
import Navbar from "./components/layout/Navbar.jsx";
import Footer from "./components/layout/Footer.jsx";
import AnnouncementBar from "./components/layout/AnnouncementBar.jsx";
import WhatsAppButton from "./components/common/WhatsAppButton.jsx";
import ScrollToTop from "./components/common/ScrollToTop.jsx";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import Products from "./pages/Products.jsx";
import ProductDetails from "./pages/ProductDetails.jsx";
import Categories from "./pages/Categories.jsx";
import Brands from "./pages/Brands.jsx";
import Gallery from "./pages/Gallery.jsx";
import Contact from "./pages/Contact.jsx";
import WholesaleEnquiryForm from "./components/forms/WholesaleEnquiryForm.jsx";
import WholesaleEnquiryList from "./components/forms/WholesaleEnquiryList.jsx";
import AdminPanel from "./admin/AdminPanel.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminPanel />} />
      <Route path="*" element={<PublicSite />} />
    </Routes>
  );
}

function PublicSite() {
  return (
    <>
      <ScrollToTop />
      <AnnouncementBar />
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetails />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/brands" element={<Brands />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Footer />
      <WhatsAppButton />
      <WholesaleEnquiryForm />
      <WholesaleEnquiryList />
    </>
  );
}
