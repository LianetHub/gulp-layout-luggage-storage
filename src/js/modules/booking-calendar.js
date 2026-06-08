import { Calendar } from 'vanilla-calendar-pro';

const DEFAULT_LABEL = 'Другая дата';

let calendarInstance = null;
let popupEl = null;
let otherChipEl = null;
let otherLabelEl = null;
let dateValueInput = null;
let headerMonthEl = null;
let onDatePickCallback = null;

export function formatBookingDate(iso) {
	if (!iso) return '';
	const [year, month, day] = iso.split('-');
	return `${day}.${month}.${year.slice(-2)}`;
}

function getDefaultLabel() {
	return otherLabelEl?.dataset.defaultLabel || DEFAULT_LABEL;
}

function applyPickedDate(iso, display) {
	if (otherLabelEl) otherLabelEl.textContent = display;
	if (dateValueInput) dateValueInput.value = iso;
}

function syncHeaderMonth(self = calendarInstance) {
	if (!headerMonthEl || !self) return;
	const { selectedMonth, selectedYear, locale } = self.context;
	headerMonthEl.textContent = `${locale.months.long[selectedMonth]} ${selectedYear}`;
}

function changeMonth(delta) {
	if (!calendarInstance) return;

	let { selectedMonth, selectedYear } = calendarInstance.context;
	selectedMonth += delta;

	if (selectedMonth > 11) {
		selectedMonth = 0;
		selectedYear += 1;
	} else if (selectedMonth < 0) {
		selectedMonth = 11;
		selectedYear -= 1;
	}

	calendarInstance.set({ selectedMonth, selectedYear }, { dates: true });
	syncHeaderMonth();
}

export function initBookingCalendar({ onDatePick } = {}) {
	popupEl = document.getElementById('booking-date-popup');
	const calendarMount = document.getElementById('booking-date-picker-inner');
	if (!popupEl || !calendarMount) return;

	const dateGroup = document.querySelector('[data-booking-chips="date"]');
	otherChipEl = dateGroup?.querySelector('[data-value="other"]');
	otherLabelEl = otherChipEl?.querySelector('.booking__date-other-label');
	dateValueInput = document.getElementById('booking-date-value');
	headerMonthEl = popupEl.querySelector('[data-calendar-month]');
	onDatePickCallback = onDatePick;

	calendarInstance = new Calendar(calendarMount, {
		inputMode: false,
		locale: 'ru',
		firstWeekday: 1,
		selectionDatesMode: 'single',
		disableDatesPast: true,
		selectedTheme: 'light',
		themeAttrDetect: false,
		onClickDate(self, event) {
			const dateEl = event.target.closest('[data-vc-date]');
			const iso = dateEl?.dataset?.vcDate;
			if (!iso) return;

			const display = formatBookingDate(iso);
			applyPickedDate(iso, display);
			onDatePickCallback?.(iso, display);
			hideBookingCalendar();
		},
		onUpdate(self) {
			syncHeaderMonth(self);
		},
	});

	calendarInstance.init();
	syncHeaderMonth();

	popupEl.querySelector('[data-calendar-prev]')?.addEventListener('click', () => changeMonth(-1));
	popupEl.querySelector('[data-calendar-next]')?.addEventListener('click', () => changeMonth(1));
}

export function showBookingCalendar() {
	if (typeof Fancybox === 'undefined') return;

	Fancybox.show(
		[
			{
				src: '#booking-date-popup',
				type: 'inline',
			},
		],
		{
			dragToClose: false,
			Carousel: {
				closeButton: false,
			},
		},
	);
	otherChipEl?.setAttribute('aria-expanded', 'true');
}

export function hideBookingCalendar() {
	if (typeof Fancybox !== 'undefined' && Fancybox.getInstance()) {
		Fancybox.close();
	}
	otherChipEl?.setAttribute('aria-expanded', 'false');
}

export function resetBookingCalendar() {
	if (calendarInstance) {
		calendarInstance.set({ selectedDates: [] }, { dates: true });
	}

	if (otherLabelEl) otherLabelEl.textContent = getDefaultLabel();
	if (dateValueInput) dateValueInput.value = '';
}

export function getOtherDateLabel() {
	return otherLabelEl?.textContent?.trim() || DEFAULT_LABEL;
}

export function isOtherDatePicked() {
	return getOtherDateLabel() !== getDefaultLabel();
}
