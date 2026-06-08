import { initBookingCalendar, showBookingCalendar, hideBookingCalendar, resetBookingCalendar, getOtherDateLabel, isOtherDatePicked } from "./booking-calendar.js";

const BOOKING_TIME_MIN = 540;
const BOOKING_TIME_MAX = 1440;
const BOOKING_TIME_STEP = 15;
const BOOKING_TIME_MIN_INTERVAL = 60;
const BOOKING_TIME_LABEL_FREEZE_PX = 200;
const BOOKING_TIME_DEFAULT = [BOOKING_TIME_MIN, 1050];
const BOOKING_DEFAULT_QTY = [3, 1, 0];

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
	const collapseSide = isCollapsed ? getHandleCollapseSide(sliderEl) : null;
	const collapseRight = collapseSide === "right";
	const collapseLeft = collapseSide === "left";
	const fromTime = minutesToTime(fromVal);
	const toTime = minutesToTime(toVal);

	lowerTime.classList.toggle("booking__time-handle-time--hidden", collapseRight);
	lowerTime.classList.toggle("booking__time-handle-time--combined", collapseLeft);
	upperTime.classList.toggle("booking__time-handle-time--hidden", collapseLeft);
	upperTime.classList.toggle("booking__time-handle-time--combined", collapseRight);

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

export function initBooking({ validateForm, showStatus } = {}) {
	const bookingForm = document.getElementById("booking-form");
	if (!bookingForm) return;

	const bookingTotalEl = document.getElementById("booking-total");
	const bookingCounters = document.getElementById("booking-counters");
	const bookingSummaryQty = document.getElementById("booking-summary-qty");
	const bookingSummaryList = document.getElementById("booking-summary-list");
	const bookingSummaryCalc = document.getElementById("booking-summary-calc");
	const bookingSummaryTime = document.getElementById("booking-summary-time");
	const bookingSummaryDate = document.getElementById("booking-summary-date");
	let bookingTimeFromOut = document.getElementById("booking-time-from");
	let bookingTimeToOut = document.getElementById("booking-time-to");
	const bookingTimeFromInput = document.getElementById("booking-time-from-value");
	const bookingTimeToInput = document.getElementById("booking-time-to-value");
	const bookingTimeSlider = document.getElementById("booking-time-slider");
	const bookingStatus = document.getElementById("booking-status");

	let timeSlider = null;

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
				bookingSummaryDate.innerHTML = `<span>${getOtherDateLabel()}</span>`;
			} else {
				bookingSummaryDate.textContent = getOtherDateLabel();
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
		if (bookingSummaryTime) {
			bookingSummaryTime.textContent = `С\u00A0${fromTime} до\u00A0${toTime}`;
		}
		if (bookingTimeFromInput) bookingTimeFromInput.value = String(fromVal);
		if (bookingTimeToInput) bookingTimeToInput.value = String(toVal);
	}

	function updateBookingTotal() {
		if (!bookingCounters || !bookingTotalEl) return;

		let total = 0;
		let totalQty = 0;
		const lines = [];

		bookingCounters.querySelectorAll(".booking__counter").forEach((row) => {
			const price = Number(row.dataset.price) || 0;
			const name = row.dataset.name || row.querySelector(".booking__counter-name")?.textContent?.trim() || "";
			const qtyEl = row.querySelector("[data-qty]");
			const qty = Number(qtyEl?.textContent) || 0;
			total += price * qty;
			totalQty += qty;
			if (qty > 0) {
				lines.push({ name, qty, price });
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
			bookingSummaryList.innerHTML = lines.map(({ name, qty, price }) => `<li>${name} ${qty}шт. ${price} ₽/шт.</li>`).join("");
		}

		if (bookingSummaryCalc) {
			const priced = lines.filter((item) => item.qty > 0);
			const samePrice = priced.length > 0 && priced.every((item) => item.price === priced[0].price);
			bookingSummaryCalc.textContent = samePrice && totalQty > 0 ? `${totalQty}шт. × ${priced[0].price} ₽` : "";
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
		syncTimeHandleProximity(bookingTimeSlider, BOOKING_TIME_DEFAULT[0], BOOKING_TIME_DEFAULT[1]);
		syncTimeHandleLabels(bookingTimeSlider, BOOKING_TIME_DEFAULT[0], BOOKING_TIME_DEFAULT[1]);
	}

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
			}

			updateBookingSummaryDate(chip);
		});
	});

	initBookingTimeSlider();

	bookingForm.addEventListener("submit", (e) => {
		e.preventDefault();
		if (validateForm && !validateForm(bookingForm)) {
			showStatus?.(bookingStatus, "Проверьте поля формы, номер телефона (+7) и\u00A0согласие на\u00A0обработку данных.", true);
			bookingForm.querySelector("._error")?.focus();
			return;
		}
		showStatus?.(bookingStatus, "Заявка отправлена. Мы свяжемся с\u00A0вами для\u00A0подтверждения.", false);
		bookingForm.reset();
		resetBookingCalendar();
		hideBookingCalendar();
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
	});
}
