const API_KEY = "24151734e6770b82ecc62ed4109992e2";
const BASE_URL = "https://api.openweathermap.org/data/2.5";
const GEO_URL = "https://api.openweathermap.org/geo/1.0/direct";
const HOME_CITY_QUERY = "Maceio,BR";

const LIST_CITIES = [
  "Maceio,BR",
  "Sao Paulo,BR",
  "Rio de Janeiro,BR",
  "Recife,BR",
  "Salvador,BR",
  "Lisbon,PT",
  "London,GB",
  "Toronto,CA",
  "Dubai,AE",
  "Bangkok,TH"
];

const phone = document.querySelector(".phone");
const addButton = document.querySelector(".add-button");
const listOpenTrigger = document.querySelector(".list-open-trigger");
const listCloseTrigger = document.querySelector(".list-close-trigger");
const cityNameEl = document.querySelector(".city-name");
const temperatureEl = document.querySelector(".temperature");
const weatherDescEl = document.querySelector(".weather-desc");
const highLowEls = document.querySelectorAll(".high-low span");
const hourlyScrollEl = document.querySelector(".hourly-scroll");
const cityCardsEl = document.querySelector(".city-cards");
const searchInputEl = document.querySelector(".list-search");
const statusTimes = document.querySelectorAll(".status-time");
const addedCityKeys = new Set();

let searchTimer = null;

addButton.addEventListener("click", () => {
  phone.classList.toggle("panel-open");
});

listOpenTrigger.addEventListener("click", () => {
  phone.classList.add("list-open");
});

listCloseTrigger.addEventListener("click", () => {
  phone.classList.remove("list-open");
});

function iconSvg(main) {
  const weather = String(main || "").toLowerCase();
  if (weather.includes("tornado")) {
    return '<img src="Tornado.png" alt="Tornado">';
  }
  if (weather.includes("rain") || weather.includes("drizzle") || weather.includes("thunder")) {
    return '<img src="Sun cloud mid rain.png" alt="Rain">';
  }
  if (weather.includes("cloud") || weather.includes("mist") || weather.includes("fog")) {
    return '<img src="Moon cloud fast wind.png" alt="Moon">';
  }
  return '<img src="Sun cloud mid rain.png" alt="Sun">';
}

