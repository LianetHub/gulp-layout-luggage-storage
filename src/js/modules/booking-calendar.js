import { Calendar } from 'vanilla-calendar-pro';

const DEFAULT_LABEL = 'Другая дата';

let calendarInstance = null;
let pickerEl = null;
let otherChipEl = null;
let otherLabelEl = null;
let dateValueInput = null;
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

export function initBookingCalendar({ onDatePick } = {}) {
    pickerEl = document.getElementById('booking-date-picker');
    const calendarMount = document.getElementById('booking-date-picker-inner');
    if (!pickerEl || !calendarMount) return;

    const dateGroup = document.querySelector('[data-booking-chips="date"]');
    otherChipEl = dateGroup?.querySelector('[data-value="other"]');
    otherLabelEl = otherChipEl?.querySelector('.booking__date-other-label');
    dateValueInput = document.getElementById('booking-date-value');
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
        },
    });

    calendarInstance.init();
    hideBookingCalendar();
}

export function showBookingCalendar() {
    if (!pickerEl) return;
    pickerEl.classList.add('is-open');
    pickerEl.removeAttribute('hidden');
    otherChipEl?.setAttribute('aria-expanded', 'true');
}

export function hideBookingCalendar() {
    if (!pickerEl) return;
    pickerEl.classList.remove('is-open');
    pickerEl.setAttribute('hidden', '');
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
