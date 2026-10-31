# Food Tasting

Find places to eat near you, read tasting notes, and post your own rating. Same idea as Winery Finder,
for restaurants, cafés, bakeries and more. Zero dependencies (Node 18+).

## Run

    npm run start:food            # http://localhost:8091  (or: node food/server.js 3000)

Open it in a browser, then click **Use my location** or type a city/ZIP. (Browsers only allow
geolocation on `localhost` or HTTPS.)

## Features

- Nearest spots, sorted by distance (haversine), with a radius filter and a type filter
  (restaurant, cafe, bakery, fast food, dessert, street food, other).
- Reviews with a 1-5 star rating, the dish you tried, and a comment; average rating and review count per spot.
- **Find more nearby** imports restaurants, cafés, fast food, ice cream, food courts and bakeries from
  OpenStreetMap (Overpass API; radius capped at 15 miles). City/ZIP search uses Nominatim.
  Both need internet; the rest of the app works offline with 12 seeded spots (coordinates are approximate).
- Add your own spot (name + coordinates).

## Data

Saved as JSON in `food/data/food.json` (git-ignored; override with `FOOD_DATA=/path/file.json`).
Delete the file to reset to the seed data.

## API

- `GET /api/spots?lat&lng&radius&limit&q&category` - nearest first when lat/lng given, otherwise top rated
- `GET /api/spots/:id` - spot + reviews
- `POST /api/spots` - `{name, category?, cuisine?, address?, website?, description?, lat, lng}`
- `POST /api/spots/:id/reviews` - `{author, rating 1-5, dish?, comment?}`
- `GET /api/categories` - allowed categories
- `POST /api/discover` - `{lat, lng, radiusMiles?}` import from OpenStreetMap
- `GET /api/geocode?q=` - place name/ZIP to coordinates

## Notes

Reuses the pure distance helpers in `winery/geo.js`; everything else is separate from the winery app.

No user accounts: the review "name" is just text anyone can type, and there is no spam protection or
moderation. Add authentication before exposing this to the public internet.

## Tests

`npm test` (runs `food/food.test.js` along with the other apps' tests).
