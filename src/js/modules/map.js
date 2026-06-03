const YANDEX_MAPS_API_KEY = "4b85df55-35b1-4c23-8034-e5e8e6e58e52";
const YANDEX_MAPS_LANG = "ru_RU";
const MAP_SCRIPT_URL = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_MAPS_API_KEY}&lang=${YANDEX_MAPS_LANG}`;
const MAP_OBSERVER_ROOT_MARGIN = "200px";

const MAP_SELECTOR = "[data-map]";

const getIconParams = () => {
	const width = window.innerWidth;
	let size = [66, 74];

	if (width <= 767) {
		size = [50, 56];
	} else if (width <= 1024) {
		size = [43, 48];
	}

	return {
		size,
		offset: [-(size[0] / 2), -size[1]],
	};
};

const parseCoords = (rawCoords) => {
	if (!rawCoords) return null;

	const coords = rawCoords.split(",").map((item) => parseFloat(item.trim()));

	if (coords.length !== 2 || coords.some(Number.isNaN)) {
		return null;
	}

	return coords;
};

const loadYandexMapsScript = () =>
	new Promise((resolve, reject) => {
		if (typeof ymaps !== "undefined") {
			ymaps.ready(resolve);
			return;
		}

		const existingScript = document.querySelector(`script[src^="https://api-maps.yandex.ru/2.1/"]`);

		if (existingScript) {
			existingScript.addEventListener("load", () => ymaps.ready(resolve), { once: true });
			existingScript.addEventListener("error", reject, { once: true });
			return;
		}

		const script = document.createElement("script");
		script.src = MAP_SCRIPT_URL;
		script.type = "text/javascript";
		script.async = true;
		script.onload = () => ymaps.ready(resolve);
		script.onerror = reject;
		document.head.appendChild(script);
	});

const initMap = (mapContainer) => {
	const coords = parseCoords(mapContainer.dataset.coords);
	const zoom = parseInt(mapContainer.dataset.zoom, 10);
	const iconPath = mapContainer.dataset.icon;

	if (!coords || Number.isNaN(zoom)) {
		return;
	}

	const iconParams = getIconParams();

	const map = new ymaps.Map(mapContainer, {
		center: coords,
		zoom,
		controls: ["zoomControl"],
	});

	map.behaviors.disable("scrollZoom");

	const placemarkOptions = {};

	if (iconPath) {
		Object.assign(placemarkOptions, {
			iconLayout: "default#image",
			iconImageHref: iconPath,
			iconImageSize: iconParams.size,
			iconImageOffset: iconParams.offset,
		});
	}

	const placemark = new ymaps.Placemark(coords, {}, placemarkOptions);

	map.geoObjects.add(placemark);
	mapContainer.classList.add("_is-loaded");
};

const observeMap = (mapContainer) => {
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;

				loadYandexMapsScript()
					.then(() => initMap(mapContainer))
					.catch(() => {
						mapContainer.classList.add("_is-error");
					});

				observer.unobserve(entry.target);
			});
		},
		{ rootMargin: MAP_OBSERVER_ROOT_MARGIN },
	);

	observer.observe(mapContainer);
};

export const initYandexMaps = () => {
	document.querySelectorAll(MAP_SELECTOR).forEach(observeMap);
};
