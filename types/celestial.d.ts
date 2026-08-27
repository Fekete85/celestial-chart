// TypeScript-típusok a d3-celestial modernizált forkjához.
//
// A Config törzse GENERÁLT: a src/config.js alapértelmezéseiből készül, hogy a
// ~110 beállítás ne kézi találgatásból kerüljön ide. A drift ellen teszt véd
// (test/tipusok.teszt.mjs): minden futásidejű beállításnévnek szerepelnie kell
// itt, és fordítva.

/** A támogatott vetítések. Kettő (`cassini`, `quincuncial`) az upstream
 *  szállított buildjében sincs benne — azok hibát dobnak. */
export type Vetites =
  | "airy"
  | "aitoff"
  | "armadillo"
  | "august"
  | "azimuthalEqualArea"
  | "azimuthalEquidistant"
  | "baker"
  | "berghaus"
  | "boggs"
  | "bonne"
  | "bromley"
  | "cassini"
  | "collignon"
  | "craig"
  | "craster"
  | "cylindricalEqualArea"
  | "cylindricalStereographic"
  | "eckert1"
  | "eckert2"
  | "eckert3"
  | "eckert4"
  | "eckert5"
  | "eckert6"
  | "eisenlohr"
  | "equirectangular"
  | "fahey"
  | "mtFlatPolarParabolic"
  | "mtFlatPolarQuartic"
  | "mtFlatPolarSinusoidal"
  | "foucaut"
  | "ginzburg4"
  | "ginzburg5"
  | "ginzburg6"
  | "ginzburg8"
  | "ginzburg9"
  | "homolosine"
  | "hammer"
  | "hatano"
  | "healpix"
  | "hill"
  | "kavrayskiy7"
  | "lagrange"
  | "larrivee"
  | "laskowski"
  | "loximuthal"
  | "mercator"
  | "miller"
  | "mollweide"
  | "naturalEarth"
  | "nellHammer"
  | "orthographic"
  | "patterson"
  | "polyconic"
  | "quincuncial"
  | "rectangularPolyconic"
  | "robinson"
  | "sinusoidal"
  | "stereographic"
  | "times"
  | "twoPointEquidistant"
  | "vanDerGrinten"
  | "vanDerGrinten2"
  | "vanDerGrinten3"
  | "vanDerGrinten4"
  | "wagner4"
  | "wagner6"
  | "wagner7"
  | "wiechel"
  | "winkel3";

/** Koordináta-rendszer, amelyben a térkép megjelenik. */
export type Transzformacio = "equatorial" | "ecliptic" | "galactic" | "supergalactic";

/** Középpont: [hosszúság, szélesség] vagy [hosszúság, szélesség, tájolás].
 *  Egyenlítői rendszerben a hosszúság órában értendő, egyébként fokban. */
export type Kozeppont = [number, number] | [number, number, number];

/** Égi koordináta fokban: [hosszúság, szélesség]. */
export type Koordinata = [number, number];

/** Képernyő-koordináta pixelben: [x, y]. */
export type Pont = [number, number];

