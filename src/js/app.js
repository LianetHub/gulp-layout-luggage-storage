"use strict";

import { initPromoAnimation } from './modules/promo-animation.js';
import { initBooking } from './modules/booking.js';

// Инициализация Fancybox
if (typeof Fancybox !== "undefined" && Fancybox !== null) {
    Fancybox.bind("[data-fancybox]", {
        dragToClose: false,
        closeButton: false
    });
}

// Дожидаемся полной загрузки DOM перед выполнением скриптов
document.addEventListener("DOMContentLoaded", () => {

    // Объект для определения типа мобильного устройства на основе userAgent
    const isMobile = {
        Android: function () {
            return navigator.userAgent.match(/Android/i);
        },
        BlackBerry: function () {
            return navigator.userAgent.match(/BlackBerry/i);
        },
        iOS: function () {
            return navigator.userAgent.match(/iPhone|iPad|iPod/i);
        },
        Opera: function () {
            return navigator.userAgent.match(/Opera Mini/i);
        },
        Windows: function () {
            return navigator.userAgent.match(/IEMobile/i);
        },
        any: function () {
            return (
                isMobile.Android() ||
                isMobile.BlackBerry() ||
                isMobile.iOS() ||
                isMobile.Opera() ||
                isMobile.Windows());
        },
    };

    // Функция для определения типа устройства (мобильное/ПК) и добавления соответствующего класса к body
    function getNavigator() {
        if (isMobile.any() || window.innerWidth < 992) {
            document.body.classList.remove("_pc");
            document.body.classList.add("_touch");
        } else {
            document.body.classList.remove("_touch");
            document.body.classList.add("_pc");
        }
    }

    getNavigator();

    initPromoAnimation();

    window.addEventListener('resize', () => {
        getNavigator()
    });

    // Обработка полей ввода телефона
    var phoneInputs = document.querySelectorAll('input[type="tel"]');


    var getInputNumbersValue = function (input) {
        return input.value.replace(/\D/g, '');
    }
    var onPhonePaste = function (e) {
        var input = e.target,
            inputNumbersValue = getInputNumbersValue(input);
        var pasted = e.clipboardData || window.clipboardData;
        if (pasted) {
            var pastedText = pasted.getData('Text');
            if (/\D/g.test(pastedText)) {

                input.value = inputNumbersValue;
                return;
            }
        }
    }

    var onPhoneInput = function (e) {
        var input = e.target,
            inputNumbersValue = getInputNumbersValue(input),
            selectionStart = input.selectionStart,
            formattedInputValue = "";

        if (!inputNumbersValue) {
            return input.value = "";
        }

        if (input.value.length != selectionStart) {

            if (e.data && /\D/g.test(e.data)) {
                input.value = inputNumbersValue;
            }
            return;
        }

        // Форматирование номера телефона для российских номеров (+7 (XXX) XXX-XX-XX)
        if (["7", "8", "9"].indexOf(inputNumbersValue[0]) > -1) {
            if (inputNumbersValue[0] == "9") inputNumbersValue = "7" + inputNumbersValue;
            var firstSymbols = (inputNumbersValue[0] == "8") ? "8" : "+7";
            formattedInputValue = input.value = firstSymbols + " ";
            if (inputNumbersValue.length > 1) {
                formattedInputValue += '(' + inputNumbersValue.substring(1, 4);
            }
            if (inputNumbersValue.length >= 5) {
                formattedInputValue += ') ' + inputNumbersValue.substring(4, 7);
            }
            if (inputNumbersValue.length >= 8) {
                formattedInputValue += '-' + inputNumbersValue.substring(7, 9);
            }
            if (inputNumbersValue.length >= 10) {
                formattedInputValue += '-' + inputNumbersValue.substring(9, 11);
            }
        } else {
            // Для других номеров просто добавляем '+'
            formattedInputValue = '+' + inputNumbersValue.substring(0, 16);
        }
        input.value = formattedInputValue;
    }


    var onPhoneKeyDown = function (e) {

        var inputValue = e.target.value.replace(/\D/g, '');
        if (e.keyCode == 8 && inputValue.length == 1) {
            e.target.value = "";
        }
    }

    for (var phoneInput of phoneInputs) {
        phoneInput.addEventListener('keydown', onPhoneKeyDown);
        phoneInput.addEventListener('input', onPhoneInput, false);
        phoneInput.addEventListener('paste', onPhonePaste, false);
    }


    // Основной обработчик кликов для всей страницы
    document.addEventListener('click', (e) => {
        const target = e.target;

        if (target.closest('.icon-menu') || !target.closest('.header') && document.querySelector('.header').classList.contains('open-menu')) {
            toggleMenu();
        }


    });


    function toggleMenu() {
        const header = document.querySelector('.header');
        const toggler = header?.querySelector('.header__menu-toggler');
        header.classList.toggle('open-menu');
        const isOpen = header.classList.contains('open-menu');
        if (toggler) {
            toggler.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            toggler.setAttribute('aria-label', isOpen ? 'Закрыть меню' : 'Открыть меню');
        }
        toggleLocking();
    }

    function getPhoneDigits(value) {
        return value.replace(/\D/g, '');
    }

    function isPhoneValid(value) {
        const digits = getPhoneDigits(value);
        if (digits.length < 11) return false;
        const normalized = digits[0] === '8' ? '7' + digits.slice(1) : digits;
        return normalized[0] === '7' && normalized.length === 11;
    }

    function setFieldError(input, hasError) {
        if (!input) return;
        input.classList.toggle('_error', hasError);
        input.setAttribute('aria-invalid', hasError ? 'true' : 'false');
    }

    function showFormStatus(container, message, isError = false) {
        if (!container) return;
        container.textContent = message;
        container.hidden = !message;
        container.classList.toggle('booking__status--error', isError);
        container.classList.toggle('form__status--error', isError);
    }

    function validateBookingForm(form) {
        let valid = true;
        const nameInput = form.querySelector('[name="name"]');
        const phoneInput = form.querySelector('[name="phone"]');

        if (!nameInput?.value.trim()) {
            setFieldError(nameInput, true);
            valid = false;
        } else {
            setFieldError(nameInput, false);
        }

        if (!isPhoneValid(phoneInput?.value || '')) {
            setFieldError(phoneInput, true);
            valid = false;
        } else {
            setFieldError(phoneInput, false);
        }

        return valid;
    }

    function validatePopupForm(form) {
        let valid = true;
        const nameInput = form.querySelector('[name="name"]');
        const phoneInput = form.querySelector('[name="phone"]');
        const agreeInput = form.querySelector('[name="agree"]');
        const statusEl = form.querySelector('.form__status');

        showFormStatus(statusEl, '', false);

        if (!nameInput?.value.trim()) {
            setFieldError(nameInput, true);
            valid = false;
        } else {
            setFieldError(nameInput, false);
        }

        if (!isPhoneValid(phoneInput?.value || '')) {
            setFieldError(phoneInput, true);
            valid = false;
        } else {
            setFieldError(phoneInput, false);
        }

        if (agreeInput && !agreeInput.checked) {
            agreeInput.classList.add('_error');
            valid = false;
        } else if (agreeInput) {
            agreeInput.classList.remove('_error');
        }

        if (!valid) {
            showFormStatus(statusEl, 'Проверьте поля формы и номер телефона.', true);
        }

        return valid;
    }

    function openSuccessModal() {
        if (typeof Fancybox === 'undefined') return;
        Fancybox.close(true);
        Fancybox.show([{ src: '#form-success', type: 'inline' }], {
            dragToClose: false,
            closeButton: false,
        });
    }

    document.querySelectorAll('.booking__fields .form__control, .popup__form .form__control').forEach((input) => {
        input.addEventListener('input', () => setFieldError(input, false));
    });

    // Функция для блокировки/разблокировки прокрутки страницы
    function toggleLocking(lockClass) {
        const body = document.body;
        let className = lockClass ? lockClass : "lock";
        let pagePosition;

        if (body.classList.contains(className)) {

            pagePosition = parseInt(document.body.dataset.position, 10);
            body.dataset.position = pagePosition;
            body.style.top = -pagePosition + 'px';
        } else {

            pagePosition = window.scrollY;
            body.style.top = 'auto';
            window.scroll({ top: pagePosition, left: 0 });
            document.body.removeAttribute('data-position');
        }


        let lockPaddingValue = body.classList.contains(className)
            ? "0px"
            : window.innerWidth -
            document.querySelector(".wrapper").offsetWidth +
            "px";

        body.style.paddingRight = lockPaddingValue;
        body.classList.toggle(className);
    }


    //  Слайдеры (Swiper.js)
    class MobileSwiper {
        constructor(sliderName, options, condition = 767.98) {
            this.slider = document.querySelector(sliderName);
            this.options = options;
            this.init = false;
            this.swiper = null;
            this.condition = condition;

            if (this.slider) {
                this.handleResize();
                window.addEventListener("resize", () => this.handleResize());
            }
        }

        handleResize() {
            if (window.innerWidth <= this.condition) {
                if (!this.init) {
                    this.init = true;
                    this.swiper = new Swiper(this.slider, this.options);
                }
            } else if (this.init) {
                this.swiper.destroy();
                this.swiper = null;
                this.init = false;
            }
        }
    }

    initBooking({
        validateForm: validateBookingForm,
        showStatus: showFormStatus,
    });

    document.querySelectorAll('.popup__form').forEach((form) => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!validatePopupForm(form)) {
                form.querySelector('._error, [aria-invalid="true"]')?.focus();
                return;
            }
            form.reset();
            openSuccessModal();
        });
    });

    if (document.querySelector('.promo__slider')) {
        new Swiper('.promo__slider', {
            slidesPerView: 1,
            speed: 800,
            loop: true,
            autoplay: {
                delay: 15000,
                stopOnLastSlide: false,
            },
            effect: "fade",
            fadeEffect: {
                crossFade: true
            },
            navigation: {
                prevEl: '.promo__controls-prev',
                nextEl: '.promo__controls-next'
            },
            on: {
                init: (swiper) => {
                    const nextEl = swiper.navigation.nextEl;
                    let speed = swiper.params.speed;
                    let autoplaySpeed = swiper.params.autoplay.delay;
                    nextEl.style.setProperty('--counting-speed', ((speed + autoplaySpeed) / 1000) + 's');
                    nextEl.classList.add('counting');
                },
                slideChangeTransitionStart: (swiper) => {
                    const nextEl = swiper.navigation.nextEl;
                    nextEl.classList.remove('counting');
                    void nextEl.offsetWidth;
                    nextEl.classList.add('counting');
                }
            }
        })
    }

    if (document.querySelector('.cases__slider-block')) {
        new Swiper('.cases__slider-block', {
            spaceBetween: 15,
            slidesPerView: 1,

            watchSlidesProgress: true,
            navigation: {
                nextEl: ".cases__next",
                prevEl: ".cases__prev"
            },
            breakpoints: {
                991.98: {
                    slidesPerView: 2,
                    spaceBetween: 18,
                },
            }
        })
    }

    if (document.querySelector('.how-we-work__slider')) {
        new MobileSwiper('.how-we-work__slider', {
            slidesPerView: "auto",
            spaceBetween: 24,
            watchOverflow: true,
        })
    }

    if (document.querySelector('.tariffs__slider')) {


        new Swiper('.tariffs__slider', {
            slidesPerView: "auto",
            spaceBetween: 30,
            watchOverflow: true,
            autoHeight: true,
            pagination: {
                el: '.tariffs__slider-pagination',
                clickable: true,
            },
            breakpoints: {
                991.98: {
                    slidesPerView: 2,
                    autoHeight: false,
                },

                1279.98: {
                    slidesPerView: 3,
                    autoHeight: false,
                }
            },
        })

    }

    if (document.querySelectorAll('.service__gallery').length > 0) {
        document.querySelectorAll('.service__gallery').forEach(function (gallery) {

            const slider = gallery.querySelector('.service__slider');
            const prevBtn = gallery.querySelector('.service__prev');
            const nextBtn = gallery.querySelector('.service__next');

            new Swiper(slider, {
                slidesPerView: 1,
                speed: 800,
                loop: true,
                autoplay: {
                    delay: 20000,
                    stopOnLastSlide: false,
                },
                navigation: {
                    prevEl: prevBtn,
                    nextEl: nextBtn
                },
                on: {
                    init: (swiper) => {
                        const nextEl = swiper.navigation.nextEl;
                        let speed = swiper.params.speed;
                        let autoplaySpeed = swiper.params.autoplay.delay;
                        nextEl.style.setProperty('--counting-speed', ((speed + autoplaySpeed) / 1000) + 's');
                        nextEl.classList.add('counting');
                    },
                    slideChangeTransitionStart: (swiper) => {
                        const nextEl = swiper.navigation.nextEl;
                        nextEl.classList.remove('counting');
                        void nextEl.offsetWidth;
                        nextEl.classList.add('counting');
                    }
                }
            })

        })

    }

});