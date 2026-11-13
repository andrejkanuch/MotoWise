import { MotorcycleType } from '@motovault/types';
import { getBrandDna } from '@/config/brand-dna';

// Map a brand's visual archetype (from getBrandDna) to a MotorcycleType so
// make-only partial captures still get a sensible default type.
const ARCHETYPE_TO_TYPE: Record<string, MotorcycleType> = {
  sport: MotorcycleType.SPORTBIKE,
  adv: MotorcycleType.DUAL_SPORT,
  cruiser: MotorcycleType.CRUISER,
};

export function typeFromMake(makeName: string): MotorcycleType {
  const dna = getBrandDna(makeName);
  return (dna && ARCHETYPE_TO_TYPE[dna.type]) ?? MotorcycleType.STANDARD;
}

export function detectTypeFromModel(modelName: string): MotorcycleType | null {
  const lower = modelName.toLowerCase();
  if (/ninja|cbr|yzf-r|gsxr|gsx-r|zx|rc\d|panigale|rsv|daytona/i.test(lower))
    return MotorcycleType.SPORTBIKE;
  if (/vulcan|shadow|rebel|scout|sportster|fatboy|softail|dyna|iron\s?\d/i.test(lower))
    return MotorcycleType.CRUISER;
  if (/goldwing|gold wing|electra|road king|road glide|voyager|k\s?1600/i.test(lower))
    return MotorcycleType.TOURING;
  if (
    /dr-z|drz|klx|crf|wr\d|xr\d|rally|tenere|versys|v-strom|vstrom|tiger|adventure|africa|gs\b|multistrada|africa twin/i.test(
      lower,
    )
  )
    return MotorcycleType.DUAL_SPORT;
  if (/crf\d+f|yz\d+f|kx\d+|rm-z|rmz|tc\d|fc\d|sx|exc/i.test(lower))
    return MotorcycleType.DIRT_BIKE;
  if (/scooter|vespa|pcx|nmax|xmax|burgman|forza|metropolitan|scoopy/i.test(lower))
    return MotorcycleType.SCOOTER;
  return null;
}