export interface Config {
  width?: number;
  projection?: Vetites;
  projectionRatio?: number | null;
  transform?: Transzformacio;
  center?: Kozeppont | null;
  geopos?: [number, number] | null;
  follow?: "zenith" | "center";
  orientationfixed?: boolean;
  zoomlevel?: number | null;
  zoomextend?: number;
  adaptable?: boolean;
  interactive?: boolean;
  disableAnimations?: boolean;
  form?: boolean;
  location?: boolean;
  formFields?: {
    location?: boolean;
    general?: boolean;
    stars?: boolean;
    dsos?: boolean;
    constellations?: boolean;
    lines?: boolean;
    other?: boolean;
    download?: boolean;
  };
  advanced?: boolean;
  daterange?: Date[];
  settimezone?: boolean;
  timezoneid?: string;
  controls?: boolean;
  lang?: string;
  culture?: string;
  container?: string;
  datapath?: string;
  stars?: {
    show?: boolean;
    limit?: number;
    colors?: boolean;
    style?: {
      fill?: string;
      opacity?: number;
    };
    designation?: boolean;
    designationType?: string;
    designationStyle?: {
      fill?: string;
      font?: string;
      align?: string;
      baseline?: string;
    };
    designationLimit?: number;
    propername?: boolean;
    propernameType?: string;
    propernameStyle?: {
      fill?: string;
      font?: string;
      align?: string;
      baseline?: string;
    };
    propernameLimit?: number;
    size?: number | null;
    exponent?: number;
    data?: string;
  };
  dsos?: {
    show?: boolean;
    limit?: number;
    colors?: boolean;
    style?: {
      fill?: string;
      stroke?: string;
      width?: number;
      opacity?: number;
    };
    names?: boolean;
    namesType?: string;
    nameStyle?: {
      fill?: string;
      font?: string;
      align?: string;
      baseline?: string;
    };
    nameLimit?: number;
    size?: unknown;
    exponent?: number;
    data?: string;
    symbols?: Record<string, { shape?: string; fill?: string }>;
  };
  constellations?: {
    show?: boolean;
    names?: boolean;
    namesType?: string;
    nameStyle?: {
      fill?: string;
      align?: string;
      baseline?: string;
      opacity?: number;
      font?: string[];
    };
    lines?: boolean;
    lineStyle?: {
      stroke?: string;
      width?: number;
      opacity?: number;
    };
    bounds?: boolean;
    boundStyle?: {
      stroke?: string;
      width?: number;
      opacity?: number;
      dash?: number[];
    };
  };
  mw?: {
    show?: boolean;
    style?: {
      fill?: string;
      opacity?: string;
    };
  };
  lines?: {
    graticule?: {
      show?: boolean;
      stroke?: string;
      width?: number;
      opacity?: number;
      lon?: {
        pos?: Array<number | string>;
        fill?: string;
        font?: string;
      };
      lat?: {
        pos?: Array<number | string>;
        fill?: string;
        font?: string;
      };
    };
    equatorial?: {
      show?: boolean;
      stroke?: string;
      width?: number;
      opacity?: number;
    };
    ecliptic?: {
      show?: boolean;
      stroke?: string;
      width?: number;
      opacity?: number;
    };
    galactic?: {
      show?: boolean;
      stroke?: string;
      width?: number;
      opacity?: number;
    };
    supergalactic?: {
      show?: boolean;
      stroke?: string;
      width?: number;
      opacity?: number;
    };
  };
  background?: {
    fill?: string;
    opacity?: number;
    stroke?: string;
    width?: number;
  };
  horizon?: {
    show?: boolean;
    stroke?: string;
    width?: number;
    fill?: string;
    opacity?: number;
  };
  daylight?: {
    show?: boolean;
  };
  planets?: {
    show?: boolean;
    which?: string[];
    symbols?: {
      sol?: {
        symbol?: string;
        letter?: string;
        fill?: string;
        size?: number;
      };
      mer?: {
        symbol?: string;
        letter?: string;
        fill?: string;
      };
      ven?: {
        symbol?: string;
        letter?: string;
        fill?: string;
      };
      ter?: {
        symbol?: string;
        letter?: string;
        fill?: string;
      };
      lun?: {
        symbol?: string;
        letter?: string;
        fill?: string;
        size?: number;
      };
      mar?: {
        symbol?: string;
        letter?: string;
        fill?: string;
      };
      cer?: {
        symbol?: string;
        letter?: string;
        fill?: string;
      };
      ves?: {
        symbol?: string;
        letter?: string;
        fill?: string;
      };
      jup?: {
        symbol?: string;
        letter?: string;
        fill?: string;
      };
      sat?: {
        symbol?: string;
        letter?: string;
        fill?: string;
      };
      ura?: {
        symbol?: string;
        letter?: string;
        fill?: string;
      };
      nep?: {
        symbol?: string;
        letter?: string;
        fill?: string;
      };
      plu?: {
        symbol?: string;
        letter?: string;
        fill?: string;
      };
      eri?: {
        symbol?: string;
        letter?: string;
        fill?: string;
      };
    };
    symbolStyle?: {
      fill?: string;
      opacity?: number;
      font?: string;
      align?: string;
      baseline?: string;
    };
    symbolType?: string;
    names?: boolean;
    nameStyle?: {
      fill?: string;
      font?: string;
      align?: string;
      baseline?: string;
    };
    namesType?: string;
  };
  /** A megjelenítés időpontja. Nincs alapértelmezése: ilyenkor a jelen idő. */
  date?: Date;
}

