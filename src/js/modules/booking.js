const BOOKING_TIME_MIN = 585;
const BOOKING_TIME_MAX = 1440;
const BOOKING_TIME_STEP = 15;
const BOOKING_TIME_DEFAULT = [BOOKING_TIME_MIN, 1050];
const BOOKING_DEFAULT_QTY = [3, 1, 0];

function formatRub(value) {
    return value.toLocaleString('ru-RU') + ' ₽';
}

function baggageUnitsLabel(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 14) return `${count} единиц багажа`;
    if (mod10 === 1) return `${count} единица багажа`;
    if (mod10 >= 2 && mod10 <= 4) return `${count} единицы багажа`;
    return `${count} единиц багажа`;
}

function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const min = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function decorateTimeHandles(sliderEl) {
    const labels = ['с', 'до'];
    sliderEl.querySelectorAll('.noUi-handle').forEach((handle, index) => {
        if (handle.querySelector('.booking__time-handle-label')) return;
        const label = document.createElement('span');
        label.className = 'booking__time-handle-label';
        label.textContent = labels[index] ?? '';
        label.setAttribute('aria-hidden', 'true');
        handle.appendChild(label);
    });
}

export function initBooking({ validateForm, showStatus } = {}) {
    const bookingForm = document.getElementById('booking-form');
    if (!bookingForm) return;

    const bookingTotalEl = document.getElementById('booking-total');
    const bookingCounters = document.getElementById('booking-counters');
    const bookingSummaryQty = document.getElementById('booking-summary-qty');
    const bookingSummaryList = document.getElementById('booking-summary-list');
    const bookingSummaryCalc = document.getElementById('booking-summary-calc');
    const bookingSummaryTime = document.getElementById('booking-summary-time');
    const bookingSummaryDate = document.getElementById('booking-summary-date');
    const bookingTimeFromOut = document.getElementById('booking-time-from');
    const bookingTimeToOut = document.getElementById('booking-time-to');
    const bookingTimeFromInput = document.getElementById('booking-time-from-value');
    const bookingTimeToInput = document.getElementById('booking-time-to-value');
    const bookingTimeSlider = document.getElementById('booking-time-slider');
    const bookingStatus = document.getElementById('booking-status');

    let timeSlider = null;

    function updateBookingSummaryDate(chip) {
        if (!bookingSummaryDate || !chip) return;
        const label = chip.querySelector('.booking__date-card-label')?.textContent?.trim();
        const date = chip.querySelector('.booking__date-card-value')?.textContent?.trim();
        if (label && date) {
            bookingSummaryDate.innerHTML = `${label} <span>${date}</span>`;
            return;
        }
        if (chip.dataset.value === 'other') {
            bookingSummaryDate.textContent = 'Другая дата';
        }
    }

    function syncDateCardMarks(group) {
        group.querySelectorAll('.booking__date-card').forEach((card) => {
            const mark = card.querySelector('.booking__date-card-mark');
            if (!mark) return;
            mark.classList.toggle('booking__date-card-mark--check', card.classList.contains('is-active'));
        });
    }

    function updateBookingTimeRange(fromVal, toVal) {
        const fromTime = minutesToTime(fromVal);
        const toTime = minutesToTime(toVal);

        if (bookingTimeFromOut) bookingTimeFromOut.textContent = fromTime;
        if (bookingTimeToOut) bookingTimeToOut.textContent = toTime;
        if (bookingSummaryTime) {
            bookingSummaryTime.textContent = `С ${fromTime} до ${toTime}`;
        }
        if (bookingTimeFromInput) bookingTimeFromInput.value = String(fromVal);
        if (bookingTimeToInput) bookingTimeToInput.value = String(toVal);
    }

    function updateBookingTotal() {
        if (!bookingCounters || !bookingTotalEl) return;

        let total = 0;
        let totalQty = 0;
        const lines = [];

        bookingCounters.querySelectorAll('.booking__counter').forEach((row) => {
            const price = Number(row.dataset.price) || 0;
            const name = row.dataset.name || row.querySelector('.booking__counter-name')?.textContent?.trim() || '';
            const qtyEl = row.querySelector('[data-qty]');
            const qty = Number(qtyEl?.textContent) || 0;
            total += price * qty;
            totalQty += qty;
            if (qty > 0) {
                lines.push({ name, qty, price });
            }
        });

        bookingTotalEl.textContent = formatRub(total);

        if (bookingSummaryQty) {
            bookingSummaryQty.textContent = totalQty ? baggageUnitsLabel(totalQty) : '0 единиц багажа';
        }

        if (bookingSummaryList) {
            bookingSummaryList.innerHTML = lines
                .map(({ name, qty, price }) => `<li>${name} ${qty}шт. ${price} ₽/шт.</li>`)
                .join('');
        }

        if (bookingSummaryCalc) {
            const priced = lines.filter((item) => item.qty > 0);
            const samePrice = priced.length > 0 && priced.every((item) => item.price === priced[0].price);
            bookingSummaryCalc.textContent =
                samePrice && totalQty > 0 ? `${totalQty}шт. × ${priced[0].price} ₽` : '';
        }
    }

    function resetBookingCounters() {
        if (!bookingCounters) return;
        bookingCounters.querySelectorAll('[data-qty]').forEach((el, i) => {
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
        if (!bookingTimeSlider || typeof noUiSlider === 'undefined') return;

        noUiSlider.create(bookingTimeSlider, {
            start: BOOKING_TIME_DEFAULT,
            connect: true,
            step: BOOKING_TIME_STEP,
            margin: BOOKING_TIME_STEP,
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
        decorateTimeHandles(bookingTimeSlider);

        timeSlider.on('update', (values) => {
            updateBookingTimeRange(Number(values[0]), Number(values[1]));
        });
    }

    if (bookingCounters) {
        bookingCounters.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const row = btn.closest('.booking__counter');
            const qtyEl = row?.querySelector('[data-qty]');
            if (!qtyEl) return;
            let qty = Number(qtyEl.textContent) || 0;
            if (btn.dataset.action === 'inc') qty += 1;
            if (btn.dataset.action === 'dec') qty = Math.max(0, qty - 1);
            qtyEl.textContent = String(qty);
            updateBookingTotal();
        });
        updateBookingTotal();
    }

    document.querySelectorAll('[data-booking-chips="date"]').forEach((group) => {
        syncDateCardMarks(group);
        group.addEventListener('click', (e) => {
            const chip = e.target.closest('.booking__chip');
            if (!chip) return;
            group.querySelectorAll('.booking__chip').forEach((el) => el.classList.remove('is-active'));
            chip.classList.add('is-active');
            syncDateCardMarks(group);
            updateBookingSummaryDate(chip);
        });
    });

    initBookingTimeSlider();

    bookingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (validateForm && !validateForm(bookingForm)) {
            showStatus?.(bookingStatus, 'Укажите имя и корректный номер телефона (+7).', true);
            bookingForm.querySelector('._error')?.focus();
            return;
        }
        showStatus?.(bookingStatus, 'Заявка отправлена. Мы свяжемся с вами для подтверждения.', false);
        bookingForm.reset();
        resetBookingCounters();
        resetBookingTimeRange();
    });
}
