import {
	initBookingCalendar,
	showBookingCalendar,
	hideBookingCalendar,
	resetBookingCalendar,
	getOtherDateLabel,
	isOtherDatePicked,
	formatBookingDate,
} from "./booking-calendar.js";

const BOOKING_TIME_MIN = 540;
const BOOKING_TIME_MAX = 1440;
const BOOKING_TIME_STEP = 30;
const BOOKING_TIME_MIN_INTERVAL = 60;
const BOOKING_TIME_EVENING = 1140;
const BOOKING_TIME_HOURLY_START = 1080;
const BOOKING_HOURLY_RATE = 100;
const BOOKING_EVENING_SURCHARGE = 100;
const BOOKING_TARIFF_SHORT_MAX = 180;
const BOOKING_TIME_LABEL_FREEZE_PX = 200;
const BOOKING_TIME_LABEL_CENTER_EDGE = 0.1;
const BOOKING_TIME_DEFAULT = [BOOKING_TIME_MIN, 1050];
const BOOKING_DEFAULT_QTY = [0, 0, 0];
const BOOKING_OVERSIZED_PRICE = 800;

let todayISO = "";
let tomorrowISO = "";

function formatRub(value) {
	return value.toLocaleString("ru-RU") + " ₽";
}

function baggageUnitWord(count) {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod100 >= 11 && mod100 <= 14) return "единиц";
	if (mod10 === 1) return "единица";
	if (mod10 >= 2 && mod10 <= 4) return "единицы";
	return "единиц";
}