/** A térkép aktuális méretei. */
export interface Meretek {
  width: number;
  height: number;
  margin: [number, number];
  scale: number;
}

/** Egy térkép beállító-űrlapja. Példányonként külön. */
export interface Urlap {
  /** Mezőkeresés ezen a térképen belül. */
  $form(id: string): HTMLElement | null;
  enable(source: HTMLElement): void;
  fldEnable(mezo: string, be: boolean): void;
  listConstellations(): void;
  setCenter(kozeppont: Kozeppont | null, transzformacio: Transzformacio): void;
  setLimits(): void;
  setVisibility(config: Config, melyik: string): void;
  showAdvanced(mutasd: boolean): void;
}

/** Egy csillagkép adatai a `constellations` listából. */
export interface Csillagkep {
  id: string;
  properties: Record<string, unknown>;
  [egyeb: string]: unknown;
}

/**
 * Egy égtérkép-példány.
 *
 * Több független térképhez ezt kell használni, `{ onallo: true }` mellett —
 * enélkül a példány a felhalmozott globális beállításra épül, ahogy a
 * `Celestial.display()`.
 *
 * ```ts
 * const a = new Egbolt({ container: "map-a", projection: "orthographic" }, { onallo: true });
 * ```
 */
export declare class Egbolt {
  constructor(config?: Config, opciok?: { onallo?: boolean });

  /** A térkép érvényes konfigurációja. Rajzolás közben frissül. */
  readonly cfg: Config;
  /** A d3-geo vetítés. Vetítésváltás után új objektum. */
  readonly mapProjection: (koord: Koordinata) => Pont | null;
  /** A d3-geo útvonal-generátor. */
  readonly map: unknown;
  /** A rajzelemeket tartó `<container>` d3-szelekció. */
  readonly container: unknown;
  /** A szülőelem CSS-szelektora, például `"#celestial-map"`. */
  readonly parentElement: string;
  /** Csillag- és mélyég-nevek a betöltött adatból. */
  readonly starnames: Record<string, Record<string, string>>;
  readonly dsonames: Record<string, Record<string, string>>;
  /** A térkép saját űrlapja (csak ha `form: true`). */
  readonly urlap: Urlap;
  readonly context: CanvasRenderingContext2D;

  /** Látható-e a pont a jelenlegi vetítésen. */
  clip(koord: Koordinata): 0 | 1;
  metrics(): Meretek;
  redraw(): void;
  /** Új szélesség; érték nélkül a jelenlegit adja vissza. */
  resize(config?: { width: number } | number): number;
  /** Beállítások alkalmazása újrarajzolással. */
  apply(config: Config): void;
  /** Teljes újratöltés — vetítés- és koordinátarendszer-váltáshoz. */
  reload(config?: Config): void;
  /** Vetítésváltás animációval. A becsült időt adja vissza ms-ban. */
  reproject(config: { projection: Vetites; projectionRatio?: number }): number;
  /** Középpont állítása. Érték nélkül a jelenlegit adja vissza. */
  rotate(config?: { center: Kozeppont }): Kozeppont | number;
  /** Nagyítás szorzóval. Érték nélkül a jelenlegi nagyítást adja vissza. */
  zoomBy(szorzo?: number): number;
  /** SVG-export. A kész SVG-t a visszahívás kapja meg. */
  exportSVG(kesz: (svg: string) => void): void;

