import * as d3 from "./d3.js";
import { deg2rad, halfπ, τ } from "./transform.js";

function px(n) { return n + "px"; } 
function Round(x, dg) { return(Math.round(Math.pow(10,dg)*x)/Math.pow(10,dg)); }
function sign(x) { return x ? x < 0 ? -1 : 1 : 0; }
function pad(n) { return n < 10 ? '0' + n : n; }


// A csupasz `hasOwnProperty` a globális objektumon keresztül oldódott fel; modulban
// ez félrevezető, ezért explicit.
var sajatja = Object.prototype.hasOwnProperty;
function has(o, key) { return o !== null && sajatja.call(o, key); }
function when(o, key, val) { return o !== null && sajatja.call(o, key) ? o[key] : val; }
function isNumber(n) { return n !== null && !isNaN(parseFloat(n)) && isFinite(n); }
function isArray(o) { return o !== null && Object.prototype.toString.call(o) === "[object Array]"; }
function isObject(o) { var type = typeof o;  return type === 'function' || type === 'object' && !!o; }
function isFunction(o) { return typeof o == 'function' || false; }
// A d3.functor a v4-ben megszűnt. Egyetlen dolgot csinált: ami nem függvény,
// abból konstans függvényt gyártott.
function functor(o) { return isFunction(o) ? o : function() { return o; }; }

// A d3.json a v5 óta Promise-t ad vissza, nem callbacket hív. A hívási helyek
// szerkezetét megtartjuk — a régi (error, json) alak marad —, mert így a
// betöltési logika változatlan, és a D3-csere hatása elkülöníthető marad.
// A d3-queue külön csomag volt, a v5 óta nincs karbantartva. A könyvtár a
// felületéből ennyit használ: defer(fn) a feladat felvételére, await(cb) a
// végére. A defer-ek mind szinkronban, az await előtt futnak le.
// A v3-as selection.classed({nev: logikai, ...}) alak a v4-ben megszűnt;
// a v7 csak classed(nevek, logikai) párost ismer.
function osztalyoz(sel, obj) {
  for (var k in obj) { if (has(obj, k)) sel.classed(k, obj[k]); }
  return sel;
}

// Ugyanez az attr és a style objektum-alakjára: a v3 elfogadott egy egész
// tulajdonságtömböt, a v4+ csak (nev, ertek) párt. Ha ez kezeletlen marad, a
// hívás GETTERKÉNT fut le, és a lánc következő tagja már nem szelekción dolgozik
// — némán, kivétel nélkül, egészen az első használatig.
function attrok(sel, obj) {
  for (var k in obj) { if (has(obj, k)) sel.attr(k, obj[k]); }
  return sel;
}

function stilusok(sel, obj) {
  for (var k in obj) { if (has(obj, k)) sel.style(k, obj[k]); }
  return sel;
}

function feladatsor(parhuzamos) {
  var feladatok = [], fut = 0, kovetkezo = 0, hiba = null, kesz = null;

  function inditsUjat() {
    while (!hiba && fut < parhuzamos && kovetkezo < feladatok.length) {
      fut++;
      feladatok[kovetkezo++](function (e) {
        fut--;
        if (e && !hiba) { hiba = e; return kesz(hiba); }
        if (hiba) return;
        if (fut === 0 && kovetkezo === feladatok.length) return kesz(null);
        inditsUjat();
      });
    }
  }

  return {
    defer: function (fn) { feladatok.push(fn); return this; },
    await: function (cb) {
      kesz = cb;
      if (!feladatok.length) cb(null);
      else inditsUjat();
      return this;
    }
  };
}

function loadJson(url, callback) {
  return d3.json(url).then(
    function(json) { callback(null, json); },
    function(error) { callback(error || new Error("betöltés sikertelen: " + url)); }
  );
}
function isValidDate(d) { return d && d instanceof Date && !isNaN(d); }
function fileExists(url) {
  var http = new XMLHttpRequest();
  http.open('HEAD', url, false);
  http.send();
  return http.status != 404;
}

