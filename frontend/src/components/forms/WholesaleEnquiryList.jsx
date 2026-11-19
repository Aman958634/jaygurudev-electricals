import { useEnquiry } from "../../context/EnquiryContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import EnquiryItemsSection from "./EnquiryItemsSection.jsx";

export default function WholesaleEnquiryList() {
  const {
    enquiryItems,
    enquiryListOpen,
    closeEnquiryList,
    updateEnquiryItem,
    removeEnquiryItem,
    clearEnquiryItems,
    openWholesale,
  } = useEnquiry();
  const { t } = useLanguage();

  if (!enquiryListOpen) return null;

  const canContinue = enquiryItems.every((item) => item.variantOptions.length < 2 || item.variant);

  function continueToEnquiry() {
    closeEnquiryList();
    openWholesale();
  }

  return (
    <div className="wholesale-list-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEnquiryList(); }}>
      <section className="wholesale-list-modal" role="dialog" aria-modal="true" aria-labelledby="enquiry-list-heading">
        <button className="modal-close" type="button" onClick={closeEnquiryList} aria-label={t("Close enquiry list")}>×</button>
        <span className="eyebrow">{t("For dealers & contractors")}</span>
        <h2 id="enquiry-list-heading">{t("Bulk enquiry list")}</h2>
        <EnquiryItemsSection
          items={enquiryItems}
          updateEnquiryItem={updateEnquiryItem}
          removeEnquiryItem={removeEnquiryItem}
          clearEnquiryItems={clearEnquiryItems}
          onContinueShopping={closeEnquiryList}
        />
        <div className="enquiry-list-actions">
          <button className="button button-primary" type="button" disabled={!canContinue} onClick={continueToEnquiry}>
            {t("Continue to enquiry")}
          </button>
        </div>
      </section>
    </div>
  );
}