function safeCap(text) {
  const value = String(text || "").trim();
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatTemp(value) {
  return `${Math.round(value)}°`;
}

function hourLabelFromUnix(unix, timezoneOffsetSeconds) {
  const date = new Date((unix + timezoneOffsetSeconds) * 1000);
  let hour = date.getUTCHours();
  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour} ${period}`;
}

function setStatusTime() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const current = `${hh}:${mm}`;
  statusTimes.forEach((el) => {
    el.textContent = current;
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchCurrentByQuery(query) {
  const url = `${BASE_URL}/weather?q=${encodeURIComponent(query)}&units=metric&appid=${API_KEY}&lang=pt_br`;
  return fetchJson(url);
}

async function fetchCurrentByCoords(lat, lon) {
  const url = `${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}&lang=pt_br`;
  return fetchJson(url);
}

async function fetchForecastByQuery(query) {
  const url = `${BASE_URL}/forecast?q=${encodeURIComponent(query)}&units=metric&appid=${API_KEY}&lang=pt_br`;
  return fetchJson(url);
}

async function fetchForecastByCoords(lat, lon) {
  const url = `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}&lang=pt_br`;
  return fetchJson(url);
}

async function fetchGeoByQuery(query) {
  const url = `${GEO_URL}?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`;
  return fetchJson(url);
}

function dateKeyFromUnix(unix, timezoneOffsetSeconds) {
  const d = new Date((unix + timezoneOffsetSeconds) * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getHomeHighLow(current, forecast) {
  const timezone = forecast.city?.timezone || 0;
  const targetDay = dateKeyFromUnix(current.dt, timezone);
  const dayItems = (forecast.list || []).filter(
    (item) => dateKeyFromUnix(item.dt, timezone) === targetDay
  );

  if (!dayItems.length) {
    return {
      high: current.main?.temp_max ?? current.main?.temp,
      low: current.main?.temp_min ?? current.main?.temp
    };
  }

  const highs = dayItems.map((item) => item.main?.temp_max ?? item.main?.temp ?? -1000);
  const lows = dayItems.map((item) => item.main?.temp_min ?? item.main?.temp ?? 1000);
  highs.push(current.main?.temp_max ?? current.main?.temp ?? -1000);
  lows.push(current.main?.temp_min ?? current.main?.temp ?? 1000);

  return {
    high: Math.max(...highs),
    low: Math.min(...lows)
  };
}

function getForecastDayHighLow(forecast, timezoneOffsetSeconds = 0, targetUnix = null) {
  const items = forecast.list || [];
  if (!items.length) {
    return { high: null, low: null };
  }

  const baseUnix = targetUnix ?? items[0].dt;
  const targetDay = dateKeyFromUnix(baseUnix, timezoneOffsetSeconds);
  const dayItems = items.filter((item) => dateKeyFromUnix(item.dt, timezoneOffsetSeconds) === targetDay);
  const source = dayItems.length ? dayItems : items;

  const highs = source.map((item) => item.main?.temp_max ?? item.main?.temp ?? -1000);
  const lows = source.map((item) => item.main?.temp_min ?? item.main?.temp ?? 1000);

  return {
    high: Math.max(...highs),
    low: Math.min(...lows)
  };
}

function renderHome(current, forecast) {
  const range = getHomeHighLow(current, forecast);
  cityNameEl.textContent = `${current.name}, ${current.sys.country}`;
  temperatureEl.textContent = formatTemp(current.main.temp);
  weatherDescEl.textContent = safeCap(current.weather?.[0]?.description || "");
  if (highLowEls[0]) highLowEls[0].textContent = `H:${formatTemp(range.high)}`;
  if (highLowEls[1]) highLowEls[1].textContent = `L:${formatTemp(range.low)}`;
}

function renderHourly(current, forecast) {
  const timezone = forecast.city?.timezone || 0;
  const items = forecast.list || [];
  const cards = [];

  if (items[0]) {
    cards.push({
      time: hourLabelFromUnix(items[0].dt, timezone),
      temp: items[0].main?.temp,
      main: items[0].weather?.[0]?.main || "Clouds"
    });
  }

  cards.push({
    time: "Now",
    temp: current.main?.temp,
    main: current.weather?.[0]?.main || "Clear"
  });

  items.slice(1, 10).forEach((item) => {
    cards.push({
      time: hourLabelFromUnix(item.dt, timezone),
      temp: item.main?.temp,
      main: item.weather?.[0]?.main || "Clouds"
    });
  });

  hourlyScrollEl.innerHTML = cards
    .map(
      (card) =>
        `<div class="hour-card"><div class="hour-time">${card.time}</div><div class="hour-icon">${iconSvg(card.main)}</div><div class="hour-temp">${formatTemp(card.temp)}</div></div>`
    )
    .join("");
}

function cityCardMarkup(data, extraSearch = "", range = null) {
  const cityCountry = `${data.name}, ${data.sys.country}`;
  const weatherText = safeCap(data.weather?.[0]?.description || "");
  const key = normalizeText(cityCountry);
  const searchValue = normalizeText(`${cityCountry} ${data.sys.country} ${weatherText} ${extraSearch}`);
  const high = range?.high ?? data.main.temp_max;
  const low = range?.low ?? data.main.temp_min;
  return `<div class="city-card" data-key="${key}" data-city="${searchValue}"><div class="card-left"><div class="card-temp">${formatTemp(
    data.main.temp
  )}</div><div class="card-range">H:${formatTemp(high)} L:${formatTemp(low)}</div><div class="card-city">${cityCountry}</div></div><div class="card-right"><div class="card-weather-icon">${iconSvg(
    data.weather?.[0]?.main || "Clouds"
  )}</div><div class="card-weather-text">${weatherText}</div></div></div>`;
}

function applyLocalFilter(term) {
  const normalized = normalizeText(term);
  const cards = cityCardsEl.querySelectorAll(".city-card");
  cards.forEach((card) => {
    const city = card.getAttribute("data-city") || "";
    card.style.display = !normalized || city.includes(normalized) ? "flex" : "none";
  });
}

function prependUniqueCityCard(data, extraSearch = "", range = null) {
  const cityCountry = `${data.name}, ${data.sys.country}`;
  const key = normalizeText(cityCountry);
  if (addedCityKeys.has(key)) {
    const existing = cityCardsEl.querySelector(`.city-card[data-key="${key}"]`);
    if (existing) {
      existing.outerHTML = cityCardMarkup(data, extraSearch, range);
    }
    return;
  }
  addedCityKeys.add(key);
  cityCardsEl.insertAdjacentHTML("afterbegin", cityCardMarkup(data, extraSearch, range));
}

async function fetchAndAddCityBySearch(term) {
  const query = normalizeText(term);
  if (query.length < 2) return;

  const geoResults = await fetchGeoByQuery(term);
  if (!Array.isArray(geoResults) || !geoResults.length) return;

  const weatherResults = await Promise.all(
    geoResults.slice(0, 4).map(async (geo) => {
      try {
        const [weather, forecast] = await Promise.all([
          fetchCurrentByCoords(geo.lat, geo.lon),
          fetchForecastByCoords(geo.lat, geo.lon)
        ]);
        const range = getForecastDayHighLow(
          forecast,
          forecast.city?.timezone || 0,
          weather.dt
        );
        const geoSearch = `${geo.name || ""} ${geo.state || ""} ${geo.country || ""} ${term}`;
        return { weather, geoSearch, range };
      } catch {
        return null;
      }
    })
  );

  weatherResults.filter(Boolean).forEach(({ weather, geoSearch, range }) => {
    prependUniqueCityCard(weather, geoSearch, range);
  });
}

function bindSearch() {
  searchInputEl.addEventListener("input", () => {
    const term = searchInputEl.value;
    applyLocalFilter(term);

    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      try {
        await fetchAndAddCityBySearch(term);
        applyLocalFilter(term);
      } catch {
        applyLocalFilter(term);
      }
    }, 550);
  });

  searchInputEl.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const term = searchInputEl.value;
    try {
      await fetchAndAddCityBySearch(term);
      applyLocalFilter(term);
    } catch {
      applyLocalFilter(term);
    }
  });
}

async function renderCityList() {
  const responses = await Promise.all(
    LIST_CITIES.map(async (query) => {
      try {
        const [current, forecast] = await Promise.all([
          fetchCurrentByQuery(query),
          fetchForecastByQuery(query)
        ]);
        const range = getForecastDayHighLow(
          forecast,
          forecast.city?.timezone || 0,
          current.dt
        );
        return { current, range };
      } catch {
        return null;
      }
    })
  );

  const validCities = responses.filter(Boolean);
  cityCardsEl.innerHTML = validCities
    .map(({ current, range }) => cityCardMarkup(current, "", range))
    .join("");
  validCities.forEach(({ current }) => {
    addedCityKeys.add(normalizeText(`${current.name}, ${current.sys.country}`));
  });
}

async function initWeather() {
  setStatusTime();
  setInterval(setStatusTime, 30000);

  try {
    const [current, forecast] = await Promise.all([
      fetchCurrentByQuery(HOME_CITY_QUERY),
      fetchForecastByQuery(HOME_CITY_QUERY)
    ]);
    renderHome(current, forecast);
    renderHourly(current, forecast);
  } catch {
    cityNameEl.textContent = "Maceio, BR";
    weatherDescEl.textContent = "Sem dados";
  }

  try {
    await renderCityList();
  } catch {
    cityCardsEl.innerHTML = "";
  }

  bindSearch();
}

initWeather();
