'use strict';
// Starter wineries so the app is useful on first run. Coordinates are approximate.
// Use "Find more nearby" in the app to import more from OpenStreetMap.

const SEED = [
  { id: 'seed-robert-mondavi', name: 'Robert Mondavi Winery', address: 'Oakville, CA', lat: 38.4430, lng: -122.4093, website: 'https://www.robertmondaviwinery.com', description: 'Napa Valley estate known for Cabernet Sauvignon and Fumé Blanc.' },
  { id: 'seed-castello-di-amorosa', name: 'Castello di Amorosa', address: 'Calistoga, CA', lat: 38.5649, lng: -122.5497, website: 'https://castellodiamorosa.com', description: 'A Tuscan-style castle winery in Napa Valley.' },
  { id: 'seed-domaine-carneros', name: 'Domaine Carneros', address: 'Napa, CA', lat: 38.2652, lng: -122.3601, website: 'https://www.domainecarneros.com', description: 'Sparkling wine and Pinot Noir in the Carneros region.' },
  { id: 'seed-ridge-lytton-springs', name: 'Ridge Vineyards Lytton Springs', address: 'Healdsburg, CA', lat: 38.6598, lng: -122.8800, website: 'https://www.ridgewine.com', description: 'Dry Creek Valley Zinfandel.' },
  { id: 'seed-buena-vista', name: 'Buena Vista Winery', address: 'Sonoma, CA', lat: 38.3003, lng: -122.4195, website: 'https://www.buenavistawinery.com', description: 'Historic Sonoma winery.' },
  { id: 'seed-tablas-creek', name: 'Tablas Creek Vineyard', address: 'Paso Robles, CA', lat: 35.6764, lng: -120.7901, website: 'https://tablascreek.com', description: 'Rhône-style blends on the Central Coast.' },
  { id: 'seed-domaine-serene', name: 'Domaine Serene', address: 'Dayton, OR', lat: 45.2736, lng: -123.0529, website: 'https://www.domaineserene.com', description: 'Willamette Valley Pinot Noir and Chardonnay.' },
  { id: 'seed-lecole-41', name: "L'Ecole No 41", address: 'Lowden, WA', lat: 46.0270, lng: -118.5543, website: 'https://lecole.com', description: 'Walla Walla Valley winery in a historic schoolhouse.' },
  { id: 'seed-konstantin-frank', name: 'Dr. Konstantin Frank Winery', address: 'Hammondsport, NY', lat: 42.4166, lng: -77.2133, website: 'https://www.drfrankwines.com', description: 'Finger Lakes Riesling pioneer.' },
  { id: 'seed-barboursville', name: 'Barboursville Vineyards', address: 'Barboursville, VA', lat: 38.1627, lng: -78.2873, website: 'https://www.barboursvillewine.com', description: 'Virginia winery with Italian-style wines.' },
  { id: 'seed-messina-hof', name: 'Messina Hof Winery', address: 'Bryan, TX', lat: 30.6853, lng: -96.4413, website: 'https://www.messinahof.com', description: 'Texas winery and resort.' },
  { id: 'seed-chateau-chantal', name: 'Chateau Chantal', address: 'Traverse City, MI', lat: 44.9875, lng: -85.5222, website: 'https://www.chateauchantal.com', description: 'Old Mission Peninsula winery with lake views.' },
];

module.exports = { SEED };
