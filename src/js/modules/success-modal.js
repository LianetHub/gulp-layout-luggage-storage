export function openSuccessModal() {
	if (typeof Fancybox === "undefined") return;
	Fancybox.close(true);
	Fancybox.show([{ src: "#form-success", type: "inline" }], {
		dragToClose: false,
	});
}
