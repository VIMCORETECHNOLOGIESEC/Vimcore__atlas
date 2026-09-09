'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import AtlasExperience, { type CameraCommand } from './atlas-experience';
import { filterMuseums, museums, type Museum, type MuseumCluster } from './museum-catalog';
import type { ViewPhase } from './atlas-navigation';

const categories = [{ id: 'all', label: 'Todos los museos' }, { id: 'arqueologia', label: 'Arqueología' }, { id: 'arte', label: 'Arte contemporáneo' }, { id: 'historia', label: 'Historia' }];
const regions = [{ id: 'all', label: 'Todo Ecuador' }, { id: 'costa', label: 'Costa' }, { id: 'sierra', label: 'Sierra' }, { id: 'amazonia', label: 'Amazonía' }, { id: 'insular', label: 'Galápagos' }];

function Icon({ name }: { name: 'search' | 'heart' | 'menu' | 'close' | 'arrow' | 'reset' | 'book' | 'cloud' | 'plus' | 'minus' }) {
  const paths = { search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', heart: 'M12 21S2 15 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 7-10 13-10 13Z', menu: 'M3 5h18M3 12h18M3 19h18', close: 'M5 5l14 14M19 5 5 19', arrow: 'M5 12h14M13 6l6 6-6 6', reset: 'M3 10a9 9 0 1 1 1 8M3 3v7h7', book: 'M12 21V5C9 1 4 2 2 4v16c3-2 7-2 10 1Zm0 0V5c3-4 8-3 10-1v16c-3-2-7-2-10 1ZM6 6v10M18 6v10', cloud: 'M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5.5 5.5 0 1 1 0 11Z', plus: 'M5 12h14M12 5v14', minus: 'M5 12h14' };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function CompassRose({ roseRef }: { roseRef: RefObject<SVGGElement | null> }) {
  return <svg className="compass-rose" viewBox="0 0 120 120" role="img" aria-label="Brújula: orientación del norte del mapa">
    <circle cx="60" cy="60" r="38" /><circle cx="60" cy="60" r="34" />
    {Array.from({ length: 32 }, (_, i) => <path key={i} d={`M60 22v${i % 4 === 0 ? 7 : 3}`} transform={`rotate(${i * 11.25} 60 60)`} />)}
    <g ref={roseRef}>
      {Array.from({ length: 8 }, (_, i) => <g key={i} transform={`rotate(${i * 45} 60 60)`}><path d={`M60 ${i % 2 ? 35 : 27} 65 60H60Z`} fill="currentColor" /><path d={`M60 ${i % 2 ? 35 : 27} 55 60H60Z`} fill="#13211e" /></g>)}
      <text x="60" y="14">N</text><text x="109" y="64">E</text><text x="60" y="115">S</text><text x="11" y="64">O</text>
    </g><circle cx="60" cy="60" r="3" fill="currentColor" />
  </svg>;
}

export default function Home() {
  const [selected, setSelected] = useState<Museum | null>(null);
  const [phase, setPhase] = useState<ViewPhase>('overview');
  const [command, setCommand] = useState<CameraCommand>({ revision: 0, kind: 'overview' });
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('all');
  const [category, setCategory] = useState('all');
  const [visibleCount, setVisibleCount] = useState(20);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [clouds, setClouds] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [cluster, setCluster] = useState<MuseumCluster | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<SVGGElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const pendingSearch = useRef(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    const frame = requestAnimationFrame(() => {
      update();
      try { const stored: unknown = JSON.parse(localStorage.getItem('atlas:favorites') ?? '[]'); if (Array.isArray(stored)) setFavorites(stored.filter((id) => museums.some((museum) => museum.id === id))); } catch { /* Storage is optional. */ }
    });
    return () => { cancelAnimationFrame(frame); media.removeEventListener('change', update); };
  }, []);

  const resetView = useCallback(() => {
    setCluster(null); setMenuOpen(false); setPhase('dive');
    setCommand((previous) => ({ revision: previous.revision + 1, kind: 'overview' }));
  }, []);
  const selectMuseum = useCallback((museum: Museum) => {
    setSelected(museum); setCluster(null); setPhase('dive'); setMenuOpen(false);
    panelRef.current?.scrollTo({ top: 0 });
    setCommand((previous) => ({ revision: previous.revision + 1, kind: 'museum' }));
  }, []);
  const completeFlight = useCallback((destination: 'overview' | 'museum') => {
    setPhase(destination);
    if (destination === 'overview') setSelected(null);
  }, []);
  const exploreCluster = useCallback((next: MuseumCluster) => {
    setCluster(next); setVisibleCount(20); panelRef.current?.scrollTo({ top: 0 });
    setCommand((previous) => ({ revision: previous.revision + 1, kind: 'cluster', cluster: next }));
  }, []);
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { if (menuOpen) setMenuOpen(false); else if (selected || cluster) resetView(); } };
    window.addEventListener('keydown', keyDown); return () => window.removeEventListener('keydown', keyDown);
  }, [selected, cluster, menuOpen, resetView]);
  useEffect(() => {
    if (!selected && pendingSearch.current) { pendingSearch.current = false; searchRef.current?.focus(); panelRef.current?.scrollIntoView({ block: 'start' }); }
  }, [selected]);

  const toggleFavorite = (id: string) => setFavorites((previous) => {
    const next = previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id];
    try { localStorage.setItem('atlas:favorites', JSON.stringify(next)); } catch { /* Keep the session preference when storage is unavailable. */ }
    return next;
  });
  const filtered = useMemo(() => filterMuseums(museums, query, region, category).filter((museum) => !favoritesOnly || favorites.includes(museum.id)), [query, region, category, favoritesOnly, favorites]);
  const listed = cluster ? filtered.filter((museum) => cluster.members.some((member) => member.id === museum.id)) : filtered;
  const chooseCategory = (value: string) => { setCategory(value); setVisibleCount(20); setFavoritesOnly(false); resetView(); };
  const focusSearch = () => { if (selected) { pendingSearch.current = true; resetView(); } else { searchRef.current?.focus(); panelRef.current?.scrollIntoView({ block: 'start' }); } };

  return <main className="atlas-app" data-view={phase}>
    <header className="topbar">
      <button className="brand" onClick={resetView} aria-label="Atlas Cultural, volver a la vista país"><Icon name="book" /><span>Atlas Cultural</span></button>
      <nav aria-label="Navegación principal">
        <button className={category === 'all' && !favoritesOnly ? 'active' : ''} onClick={() => { setQuery(''); setRegion('all'); chooseCategory('all'); }}>Explora el mapa</button>
        {categories.slice(0, 3).map((item) => <button key={item.id} className={item.id !== 'all' && category === item.id ? 'active' : ''} onClick={() => chooseCategory(item.id)}>{item.label}</button>)}
      </nav>
      <div className="header-actions">
        <button className="icon-button" onClick={focusSearch} aria-label="Buscar museo"><Icon name="search" /></button>
        <button className={`icon-button ${favoritesOnly ? 'is-favorite' : ''}`} aria-label="Mostrar favoritos" aria-pressed={favoritesOnly} onClick={() => { setFavoritesOnly(!favoritesOnly); resetView(); }}><Icon name="heart" /></button>
        <button className="icon-button" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="atlas-menu" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
      </div>
      {menuOpen && <div className="menu-panel" id="atlas-menu">
        <button onClick={() => setClouds(!clouds)} aria-pressed={clouds}><Icon name="cloud" />{clouds ? 'Ocultar nubes' : 'Mostrar nubes'}</button>
        <button onClick={() => chooseCategory('historia')}><Icon name="book" />Museos de historia</button>
        <button onClick={resetView}><Icon name="reset" />Volver a la vista país</button>
        <p>Arrastra para girar. Usa la rueda o dos dedos para acercarte. Selecciona un punto para entrar en su museo.</p>
      </div>}
    </header>

    <div className="workspace">
      <aside className="side-panel" ref={panelRef} aria-label={selected ? 'Museo seleccionado' : 'Catálogo de museos'}>
        {!selected ? <>
          <p className="eyebrow">Patrimonio · Territorio · Memoria</p>
          <h1>Museos del<br /><em>Ecuador.</em></h1>
          <div className="editorial-rule" />
          <p className="intro-copy">Descubre el patrimonio que vive cerca de ti.</p>
          <div className="catalog-controls">
            <label className="search-field"><Icon name="search" /><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setCluster(null); setVisibleCount(20); }} placeholder="Museo, ciudad o provincia" aria-label="Buscar museo, ciudad o provincia" />{query && <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><Icon name="close" /></button>}</label>
            <div className="filter-grid">
              <label>Región<select value={region} onChange={(event) => { setRegion(event.target.value); setCluster(null); setVisibleCount(20); }}>{regions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label>Colección<select value={category} onChange={(event) => { setCategory(event.target.value); setCluster(null); setVisibleCount(20); }}>{categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            </div>
          </div>
          <div className="catalog-heading"><span>{favoritesOnly ? 'Tus favoritos' : 'Explorar museos'}</span><span aria-live="polite">{listed.length.toString().padStart(2, '0')}</span></div>
          {cluster && <div className="cluster-selection">En esta zona<button onClick={() => setCluster(null)}>Ver todos</button></div>}
          <div className="museum-list">
            {listed.slice(0, visibleCount).map((museum, index) => <div className="museum-row" key={museum.id}>
              <button className="museum-link" onClick={() => selectMuseum(museum)} aria-label={`Explorar ${museum.name} en ${museum.city}`}><span className="museum-index">{String(index + 1).padStart(2, '0')}</span><span><strong>{museum.city}</strong><small>{museum.name}</small></span><Icon name="arrow" /></button>
              <button className={`favorite-button ${favorites.includes(museum.id) ? 'is-favorite' : ''}`} onClick={() => toggleFavorite(museum.id)} aria-label={`${favorites.includes(museum.id) ? 'Quitar' : 'Guardar'} ${museum.name} ${favorites.includes(museum.id) ? 'de' : 'en'} favoritos`} aria-pressed={favorites.includes(museum.id)}><Icon name="heart" /></button>
            </div>)}
          </div>
          {!listed.length && <div className="empty-state"><p>{favoritesOnly ? 'Aún no hay museos guardados con estos filtros.' : 'No encontramos museos con estos filtros.'}</p><button onClick={() => { setQuery(''); setRegion('all'); setCategory('all'); setFavoritesOnly(false); setCluster(null); }}>Ver todos los museos</button></div>}
          {listed.length > visibleCount && <button className="load-more" onClick={() => setVisibleCount(visibleCount + 20)}>Mostrar más museos</button>}
          <p className="panel-note">Un atlas para explorar, una historia por descubrir. Selecciona un museo en el mapa o en esta lista.</p>
        </> : <div className="museum-detail">
          <button className="back-link" onClick={resetView}>← Todos los museos</button>
          <p className="eyebrow">{selected.province} · {regions.find((item) => item.id === selected.region)?.label}</p>
          <h1>{selected.city}</h1><div className="editorial-rule" /><h2>{selected.name}</h2>
          <p className="detail-copy">{selected.short}</p>
          <dl><div><dt>Colección</dt><dd>{selected.collection}</dd></div><div><dt>Territorio</dt><dd>{selected.city}, {selected.province}</dd></div></dl>
          <button className={`save-museum ${favorites.includes(selected.id) ? 'saved' : ''}`} aria-pressed={favorites.includes(selected.id)} onClick={() => toggleFavorite(selected.id)}><Icon name="heart" />{favorites.includes(selected.id) ? 'Guardado en favoritos' : 'Guardar museo'}</button>
          <p className="detail-hint">Arrastra para contemplar el edificio desde otra perspectiva.</p>
          {!selected.model && <p className="model-note">Interpretación arquitectónica del museo.</p>}
        </div>}
      </aside>

      <section className="map-stage" aria-label="Atlas tridimensional interactivo de Ecuador">
        <div className="stage-heading"><span>Atlas abierto <b>·</b> Ecuador</span><span>{selected ? selected.name : 'Un viaje por nuestra memoria'}</span></div>
        <div className="scene-frame" ref={stageRef}>
          <AtlasExperience catalog={filtered} selected={selected} phase={phase} command={command} clouds={clouds} reducedMotion={reducedMotion} onSelect={selectMuseum} onCluster={exploreCluster} onComplete={completeFlight} stageRef={stageRef} compassRef={compassRef} />
          <div className="cinematic-vignette" aria-hidden="true" />
          <div className="compass-holder"><CompassRose roseRef={compassRef} /></div>
        </div>
        <div className="map-toolbar">
          <button className="country-button" onClick={resetView}><Icon name="reset" />Vista país</button>
          <span className="map-help" aria-live="polite">{phase === 'dive' ? 'Viajando por el atlas…' : selected ? 'Arrastra para girar alrededor del museo' : 'Arrastra para girar · Acércate para explorar'}</span>
          <div className="zoom-controls"><button className="icon-button" aria-label="Alejar mapa" disabled={phase === 'dive'} onClick={() => setCommand((old) => ({ revision: old.revision + 1, kind: 'zoom-out' }))}><Icon name="minus" /></button><button className="icon-button" aria-label="Acercar mapa" disabled={phase === 'dive'} onClick={() => setCommand((old) => ({ revision: old.revision + 1, kind: 'zoom-in' }))}><Icon name="plus" /></button></div>
        </div>
        <footer className="map-credits"><span>24 provincias. Miles de historias.</span><small>Cartografía: <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Natural Earth</a> · Relieve: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">SRTM / GMTED2010 / ETOPO1</a></small></footer>
      </section>
    </div>
  </main>;
}
