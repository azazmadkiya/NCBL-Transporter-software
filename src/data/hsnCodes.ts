export interface HSNRecord {
  code: string;
  description: string;
  defaultGst: 0 | 5 | 12 | 18 | 28;
  defaultUnit: string;
  keywords: string[];
}

export const COMMON_HSN_SAC_CODES: HSNRecord[] = [
  {
    code: '252329',
    description: 'Portland Cement (OPC / PPC / White Cement / Slag)',
    defaultGst: 28,
    defaultUnit: 'Bags',
    keywords: ['cement', 'opc', 'ppc', 'ultratech', 'ambuja', 'acc', 'jk']
  },
  {
    code: '262190',
    description: 'Fly Ash / Pond Ash (Raw Material)',
    defaultGst: 5,
    defaultUnit: 'MT',
    keywords: ['fly ash', 'flyash', 'pond ash', 'ash']
  },
  {
    code: '250590',
    description: 'River Sand / Natural Sand / Silica Sand / Crushed Sand',
    defaultGst: 5,
    defaultUnit: 'Brass',
    keywords: ['sand', 'river sand', 'm-sand', 'msand', 'crushed sand']
  },
  {
    code: '251710',
    description: 'Stone Aggregate / Crushed Stone / Gitti / Metal (10mm, 20mm, 40mm)',
    defaultGst: 5,
    defaultUnit: 'Brass',
    keywords: ['aggregate', 'stone', 'gitti', 'metal', 'gravel', 'ballast', 'rubble']
  },
  {
    code: '382450',
    description: 'Ready Mix Concrete (RMC) / Non-refractory Mortars',
    defaultGst: 18,
    defaultUnit: 'Cum',
    keywords: ['rmc', 'ready mix', 'concrete', 'mortar']
  },
  {
    code: '721420',
    description: 'TMT Steel Bars / Deformed Rebars (Fe 500D, Fe 550D)',
    defaultGst: 18,
    defaultUnit: 'MT',
    keywords: ['steel', 'tmt', 'rebar', 'iron rod', 'sariya', 'bars']
  },
  {
    code: '721631',
    description: 'Structural Steel / Beams / Angles / Channels / Joists',
    defaultGst: 18,
    defaultUnit: 'MT',
    keywords: ['angle', 'channel', 'beam', 'joist', 'girder', 'section', 'structural']
  },
  {
    code: '681011',
    description: 'Building Bricks / Concrete Blocks / AAC Blocks',
    defaultGst: 12,
    defaultUnit: 'Pcs',
    keywords: ['brick', 'blocks', 'aac', 'concrete block', 'fly ash brick']
  },
  {
    code: '690721',
    description: 'Ceramic Tiles / Vitrified Floor & Wall Tiles',
    defaultGst: 18,
    defaultUnit: 'Boxes',
    keywords: ['tiles', 'ceramic', 'vitrified', 'flooring', 'granite', 'marble']
  },
  {
    code: '996511',
    description: 'Goods Transport Agency (GTA) / Road Freight Transportation Services',
    defaultGst: 5,
    defaultUnit: 'Trips',
    keywords: ['freight', 'transport', 'gta', 'bhada', 'truck hire', 'cartage', 'carriage']
  },
  {
    code: '996791',
    description: 'Logistics, Cargo Handling, Loading & Unloading Services',
    defaultGst: 18,
    defaultUnit: 'Trips',
    keywords: ['logistics', 'cargo', 'loading', 'unloading', 'handling', 'hamali']
  },
  {
    code: '271019',
    description: 'Diesel, Lubricants, Engine Oils & Greases',
    defaultGst: 18,
    defaultUnit: 'Ltr',
    keywords: ['diesel', 'oil', 'lubricant', 'grease', 'fuel', 'mobil']
  },
  {
    code: '870829',
    description: 'Truck Spare Parts / Commercial Vehicle Accessories',
    defaultGst: 18,
    defaultUnit: 'Pcs',
    keywords: ['spare', 'parts', 'tyre', 'tire', 'battery', 'filter', 'brake']
  },
  {
    code: '843149',
    description: 'Earthmoving & Heavy Machinery Spares (JCB / Crane / Dumper)',
    defaultGst: 18,
    defaultUnit: 'Pcs',
    keywords: ['jcb', 'crane', 'dumper', 'machinery', 'hydraulics']
  }
];

export function autoDetectHsn(description: string): HSNRecord | undefined {
  if (!description || description.trim().length < 2) return undefined;
  const desc = description.toLowerCase();

  for (const item of COMMON_HSN_SAC_CODES) {
    for (const kw of item.keywords) {
      if (desc.includes(kw)) {
        return item;
      }
    }
  }
  return undefined;
}
