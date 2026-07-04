/**
 * Team name → flag emoji lookup.
 *
 * TxLINE feeds send plain English team names with no country metadata,
 * so we resolve flags client-side. Covers all 2026 World Cup qualifiers
 * plus common aliases (USA / United States, Korea Republic / South Korea…).
 */

/** ISO 3166-1 alpha-2 → regional-indicator emoji */
function iso(code: string): string {
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

const TEAM_ISO: Record<string, string> = {
  // ── Host nations 2026 ──
  'usa': 'us', 'united states': 'us', 'united states of america': 'us',
  'mexico': 'mx', 'canada': 'ca',

  // ── South America ──
  'argentina': 'ar', 'brazil': 'br', 'uruguay': 'uy', 'colombia': 'co',
  'ecuador': 'ec', 'paraguay': 'py', 'peru': 'pe', 'chile': 'cl',
  'venezuela': 've', 'bolivia': 'bo',

  // ── Europe ──
  'france': 'fr', 'england': 'gb-eng', 'spain': 'es', 'germany': 'de',
  'portugal': 'pt', 'netherlands': 'nl', 'holland': 'nl', 'belgium': 'be',
  'italy': 'it', 'croatia': 'hr', 'switzerland': 'ch', 'denmark': 'dk',
  'norway': 'no', 'sweden': 'se', 'poland': 'pl', 'austria': 'at',
  'ukraine': 'ua', 'turkey': 'tr', 'turkiye': 'tr', 'wales': 'gb-wls',
  'scotland': 'gb-sct', 'serbia': 'rs', 'hungary': 'hu', 'greece': 'gr',
  'czechia': 'cz', 'czech republic': 'cz', 'romania': 'ro', 'slovakia': 'sk',
  'slovenia': 'si', 'albania': 'al', 'georgia': 'ge', 'ireland': 'ie',
  'republic of ireland': 'ie', 'northern ireland': 'gb-nir', 'iceland': 'is',
  'finland': 'fi', 'bosnia': 'ba', 'bosnia and herzegovina': 'ba',
  'north macedonia': 'mk', 'montenegro': 'me', 'kosovo': 'xk', 'israel': 'il',
  'russia': 'ru', 'bulgaria': 'bg', 'cyprus': 'cy', 'estonia': 'ee',
  'latvia': 'lv', 'lithuania': 'lt', 'luxembourg': 'lu', 'malta': 'mt',
  'moldova': 'md', 'belarus': 'by', 'armenia': 'am', 'azerbaijan': 'az',
  'kazakhstan': 'kz', 'faroe islands': 'fo', 'gibraltar': 'gi',
  'andorra': 'ad', 'san marino': 'sm', 'liechtenstein': 'li',

  // ── Africa ──
  'morocco': 'ma', 'senegal': 'sn', 'nigeria': 'ng', 'egypt': 'eg',
  'algeria': 'dz', 'tunisia': 'tn', 'cameroon': 'cm', 'ghana': 'gh',
  'ivory coast': 'ci', "cote d'ivoire": 'ci', 'mali': 'ml',
  'burkina faso': 'bf', 'south africa': 'za', 'dr congo': 'cd',
  'congo dr': 'cd', 'cape verde': 'cv', 'cabo verde': 'cv', 'guinea': 'gn',
  'zambia': 'zm', 'gabon': 'ga', 'benin': 'bj', 'mozambique': 'mz',
  'madagascar': 'mg', 'uganda': 'ug', 'kenya': 'ke', 'tanzania': 'tz',
  'angola': 'ao', 'togo': 'tg', 'sudan': 'sd', 'libya': 'ly',
  'equatorial guinea': 'gq', 'guinea-bissau': 'gw', 'niger': 'ne',
  'sierra leone': 'sl', 'namibia': 'na', 'gambia': 'gm', 'mauritania': 'mr',
  'zimbabwe': 'zw', 'comoros': 'km', 'rwanda': 'rw', 'burundi': 'bi',
  'ethiopia': 'et', 'botswana': 'bw', 'malawi': 'mw', 'lesotho': 'ls',
  'eswatini': 'sz', 'liberia': 'lr', 'chad': 'td',
  'central african republic': 'cf', 'congo': 'cg', 'djibouti': 'dj',
  'eritrea': 'er', 'somalia': 'so', 'south sudan': 'ss', 'seychelles': 'sc',
  'mauritius': 'mu', 'sao tome and principe': 'st',

  // ── Asia ──
  'japan': 'jp', 'south korea': 'kr', 'korea republic': 'kr', 'korea': 'kr',
  'iran': 'ir', 'ir iran': 'ir', 'saudi arabia': 'sa', 'qatar': 'qa',
  'australia': 'au', 'iraq': 'iq', 'uzbekistan': 'uz', 'jordan': 'jo',
  'united arab emirates': 'ae', 'uae': 'ae', 'oman': 'om', 'bahrain': 'bh',
  'kuwait': 'kw', 'china': 'cn', 'china pr': 'cn', 'thailand': 'th',
  'vietnam': 'vn', 'indonesia': 'id', 'malaysia': 'my', 'singapore': 'sg',
  'philippines': 'ph', 'india': 'in', 'syria': 'sy', 'lebanon': 'lb',
  'palestine': 'ps', 'yemen': 'ye', 'tajikistan': 'tj', 'kyrgyzstan': 'kg',
  'turkmenistan': 'tm', 'afghanistan': 'af', 'pakistan': 'pk',
  'bangladesh': 'bd', 'sri lanka': 'lk', 'nepal': 'np', 'myanmar': 'mm',
  'cambodia': 'kh', 'laos': 'la', 'mongolia': 'mn', 'hong kong': 'hk',
  'chinese taipei': 'tw', 'taiwan': 'tw', 'north korea': 'kp',
  'korea dpr': 'kp',

  // ── CONCACAF ──
  'costa rica': 'cr', 'panama': 'pa', 'honduras': 'hn', 'jamaica': 'jm',
  'el salvador': 'sv', 'guatemala': 'gt', 'trinidad and tobago': 'tt',
  'haiti': 'ht', 'cuba': 'cu', 'nicaragua': 'ni', 'curacao': 'cw',
  'suriname': 'sr', 'guyana': 'gy', 'belize': 'bz', 'bermuda': 'bm',
  'puerto rico': 'pr', 'dominican republic': 'do', 'barbados': 'bb',
  'grenada': 'gd', 'saint lucia': 'lc', 'saint kitts and nevis': 'kn',
  'antigua and barbuda': 'ag', 'dominica': 'dm', 'bahamas': 'bs',
  'saint vincent and the grenadines': 'vc',

  // ── Oceania ──
  'new zealand': 'nz', 'fiji': 'fj', 'new caledonia': 'nc', 'tahiti': 'pf',
  'papua new guinea': 'pg', 'solomon islands': 'sb', 'vanuatu': 'vu',
  'samoa': 'ws', 'tonga': 'to',
};

/** GB subdivision flags (England / Scotland / Wales / N. Ireland) use tag sequences */
const GB_FLAGS: Record<string, string> = {
  'gb-eng': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'gb-sct': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'gb-wls': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'gb-nir': iso('gb'), // no emoji exists — fall back to Union Jack
};

/**
 * Returns the flag-icons ISO code for a team name, or '' when unknown.
 * Use with the `fi fi-{code}` CSS classes (SVG — renders on Windows too,
 * where flag emoji fall back to plain letter pairs).
 */
export function isoFor(team: string | undefined | null): string {
  if (!team) return '';
  return TEAM_ISO[team.trim().toLowerCase()] ?? '';
}

/** Returns the flag emoji for a team name, or '' when unknown. */
export function flagFor(team: string | undefined | null): string {
  if (!team) return '';
  const key = team.trim().toLowerCase();
  const code = TEAM_ISO[key];
  if (!code) return '';
  return GB_FLAGS[code] ?? iso(code);
}
