/**
 * 200 town names (owner rule, session 63): one is drawn at random when a new
 * game begins and lives in the save. English medieval flavor to match the
 * villager names.
 */

export const TOWN_NAMES: string[] = [
  'Aldbrook', 'Alderholt', 'Ashcombe', 'Ashenfell', 'Ashford', 'Astonbury', 'Bailemoor', 'Bannerdale',
  'Barleywick', 'Barrowmere', 'Beechhurst', 'Bellbrook', 'Birchcross', 'Blackfen', 'Blackthorn', 'Bleakmoor',
  'Bracken Hollow', 'Bramblewood', 'Brandleford', 'Briarcliff', 'Brightwater', 'Brockenhurst', 'Bromleigh', 'Brookstead',
  'Burnfield', 'Bywater', 'Caldermoor', 'Camberwell', 'Candlewick', 'Cartmere', 'Cedarholm', 'Chalkford',
  'Charwick', 'Cherrymead', 'Chesterfen', 'Clayborne', 'Clearbrook', 'Cloverdale', 'Coldharbour', 'Coppermill',
  'Cranmere', 'Crowfell', 'Dallowgate', 'Dartmere', 'Deepdale', 'Dernwood', 'Dovecote', 'Downfield',
  'Dunsmere', 'Eastholme', 'Ebbcombe', 'Elderbrook', 'Eldergreen', 'Elmsworth', 'Emberfield', 'Everfen',
  'Fairmarsh', 'Fallowden', 'Farleigh', 'Fenwick', 'Fernshaw', 'Firlington', 'Fleetmoor', 'Flintcombe',
  'Fogmarsh', 'Fordwich', 'Foxglove Green', 'Frostfen', 'Furrowdale', 'Gladefield', 'Glimmerbeck', 'Gorsemoor',
  'Granthollow', 'Greenholt', 'Greyfen', 'Grimsdale', 'Haletree', 'Halloway', 'Harrowgate', 'Hartsmere',
  'Havenwick', 'Hawkhurst', 'Hazelmoor', 'Heathermoor', 'Hemlockden', 'Henbrook', 'Herongate', 'Highfen',
  'Hollowbrook', 'Hollybourne', 'Honeywick', 'Hopedale', 'Hornmere', 'Icemere', 'Ironwick', 'Ivybridge',
  'Kelder Vale', 'Kestrelmoor', 'Kilnworth', 'Kingsfen', 'Lambswick', 'Lanternlea', 'Lindenshaw', 'Littlemoor',
  'Longfurrow', 'Lowmarsh', 'Lynnhollow', 'Maplemere', 'Marleston', 'Marshgate', 'Meadowlark', 'Merribourne',
  'Middlefen', 'Milldale', 'Mistlemoor', 'Moorcroft', 'Mossbeck', 'Netherby', 'Nettlecombe', 'Newbarrow',
  'Nightingale Fen', 'Northfen', 'Nutbourne', 'Oakenshaw', 'Oldbridge', 'Orchard End', 'Otterford', 'Oxmoor',
  'Peatmarsh', 'Pebbleford', 'Pinewick', 'Ploughley', 'Pondsworth', 'Puddlemere', 'Quarryhurst', 'Quillmoor',
  'Rainscombe', 'Ravenfell', 'Redfern', 'Reedholm', 'Ridgeway', 'Rimewick', 'Rivermoor', 'Rookmere',
  'Roseden', 'Rowanhurst', 'Rushbrook', 'Ryefield', 'Saltmarsh', 'Sandpiper Fen', 'Shadowbeck', 'Sheepwash',
  'Silverbirch', 'Slatemoor', 'Sloeberry Cross', 'Snowfen', 'Sorrelmead', 'Southmere', 'Sparrowick', 'Spindlewood',
  'Springhollow', 'Stagford', 'Stonewick', 'Stormcombe', 'Strawmere', 'Summerfen', 'Sunderholt', 'Swalecliffe',
  'Swanmere', 'Tanglewood', 'Tarnbrook', 'Thistledown', 'Thornbury', 'Thrushfield', 'Timberfen', 'Tinderwick',
  'Turfmoor', 'Twinbrook', 'Umberdale', 'Underfell', 'Valeham', 'Violet Marsh', 'Wagtail End', 'Walnutbourne',
  'Wandermere', 'Watermill Green', 'Westerfen', 'Wheatcroft', 'Whisperwind', 'Whitewillow', 'Willowdene', 'Windlecombe',
  'Winterbourne', 'Wolfden', 'Woodruff Vale', 'Wrenfield', 'Wyrmsend', 'Yarrowmead', 'Yewhurst', 'Weaselden',
];

export function randomTownName(): string {
  return TOWN_NAMES[Math.floor(Math.random() * TOWN_NAMES.length)];
}
