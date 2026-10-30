import { ArrowRight, Globe2, MapPin, Cpu } from "lucide-react";
import { Link } from "react-router-dom";
import "./Home.css";

function Home() {
  return (
    <main className="home">
      <header className="home-header">
        <Link to="/" className="home-brand" aria-label="Vinheria Full — início">
          <span className="brand-mark">V.</span>
          <span className="brand-name">
            VINHERIA <span>FULL</span>
          </span>
        </Link>

        <nav className="home-nav" aria-label="Navegação principal">
          <a href="#sobre">O projeto</a>
          <Link to="/mapa">Explorar vinherias</Link>
          <Link to="/dispositivos">Gerenciar dispositivos</Link>
        </nav>

        <Link to="/dispositivos" className="header-cta">
          Gerenciar dispositivos <ArrowRight size={15} />
        </Link>
      </header>

      <section className="home-hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            UMA REDE, DIFERENTES TERRITÓRIOS
          </div>

          <h1>
            O mundo do vinho,
            <br />
            <em>em um só lugar.</em>
          </h1>

          <p className="hero-description">
            Explore vinherias ao redor do mundo e acompanhe as condições
            ambientais de cada adega em uma experiência que conecta
            território, tecnologia e tradição.
          </p>

          <div className="hero-actions">
            <Link to="/mapa" className="primary-cta">
              Explorar o mapa <ArrowRight size={17} />
            </Link>

            <Link to="/dispositivos" className="secondary-cta">
              <Cpu size={17} />
              Gerenciar dispositivos
            </Link>
          </div>

          <div className="hero-note">
            <Globe2 size={17} strokeWidth={1.5} />
            <span>Uma perspectiva global sobre o cuidado com o vinho.</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-image">
            <div className="image-overlay" />

            <div className="image-caption">
              <span>TERROIR · TEMPO · PRECISÃO</span>
              <span className="caption-divider" />
              <span>Uma nova forma de explorar</span>
            </div>
          </div>

          <div className="floating-note">
            <span className="floating-icon">
              <MapPin size={17} />
            </span>
            <div>
              <strong>De um território a outro</strong>
              <span>Descubra a rede de vinherias</span>
            </div>
          </div>

          <span className="visual-index">01 / EXPLORAÇÃO GLOBAL</span>
        </div>

        <div className="hero-vertical-label">VINHERIA FULL · MONITORAMENTO</div>
      </section>

      <section className="home-intro" id="sobre">
        <div className="intro-heading">
          <span className="section-index">01 — NOSSA PROPOSTA</span>
          <h2>
            Cada vinheria tem
            <br />
            uma história. <em>E condições próprias.</em>
          </h2>
        </div>

        <div className="intro-content">
          <p>
            Uma plataforma para explorar vinherias de diferentes países
            e visualizar dados ambientais que ajudam a compreender
            as condições de cada adega.
          </p>

          <Link to="/mapa" className="text-link">
            Descobrir a rede <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <footer className="home-footer">
        <Link to="/" className="footer-brand">VINHERIA FULL</Link>
        <span>Território, tecnologia e tradição.</span>
        <span>CP5 · EDGE COMPUTING</span>
      </footer>
    </main>
  );
}

export default Home;