function findPos(o) {
  var l = 0, t = 0;
  if (o.offsetParent) {
    do {
      l += o.offsetLeft;
      t += o.offsetTop;
    } while ((o = o.offsetParent) !== null);
  }
  return [l, t];
}

function hasParent(t, id){
  while(t.parentNode){
    if(t.id === id) return true;
    t = t.parentNode;
  }
  return false;
}

function attach(node, event, func) {
  if (node.addEventListener) node.addEventListener(event, func, false);
  else node.attachEvent("on" + event, func); 
}

function stopPropagation(e) {
  if (typeof e.stopPropagation != "undefined") e.stopPropagation();
  else e.cancelBubble = true;
}

function dateDiff(dt1, dt2, type) {
  var diff = dt2.valueOf() - dt1.valueOf(),
      tp = type || "d";
  switch (tp) {
    case 'y': case 'yr': diff /= 31556926080; break;
    case 'm': case 'mo': diff /= 2629800000; break;
    case 'd': case 'dy': diff /= 86400000; break;
    case 'h': case 'hr': diff /= 3600000; break;
    case 'n': case 'mn': diff /= 60000; break;
    case 's': case 'sec': diff /= 1000; break;
    case 'ms': break;    
  }
  return Math.floor(diff);
}

function dateParse(s) {
  if (!s) return; 
  var t = s.split(".");
  if (t.length < 1) return; 
  t = t[0].split("-");
  t[0] = t[0].replace(/\D/g, "");
  if (!t[0]) return; 
  t[1] = t[1] ? t[1].replace(/\D/g, "") : "1";
  t[2] = t[2] ? t[2].replace(/\D/g, "") : "1";
  //Fraction -> h:m:s
  return new Date(Date.UTC(t[0], t[1]-1, t[2]));
}


function interpolateAngle(a1, a2, t) {
  a1 = (a1*deg2rad +τ) % τ;
  a2 = (a2*deg2rad + τ) % τ;
  if (Math.abs(a1 - a2) > Math.PI) {
    if (a1 > a2) a1 = a1 - τ;
    else if (a2 > a1) a2 = a2 - τ;
  }
  return d3.interpolateNumber(a1/deg2rad, a2/deg2rad);
}

var Trig = {
  sinh: function (val) { return (Math.pow(Math.E, val)-Math.pow(Math.E, -val))/2; },
  cosh: function (val) { return (Math.pow(Math.E, val)+Math.pow(Math.E, -val))/2; },
  tanh: function (val) { return 2.0 / (1.0 + Math.exp(-2.0 * val)) - 1.0; },
  asinh: function (val) { return Math.log(val + Math.sqrt(val * val + 1)); },
  acosh: function (val) { return Math.log(val + Math.sqrt(val * val - 1)); },
  // A JS `%` megtartja az osztandó előjelét, ezért egyetlen eltolás csak akkor
  // elég, ha a bemenet nem megy −2π (illetve −3π) alá. A közepes pályaelemek
  // J2000-től távolodva viszont nagyra nőnek, ott a régi képlet negatív, azaz
  // nem normált szöget adott. A kétszeres eltolás minden bemenetre helyes.
  normalize0: function(val) { return (((val + Math.PI) % (Math.PI*2)) + Math.PI*2) % (Math.PI*2) - Math.PI; },
  normalize: function(val) { return ((val % (Math.PI*2)) + Math.PI*2) % (Math.PI*2); },

  cartesian: function(p) {
    var ϕ = p[0], θ = halfπ - p[1], r = p[2];
    return {"x": r * Math.sin(θ) * Math.cos(ϕ), "y": r * Math.sin(θ) * Math.sin(ϕ), "z": r * Math.cos(θ)};
  },
  // FIGYELEM: az alábbi négy metódust a könyvtárban semmi nem hívja.
  // A `spherical` ráadásul nem inverze a `cartesian`-nak: `atan` van benne
  // `atan2` helyett (elveszti a kvadránst, és x = 0 esetén osztás nullával),
  // a visszaadott második érték pedig pólustávolság, nem szélesség. Nem
  // nyúltunk hozzá, mert nincs hívója — de ne épüljön rá új kód anélkül, hogy
  // előbb helyrerakná valaki.
  spherical: function(p) {
    var r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z),
        θ = Math.atan(p.y / p.x),
        ϕ = Math.acos(p.z / r);
    return  [θ / deg2rad, ϕ / deg2rad, r];
  },
  distance: function(p1, p2) {
    return Math.acos(Math.sin(p1[1])*Math.sin(p2[1]) + Math.cos(p1[1])*Math.cos(p2[1])*Math.cos(p1[0]-p2[0]));
  }
};