  animate(lepesek: Array<{ param: string; value: unknown; duration?: number; callback?: () => void }>,
          ismetel?: boolean): void;
  stop(torol?: boolean): void;
  go(index?: number): void;

  color(tipus?: string): string;
  starColor(csillag: unknown): string;
  symbol: unknown;
  dsoSymbol(dso: unknown): string;
  setStyle(stilus: Record<string, unknown>): void;
  setTextStyle(stilus: Record<string, unknown>): void;
  setStyleA(rang: number, stilus: Record<string, unknown>): void;
  setConstStyle(rang: number, font: string | string[]): void;

  /** Csak `location: true` mellett. */
  date?(datum?: Date, tz?: number): Date;
  dateFormat?(datum: Date, tz: number): string;
  zenith?(): Kozeppont;
  nadir?(): Kozeppont;
  position?(): [number, number];
  location?(be: boolean): void;
  timezone?(): number;
  skyview?(config?: unknown): unknown;
  dtLoc?(): unknown;

  showConstellation?(id: string): void;
  setLanguage?(nyelv: string): Config;
  updateForm?(): void;
  /** A betöltött csillagképek. Az adatok beérkezése után áll be. */
  constellations?: Record<string, Csillagkep>;
  constellation?: string | null;
}

/**
 * A globális felület — visszafelé kompatibilis a régi használattal.
 *
 * A `display()` létrehoz egy példányt, és annak a felületét kiteríti magára;
 * a visszaadott példányon keresztül több térkép is kezelhető.
 *
 * FIGYELEM: a térkép-metódusok (`rotate`, `apply`, `zoomBy`, `redraw`, …) csak
 * az első `display()` UTÁN léteznek. A típus jelenlévőnek mutatja őket, mert a
 * gyakorlatban minden használat a `display()`-jel kezdődik, és opcionálisként
 * minden hívás `?.`-ot igényelne.
 */
export interface CelestialFelulet extends Egbolt {
  readonly version: string;
  data: unknown[];

  /** Térkép megjelenítése. A létrehozott példányt adja vissza. */
  display(config?: Config): Egbolt;

  /** Az érvényes beállítások. */
  settings(): {
    set(config?: Config, alap?: unknown): Config;
    applyDefaults(config?: Config, alap?: unknown): Config;
    [kulcs: string]: unknown;
  };
  /** A támogatott vetítések leírói. */
  projections(): Record<Vetites, { n: string; arg: number | null; scale: number; ratio?: number; clip?: boolean }>;
  /** Vetítés felépítése névből. */
  projection(nev: Vetites): unknown;
  eulerAngles(): Record<string, [number, number, number]>;
  poles(): Record<string, [number, number]>;
  euler(): Record<string, number[]>;

  /** Saját adatréteg hozzáadása. */
  add(adat: { type?: string; file?: string; callback: () => void; redraw?: () => void }): void;
  remove(): void;
  clear(): void;
  addCallback(fv: () => void): void;
  runCallback(): void;

  getData(json: unknown, transzformacio: Transzformacio): unknown;
  getPlanet(id: string, datum?: Date, egbolt?: Egbolt): unknown;
  /** Koordináta átszámítása egyenlítőiből a megadott rendszerbe. */
  getPoint(koord: Koordinata, transzformacio: Transzformacio): Koordinata;

  /** Égi → horizontális koordináta. */
  horizontal: {
    (datum: Date, koord: Koordinata, hely: Koordinata): [number, number, number];
    /** Horizontális → égi. */
    inverse(datum: Date, horizontalis: Koordinata, hely: Koordinata): [number, number, number];
  };
  /** Óraszög fokban, [0, 360). */
  ha(datum: Date, hosszusag: number, rektaszcenzio: number): number;
}

declare const Celestial: CelestialFelulet;
export { Celestial };
export default Celestial;
