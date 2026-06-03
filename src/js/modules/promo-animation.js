const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

function runIntro(element, keyframes, options) {
	return element.animate(keyframes, { fill: "forwards", ...options }).finished;
}

function setParallaxTransform(element, y, x = 0, scale = 1, centerY = false) {
	const yPart = centerY ? `calc(-50% + ${y}px)` : `${y}px`;
	const xPart = x ? `${x}px` : "0";
	element.style.transform = `translate(${xPart}, ${yPart}) scale(${scale})`;
}

export function initPromoAnimation() {
	const section = document.querySelector(".promo");
	if (!section) return;

	const plane = section.querySelector(".promo__plane");
	const cloudLeft = section.querySelector(".promo__cloud--left");
	const cloudRight = section.querySelector(".promo__cloud--right");

	if (!plane) return;

	const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	if (prefersReducedMotion) {
		section.classList.remove("promo--pending");
		section.classList.add("promo--ready");
		return;
	}

	const layers = [
		{ el: cloudLeft, speedY: 0.12, speedX: -0.04, centerY: true },
		{ el: cloudRight, speedY: 0.18, speedX: 0.05, centerY: true },
		{ el: plane, speedY: -0.32, speedX: 0.02, centerY: false },
	].filter((layer) => layer.el);

	if (!section.classList.contains("promo--pending")) {
		section.classList.add("promo--pending");
	}

	const introPromises = [];

	if (cloudLeft) {
		introPromises.push(
			runIntro(
				cloudLeft,
				[
					{ transform: "translate(-28vw, -50%) scale(0.55)", opacity: 0 },
					{ transform: "translate(0, -50%) scale(1)", opacity: 1 },
				],
				{ duration: 1500, easing: EASE_OUT, delay: 0 },
			),
		);
	}

	if (cloudRight) {
		introPromises.push(
			runIntro(
				cloudRight,
				[
					{ transform: "translate(22vw, -50%) scale(0.55)", opacity: 0 },
					{ transform: "translate(0, -50%) scale(1)", opacity: 1 },
				],
				{ duration: 1400, easing: EASE_OUT, delay: 120 },
			),
		);
	}

	introPromises.push(
		runIntro(
			plane,
			[
				{ transform: "translate(58vw, 6vh) scale(0.1)", opacity: 0.55 },
				{ transform: "translate(0, 0) scale(1)", opacity: 1 },
			],
			{ duration: 1850, easing: EASE_OUT, delay: 280 },
		),
	);

	let parallaxActive = false;
	let ticking = false;

	const updateParallax = () => {
		if (!parallaxActive) return;

		const rect = section.getBoundingClientRect();
		const height = section.offsetHeight || 1;
		const progress = Math.min(Math.max(-rect.top / height, 0), 1);
		const range = Math.min(height * 0.28, 220);

		layers.forEach(({ el, speedY, speedX, centerY }) => {
			const y = progress * range * speedY;
			const x = progress * range * speedX;
			setParallaxTransform(el, y, x, 1, centerY);
		});

		ticking = false;
	};

	const onScroll = () => {
		if (!parallaxActive || ticking) return;
		ticking = true;
		requestAnimationFrame(updateParallax);
	};

	Promise.all(introPromises)
		.then(() => {
			layers.forEach(({ el, centerY }) => {
				el.getAnimations().forEach((anim) => anim.cancel());
				if (centerY) {
					el.style.transform = "translate(0, -50%) scale(1)";
				} else {
					el.style.transform = "translate(0, 0) scale(1)";
				}
				el.style.opacity = "";
			});

			section.classList.remove("promo--pending");
			section.classList.add("promo--ready");

			parallaxActive = true;
			updateParallax();
			window.addEventListener("scroll", onScroll, { passive: true });
			window.addEventListener("resize", onScroll, { passive: true });
		})
		.catch(() => {
			section.classList.remove("promo--pending");
			section.classList.add("promo--ready");
		});
}