var epsilon = 1e-6, 
    halfPi =  Math.PI / 2, 
    quarterPi =  Math.PI / 4, 
    tau =  Math.PI * 2;
    
function cartesian(spherical) {
  var lambda = spherical[0], phi = spherical[1], cosPhi = Math.cos(phi);
  return [cosPhi * Math.cos(lambda), cosPhi * Math.sin(lambda), Math.sin(phi)];
}

function cartesianCross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function cartesianNormalizeInPlace(d) {
  var l = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
  d[0] /= l; d[1] /= l; d[2] /= l;
}

function longitude(point) {
  if (Math.abs(point[0]) <= Math.PI)
    return point[0];
  else
    return sign(point[0]) * ((Math.abs(point[0]) +  Math.PI) % tau -  Math.PI);
}

function poligonContains(polygon, point) {
  var lambda = longitude(point),
      phi = point[1],
      sinPhi = Math.sin(phi),
      normal = [Math.sin(lambda), -Math.cos(lambda), 0],
      angle = 0,
      winding = 0,
      sum = 0;

  if (sinPhi === 1) phi = halfPi + epsilon;
  else if (sinPhi === -1) phi = -halfPi - epsilon;

  for (var i = 0, n = polygon.length; i < n; ++i) {
    if (!(m = (ring = polygon[i]).length)) continue;
    var ring,
        m,
        point0 = ring[m - 1],
        lambda0 = longitude(point0),
        phi0 = point0[1] / 2 + quarterPi,
        sinPhi0 = Math.sin(phi0),
        cosPhi0 = Math.cos(phi0),
        point1, cosPhi1, sinPhi1, lambda1;

    for (var j = 0; j < m; ++j, lambda0 = lambda1, sinPhi0 = sinPhi1, cosPhi0 = cosPhi1, point0 = point1) {
      point1 = ring[j];
      lambda1 = longitude(point1);
      var phi1 = point1[1] / 2 + quarterPi;
      sinPhi1 = Math.sin(phi1);
      cosPhi1 = Math.cos(phi1);
      var delta = lambda1 - lambda0,
          sign = delta >= 0 ? 1 : -1,
          absDelta = sign * delta,
          antimeridian = absDelta > Math.PI,
          k = sinPhi0 * sinPhi1;

      sum += Math.atan2(k * sign * Math.sin(absDelta), cosPhi0 * cosPhi1 + k * Math.cos(absDelta));
      angle += antimeridian ? delta + sign * tau : delta;

      if ((antimeridian ^ lambda0) >= (lambda ^ lambda1) >= lambda) {
        var arc = cartesianCross(cartesian(point0), cartesian(point1));
        cartesianNormalizeInPlace(arc);
        var intersection = cartesianCross(normal, arc);
        cartesianNormalizeInPlace(intersection);
        var phiArc = (antimeridian ^ delta >= 0 ? -1 : 1) * Math.asin(intersection[2]);
        if (phi > phiArc || phi === phiArc && (arc[0] || arc[1])) {
          winding += antimeridian ^ delta >= 0 ? 1 : -1;
        }
      }
    }
  }

  return (angle < -epsilon || angle < epsilon && sum < -epsilon) ^ (winding & 1);
}

export { Round, Trig, attrok, dateDiff, dateParse, feladatsor, findPos, functor, has, hasParent, interpolateAngle, isArray, isNumber, isObject, isValidDate, loadJson, osztalyoz, pad, px, stilusok };
