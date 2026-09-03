import AudienceSection from '../components/home/AudienceSection.jsx';
import CeoGreeting from '../components/home/CeoGreeting.jsx';
import CompanyOverview from '../components/home/CompanyOverview.jsx';
import ContactSection from '../components/home/ContactSection.jsx';
import CoreValues from '../components/home/CoreValues.jsx';
import FAQSection from '../components/home/FAQSection.jsx';
import GuideSection from '../components/home/GuideSection.jsx';
import HeroSection from '../components/home/HeroSection.jsx';
import HistorySection from '../components/home/HistorySection.jsx';
import LocationSection from '../components/home/LocationSection.jsx';
import NewsSection from '../components/home/NewsSection.jsx';
import PartnersSection from '../components/home/PartnersSection.jsx';
import ServicesSection from '../components/home/ServicesSection.jsx';
import StatementSection from '../components/home/StatementSection.jsx';
import useRevealOnScroll from '../hooks/useRevealOnScroll.js';

export default function HomePage() {

  useRevealOnScroll();

  return (
    <>
      <HeroSection />

      <section className="intro section" id="about" aria-labelledby="about-title">
        <div className="content-width">
          <article className="ceo-greeting reveal">
            <CeoGreeting />
          </article>

          <HistorySection />

          <div className="section-heading split-heading company-heading reveal">
            <CompanyOverview />
          </div>

          <div className="value-grid">
            <CoreValues />
          </div>

          <section className="location-panel" id="location" aria-labelledby="location-title">
            <span className="location-backdrop" aria-hidden="true"><span className="location-backdrop-grid" />
              <svg viewBox="0 0 900 420" preserveAspectRatio="xMidYMid slice" focusable="false"><path className="location-route" d="M40 330 C 210 300, 250 150, 430 140 S 700 190, 860 96"/><path className="location-route location-route--soft" d="M20 210 C 190 250, 320 320, 500 300 S 760 250, 880 300"/><circle className="location-pin" cx="430" cy="140" r="7"/><circle className="location-pin location-pin--b" cx="500" cy="300" r="6"/></svg></span>
            <LocationSection />
          </section>
        </div>
      </section>

      <NewsSection />

      <section className="services section" id="services" aria-labelledby="services-title">
        <ServicesSection />
      </section>

      <section className="audience section" id="audience" aria-labelledby="audience-title">
        <AudienceSection />
      </section>

      <section className="partners section" id="partners" aria-labelledby="partners-title">
        <PartnersSection />
      </section>

      <section className="statement" aria-labelledby="statement-title">
        <StatementSection />
      </section>

      <section className="guide section" id="guide" aria-labelledby="guide-title">
        <GuideSection />
      </section>

      <section className="faq section" id="faq" aria-labelledby="faq-title">
        <FAQSection />
      </section>

      <section className="contact-section" id="contact" aria-labelledby="contact-title">
        <ContactSection />
      </section>
    </>
  );
}
