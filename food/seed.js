'use strict';
// Starter food spots so the app is useful on first run. Coordinates are approximate.
// Use "Find more nearby" in the app to import more from OpenStreetMap.

const SEED = [
  { id: 'seed-katzs', name: "Katz's Delicatessen", category: 'restaurant', cuisine: 'deli', address: 'New York, NY', lat: 40.7223, lng: -73.9874, website: 'https://katzsdelicatessen.com', description: 'Famous for hand-carved pastrami on rye.' },
  { id: 'seed-joes-pizza', name: "Joe's Pizza", category: 'fast food', cuisine: 'pizza', address: 'New York, NY', lat: 40.7306, lng: -74.0021, website: '', description: 'Classic New York slices in Greenwich Village.' },
  { id: 'seed-pats', name: "Pat's King of Steaks", category: 'fast food', cuisine: 'cheesesteak', address: 'Philadelphia, PA', lat: 39.9331, lng: -75.1590, website: 'https://patskingofsteaks.com', description: 'Home of the Philly cheesesteak since 1930.' },
  { id: 'seed-bens-chili-bowl', name: "Ben's Chili Bowl", category: 'restaurant', cuisine: 'american', address: 'Washington, DC', lat: 38.9170, lng: -77.0289, website: 'https://benschilibowl.com', description: 'Half-smokes and chili on U Street.' },
  { id: 'seed-cafe-du-monde', name: 'Café du Monde', category: 'cafe', cuisine: 'beignets', address: 'New Orleans, LA', lat: 29.9577, lng: -90.0618, website: 'https://cafedumonde.com', description: 'Beignets and chicory coffee by the French Market.' },
  { id: 'seed-franklin-bbq', name: 'Franklin Barbecue', category: 'restaurant', cuisine: 'barbecue', address: 'Austin, TX', lat: 30.2701, lng: -97.7313, website: 'https://franklinbbq.com', description: 'Central Texas brisket worth the line.' },
  { id: 'seed-lou-malnatis', name: "Lou Malnati's Pizzeria", category: 'restaurant', cuisine: 'pizza', address: 'Chicago, IL', lat: 41.8903, lng: -87.6335, website: 'https://www.loumalnatis.com', description: 'Chicago deep-dish pizza.' },
  { id: 'seed-pike-place-chowder', name: 'Pike Place Chowder', category: 'restaurant', cuisine: 'seafood', address: 'Seattle, WA', lat: 47.6097, lng: -122.3425, website: 'https://pikeplacechowder.com', description: 'New England and Pacific chowders at the market.' },
  { id: 'seed-voodoo-doughnut', name: 'Voodoo Doughnut', category: 'bakery', cuisine: 'doughnuts', address: 'Portland, OR', lat: 45.5229, lng: -122.6732, website: 'https://www.voodoodoughnut.com', description: 'Playful, over-the-top doughnuts.' },
  { id: 'seed-tartine', name: 'Tartine Bakery', category: 'bakery', cuisine: 'bread and pastry', address: 'San Francisco, CA', lat: 37.7614, lng: -122.4241, website: 'https://tartinebakery.com', description: 'Country loaves and morning buns in the Mission.' },
  { id: 'seed-swan-oyster-depot', name: 'Swan Oyster Depot', category: 'restaurant', cuisine: 'seafood', address: 'San Francisco, CA', lat: 37.7911, lng: -122.4208, website: '', description: 'Counter-service oysters and crab since 1912.' },
  { id: 'seed-langers', name: "Langer's Delicatessen", category: 'restaurant', cuisine: 'deli', address: 'Los Angeles, CA', lat: 34.0568, lng: -118.2757, website: 'https://www.langersdeli.com', description: 'Home of the #19 hot pastrami sandwich.' },
];

module.exports = { SEED };
