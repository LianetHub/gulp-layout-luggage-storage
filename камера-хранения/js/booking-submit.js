(function () {
	"use strict";

	const endpoint = "booking-send.php";

	function ready(callback) {
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", callback);
		} else {
			callback();
		}
	}

	function getPhoneDigits(value) {
		return value.replace(/\D/g, "");
	}

	function isPhoneValid(value) {
		const digits = getPhoneDigits(value);
		if (digits.length < 11) return false;
		const normalized = digits[0] === "8" ? "7" + digits.slice(1) : digits;
		return normalized[0] === "7" && normalized.length === 11;
	}

	function setFieldError(input, hasError) {
		if (!input) return;
		input.classList.toggle("_error", hasError);
		input.setAttribute("aria-invalid", hasError ? "true" : "false");
		input.closest(".booking__field")?.classList.toggle("_error", hasError);
	}

	function setCheckboxError(input, hasError) {
		if (!input) return;
		input.classList.toggle("_error", hasError);
		input.closest(".checkbox")?.classList.toggle("_error", hasError);
	}

	function focusFirstError(form) {
		const target = form.querySelector(".booking__field._error .form__control") || form.querySelector(".checkbox._error .checkbox__input") || form.querySelector("._error");
		if (!target) return;
		target.focus({ preventScroll: true });
		target.closest(".booking__field, .checkbox")?.scrollIntoView({ behavior: "smooth", block: "center" });
	}

	function showStatus(form, message, isError) {
		let status = form.querySelector(".form__status");
		if (!status) {
			status = document.createElement("p");
			status.className = "form__status booking__status";
			status.setAttribute("role", "status");
			form.querySelector(".booking__footer")?.append(status);
		}
		status.textContent = message;
		status.hidden = !message;
		status.classList.toggle("form__status--error", Boolean(isError));
	}

	function validate(form) {
		let valid = true;
		const nameInput = form.querySelector('[name="name"]');
		const phoneInput = form.querySelector('[name="phone"]');
		const agreeInput = form.querySelector('[name="agree"]');

		if (!nameInput?.value.trim()) {
			setFieldError(nameInput, true);
			valid = false;
		} else {
			setFieldError(nameInput, false);
		}

		if (!isPhoneValid(phoneInput?.value || "")) {
			setFieldError(phoneInput, true);
			valid = false;
		} else {
			setFieldError(phoneInput, false);
		}

		if (agreeInput && !agreeInput.checked) {
			setCheckboxError(agreeInput, true);
			valid = false;
		} else if (agreeInput) {
			setCheckboxError(agreeInput, false);
		}

		return valid;
	}

	function ensureHidden(form, name) {
		let input = form.querySelector('[name="' + name + '"]');
		if (!input) {
			input = document.createElement("input");
			input.type = "hidden";
			input.name = name;
			form.append(input);
		}
		return input;
	}

	async function loadCaptcha(form) {
		const input = ensureHidden(form, "booking_captcha");
		if (input.value) return input.value;

		const response = await fetch(endpoint + "?action=captcha", {
			method: "GET",
			credentials: "same-origin",
			headers: { "Accept": "application/json" },
		});
		const data = await response.json();
		if (!response.ok || !data.success || !data.token) {
			throw new Error(data.message || "Не удалось подготовить защитный код.");
		}
		input.value = data.token;
		return input.value;
	}

	function collectItems() {
		return Array.from(document.querySelectorAll("#booking-counters .booking__counter")).map((counter) => ({
			name: counter.dataset.name || counter.querySelector(".booking__counter-name")?.textContent?.trim() || "",
			qty: Number(counter.querySelector("[data-qty]")?.textContent || 0),
			price: Number(counter.dataset.price || 0),
		}));
	}

	function getTotalQty(items) {
		return items.reduce((sum, item) => sum + item.qty, 0);
	}

	function resetBookingForm(form) {
		form.reset();
		window.location.reload();
	}

	ready(() => {
		const form = document.getElementById("booking-form");
		if (!form) return;

		form.action = endpoint;
		form.method = "post";
		ensureHidden(form, "booking_captcha");
		ensureHidden(form, "items_json");
		const website = ensureHidden(form, "website");
		website.tabIndex = -1;
		website.autocomplete = "off";

		const phoneInput = form.querySelector('[name="phone"]');
		phoneInput?.addEventListener("focus", () => {
			loadCaptcha(form).catch(() => {});
		}, { once: true });

		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			event.stopImmediatePropagation();
			showStatus(form, "", false);

			if (!validate(form)) {
				showStatus(form, "Проверьте поля формы и номер телефона.", true);
				focusFirstError(form);
				return;
			}

			const items = collectItems();
			if (getTotalQty(items) <= 0) {
				showStatus(form, "Выберите хотя бы одну единицу багажа.", true);
				document.getElementById("booking-counters")?.scrollIntoView({ behavior: "smooth", block: "center" });
				return;
			}

			const submit = form.querySelector('[type="submit"]');
			const itemsInput = ensureHidden(form, "items_json");
			itemsInput.value = JSON.stringify(items);

			try {
				await loadCaptcha(form);
				submit && (submit.disabled = true);
				showStatus(form, "Отправляем заявку...", false);

				const response = await fetch(endpoint, {
					method: "POST",
					body: new FormData(form),
					credentials: "same-origin",
					headers: { "Accept": "application/json" },
				});
				const data = await response.json();

				if (!response.ok || !data.success) {
					throw new Error(data.message || "Не удалось отправить заявку.");
				}

				showStatus(form, "", false);
				if (typeof Fancybox !== "undefined") {
					Fancybox.show([{ src: "#form-success", type: "inline" }], { dragToClose: false });
				}
				setTimeout(() => resetBookingForm(form), 15000);
			} catch (error) {
				ensureHidden(form, "booking_captcha").value = "";
				showStatus(form, error.message || "Не удалось отправить заявку. Попробуйте позже.", true);
			} finally {
				submit && (submit.disabled = false);
			}
		}, true);
	});
})();

