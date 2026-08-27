// TypeScript definitions for celestial-chart.
//
// The body of Config is GENERATED from the defaults in src/config.js, so that
// the ~110 settings do not have to be transcribed by hand. A test guards
// against drift (test/types.test.mjs): every setting name that exists at
// runtime must appear here, and vice versa.

/** The supported projections. Two of them (`cassini`, `quincuncial`) are absent
 *  from the shipped upstream build as well — those throw. */
export type Projection =
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

/** The coordinate system the map is drawn in. */
export type Transform = "equatorial" | "ecliptic" | "galactic" | "supergalactic";

/** Map centre: [longitude, latitude] or [longitude, latitude, orientation].
 *  In the equatorial system the longitude is in hours, otherwise in degrees. */
export type Center = [number, number] | [number, number, number];

/** A celestial coordinate in degrees: [longitude, latitude]. */
export type Coordinate = [number, number];

/** A screen coordinate in pixels: [x, y]. */
export type ScreenPoint = [number, number];

export interface Config {
  width?: number;
  projection?: Projection;
  projectionRatio?: number | null;
  transform?: Transform;
  center?: Center | null;
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
  /** The moment to render. No default: the current time is used. */
  date?: Date;
}

/** The map's current dimensions. */
export interface Metrics {
  width: number;
  height: number;
  margin: [number, number];
  scale: number;
}

/** One map's settings form. Separate per instance. */
export interface SettingsForm {
  /** Field lookup within this map. */
  $form(id: string): HTMLElement | null;
  enable(source: HTMLElement): void;
  fldEnable(field: string, be: boolean): void;
  listConstellations(): void;
  setCenter(centerPoint: Center | null, transform_: Transform): void;
  setLimits(): void;
  setVisibility(config: Config, which_: string): void;
  showAdvanced(visible: boolean): void;
}

/** One constellation's data from the `constellations` list. */
export interface Constellation {
  id: string;
  properties: Record<string, unknown>;
  [other_: string]: unknown;
}

/**
 * One sky-map instance.
 *
 * This is what several independent maps need, together with
 * `{ standalone: true }` — without it the instance is built on the accumulated
 * global settings, just as `Celestial.display()` is.
 *
 * ```ts
 * const a = new SkyMap({ container: "map-a", projection: "orthographic" }, { standalone: true });
 * ```
 */
export declare class SkyMap {
  constructor(config?: Config, options?: { standalone?: boolean });

  /** The map's effective configuration. Updated while drawing. */
  readonly cfg: Config;
  /** The d3-geo projection. A new object after a projection change. */
  readonly mapProjection: (coord: Coordinate) => ScreenPoint | null;
  /** The d3-geo path generator. */
  readonly map: unknown;
  /** The d3 selection of the `<container>` element holding the drawn elements. */
  readonly container: unknown;
  /** CSS selector of the parent element, for example `"#celestial-map"`. */
  readonly parentElement: string;
  /** Star and deep-sky names from the loaded data. */
  readonly starnames: Record<string, Record<string, string>>;
  readonly dsonames: Record<string, Record<string, string>>;
  /** This map's own settings form (only when `form: true`). */
  readonly form: SettingsForm;
  readonly context: CanvasRenderingContext2D;

  /** Whether the point is visible in the current projection. */
  clip(coord: Coordinate): 0 | 1;
  metrics(): Metrics;
  redraw(): void;
  /** Set a new width; without an argument returns the current one. */
  resize(config?: { width: number } | number): number;
  /** Apply settings and redraw. */
  apply(config: Config): void;
  /** Full reload — for changing projection or coordinate system. */
  reload(config?: Config): void;
  /** Animated projection change. Returns the estimated duration in ms. */
  reproject(config: { projection: Projection; projectionRatio?: number }): number;
  /** Set the centre. Without an argument returns the current one. */
  rotate(config?: { center: Center }): Center | number;
  /** Zoom by a factor. Without an argument returns the current zoom. */
  zoomBy(factor?: number): number;
  /** SVG export. The finished SVG is passed to the callback. */
  exportSVG(done: (svg: string) => void): void;

  animate(steps: Array<{ param: string; value: unknown; duration?: number; callback?: () => void }>,
          repeat?: boolean): void;
  stop(clear?: boolean): void;
  go(index?: number): void;

  color(type_?: string): string;
  starColor(star: unknown): string;
  symbol: unknown;
  dsoSymbol(dso: unknown): string;
  setStyle(style_: Record<string, unknown>): void;
  setTextStyle(style_: Record<string, unknown>): void;
  setStyleA(rank: number, style_: Record<string, unknown>): void;
  setConstStyle(rank: number, font: string | string[]): void;

  /** Csak `location: true` mellett. */
  date?(date_?: Date, tz?: number): Date;
  dateFormat?(date_: Date, tz: number): string;
  zenith?(): Center;
  nadir?(): Center;
  position?(): [number, number];
  location?(be: boolean): void;
  timezone?(): number;
  skyview?(config?: unknown): unknown;
  dtLoc?(): unknown;

  showConstellation?(id: string): void;
  setLanguage?(language: string): Config;
  updateForm?(): void;
  /** The loaded constellations. Set once the data has arrived. */
  constellations?: Record<string, Constellation>;
  constellation?: string | null;
}

/**
 * The global interface — backwards compatible with the original usage.
 *
 * `display()` creates an instance and spreads that instance's interface onto
 * itself; the returned instance is how several maps can be handled.
 *
 * NOTE: the map methods (`rotate`, `apply`, `zoomBy`, `redraw` and the rest)
 * only exist AFTER the first `display()`. The types present them as always
 * available, because in practice every use starts with `display()`, and marking
 * them optional would force `?.` on every call.
 */
export interface CelestialGlobal extends SkyMap {
  readonly version: string;
  data: unknown[];

  /** Render a map. Returns the instance it created. */
  display(config?: Config): SkyMap;

  /** The effective settings. */
  settings(): {
    set(config?: Config, base?: unknown): Config;
    applyDefaults(config?: Config, base?: unknown): Config;
    [key_: string]: unknown;
  };
  /** Descriptors of the supported projections. */
  projections(): Record<Projection, { n: string; arg: number | null; scale: number; ratio?: number; clip?: boolean }>;
  /** Build a projection from its name. */
  projection(name_: Projection): unknown;
  eulerAngles(): Record<string, [number, number, number]>;
  poles(): Record<string, [number, number]>;
  euler(): Record<string, number[]>;

  /** Add a custom data layer. */
  add(data_: { type?: string; file?: string; callback: () => void; redraw?: () => void }): void;
  remove(): void;
  clear(): void;
  addCallback(fv: () => void): void;
  runCallback(): void;

  getData(json: unknown, transform_: Transform): unknown;
  getPlanet(id: string, date_?: Date, sky?: SkyMap): unknown;
  /** Convert a coordinate from equatorial to the given system. */
  getPoint(coord: Coordinate, transform_: Transform): Coordinate;

  /** Celestial to horizontal coordinates. */
  horizontal: {
    (date_: Date, coord: Coordinate, site: Coordinate): [number, number, number];
    /** Horizontal to celestial. */
    inverse(date_: Date, horizontalCoord: Coordinate, site: Coordinate): [number, number, number];
  };
  /** Hour angle in degrees, [0, 360). */
  ha(date_: Date, longitude: number, rightAscension: number): number;
}

declare const Celestial: CelestialGlobal;
export { Celestial };
export default Celestial;