function minutesToTime(minutes) {
	const h = Math.floor(minutes / 60) % 24;
	const min = minutes % 60;
	return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function toISODate(date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function toDisplayDate(date) {
	return formatBookingDate(toISODate(date));
}

function getBaseTariff(duration) {
	if (duration <= BOOKING_TARIFF_SHORT_MAX) {
		return { theme: "pink", price: 200, badge: "200 ₽/ШТ." };
	}

	return { theme: "blue", price: 300, badge: "300 ₽/ШТ." };
}

function getHourlyBadge(isExactlyOneHour, price) {
	return isExactlyOneHour
		? `<span class="booking__badge-hour">НА ЧАС</span> ${BOOKING_HOURLY_RATE} ₽/ШТ.`
		: `${price} ₽/ШТ.`;
}

function getHourlyTariff(fromMin, toMin, theme = "purple") {
	const duration = toMin - fromMin;
	const hours = Math.ceil(duration / 60);
	const price = BOOKING_HOURLY_RATE * hours;
	const isExactlyOneHour = duration === 60;

	return {
		theme,
		price,
		badge: getHourlyBadge(isExactlyOneHour, price),
		badgeHtml: isExactlyOneHour,
		isHourly: isExactlyOneHour,
	};
}

function isHourlyAfterEvening(fromMin, toMin) {
	return fromMin >= BOOKING_TIME_EVENING || toMin > BOOKING_TIME_EVENING;
}

export function getTariff(fromMin, toMin) {
	const duration = toMin - fromMin;

	if (duration === 60) {
		return getHourlyTariff(fromMin, toMin, isHourlyAfterEvening(fromMin, toMin) ? "purple" : "pink");
	}

	if (fromMin >= BOOKING_TIME_HOURLY_START) {
		return getHourlyTariff(fromMin, toMin);
	}

	const base = getBaseTariff(duration);
	let price = base.price;
	let theme = base.theme;

	if (toMin > BOOKING_TIME_EVENING) {
		const extraHours = Math.ceil((toMin - BOOKING_TIME_EVENING) / 60);
		price = base.price + BOOKING_EVENING_SURCHARGE * extraHours;
		theme = "purple";
		return { theme, price, badge: `${price} ₽/ШТ.`, isHourly: false };
	}

	return { theme, price, badge: base.badge, isHourly: false };
}

function resolveTariff(fromMin, toMin) {
	return getTariff(fromMin, toMin);
}

function getTimeHandleWidth(sliderEl) {
	const handle = sliderEl.querySelector(".noUi-handle");
	return handle ? handle.getBoundingClientRect().width : 44;
}

function getHandleCenters(sliderEl) {
	const handles = sliderEl.querySelectorAll(".noUi-handle");
	if (handles.length < 2) return null;

	const lowerRect = handles[0].getBoundingClientRect();
	const upperRect = handles[1].getBoundingClientRect();

	return {
		lower: lowerRect.left + lowerRect.width / 2,
		upper: upperRect.left + upperRect.width / 2,
	};
}

function getHandlePixelDistance(sliderEl) {
	const centers = getHandleCenters(sliderEl);
	if (!centers) return Infinity;

	return centers.upper - centers.lower;
}

function getHandleCollapseSide(sliderEl) {
	const centers = getHandleCenters(sliderEl);
	if (!centers) return "right";

	const sliderRect = sliderEl.getBoundingClientRect();
	const midpoint = (centers.lower + centers.upper) / 2;

	return midpoint - sliderRect.left >= sliderRect.width / 2 ? "right" : "left";
}

function getHandleCollapseZone(sliderEl) {
	const centers = getHandleCenters(sliderEl);
	if (!centers) return "right";

	const sliderRect = sliderEl.getBoundingClientRect();
	const relativeMid = ((centers.lower + centers.upper) / 2 - sliderRect.left) / sliderRect.width;

	if (relativeMid < BOOKING_TIME_LABEL_CENTER_EDGE) return "left";
	if (relativeMid > 1 - BOOKING_TIME_LABEL_CENTER_EDGE) return "right";
	return "center";
}

function syncTimeHandleProximity(sliderEl, fromVal, toVal) {
	const sliderWidth = sliderEl.getBoundingClientRect().width;
	const handleWidth = getTimeHandleWidth(sliderEl);
	const range = BOOKING_TIME_MAX - BOOKING_TIME_MIN;
	const pixelDist = ((toVal - fromVal) / range) * sliderWidth;

	sliderEl.classList.toggle("booking__time-slider--close", pixelDist < handleWidth);
}

function syncTimeHandleLabels(sliderEl, fromVal, toVal) {
	const handles = sliderEl.querySelectorAll(".noUi-handle");
	const lowerTime = handles[0]?.querySelector(".booking__time-handle-time");
	const upperTime = handles[1]?.querySelector(".booking__time-handle-time");

	if (!lowerTime || !upperTime) return;

	const isCollapsed = getHandlePixelDistance(sliderEl) <= BOOKING_TIME_LABEL_FREEZE_PX;
	const collapseZone = isCollapsed ? getHandleCollapseZone(sliderEl) : null;
	const collapseSide =
		isCollapsed && collapseZone !== "center" ? collapseZone : isCollapsed ? getHandleCollapseSide(sliderEl) : null;
	const collapseRight = collapseSide === "right";
	const collapseLeft = collapseSide === "left";
	const isCenterZone = collapseZone === "center";
	const fromTime = minutesToTime(fromVal);
	const toTime = minutesToTime(toVal);

	lowerTime.classList.toggle("booking__time-handle-time--hidden", collapseRight);
	lowerTime.classList.toggle("booking__time-handle-time--combined", collapseLeft);
	lowerTime.classList.toggle("booking__time-handle-time--center", isCenterZone && collapseLeft);
	upperTime.classList.toggle("booking__time-handle-time--hidden", collapseLeft);
	upperTime.classList.toggle("booking__time-handle-time--combined", collapseRight);
	upperTime.classList.toggle("booking__time-handle-time--center", isCenterZone && collapseRight);

	if (isCenterZone) {
		const centers = getHandleCenters(sliderEl);
		const rangeMid = (centers.lower + centers.upper) / 2;
		const anchorCenter = collapseRight ? centers.upper : centers.lower;
		const offset = rangeMid - anchorCenter;
		const activeTime = collapseRight ? upperTime : lowerTime;

		activeTime.style.setProperty("--time-label-offset", `${offset}px`);
		(collapseRight ? lowerTime : upperTime).style.removeProperty("--time-label-offset");
	} else {
		lowerTime.style.removeProperty("--time-label-offset");
		upperTime.style.removeProperty("--time-label-offset");
	}

	if (collapseRight) {
		const fromOutput = upperTime.querySelector(".booking__time-output--from");
		const toOutput = upperTime.querySelector(".booking__time-output--to");

		if (fromOutput) fromOutput.textContent = fromTime;
		if (toOutput) toOutput.textContent = toTime;
	}

	if (collapseLeft) {
		const fromOutput = lowerTime.querySelector(".booking__time-output");
		const toOutput = lowerTime.querySelector(".booking__time-output--to");

		if (fromOutput) fromOutput.textContent = fromTime;
		if (toOutput) toOutput.textContent = toTime;
	}
}

function decorateTimeHandles(sliderEl) {
	const prefixes = ["с", "до"];
	const outputIds = ["booking-time-from", "booking-time-to"];
	const outputs = [];

	sliderEl.querySelectorAll(".noUi-handle").forEach((handle, index) => {
		if (handle.classList.contains("booking__time-handle--ready")) return;

		const prefix = prefixes[index] ?? "";
		handle.classList.add("booking__time-handle--ready");
		handle.textContent = "";

		const visual = document.createElement("span");
		visual.className = "booking__time-handle-visual";
		visual.setAttribute("aria-hidden", "true");

		const timeEl = document.createElement("span");
		timeEl.className = "booking__time-handle-time";

		const prefixEl = document.createElement("span");
		prefixEl.className = "booking__time-prefix";
		prefixEl.textContent = prefix;

		const output = document.createElement("output");
		output.className = index === 1 ? "booking__time-output booking__time-output--to" : "booking__time-output";
		output.id = outputIds[index] ?? "";

		const dot = document.createElement("span");
		dot.className = "booking__time-handle-dot";

		const pin = document.createElement("span");
		pin.className = "booking__time-handle-pin";
		pin.innerHTML = `<span class="booking__time-handle-pin-text">${prefix}</span>`;

		const touchArea = document.createElement("div");
		touchArea.className = "noUi-touch-area";

		if (index === 0) {
			const toPrefixEl = document.createElement("span");
			toPrefixEl.className = "booking__time-prefix booking__time-prefix--to";
			toPrefixEl.textContent = "до";

			const toOutput = document.createElement("output");
			toOutput.className = "booking__time-output booking__time-output--to";

			timeEl.append(prefixEl, output, toPrefixEl, toOutput);
		} else {
			const fromPrefixEl = document.createElement("span");
			fromPrefixEl.className = "booking__time-prefix booking__time-prefix--from";
			fromPrefixEl.textContent = "с";

			const fromOutput = document.createElement("output");
			fromOutput.className = "booking__time-output booking__time-output--from";

			timeEl.append(fromPrefixEl, fromOutput, prefixEl, output);
		}
		visual.append(timeEl, dot, pin);
		handle.append(visual, touchArea);
		outputs.push(output);
	});

	return outputs;
}

export function initBooking({ validateForm, onSuccess, onValidationFail } = {}) {
	const bookingForm = document.getElementById("booking-form");
	if (!bookingForm) return;

	const bookingTotalEl = document.getElementById("booking-total");
	const bookingCounters = document.getElementById("booking-counters");
	const bookingSummaryQty = document.getElementById("booking-summary-qty");
	const bookingSummaryList = document.getElementById("booking-summary-list");
	const bookingSummaryCalc = document.getElementById("booking-summary-calc");
	const bookingSummaryTime = document.getElementById("booking-summary-time");
	const bookingSummaryDate = document.getElementById("booking-summary-date");
	const bookingTariffBadge = document.getElementById("booking-tariff-badge");
	const bookingTimeGroup = bookingForm.querySelector(".booking__group--time");
	const bookingDateValue = document.getElementById("booking-date-value");
	let bookingTimeFromOut = document.getElementById("booking-time-from");
	let bookingTimeToOut = document.getElementById("booking-time-to");
	const bookingTimeFromMobile = document.getElementById("booking-time-from-mobile");
	const bookingTimeToMobile = document.getElementById("booking-time-to-mobile");
	const bookingTimeFromInput = document.getElementById("booking-time-from-value");
	const bookingTimeToInput = document.getElementById("booking-time-to-value");
	const bookingTimeSlider = document.getElementById("booking-time-slider");

	let timeSlider = null;
	let currentFromVal = BOOKING_TIME_DEFAULT[0];
	let currentToVal = BOOKING_TIME_DEFAULT[1];
	let currentTariff = resolveTariff(BOOKING_TIME_DEFAULT[0], BOOKING_TIME_DEFAULT[1]);

	function initBookingDates() {
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		todayISO = toISODate(today);
		tomorrowISO = toISODate(tomorrow);

		const todayChip = document.querySelector('[data-booking-chips="date"] [data-value="today"]');
		const tomorrowChip = document.querySelector('[data-booking-chips="date"] [data-value="tomorrow"]');

		[todayChip, tomorrowChip].forEach((chip, index) => {
			const date = index === 0 ? today : tomorrow;
			const timeEl = chip?.querySelector(".booking__date-card-value");
			if (!timeEl) return;
			timeEl.dateTime = toISODate(date);
			timeEl.textContent = toDisplayDate(date);
		});

		const activeChip = document.querySelector('[data-booking-chips="date"] .booking__chip.is-active');
		if (activeChip) {
			syncStorageDate(activeChip);
			updateBookingSummaryDate(activeChip);
		}
	}

	function syncStorageDate(chip) {
		if (!bookingDateValue || !chip) return;

		if (chip.dataset.value === "today") {
			bookingDateValue.value = todayISO;
			return;
		}

		if (chip.dataset.value === "tomorrow") {
			bookingDateValue.value = tomorrowISO;
		}
	}

	function updateBookingSummaryDate(chip) {
		if (!bookingSummaryDate || !chip) return;

		const label = chip.querySelector(".booking__date-card-label")?.textContent?.trim();
		const date = chip.querySelector(".booking__date-card-value")?.textContent?.trim();
		if (label && date) {
			bookingSummaryDate.innerHTML = `${label} <span>${date}</span>`;
			return;
		}
		if (chip.dataset.value === "other") {
			if (isOtherDatePicked()) {
				bookingSummaryDate.innerHTML = `Другая дата <span>${getOtherDateLabel()}</span>`;
			} else {
				bookingSummaryDate.textContent = "Другая дата";
			}
		}
	}

	function syncDateCardMarks(group) {
		group.querySelectorAll(".booking__date-card").forEach((card) => {
			const mark = card.querySelector(".booking__date-card-mark");
			if (!mark) return;
			mark.classList.toggle("booking__date-card-mark--check", card.classList.contains("is-active"));
		});
	}

	function updateBookingTimeRange(fromVal, toVal) {
		const fromTime = minutesToTime(fromVal);
		const toTime = minutesToTime(toVal);

		if (bookingTimeFromOut) bookingTimeFromOut.textContent = fromTime;
		if (bookingTimeToOut) bookingTimeToOut.textContent = toTime;
		if (bookingTimeFromMobile) bookingTimeFromMobile.textContent = fromTime;
		if (bookingTimeToMobile) bookingTimeToMobile.textContent = toTime;
		if (bookingSummaryTime) {
			bookingSummaryTime.textContent = `С\u00A0${fromTime} до\u00A0${toTime}`;
		}
		if (bookingTimeFromInput) bookingTimeFromInput.value = String(fromVal);
		if (bookingTimeToInput) bookingTimeToInput.value = String(toVal);
		if (bookingTimeGroup) {
			bookingTimeGroup.classList.remove("booking__group--daily");
		}
	}

	function renderTariffBadge(tariff, tariffChanged) {
		if (!bookingTariffBadge) return;

		if (tariff.badgeHtml) {
			bookingTariffBadge.innerHTML = tariff.badge;
		} else {
			bookingTariffBadge.textContent = tariff.badge;
		}

		if (tariffChanged) {
			bookingTariffBadge.classList.remove("booking__badge--pulse");
			void bookingTariffBadge.offsetWidth;
			bookingTariffBadge.classList.add("booking__badge--pulse");
		}
	}

	function updateBookingTariff(fromVal, toVal) {
		currentFromVal = fromVal;
		currentToVal = toVal;

		const tariff = resolveTariff(fromVal, toVal);
		const tariffChanged =
			!currentTariff ||
			currentTariff.theme !== tariff.theme ||
			currentTariff.price !== tariff.price ||
			currentTariff.isHourly !== tariff.isHourly;

		if (bookingTimeGroup) bookingTimeGroup.dataset.tariff = tariff.theme;
		renderTariffBadge(tariff, tariffChanged);

		currentTariff = tariff;
		updateBookingTotal();
	}

	function refreshBookingTariff() {
		updateBookingTariff(currentFromVal, currentToVal);
	}

	function updateBookingTotal() {
		if (!bookingCounters || !bookingTotalEl) return;

		let total = 0;
		let totalQty = 0;
		const lines = [];

		bookingCounters.querySelectorAll(".booking__counter").forEach((row) => {
			const isOversized = row.hasAttribute("data-oversized");
			const isTariffItem = row.hasAttribute("data-tariff-item");
			const price = isOversized ? BOOKING_OVERSIZED_PRICE : isTariffItem ? currentTariff.price : Number(row.dataset.price) || 0;
			const name = row.dataset.name || row.querySelector(".booking__counter-name")?.textContent?.trim() || "";
			const qtyEl = row.querySelector("[data-qty]");
			const qty = Number(qtyEl?.textContent) || 0;
			const priceEl = row.querySelector(".booking__counter-price");

			if (isTariffItem) {
				row.dataset.price = String(price);
				if (priceEl) priceEl.textContent = `${price} ₽/ШТ.`;
			} else if (isOversized) {
				row.dataset.price = String(BOOKING_OVERSIZED_PRICE);
				if (priceEl) priceEl.textContent = `${BOOKING_OVERSIZED_PRICE} ₽/ШТ.`;
			}

			total += price * qty;
			totalQty += qty;
			if (qty > 0) {
				lines.push({ name, qty, price, isOversized });
			}
		});

		bookingTotalEl.textContent = formatRub(total);

		if (bookingSummaryQty) {
			const countEl = bookingSummaryQty.querySelector("[data-qty-count]");
			const unitEl = bookingSummaryQty.querySelector("[data-qty-unit]");
			if (countEl && unitEl) {
				countEl.textContent = String(totalQty);
				unitEl.textContent = totalQty ? baggageUnitWord(totalQty) : "единиц";
			}
		}

		if (bookingSummaryList) {
			bookingSummaryList.innerHTML = lines.map(({ name, qty, price }) => `<li>${name} ${qty}шт.: ${price} ₽/ШТ.</li>`).join("");
		}

		if (bookingSummaryCalc) {
			const tariffLines = lines.filter((item) => !item.isOversized);
			const oversizedLines = lines.filter((item) => item.isOversized);
			const calcParts = [];

			if (tariffLines.length > 0) {
				const tariffQty = tariffLines.reduce((sum, item) => sum + item.qty, 0);
				const sameTariffPrice = tariffLines.every((item) => item.price === tariffLines[0].price);
				if (sameTariffPrice) {
					calcParts.push(`${tariffQty}шт. × ${tariffLines[0].price} ₽`);
				}
			}

			oversizedLines.forEach((item) => {
				calcParts.push(`${item.qty}шт. × ${item.price} ₽`);
			});

			bookingSummaryCalc.innerHTML = calcParts.map((line) => `<span>${line}</span>`).join("");
		}
	}

	function resetBookingCounters() {
		if (!bookingCounters) return;
		bookingCounters.querySelectorAll("[data-qty]").forEach((el, i) => {
			el.textContent = String(BOOKING_DEFAULT_QTY[i] ?? 0);
		});
		updateBookingTotal();
	}

	function resetBookingTimeRange() {
		if (timeSlider) {
			timeSlider.set(BOOKING_TIME_DEFAULT);
			return;
		}
		updateBookingTimeRange(BOOKING_TIME_DEFAULT[0], BOOKING_TIME_DEFAULT[1]);
		updateBookingTariff(BOOKING_TIME_DEFAULT[0], BOOKING_TIME_DEFAULT[1]);
	}

	function initBookingTimeSlider() {
		if (!bookingTimeSlider || typeof noUiSlider === "undefined") return;

		noUiSlider.create(bookingTimeSlider, {
			start: BOOKING_TIME_DEFAULT,
			connect: true,
			step: BOOKING_TIME_STEP,
			margin: BOOKING_TIME_MIN_INTERVAL,
			range: {
				min: BOOKING_TIME_MIN,
				max: BOOKING_TIME_MAX,
			},
			format: {
				to: (value) => Math.round(value),
				from: (value) => Number(value),
			},
		});

		timeSlider = bookingTimeSlider.noUiSlider;
		const timeOutputs = decorateTimeHandles(bookingTimeSlider);
		if (timeOutputs[0]) bookingTimeFromOut = timeOutputs[0];
		if (timeOutputs[1]) bookingTimeToOut = timeOutputs[1];

		timeSlider.on("update", (values) => {
			const fromVal = Number(values[0]);
			const toVal = Number(values[1]);
			updateBookingTimeRange(fromVal, toVal);
			updateBookingTariff(fromVal, toVal);
			syncTimeHandleProximity(bookingTimeSlider, fromVal, toVal);
			syncTimeHandleLabels(bookingTimeSlider, fromVal, toVal);
		});

		const syncHandleLayout = () => {
			const [fromVal, toVal] = timeSlider.get().map(Number);
			syncTimeHandleProximity(bookingTimeSlider, fromVal, toVal);
			syncTimeHandleLabels(bookingTimeSlider, fromVal, toVal);
		};

		window.addEventListener("resize", syncHandleLayout);
		updateBookingTimeRange(BOOKING_TIME_DEFAULT[0], BOOKING_TIME_DEFAULT[1]);
		updateBookingTariff(BOOKING_TIME_DEFAULT[0], BOOKING_TIME_DEFAULT[1]);
		syncTimeHandleProximity(bookingTimeSlider, BOOKING_TIME_DEFAULT[0], BOOKING_TIME_DEFAULT[1]);
		syncTimeHandleLabels(bookingTimeSlider, BOOKING_TIME_DEFAULT[0], BOOKING_TIME_DEFAULT[1]);
	}

	initBookingDates();

	if (bookingCounters) {
		bookingCounters.addEventListener("click", (e) => {
			const btn = e.target.closest("[data-action]");
			if (!btn) return;
			const row = btn.closest(".booking__counter");
			const qtyEl = row?.querySelector("[data-qty]");
			if (!qtyEl) return;
			let qty = Number(qtyEl.textContent) || 0;
			if (btn.dataset.action === "inc") qty += 1;
			if (btn.dataset.action === "dec") qty = Math.max(0, qty - 1);
			qtyEl.textContent = String(qty);
			updateBookingTotal();
		});
		updateBookingTotal();
	}

	initBookingCalendar({
		onDatePick: () => {
			const otherChip = document.querySelector('[data-booking-chips="date"] [data-value="other"]');
			if (otherChip) updateBookingSummaryDate(otherChip);
			updateBookingTimeRange(currentFromVal, currentToVal);
			refreshBookingTariff();
		},
	});

	document.querySelectorAll('[data-booking-chips="date"]').forEach((group) => {
		syncDateCardMarks(group);
		group.addEventListener("click", (e) => {
			const chip = e.target.closest(".booking__chip");
			if (!chip) return;
			group.querySelectorAll(".booking__chip").forEach((el) => el.classList.remove("is-active"));
			chip.classList.add("is-active");
			syncDateCardMarks(group);

			if (chip.dataset.value === "other") {
				showBookingCalendar();
			} else {
				resetBookingCalendar();
				hideBookingCalendar();
				syncStorageDate(chip);
			}

			updateBookingSummaryDate(chip);
			updateBookingTimeRange(currentFromVal, currentToVal);
			refreshBookingTariff();
		});
	});

	initBookingTimeSlider();

	bookingForm.addEventListener("submit", (e) => {
		e.preventDefault();
		if (validateForm && !validateForm(bookingForm)) {
			onValidationFail?.(bookingForm);
			return;
		}
		bookingForm.reset();
		resetBookingCalendar();
		hideBookingCalendar();
		initBookingDates();
		const todayChip = document.querySelector('[data-booking-chips="date"] [data-value="today"]');
		if (todayChip) {
			document.querySelectorAll('[data-booking-chips="date"] .booking__chip').forEach((el) => {
				el.classList.remove("is-active");
			});
			todayChip.classList.add("is-active");
			syncDateCardMarks(document.querySelector('[data-booking-chips="date"]'));
			updateBookingSummaryDate(todayChip);
		}
		resetBookingCounters();
		resetBookingTimeRange();
		onSuccess?.();
	});
}
