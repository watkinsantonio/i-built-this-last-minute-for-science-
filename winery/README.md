# Winery Finder

Find wineries near you, read reviews, and post your own rating. Zero dependencies (Node 18+).

## Run

    npm run start:winery            # http://localhost:8090  (or: node winery/server.js 3000)

Open it in a browser, then click **Use my location** or type a city/ZIP. (Browsers only allow
geolocation on `localhost` or HTTPS.)

## Features

- Nearest wineries, sorted by distance (haversine), with a radius filter.
- Reviews with a 1-5 star rating and a comment; average rating and review count per winery.
- **Find more nearby** imports wineries from OpenStreetMap (Overpass API). City/ZIP search uses Nominatim.
  Both need internet; the rest of the app works offline with 12 seeded wineries (coordinates are approximate).
- Add your own winery (name + coordinates).

## Data

Saved as JSON in `winery/data/winery.json` (git-ignored; override with `WINERY_DATA=/path/file.json`).
Delete the file to reset to the seed data.

## API

- `GET /api/wineries?lat&lng&radius&limit&q` - nearest first when lat/lng given, otherwise top rated
- `GET /api/wineries/:id` - winery + reviews
- `POST /api/wineries` - `{name, address?, website?, description?, lat, lng}`
- `POST /api/wineries/:id/reviews` - `{author, rating 1-5, comment?}`
- `POST /api/discover` - `{lat, lng, radiusMiles?}` import from OpenStreetMap
- `GET /api/geocode?q=` - place name/ZIP to coordinates

## Limits

No user accounts: the review "name" is just text anyone can type, and there is no spam protection or
moderation. Add authentication before exposing this to the public internet.

## Tests

`npm test` (runs `winery/winery.test.js` along with the MathPath tests).
